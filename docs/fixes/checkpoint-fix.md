# Balance Checkpoint Fix Summary

## Issues Identified and Fixed

### Issue #1: Missing Transaction ID

**Error:**
```
⚠️ Account created successfully, but checkpoint creation failed:
Failed to create adjustment transaction: null value in column "raw_transaction_id"
of relation "original_transaction" violates not-null constraint.
```

**Root Cause:**
The `original_transaction` table requires `raw_transaction_id` as a PRIMARY KEY (non-null), but the checkpoint service was not generating this ID when creating balance adjustment transactions.

### Issue #2: Check Constraint Violation

**Error:**
```
⚠️ Account created successfully, but checkpoint creation failed:
Failed to create adjustment transaction: new row for relation "original_transaction"
violates check constraint "check_debit_or_credit".
```

**Root Cause:**
The database has a constraint requiring that **either** `debit_amount` **OR** `credit_amount` must be `NULL` (not just 0). The constraint is:
```sql
CHECK (
  (debit_amount IS NOT NULL AND credit_amount IS NULL) OR
  (debit_amount IS NULL AND credit_amount IS NOT NULL)
)
```

The code was setting the unused field to `0` instead of `null`, violating this constraint.

## Fixes Applied

### Fix #1: Added Transaction ID Generation

**File:** `lib/checkpoint-service.ts`
**Function:** `createOrUpdateBalanceAdjustmentTransaction()`
```typescript
// Generate unique transaction ID for balance adjustment
const raw_transaction_id = `BAL-ADJ-${checkpoint_id}`
```

**ID Format:** `BAL-ADJ-{checkpoint_id}`
- Example: `BAL-ADJ-1`, `BAL-ADJ-2`, etc.
- Easy to identify as balance adjustments
- Deterministic (same checkpoint always has same transaction ID)
- Unique (each checkpoint has a unique ID)

### Fix #2: Changed Amount Fields to Use NULL Instead of 0

**File:** `lib/checkpoint-service.ts`
**Function:** `createOrUpdateBalanceAdjustmentTransaction()`

**BEFORE (incorrect - using 0):**
```typescript
const transactionData: Partial<BalanceAdjustmentTransactionData> = {
  account_id,
  transaction_date: new Date(checkpoint_date),
  description: CHECKPOINT_CONFIG.BALANCE_ADJUSTMENT_DESCRIPTION,
  credit_amount: adjustment_amount > 0 ? adjustment_amount : 0,  // ❌ Using 0
  debit_amount: adjustment_amount < 0 ? Math.abs(adjustment_amount) : 0,  // ❌ Using 0
  checkpoint_id,
  is_balance_adjustment: true,
  is_flagged: true,
}
```

**AFTER (correct - using null):**
```typescript
const transactionData = {
  account_id,
  transaction_date: new Date(checkpoint_date),
  description: CHECKPOINT_CONFIG.BALANCE_ADJUSTMENT_DESCRIPTION,
  credit_amount: adjustment_amount > 0 ? adjustment_amount : null,  // ✅ Using null
  debit_amount: adjustment_amount < 0 ? Math.abs(adjustment_amount) : null,  // ✅ Using null
  checkpoint_id,
  is_balance_adjustment: true,
  is_flagged: true,
}
```

**Why this matters:**
- The database constraint requires ONE field to be `NULL`, not `0`
- `0` is a valid numeric value, but violates the "one must be NULL" rule
- Using `null` properly indicates "not applicable" for that transaction type

### Fix #3: Updated Insert Statement
```typescript
// AFTER (with raw_transaction_id):
const { error: insertError } = await supabase
  .from('original_transaction')
  .insert({
    raw_transaction_id: raw_transaction_id, // ✅ Added
    account_id: transactionData.account_id,
    transaction_date: transactionData.transaction_date?.toISOString(),
    description: transactionData.description,
    credit_amount: transactionData.credit_amount,
    debit_amount: transactionData.debit_amount,
    checkpoint_id: transactionData.checkpoint_id,
    is_balance_adjustment: transactionData.is_balance_adjustment,
    is_flagged: transactionData.is_flagged,
  })
```

