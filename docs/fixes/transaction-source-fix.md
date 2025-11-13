# Transaction Source Fix - Balance Adjustments

## Issue
Balance adjustment transactions created by the checkpoint system were not properly setting the `transaction_source` field, leaving it as the default (`user_manual`) instead of `auto_adjustment`.

## Problem
```sql
-- BEFORE FIX:
SELECT transaction_source FROM original_transaction
WHERE is_balance_adjustment = true;
-- Result: 'user_manual' ❌ (incorrect - implies user created it)
```

This made it difficult to:
- Identify system-generated adjustments
- Filter transactions by source
- Distinguish between manual and automatic transactions
- Generate accurate reports

## Solution

### Code Changes

**File:** `lib/checkpoint-service.ts`

Added `transaction_source: 'auto_adjustment'` to the insert statement:

```typescript
// BEFORE:
const { error: insertError } = await supabase
  .from('original_transaction')
  .insert({
    raw_transaction_id: raw_transaction_id,
    account_id: transactionData.account_id,
    transaction_date: transactionData.transaction_date?.toISOString(),
    description: transactionData.description,
    credit_amount: transactionData.credit_amount,
    debit_amount: transactionData.debit_amount,
    checkpoint_id: transactionData.checkpoint_id,
    is_balance_adjustment: transactionData.is_balance_adjustment,
    is_flagged: transactionData.is_flagged,
    // ❌ transaction_source missing - defaults to 'user_manual'
  })

// AFTER:
const { error: insertError } = await supabase
  .from('original_transaction')
  .insert({
    raw_transaction_id: raw_transaction_id,
    account_id: transactionData.account_id,
    transaction_date: transactionData.transaction_date?.toISOString(),
    description: transactionData.description,
    credit_amount: transactionData.credit_amount,
    debit_amount: transactionData.debit_amount,
    transaction_source: 'auto_adjustment',  // ✅ Explicitly set
    checkpoint_id: transactionData.checkpoint_id,
    is_balance_adjustment: transactionData.is_balance_adjustment,
    is_flagged: transactionData.is_flagged,
  })
```

**File:** `types/checkpoint.ts`

Updated type definition:

```typescript
export interface BalanceAdjustmentTransactionData {
  raw_transaction_id: string
  account_id: number
  transaction_date: Date
  description: string
  credit_amount: number | null
  debit_amount: number | null
  transaction_source: 'auto_adjustment'  // ✅ Added to type
  checkpoint_id: number
  is_balance_adjustment: boolean
  is_flagged: boolean
}
```

## Result

```sql
-- AFTER FIX:
SELECT transaction_source FROM original_transaction
WHERE is_balance_adjustment = true;
-- Result: 'auto_adjustment' ✅ (correct!)
```

## Impact

This fix applies to:
- ✅ **New checkpoints** created via "Create Checkpoint" button
- ✅ **Opening balance checkpoints** during account creation
- ✅ **All future balance adjustment transactions**

Existing transactions are **not affected** (would need manual migration if needed).

## Benefits

✅ **Clear Source Identification**
```sql
-- Easy to find all system-generated adjustments
SELECT * FROM original_transaction
WHERE transaction_source = 'auto_adjustment';
```

✅ **Accurate Reports**
```sql
-- Separate user transactions from system adjustments
SELECT
  transaction_source,
  COUNT(*),
  SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)) as net
FROM original_transaction
GROUP BY transaction_source;
```

✅ **Better Filtering**
- UI can filter by transaction source
- Reports can exclude adjustments
- Analytics can distinguish transaction types

✅ **Audit Trail**
- Clear indication this is system-generated
- Not confused with manual transactions
- Proper categorization for compliance

## Transaction Source Types

The system supports 4 transaction sources:

| Source | Description | Created By | Example |
|--------|-------------|------------|---------|
| `imported_bank` | Bank statement imports | CSV/Excel import | Monthly statement import |
| `user_manual` | Manually entered | User in UI | "Paid contractor 50M" |
| `system_opening` | Opening balance | Account creation (future) | Initial account balance |
| `auto_adjustment` | Balance adjustment | **Checkpoint system** | **"Balance Adjustment (Checkpoint)"** |

## Verification

After creating a checkpoint, verify:

```sql
-- Check transaction source is correct
SELECT
  raw_transaction_id,
  description,
  transaction_source,
  is_balance_adjustment,
  is_flagged
FROM original_transaction
WHERE description = 'Balance Adjustment (Checkpoint)'
ORDER BY transaction_date DESC
LIMIT 5;

-- Expected:
-- transaction_source: 'auto_adjustment' ✅
-- is_balance_adjustment: true
-- is_flagged: true
```

## Migration (Optional)

To fix existing balance adjustment transactions:

```sql
-- Update existing balance adjustments
UPDATE original_transaction
SET transaction_source = 'auto_adjustment'
WHERE is_balance_adjustment = true
  AND (transaction_source IS NULL OR transaction_source = 'user_manual');

-- Verify
SELECT COUNT(*) FROM original_transaction
WHERE is_balance_adjustment = true
  AND transaction_source = 'auto_adjustment';
```

## Related Issues

This fix complements:
- ✅ Missing `raw_transaction_id` (fixed)
- ✅ Check constraint violation for debit/credit (fixed)
- ✅ Balance sync integration (implemented)
- ✅ Transaction source categorization (this fix)

---

**Date:** November 5, 2025
**Status:** ✅ Fixed
**Impact:** New transactions only (existing data unchanged)
**Breaking Change:** No
