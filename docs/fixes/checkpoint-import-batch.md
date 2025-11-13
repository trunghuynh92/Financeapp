# Checkpoint-Import Batch Link - Migration 005

## Problem Identified

When rolling back an import, transactions are deleted but **checkpoints created by the import remain**, causing confusion.

### **Before Fix:**

**Import Flow:**
1. Import November statement (ending balance: 50M)
2. System creates checkpoint (Nov 30, declared = 50M, calculated = 63M)
3. ❌ **Checkpoint has NO link to import batch**

**Rollback Flow:**
1. User rolls back import
2. ✅ Transactions deleted (157 transactions)
3. ✅ Checkpoint recalculates → calculated drops to 0M
4. ❌ **Checkpoint still exists:** declared = 50M, calculated = 0M, adjustment = 50M
5. ❌ **User confused:** "Where did this 50M declared balance come from?"

---

## Solution: Migration 005

**Add `import_batch_id` column to `balance_checkpoints` table**

### **Database Change:**

```sql
ALTER TABLE balance_checkpoints
ADD COLUMN import_batch_id INTEGER NULL
REFERENCES import_batch(import_batch_id) ON DELETE SET NULL;
```

**Usage:**
- **Import-created checkpoints:** `import_batch_id = 123` (linked to import)
- **Manual checkpoints:** `import_batch_id = NULL` (created via UI button)

---

## Updated Flow

### **Import Flow:**

```sql
-- Import creates checkpoint WITH import_batch_id
INSERT INTO balance_checkpoints (
  account_id,
  checkpoint_date,
  declared_balance,
  import_batch_id,  ← LINKS TO IMPORT
  notes
) VALUES (
  45,
  '2024-11-30',
  50000000,
  123,  ← import_batch_id
  'Checkpoint for imported statement...'
);
```

### **Rollback Flow:**

```sql
-- Step 1: Delete checkpoint created by import
DELETE FROM balance_checkpoints
WHERE import_batch_id = 123;

-- Step 2: Delete transactions
DELETE FROM original_transaction
WHERE import_batch_id = 123;

-- Step 3: Mark batch as rolled back
UPDATE import_batch
SET import_status = 'rolled_back'
WHERE import_batch_id = 123;
```

**Result:**
- ✅ Checkpoint deleted (no orphaned checkpoint)
- ✅ Transactions deleted
- ✅ Other checkpoints recalculate automatically
- ✅ Clean state - no confusion!

---

## Code Changes

### **1. Migration SQL** (`migrations/005_add_import_batch_to_checkpoints.sql`)

```sql
ALTER TABLE balance_checkpoints
ADD COLUMN import_batch_id INTEGER NULL
REFERENCES import_batch(import_batch_id) ON DELETE SET NULL;

CREATE INDEX idx_checkpoints_import_batch
ON balance_checkpoints(import_batch_id);
```

### **2. Type Definition** (`types/checkpoint.ts`)

```typescript
export interface BalanceCheckpoint {
  checkpoint_id: number
  account_id: number
  checkpoint_date: string
  declared_balance: number
  calculated_balance: number
  adjustment_amount: number
  is_reconciled: boolean
  notes: string | null
  import_batch_id: number | null  // ← ADDED
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export interface CreateOrUpdateCheckpointParams {
  account_id: number
  checkpoint_date: Date
  declared_balance: number
  notes?: string | null
  import_batch_id?: number | null  // ← ADDED
  user_id?: number | null
}
```

### **3. Checkpoint Service** (`lib/checkpoint-service.ts`)

```typescript
export async function createOrUpdateCheckpoint(
  params: CreateOrUpdateCheckpointParams
): Promise<BalanceCheckpoint> {
  const {
    account_id,
    checkpoint_date,
    declared_balance,
    notes = null,
    import_batch_id = null,  // ← ADDED
    user_id = null,
  } = params

  // ... calculation ...

  const { data: created } = await supabase
    .from('balance_checkpoints')
    .insert({
      account_id,
      checkpoint_date: checkpoint_date.toISOString(),
      declared_balance,
      calculated_balance,
      adjustment_amount,
      is_reconciled,
      notes,
      import_batch_id,  // ← ADDED
      created_by_user_id: user_id,
    })
    .select()
    .single()

  return created
}
```

### **4. Import API** (`app/api/accounts/[id]/import/route.ts`)

