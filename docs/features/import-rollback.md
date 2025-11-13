# Import Rollback (Undo) Feature - Documentation

## Overview

The **Import Rollback** feature allows users to completely undo an import batch, deleting all imported transactions and allowing checkpoints to automatically recalculate.

---

## How It Works

### **Rollback Flow:**

```
User completes import (Step 4: Results)
   ↓
Sees "Rollback Import" button
   ↓
Clicks "Rollback Import"
   ↓
Confirmation dialog appears:
   - Shows number of transactions to be deleted
   - Warns about permanent deletion
   - "This action cannot be undone"
   ↓
User confirms "Yes, Rollback Import"
   ↓
System executes rollback:
   1. Deletes ALL transactions with this import_batch_id
   2. Marks import_batch status as 'rolled_back'
   3. Checkpoint auto-recalculates (via trigger from migration 004)
   ↓
Dialog closes, account refreshes
   ↓
✅ All imported transactions removed
✅ Checkpoints recalculated automatically
✅ Balance back to pre-import state
```

---

## Files Modified/Created

### **1. New API Endpoint: `/api/import-batches/[batchId]/route.ts`**

**GET /api/import-batches/[batchId]**
- Returns import batch details
- Shows current transaction count
- Used for verification

**DELETE /api/import-batches/[batchId]**
- **Rollback endpoint**
- Deletes all transactions with `import_batch_id = batchId`
- Updates import_batch status to `'rolled_back'`
- Records rollback details in `error_log`

**Process:**
1. Verify batch exists and not already rolled back
2. Count transactions before deletion
3. Delete all transactions (triggers checkpoint recalculation automatically)
4. Update batch status to 'rolled_back'
5. Return success with deletion count

**Response:**
```json
{
  "success": true,
  "message": "Successfully rolled back import batch 123",
  "data": {
    "batch_id": 123,
    "account_id": 45,
    "transactions_deleted": 157,
    "file_name": "techcombank_nov_2024.csv",
    "import_date": "2024-11-05T10:30:00Z"
  }
}
```

**Error Cases:**
- Batch not found → 404
- Already rolled back → 400 "This import has already been rolled back"
- No transactions found → 404 "No transactions found for this import batch"
- Database error → 500

---

### **2. Updated UI: `components/bank-import-dialog.tsx`**

**New States:**
```typescript
const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)
const [isRollingBack, setIsRollingBack] = useState(false)
```

**New Function: `handleRollback()`**
```typescript
async function handleRollback() {
  setIsRollingBack(true)

  const response = await fetch(
    `/api/import-batches/${importResult.importSummary.importBatchId}`,
    { method: 'DELETE' }
  )

  if (response.ok) {
    onSuccess()  // Refresh account data
    onOpenChange(false)  // Close dialog
  }

  setIsRollingBack(false)
}
```

**Step 4 UI Additions:**

1. **Rollback Button Section:**
```tsx
<div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
  <div className="flex items-center justify-between">
    <div>
      <p>Need to undo this import?</p>
      <p className="text-xs">
        This will delete all {successfulImports} imported transactions.
        Checkpoints will automatically recalculate.
      </p>
    </div>
    <Button variant="destructive" onClick={() => setRollbackConfirmOpen(true)}>
      Rollback Import
    </Button>
  </div>
</div>
```

2. **Confirmation Dialog:**
```tsx
{rollbackConfirmOpen && (
  <div className="fixed inset-0 z-50 bg-black/50">
    <div className="bg-white rounded-lg p-6">
      <AlertCircle className="h-6 w-6 text-red-600" />
      <h3>Confirm Rollback</h3>
      <p>Are you sure? This will permanently delete:</p>
      <ul>
        <li>{successfulImports} imported transactions</li>
        <li>Import batch will be marked as "rolled back"</li>
        <li>Checkpoints will auto-recalculate</li>
      </ul>
      <p className="text-red-600">This action cannot be undone.</p>

      <Button onClick={() => setRollbackConfirmOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleRollback}>
        Yes, Rollback Import
      </Button>
    </div>
  </div>
)}
```

---

## Database Changes

### **Import Batch Status Update:**

