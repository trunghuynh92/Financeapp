# Automatic Checkpoint Recalculation - Fix Documentation

## Problem Identified

**Issue:** When you add a transaction before a checkpoint date, the balance adjustment doesn't automatically recalculate.

### Your Specific Example:
1. ✅ Created checkpoint on **Nov 5, 2020** with **45M VND** declared balance
2. ✅ System created balance adjustment transaction of **+45M** (since calculated was 0)
3. ✅ Added transaction on **Sep 1, 2020** (before checkpoint) - sold bike for **13M**
4. ❌ **Expected:** Balance adjustment should recalculate to **+32M** (45M - 13M)
5. ❌ **Actual:** Balance adjustment stayed at **+45M** (no recalculation happened)

---

## Root Cause

The database trigger (`trigger_recalculate_checkpoints`) was only **sending a notification** (`pg_notify`) but not **actually recalculating** the checkpoints.

### Original Migration 003 Code (BROKEN):
```sql
CREATE OR REPLACE FUNCTION trigger_recalculate_checkpoints()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sends a notification ❌
  PERFORM pg_notify(
    'recalculate_checkpoints',
    json_build_object('account_id', v_account_id)::text
  );
  -- But doesn't actually recalculate anything!
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**The notification was never being listened to!** The system expected:
- A pg_notify listener in the Next.js app
- That listener would call the recalculation API
- But we never implemented this listener ❌

**Result:** Transactions were added, but checkpoints never recalculated.

---

## The Fix

**Migration 004** (`004_fix_automatic_checkpoint_recalculation.sql`) replaces the broken trigger with one that **actually recalculates** checkpoints in the database.

### What It Does:

1. **Creates 3 new database functions:**
   - `recalculate_checkpoint(checkpoint_id)` - Recalculates one checkpoint
   - `recalculate_all_checkpoints_for_account(account_id)` - Recalculates all checkpoints for an account
   - `sync_account_balance_from_checkpoints(account_id)` - Syncs account_balances table

2. **Replaces the trigger function:**
   - Now actually calls the recalculation functions
   - Updates checkpoints immediately
   - Updates balance adjustment transactions
   - Syncs account_balances table
   - All happens automatically in the database

3. **How it works:**
```
You add transaction (Sep 1, 2020, +13M)
   ↓
Trigger fires: trigger_recalculate_checkpoints()
   ↓
Calls: recalculate_all_checkpoints_for_account(account_id)
   ↓
Loops through checkpoints (Nov 5, 2020)
   ↓
Recalculates: calculated_balance = 13M (from Sep 1 transaction)
   ↓
Updates: adjustment_amount = 45M - 13M = 32M
   ↓
Updates balance adjustment transaction: credit_amount = 32M
   ↓
Syncs account_balances: current_balance = 45M
   ↓
✅ Done! Everything updated automatically
```

---

## How to Apply the Fix

### Step 1: Run Migration 004

1. **Open Supabase SQL Editor**
2. **Copy and paste** the entire contents of:
   ```
   migrations/004_fix_automatic_checkpoint_recalculation.sql
   ```
3. **Click "Run"**
4. **Check output** - you should see:
   ```
   ==============================================================
   Migration 004 Complete!
   ==============================================================
   ✅ Created recalculate_checkpoint() function
   ✅ Created recalculate_all_checkpoints_for_account() function
   ✅ Created sync_account_balance_from_checkpoints() function
   ✅ Replaced trigger_recalculate_checkpoints() function
   ```

### Step 2: Fix Your Existing Checkpoint

Your existing checkpoint (Nov 5, 2020 with 45M) is still showing the old values. To fix it:

1. **Open Supabase SQL Editor**
2. **Copy and paste** the entire contents of:
   ```
   migrations/FIX_EXISTING_CHECKPOINTS_NOW.sql
   ```
3. **Click "Run"**
4. **Check the results** - you should see your checkpoint updated:
   ```
   checkpoint_date: Nov 5, 2020
   declared_balance: 45,000,000
   calculated_balance: 13,000,000  ← Updated!
   adjustment_amount: 32,000,000   ← Updated from 45M to 32M!
   is_reconciled: false
   ```

---

## Verification

### Check 1: Checkpoint Updated

```sql
SELECT
  checkpoint_date,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled
FROM balance_checkpoints
WHERE checkpoint_date = '2020-11-05'
ORDER BY checkpoint_id DESC
LIMIT 1;
```

**Expected:**
```
checkpoint_date: 2020-11-05
declared_balance: 45000000
calculated_balance: 13000000  ← Includes your Sep 1 transaction
adjustment_amount: 32000000   ← 45M - 13M = 32M
is_reconciled: false
```

### Check 2: Balance Adjustment Transaction Updated

```sql
SELECT
  raw_transaction_id,
  description,
  credit_amount,
  debit_amount,
  is_flagged
FROM original_transaction
WHERE is_balance_adjustment = true
ORDER BY transaction_date DESC
LIMIT 1;
```

**Expected:**
```
raw_transaction_id: BAL-ADJ-1 (or similar)
description: Balance Adjustment (Checkpoint)
credit_amount: 32000000  ← Updated from 45M to 32M!
debit_amount: NULL
is_flagged: true
```

### Check 3: Account Balance

```sql
SELECT
  account_id,
  current_balance,
  last_updated