```typescript
// Create checkpoint with import_batch_id link
const checkpoint = await createOrUpdateCheckpoint({
  account_id: accountId,
  checkpoint_date: checkpointDate,
  declared_balance: endingBalance,
  notes: `Checkpoint for imported statement...`,
  import_batch_id: importBatch.import_batch_id,  // ← ADDED
})
```

### **5. Rollback API** (`app/api/import-batches/[batchId]/route.ts`)

```typescript
// DELETE rollback endpoint

// Step 1: Delete checkpoint created by import
const { error: deleteCheckpointError } = await supabase
  .from('balance_checkpoints')
  .delete()
  .eq('import_batch_id', batchId)

if (deleteCheckpointError) {
  throw new Error(`Failed to delete checkpoint: ${deleteCheckpointError.message}`)
}

// Step 2: Delete transactions
const { error: deleteError } = await supabase
  .from('original_transaction')
  .delete()
  .eq('import_batch_id', batchId)

// Step 3: Update batch status
await supabase
  .from('import_batch')
  .update({ import_status: 'rolled_back' })
  .eq('import_batch_id', batchId)
```

---

## Scenarios

### **Scenario 1: Import → Rollback (Clean)**

**Import:**
```sql
-- Batch created
INSERT INTO import_batch (...) VALUES (...); -- batch_id = 123

-- Transactions created
INSERT INTO original_transaction (import_batch_id, ...) VALUES (123, ...); -- 157 rows

-- Checkpoint created
INSERT INTO balance_checkpoints (import_batch_id, ...) VALUES (123, ...);
```

**Rollback:**
```sql
-- Delete checkpoint (no orphans!)
DELETE FROM balance_checkpoints WHERE import_batch_id = 123; -- 1 row deleted

-- Delete transactions
DELETE FROM original_transaction WHERE import_batch_id = 123; -- 157 rows deleted

-- Mark batch
UPDATE import_batch SET import_status = 'rolled_back' WHERE import_batch_id = 123;
```

**Result:**
- Checkpoint: DELETED ✅
- Transactions: DELETED ✅
- Batch: Marked as rolled_back ✅
- State: Clean, no orphans ✅

---

### **Scenario 2: Manual Checkpoint (Not Affected)**

**User creates manual checkpoint:**
```sql
INSERT INTO balance_checkpoints (
  account_id,
  checkpoint_date,
  declared_balance,
  import_batch_id,  -- NULL for manual
  notes
) VALUES (
  45,
  '2024-10-31',
  40000000,
  NULL,  ← Manual checkpoint
  'End of October reconciliation'
);
```

**Import happens:**
```sql
-- Import creates its own checkpoint
INSERT INTO balance_checkpoints (..., import_batch_id) VALUES (..., 123);
```

**Rollback:**
```sql
-- Only deletes checkpoint with import_batch_id = 123
DELETE FROM balance_checkpoints WHERE import_batch_id = 123;
-- Manual checkpoint (import_batch_id = NULL) is NOT deleted ✅
```

**Result:**
- Manual checkpoint: KEPT ✅
- Import checkpoint: DELETED ✅
- Correct behavior!

---

### **Scenario 3: Multiple Imports, Different Dates**

**Import 1 (October statement):**
```sql
-- Batch 100
INSERT INTO balance_checkpoints (..., import_batch_id) VALUES (..., 100); -- Oct 31 checkpoint
```

**Import 2 (November statement):**
```sql
-- Batch 101
INSERT INTO balance_checkpoints (..., import_batch_id) VALUES (..., 101); -- Nov 30 checkpoint
```

**Rollback Import 2:**
```sql
DELETE FROM balance_checkpoints WHERE import_batch_id = 101; -- Only Nov 30 deleted
DELETE FROM original_transaction WHERE import_batch_id = 101;
```

**Result:**
- October checkpoint: KEPT ✅
- November checkpoint: DELETED ✅
- October transactions: KEPT ✅
- November transactions: DELETED ✅

---

## Foreign Key Behavior

**`ON DELETE SET NULL`:**

If an import_batch record is deleted (rare - usually just status changed):
```sql
DELETE FROM import_batch WHERE import_batch_id = 123;
```

Checkpoint's `import_batch_id` automatically becomes `NULL`:
```sql
-- Before
import_batch_id: 123

-- After DELETE
import_batch_id: NULL  ← Automatically set by FK constraint
```