**Before Rollback:**
```sql
import_batch_id: 123
import_status: 'completed'
successful_records: 157
failed_records: 0
error_log: null
```

**After Rollback:**
```sql
import_batch_id: 123
import_status: 'rolled_back'  ← Changed
successful_records: 157
failed_records: 0
error_log: {
  "rolled_back_at": "2024-11-05T14:30:00Z",
  "transactions_deleted": 157,
  "reason": "User-initiated rollback"
}
```

### **Transactions Deleted:**
All transactions with `import_batch_id = 123` are permanently deleted.

### **Checkpoint Recalculation:**
The database trigger `transaction_checkpoint_recalc` (from migration 004) automatically fires on DELETE and recalculates affected checkpoints.

**Example:**
- **Before rollback:** Declared = 50M, Calculated = 63M (includes 13M import), Adjustment = -13M
- **After rollback:** Declared = 50M, Calculated = 50M (import deleted), Adjustment = 0M ✅ Reconciled!

---

## Use Cases

### **Use Case 1: Accidental Duplicate Import**

**Scenario:**
- John manually entered November transactions
- Then imported November bank statement (duplicates!)
- Checkpoint shows huge discrepancy

**Solution:**
1. Click "Rollback Import" in Step 4
2. Confirm rollback
3. All imported transactions deleted
4. Checkpoint recalculates (now reconciled with manual entries)
5. John can re-import after reviewing data

---

### **Use Case 2: Wrong File Uploaded**

**Scenario:**
- Sarah uploaded October statement instead of November
- Import completed successfully (500 transactions)
- Realized mistake

**Solution:**
1. Click "Rollback Import"
2. All 500 October transactions deleted
3. Upload correct November file
4. Import proceeds normally

---

### **Use Case 3: Incorrect Column Mapping**

**Scenario:**
- David mapped debit/credit columns backwards
- 200 transactions imported with reversed amounts
- Balances completely wrong

**Solution:**
1. Click "Rollback Import"
2. All 200 transactions deleted
3. Go back to import dialog
4. Upload same file with correct mappings
5. Import succeeds with correct data

---

### **Use Case 4: Testing/Demo**

**Scenario:**
- Demo environment needs to show import feature
- Import sample data for demonstration
- Need to clean up after demo

**Solution:**
1. Import sample CSV
2. Show features to stakeholders
3. Click "Rollback Import" to clean up
4. Environment restored to original state

---

## Safety Features

### **Confirmation Dialog:**
✅ Prevents accidental rollback
✅ Shows exact number of transactions to be deleted
✅ Clear warning: "This action cannot be undone"
✅ Two-step process (button → confirm)

### **Idempotency:**
✅ Cannot rollback twice
✅ API checks if already rolled back
✅ Returns 400 error: "This import has already been rolled back"

### **Batch Tracking:**
✅ Import batch status preserved (not deleted)
✅ Audit trail shows when/why rolled back
✅ Can query rolled-back imports for history

### **Automatic Recalculation:**
✅ Checkpoints auto-recalculate on transaction deletion
✅ No manual intervention needed
✅ System stays consistent

---

## What Rollback Does

### ✅ DOES:
- ✅ Deletes all transactions with this `import_batch_id`
- ✅ Marks import_batch as `'rolled_back'`
- ✅ Records rollback timestamp and count in `error_log`
- ✅ Triggers checkpoint recalculation automatically
- ✅ Refreshes account balance from checkpoints
- ✅ Closes import dialog and refreshes UI

### ❌ DOES NOT:
- ❌ Delete the import_batch record (preserved for history)
- ❌ Delete checkpoints (they recalculate automatically)
- ❌ Delete the uploaded CSV file (not stored)
- ❌ Affect other imports or manual transactions
- ❌ Allow "undo rollback" (permanent deletion)

---

## API Testing

### **Test Rollback:**
```bash
# Rollback import batch 123
curl -X DELETE http://localhost:3000/api/import-batches/123

# Expected response:
{
  "success": true,
  "message": "Successfully rolled back import batch 123",
  "data": {
    "batch_id": 123,
    "account_id": 45,
    "transactions_deleted": 157,
    "file_name": "techcombank_nov_2024.csv",
    "import_date": "2024-11-05T10:30:00Z"
  }
}
```