FROM account_balances
WHERE account_id = [YOUR_ACCOUNT_ID];
```

**Expected:**
```
current_balance: 45000000  ← 13M (transaction) + 32M (adjustment) = 45M
last_updated: [recent timestamp]
```

---

## Testing the Fix

### Test 1: Add Another Transaction Before Checkpoint

```sql
-- Add another transaction before Nov 5, 2020
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  credit_amount,
  debit_amount,
  is_balance_adjustment
) VALUES (
  'TEST-TX-003',
  [YOUR_ACCOUNT_ID],  -- Replace with your account ID
  '2020-10-15',       -- Before Nov 5, 2020
  'Test: Salary income',
  10000000,           -- 10M credit
  NULL,
  false
);
```

**What should happen automatically:**
1. Trigger fires
2. Checkpoint recalculates
3. New calculated_balance = 13M + 10M = 23M
4. New adjustment_amount = 45M - 23M = 22M
5. Balance adjustment transaction updates to 22M

**Verify:**
```sql
SELECT
  declared_balance,
  calculated_balance,
  adjustment_amount
FROM balance_checkpoints
WHERE checkpoint_date = '2020-11-05';

-- Expected:
-- declared_balance: 45000000 (unchanged)
-- calculated_balance: 23000000 (13M + 10M)
-- adjustment_amount: 22000000 (45M - 23M)
```

### Test 2: Add Transaction After Checkpoint

```sql
-- Add transaction after Nov 5, 2020
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  credit_amount,
  debit_amount,
  is_balance_adjustment
) VALUES (
  'TEST-TX-004',
  [YOUR_ACCOUNT_ID],
  '2020-12-01',       -- After Nov 5, 2020
  'Test: December income',
  5000000,            -- 5M credit
  NULL,
  false
);
```

**What should happen:**
- Checkpoint stays the same (transaction is after checkpoint date)
- Account balance increases to 50M (45M + 5M)

### Test 3: Delete a Transaction

```sql
-- Delete the Sep 1 bike sale transaction
DELETE FROM original_transaction
WHERE description = 'Sold bike'
  AND transaction_date = '2020-09-01';
```

**What should happen automatically:**
- Checkpoint recalculates
- Calculated balance decreases
- Adjustment increases back up
- Balance adjustment transaction updates

---

## Benefits of the Fix

### Before Fix:
❌ Transactions added but checkpoints never updated
❌ Balance adjustments stayed incorrect
❌ Had to manually call API to recalculate
❌ Confusing for users - "Why isn't it updating?"
❌ Required application-level listener (never implemented)

### After Fix:
✅ **Instant recalculation** when transactions change
✅ **Automatic updates** to balance adjustments
✅ **No manual intervention** needed
✅ **Database-level solution** - more reliable
✅ **Works immediately** - no app changes needed
✅ **Account balance stays in sync** automatically

---

## What Changed in the Database

### New Functions:

1. **`recalculate_checkpoint(checkpoint_id)`**
   - Recalculates one checkpoint
   - Updates calculated_balance
   - Updates adjustment_amount
   - Updates/creates/deletes adjustment transaction
   - Handles reconciliation

2. **`recalculate_all_checkpoints_for_account(account_id)`**
   - Recalculates all checkpoints for an account in date order
   - Ensures consistency across multiple checkpoints

3. **`sync_account_balance_from_checkpoints(account_id)`**
   - Updates account_balances table
   - Uses latest checkpoint data
   - Fallback to transaction sum if no checkpoints

### Updated Function:

4. **`trigger_recalculate_checkpoints()`**
   - Now actually performs recalculation
   - Calls the new functions above
   - Runs automatically when transactions change

### Trigger (Unchanged):

The trigger `transaction_checkpoint_recalc` remains the same - it automatically uses the new function definition.

---

## Edge Cases Handled

✅ **Multiple checkpoints** - All recalculate in order
✅ **Checkpoint becomes reconciled** - Adjustment transaction deleted
✅ **Checkpoint becomes unreconciled** - Adjustment transaction recreated
✅ **Delete transaction** - Checkpoints recalculate accordingly
✅ **Update transaction** - Checkpoints recalculate
✅ **No checkpoints** - Still syncs account_balances from transactions
✅ **First checkpoint** - Creates adjustment transaction correctly

---

## Performance Considerations

**Q: Won't this be slow if I have lots of checkpoints?**

A: The recalculation is optimized:
- Only recalculates checkpoints for the affected account
- Uses indexed queries (account_id, transaction_date)
- Runs in a single database transaction
- For typical usage (1-10 checkpoints per account), it's instant

**Q: What if I import 1000 transactions?**

A: Each transaction triggers a recalculation, which could be slow. For bulk imports, consider:
- Temporarily disable the trigger
- Import all transactions
- Manually recalculate once at the end
- Re-enable trigger

---

## Troubleshooting

### Issue: Checkpoint still not updating

**Check trigger exists:**
```sql
SELECT * FROM pg_trigger
WHERE tgname = 'transaction_checkpoint_recalc';
```

**Check function exists:**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'recalculate_all_checkpoints_for_account';
```

**Manually trigger recalculation:**
```sql
SELECT recalculate_all_checkpoints_for_account([YOUR_ACCOUNT_ID]);
```

### Issue: Error when adding transaction

Check the server logs or Supabase logs for the error message. Common issues:
- Missing functions (run migration 004 again)
- Data inconsistency (fix data then retry)

---

## Summary

**What was broken:**
- Trigger only notified, didn't recalculate ❌

**What we fixed:**
- Trigger now recalculates automatically ✅

**What you need to do:**
1. Run migration 004 (creates new functions)
2. Run FIX_EXISTING_CHECKPOINTS_NOW.sql (fixes old data)
3. Test by adding a transaction
4. Enjoy automatic recalculation! 🎉

---

**Migration Created:** November 5, 2025
**Status:** ✅ Ready to Deploy
**Breaking Changes:** None (only improves existing functionality)
**Rollback:** Simply revert to migration 003 functions