**Why SET NULL instead of CASCADE:**
- We want to preserve checkpoints even if batch record deleted
- Checkpoints are reconciliation points, valuable for history
- User can still see and manage the checkpoint

---

## Migration Instructions

### **Step 1: Run Migration 005**

1. Open Supabase SQL Editor
2. Copy contents of `migrations/005_add_import_batch_to_checkpoints.sql`
3. Click "Run"
4. Verify output:
   ```
   ✅ Added import_batch_id column to balance_checkpoints
   ✅ Added foreign key to import_batch
   ✅ Created index on import_batch_id
   ```

### **Step 2: Verify Schema**

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'balance_checkpoints'
  AND column_name = 'import_batch_id';

-- Expected:
-- column_name: import_batch_id
-- data_type: integer
-- is_nullable: YES
```

### **Step 3: Verify Foreign Key**

```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'balance_checkpoints'
  AND kcu.column_name = 'import_batch_id';

-- Expected:
-- constraint_name: balance_checkpoints_import_batch_id_fkey
-- table_name: balance_checkpoints
-- column_name: import_batch_id
-- foreign_table_name: import_batch
-- foreign_column_name: import_batch_id
```

### **Step 4: Existing Data**

All existing checkpoints will have `import_batch_id = NULL`:
```sql
-- Check existing checkpoints
SELECT checkpoint_id, checkpoint_date, import_batch_id
FROM balance_checkpoints;

-- All will show:
-- import_batch_id: NULL  ← Existing checkpoints (created before migration)
```

**This is correct!** Existing checkpoints were manually created or created before this feature.

---

## Testing

### **Test 1: Import Creates Linked Checkpoint**

```typescript
// Import bank statement
const result = await importBankStatement(...)

// Verify checkpoint has import_batch_id
const checkpoint = await supabase
  .from('balance_checkpoints')
  .select('*')
  .eq('import_batch_id', result.importSummary.importBatchId)
  .single()

expect(checkpoint.import_batch_id).toBe(result.importSummary.importBatchId) ✅
```

### **Test 2: Manual Checkpoint Has NULL import_batch_id**

```typescript
// Create manual checkpoint
const checkpoint = await createOrUpdateCheckpoint({
  account_id: 45,
  checkpoint_date: new Date('2024-11-05'),
  declared_balance: 50000000,
  notes: 'Manual checkpoint',
  // import_batch_id NOT provided
})

expect(checkpoint.import_batch_id).toBeNull() ✅
```

### **Test 3: Rollback Deletes Import Checkpoint**

```typescript
// Import creates checkpoint
const importResult = await importBankStatement(...)
const checkpointId = importResult.checkpoint.checkpoint_id

// Rollback
await rollbackImport(importResult.importSummary.importBatchId)

// Verify checkpoint deleted
const checkpoint = await supabase
  .from('balance_checkpoints')
  .select('*')
  .eq('checkpoint_id', checkpointId)
  .maybeSingle()

expect(checkpoint).toBeNull() ✅
```

### **Test 4: Rollback Keeps Manual Checkpoints**

```typescript
// Create manual checkpoint
const manualCheckpoint = await createManualCheckpoint(...)

// Import and rollback
const importResult = await importBankStatement(...)
await rollbackImport(importResult.importSummary.importBatchId)

// Verify manual checkpoint still exists
const checkpoint = await supabase
  .from('balance_checkpoints')
  .select('*')
  .eq('checkpoint_id', manualCheckpoint.checkpoint_id)
  .single()

expect(checkpoint).not.toBeNull() ✅
```

---

## Summary

### **What Changed:**

1. ✅ Added `import_batch_id` column to `balance_checkpoints`
2. ✅ Updated types to include `import_batch_id`
3. ✅ Updated checkpoint service to accept `import_batch_id`
4. ✅ Updated import API to pass `import_batch_id` when creating checkpoint
5. ✅ Updated rollback API to delete checkpoint created by import

### **Benefits:**

✅ **Clean Rollback** - No orphaned checkpoints
✅ **Clear Ownership** - Know which checkpoints came from imports
✅ **Preserved History** - Manual checkpoints not affected
✅ **Audit Trail** - Can track which import created which checkpoint
✅ **No Confusion** - Rollback fully reverses import

---

**Created:** November 5, 2025
**Status:** ✅ Complete
**Migration:** 005
**Breaking Changes:** None (existing checkpoints get NULL)