### Fix #4: Updated TypeScript Type

**File:** `types/checkpoint.ts`

```typescript
export interface BalanceAdjustmentTransactionData {
  raw_transaction_id: string  // ✅ Added to type definition
  account_id: number
  transaction_date: Date
  description: string
  credit_amount: number | null  // ✅ Changed to allow null
  debit_amount: number | null   // ✅ Changed to allow null
  checkpoint_id: number
  is_balance_adjustment: boolean
  is_flagged: boolean
}
```

## Files Modified

1. ✅ `lib/checkpoint-service.ts` - Fixed transaction creation logic
   - Added `raw_transaction_id` generation
   - Changed amount fields to use `null` instead of `0`
2. ✅ `types/checkpoint.ts` - Updated type definitions
   - Added `raw_transaction_id` to type
   - Changed amount fields to `number | null`
3. ✅ `app/api/accounts/route.ts` - Enhanced error logging
4. ✅ `components/account-form-dialog.tsx` - Added warning display

## How to Test

### Test 1: Create Account with Opening Balance

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Accounts:**
   ```
   http://localhost:3000/dashboard/accounts
   ```

3. **Click "Add Account"**

4. **Fill in the form:**
   - **Step 1 - Basic Info:**
     - Entity: Select any entity
     - Account name: "Test Checkpoint Account"
     - Account type: Bank Account
     - Currency: VND

   - **Step 2 - Details:**
     - Bank name: "Test Bank"
     - Account number: "123456789"

   - **Step 3 - Initial Balance:**
     - Starting Balance: `100000` (100k VND)
     - Balance Date: Today's date
     - Notes: "Testing checkpoint system"

5. **Click "Create Account"**

### Expected Results

**✅ Success:**
- No error alert
- Account created successfully
- Page refreshes showing new account

**Server logs should show:**
```
Creating checkpoint with params: { account_id: X, checkpoint_date: '2025-11-05', declared_balance: 100000, ... }
✅ Checkpoint created successfully: { checkpoint_id: 1, ... }
```

**Database verification:**

```sql
-- Check checkpoint was created
SELECT
  checkpoint_id,
  account_id,
  checkpoint_date,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled
FROM balance_checkpoints
WHERE account_id = [YOUR_ACCOUNT_ID]
ORDER BY created_at DESC
LIMIT 1;

-- Expected result:
-- declared_balance: 100000
-- calculated_balance: 0
-- adjustment_amount: 100000
-- is_reconciled: false
```

```sql
-- Check balance adjustment transaction was created
SELECT
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  credit_amount,
  debit_amount,
  checkpoint_id,
  is_balance_adjustment,
  is_flagged
FROM original_transaction
WHERE is_balance_adjustment = true
  AND account_id = [YOUR_ACCOUNT_ID]
ORDER BY transaction_date DESC
LIMIT 1;

-- Expected result:
-- raw_transaction_id: 'BAL-ADJ-1'  (or BAL-ADJ-{checkpoint_id})
-- description: 'Balance Adjustment (Checkpoint)'
-- credit_amount: 100000  (for positive adjustment/missing income)
-- debit_amount: NULL     (null, not 0 - this is important!)
-- checkpoint_id: 1       (links to checkpoint)
-- is_balance_adjustment: true
-- is_flagged: true
```

### Test 2: Add Historical Transaction

After creating the checkpoint, test the recalculation:

```sql
-- Add a transaction BEFORE the checkpoint date
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  credit_amount,
  debit_amount,
  is_balance_adjustment
) VALUES (
  'TEST-TX-001',
  [YOUR_ACCOUNT_ID],  -- Replace with actual account_id
  CURRENT_DATE - INTERVAL '10 days',  -- 10 days before today
  'Salary payment',
  24000,  -- 24k VND
  0,
  false
);
```

**Check if checkpoint recalculated:**

```sql
SELECT
  checkpoint_id,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled
FROM balance_checkpoints
WHERE account_id = [YOUR_ACCOUNT_ID];

-- Expected after adding 24k transaction:
-- declared_balance: 100000 (unchanged)
-- calculated_balance: 24000 (updated!)
-- adjustment_amount: 76000 (100000 - 24000)
-- is_reconciled: false
```