### **Test Double Rollback (Should Fail):**
```bash
# Try to rollback again
curl -X DELETE http://localhost:3000/api/import-batches/123

# Expected response (400 error):
{
  "error": "This import has already been rolled back"
}
```

### **Verify Transactions Deleted:**
```sql
-- Check original_transaction table
SELECT COUNT(*) FROM original_transaction
WHERE import_batch_id = 123;

-- Expected: 0 (all deleted)
```

### **Verify Batch Status:**
```sql
SELECT import_status, error_log FROM import_batch
WHERE import_batch_id = 123;

-- Expected:
-- import_status: 'rolled_back'
-- error_log: {"rolled_back_at": "...", "transactions_deleted": 157, ...}
```

---

## UI Flow Screenshots (Conceptual)

### **Step 4: Import Results (with Rollback)**

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Import Completed Successfully!                       │
│  157 of 157 transactions imported.                      │
└─────────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────┐
│  Import Statistics   │  Checkpoint Status   │
│  Total: 157          │  Declared: 50M       │
│  Successful: 157     │  Calculated: 63M     │
│  Failed: 0           │  Adjustment: -13M    │
│  Duplicates: 0       │  ⚠ Discrepancy       │
└──────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ⚠ Balance Discrepancy Detected                         │
│  Possible reasons:                                      │
│  • Duplicate transactions                               │
│  • Missing transactions                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Need to undo this import?                              │
│  This will delete all 157 imported transactions.        │
│  Checkpoints will automatically recalculate.            │
│                                    [Rollback Import]    │
└─────────────────────────────────────────────────────────┘

                        [Done]
```

### **Confirmation Dialog:**

```
┌─────────────────────────────────────────┐
│  ⚠  Confirm Rollback                    │
│                                         │
│  Are you sure? This will delete:        │
│  • 157 imported transactions            │
│  • Batch marked as "rolled back"        │
│  • Checkpoints auto-recalculate         │
│                                         │
│  ⚠ This action cannot be undone.        │
│                                         │
│        [Cancel]  [Yes, Rollback]        │
└─────────────────────────────────────────┘
```

---

## Future Enhancements

### **1. Import History View**
Show list of all imports (including rolled-back):
```
┌──────────────────────────────────────────────────────────┐
│  Import History                                          │
├──────────┬─────────────┬────────────┬────────────────────┤
│ Date     │ File        │ Txns       │ Status             │
├──────────┼─────────────┼────────────┼────────────────────┤
│ Nov 5    │ nov.csv     │ 157        │ ✓ Completed        │
│ Oct 28   │ oct.csv     │ 142        │ 🔄 Rolled Back     │
│ Oct 1    │ sep.csv     │ 139        │ ✓ Completed        │
└──────────┴─────────────┴────────────┴────────────────────┘
```

### **2. Partial Rollback**
Allow rolling back specific transactions (not entire batch):
- Checkbox to select transactions
- "Rollback Selected" button
- Keep non-duplicate transactions

### **3. Rollback Reason**
Add optional reason field:
```tsx
<Input placeholder="Reason for rollback (optional)" />
// Stored in error_log for audit trail
```

### **4. Batch Comparison**
Before rollback, show comparison:
- Original balance before import
- Balance after import
- Expected balance after rollback

---

## Summary

The Import Rollback feature provides:

✅ **One-Click Undo** - Reverse entire import in seconds
✅ **Safety Confirmation** - Prevents accidental deletions
✅ **Automatic Recalculation** - Checkpoints update instantly
✅ **Audit Trail** - Batch status preserved for history
✅ **Clean UI** - Integrated into Step 4 results
✅ **Error Prevention** - Cannot rollback twice

**Perfect for:**
- Accidental duplicate imports
- Wrong file uploads
- Incorrect column mappings
- Testing and demos
- Any import mistakes!

---

**Created:** November 5, 2025
**Status:** ✅ Complete
**Files:** 1 new API route, 1 modified component
**Lines of Code:** ~200 lines