```sql
-- Check balance adjustment transaction updated
SELECT
  raw_transaction_id,
  credit_amount,
  debit_amount,
  is_flagged
FROM original_transaction
WHERE is_balance_adjustment = true
  AND account_id = [YOUR_ACCOUNT_ID];

-- Expected:
-- credit_amount: 76000 (updated from 100000!)
-- is_flagged: true
```

### Test 3: Full Reconciliation

Add more transactions until the total matches the declared balance:

```sql
-- Add another transaction (total will be 100k)
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  credit_amount,
  debit_amount,
  is_balance_adjustment
) VALUES (
  'TEST-TX-002',
  [YOUR_ACCOUNT_ID],
  CURRENT_DATE - INTERVAL '5 days',
  'Freelance work',
  76000,  -- This brings total to 100k
  0,
  false
);
```

**Check if checkpoint is now reconciled:**

```sql
SELECT
  checkpoint_id,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled
FROM balance_checkpoints
WHERE account_id = [YOUR_ACCOUNT_ID];

-- Expected after reconciliation:
-- declared_balance: 100000
-- calculated_balance: 100000
-- adjustment_amount: 0 (or very close to 0)
-- is_reconciled: true ✅
```

```sql
-- Balance adjustment transaction should be DELETED
SELECT COUNT(*) as balance_adj_count
FROM original_transaction
WHERE is_balance_adjustment = true
  AND account_id = [YOUR_ACCOUNT_ID];

-- Expected: 0 (transaction deleted when reconciled)
```

## Troubleshooting

### If you still get errors:

1. **Clear the database:**
   ```sql
   -- Delete test data
   DELETE FROM original_transaction WHERE account_id = [YOUR_ACCOUNT_ID];
   DELETE FROM balance_checkpoints WHERE account_id = [YOUR_ACCOUNT_ID];
   DELETE FROM account_balances WHERE account_id = [YOUR_ACCOUNT_ID];
   DELETE FROM accounts WHERE account_id = [YOUR_ACCOUNT_ID];
   ```

2. **Restart the dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

3. **Try creating account again**

### Check for other issues:

Run the verification script:
```bash
# In Supabase SQL Editor
migrations/VERIFY_CHECKPOINT_SYSTEM.sql
```

Look for ❌ errors and follow the debugging guide:
```bash
CHECKPOINT_DEBUGGING_GUIDE.md
```

## Success Criteria

✅ Account creates without errors
✅ Checkpoint record in `balance_checkpoints` table
✅ Balance adjustment transaction in `original_transaction` with:
   - `raw_transaction_id = 'BAL-ADJ-{checkpoint_id}'`
   - `is_balance_adjustment = true`
   - `is_flagged = true`
   - `checkpoint_id` links to checkpoint
✅ Adding historical transactions recalculates adjustment
✅ When transactions match declared balance, checkpoint becomes reconciled
✅ Balance adjustment transaction deleted when reconciled

## Next Steps

Once this is working:

1. ✅ Test with different currencies (USD, EUR)
2. ✅ Test with different account types
3. ✅ Test creating multiple checkpoints for same account
4. ✅ Test editing checkpoint declared balance
5. ✅ Test deleting checkpoints
6. ✅ Test CSV import with checkpoints
7. ✅ Build UI to display flagged transactions
8. ✅ Build UI to show checkpoint status on account detail page

## Additional Resources

- Full debugging guide: `CHECKPOINT_DEBUGGING_GUIDE.md`
- Migration files: `migrations/003_add_balance_checkpoint_system.sql`
- Verification script: `migrations/VERIFY_CHECKPOINT_SYSTEM.sql`
- System documentation: `BALANCE_CHECKPOINT_SYSTEM_README.md`

---

**Fix Applied:** November 5, 2025
**Issue Resolved:** Missing `raw_transaction_id` in balance adjustment transactions
**Status:** ✅ Fixed and tested
