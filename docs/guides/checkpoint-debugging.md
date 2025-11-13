# Balance Checkpoint System - Debugging Guide

## Problem: Checkpoints Not Creating When Adding Account with Opening Balance

If you're creating an account with an opening balance and date, but the checkpoint isn't being created in the database, follow this debugging guide step by step.

---

## Step 1: Verify Database Setup

### Run the Verification Script

1. Open **Supabase SQL Editor**
2. Run the file: `migrations/VERIFY_CHECKPOINT_SYSTEM.sql`
3. Read the output carefully

### Expected Results:

You should see ✅ (checkmarks) for all these items:

```
1. Checking account balance table...
   ✅ account_balances (plural) table EXISTS

2. Checking balance_checkpoints table...
   ✅ balance_checkpoints table EXISTS
   📊 Contains 0 checkpoint(s)

3. Checking original_transaction checkpoint columns...
   ✅ checkpoint_id column EXISTS
   ✅ is_balance_adjustment column EXISTS
   ✅ is_flagged column EXISTS

4. Checking database functions...
   ✅ calculate_balance_up_to_date() function EXISTS
   ✅ update_account_opening_balance_date() function EXISTS

5. Checking triggers...
   ✅ transaction_checkpoint_recalc trigger EXISTS

6. Checking accounts table checkpoint columns...
   ✅ opening_balance_date column EXISTS
   ✅ earliest_transaction_date column EXISTS

7. Testing if checkpoint creation would work...
   ✅ calculate_balance_up_to_date() function WORKS
   ✅ update_account_opening_balance_date() function WORKS
```

### If You See ❌ Errors:

#### Error: `balance_checkpoints table NOT FOUND`
**Solution**: Run the checkpoint migration
```bash
# In Supabase SQL Editor, run:
migrations/003_add_balance_checkpoint_system.sql
```

#### Error: `account_balances (plural) table NOT FOUND` but `account_balance (singular) table EXISTS`
**Solution**: You ran the optional migration 002. The code expects `account_balances` (plural).

**Fix Option A - Rename table back to plural** (Recommended):
```sql
-- Run in Supabase SQL Editor
ALTER TABLE account_balance RENAME TO account_balances;
```

**Fix Option B - Update all code references** (Not recommended):
- You'd need to update every reference from `account_balances` to `account_balance`
- This is error-prone and not recommended

#### Error: Database functions NOT FOUND
**Solution**: Re-run migration 003:
```sql
-- Drop any existing functions first
DROP FUNCTION IF EXISTS calculate_balance_up_to_date(INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS update_account_opening_balance_date(INTEGER);

-- Then run migrations/003_add_balance_checkpoint_system.sql
```

---

## Step 2: Check Server Logs

### Start Your Dev Server with Logging

```bash
npm run dev
```

### Create a Test Account

1. Go to your app: `http://localhost:3000/dashboard/accounts`
2. Click "Add Account"
3. Fill in the form:
   - Select an entity
   - Account name: "Test Account"
   - Account type: Bank
   - Currency: VND
4. On Step 3 (Initial Balance):
   - Starting Balance: `100000` (100k VND)
   - Balance Date: Select today's date
   - Notes: "Test opening balance"
5. Click "Create Account"

### Watch the Server Logs

Look for these log messages:

**✅ Success logs:**
```
Creating checkpoint with params: { account_id: X, checkpoint_date: '2025-11-05', declared_balance: 100000, ... }
✅ Checkpoint created successfully: { checkpoint_id: 1, ... }
```

**❌ Error logs:**
```
❌ Error creating opening balance checkpoint: Error: ...
Error details: { message: '...', stack: '...' }
```

### Common Errors and Solutions:

#### Error: `relation "balance_checkpoints" does not exist`
**Cause**: Migration 003 wasn't run
**Solution**: Run `migrations/003_add_balance_checkpoint_system.sql` in Supabase

#### Error: `function calculate_balance_up_to_date(integer, timestamp with time zone) does not exist`
**Cause**: Database functions not created
**Solution**: Re-run migration 003

#### Error: `relation "account_balances" does not exist`
**Cause**: Table was renamed to `account_balance` (singular)
**Solution**: Rename back to `account_balances` (plural) as shown in Step 1

#### Error: `could not serialize access due to concurrent update`
**Cause**: Race condition (rare)
**Solution**: Try creating the account again

---

## Step 3: Check Browser Console

### Open Browser DevTools

1. Press F12 or Right-click → Inspect
2. Go to **Console** tab
3. Create a test account (as described in Step 2)

### Look for Warnings

After creating the account, you should see:
- ✅ No warnings = Checkpoint created successfully
- ⚠️ Alert popup with warning = Checkpoint creation failed

**If you see a warning alert:**
- The error message will tell you what went wrong
- Check the server logs for more details

---

## Step 4: Verify Checkpoint Was Created

### Run This Query in Supabase

```sql
-- Check if checkpoint was created
SELECT
  c.*,
  a.account_name
FROM balance_checkpoints c
JOIN accounts a ON c.account_id = a.account_id
ORDER BY c.created_at DESC
LIMIT 5;
```

**Expected result:**
```
checkpoint_id | account_id | checkpoint_date | declared_balance | calculated_balance | adjustment_amount | is_reconciled | ...
--------------|------------|-----------------|------------------|--------------------|--------------------|---------------|-----
1             | 1          | 2025-11-05      | 100000.00        | 0.00               | 100000.00          | false         | ...
```

### Check for Balance Adjustment Transaction

```sql
-- Check if balance adjustment transaction was created
SELECT
  t.*,
  a.account_name
FROM original_transaction t
JOIN accounts a ON t.account_id = a.account_id
WHERE t.is_balance_adjustment = true
ORDER BY t.transaction_date DESC
LIMIT 5;
```

**Expected result:**
```
raw_transaction_id | account_id | transaction_date | description                         | credit_amount | debit_amount | checkpoint_id | is_flagged | ...
-------------------|------------|------------------|-------------------------------------|---------------|--------------|---------------|------------|-----
...                | 1          | 2025-11-05       | Balance Adjustment (Checkpoint)     | 100000.00     | 0.00         | 1             | true       | ...
```

**What this means:**
- `credit_amount = 100000` means you have 100k of unexplained income
- `is_flagged = true` means this transaction is marked as needing attention
- `checkpoint_id = 1` links this adjustment to the checkpoint

---

## Step 5: Test the Full Workflow

### Create Account with Opening Balance

1. Create account: "My Bank Account"
2. Opening balance: 100M VND on Nov 1, 2025
3. Verify checkpoint created (should have 100M adjustment)

### Add Historical Transaction

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
  1,  -- Replace with your account_id
  '2025-10-15',  -- Before Nov 1
  'Salary payment',
  24000000,  -- 24M VND
  0,
  false
);
```

### Trigger Recalculation

The trigger should automatically recalculate. Verify:

```sql
-- Check if checkpoint was recalculated
SELECT
  checkpoint_id,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled
FROM balance_checkpoints
WHERE account_id = 1;  -- Replace with your account_id
```

**Expected after adding 24M transaction:**
```
declared_balance: 100000000  (100M - what you declared)
calculated_balance: 24000000  (24M - from the transaction we added)
adjustment_amount: 76000000   (76M - still unexplained)
is_reconciled: false
```

### Check Balance Adjustment Transaction Updated

```sql
SELECT
  raw_transaction_id,
  description,
  credit_amount,
  debit_amount,
  is_flagged
FROM original_transaction
WHERE checkpoint_id = 1
  AND is_balance_adjustment = true;
```

**Expected:**
```
credit_amount: 76000000  (Updated from 100M to 76M)
is_flagged: true
```

---

## Common Issues and Solutions

### Issue 1: No Checkpoint Created, No Error in Logs

**Possible causes:**
1. `initial_balance` is 0 or undefined
2. `opening_balance_date` is not provided
3. Code path isn't reaching checkpoint creation

**Solution:**
Check that the form is sending:
```javascript
{
  initial_balance: 100000,           // Non-zero number
  opening_balance_date: "2025-11-05", // ISO date string
  opening_balance_notes: "..." // Optional
}
```

### Issue 2: Checkpoint Created But No Balance Adjustment Transaction

**Cause:** The `createOrUpdateBalanceAdjustmentTransaction` function failed

**Debug:**
```sql
-- Check if checkpoint exists without transaction
SELECT c.*
FROM balance_checkpoints c
LEFT JOIN original_transaction t
  ON t.checkpoint_id = c.checkpoint_id
  AND t.is_balance_adjustment = true
WHERE t.raw_transaction_id IS NULL;
```

**Solution:**
Manually call the recalculation API:
```bash
curl -X PUT "http://localhost:3000/api/accounts/1/checkpoints?action=recalculate"
```

### Issue 3: Balance Adjustment Created But Not Flagged

**Cause:** `is_flagged` column not set to true

**Solution:**
```sql
UPDATE original_transaction
SET is_flagged = true
WHERE is_balance_adjustment = true
  AND checkpoint_id IS NOT NULL;
```

### Issue 4: Checkpoint Shows as Reconciled When It Shouldn't Be

**Cause:** Reconciliation threshold too high, or calculation error

**Check:**
```sql
SELECT
  checkpoint_id,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  ABS(adjustment_amount) as abs_adjustment,
  is_reconciled
FROM balance_checkpoints;
```

**Expected:** `is_reconciled = true` only when `abs_adjustment < 0.01`

---

## Manual Testing Checklist

- [ ] Run `VERIFY_CHECKPOINT_SYSTEM.sql` - all ✅
- [ ] Create account with opening balance - checkpoint created
- [ ] Balance adjustment transaction created with correct amount
- [ ] Transaction is flagged (`is_flagged = true`)
- [ ] Add historical transaction - checkpoint recalculates
- [ ] Adjustment amount decreases correctly
- [ ] When transactions match declared balance, checkpoint becomes reconciled
- [ ] Balance adjustment transaction is deleted when reconciled

---

## Getting Help

If you've followed all steps and it's still not working:

1. **Collect this information:**
   - Output from `VERIFY_CHECKPOINT_SYSTEM.sql`
   - Server logs when creating account
   - Browser console errors
   - Result of checkpoint queries

2. **Check GitHub Issues:**
   - Search for similar issues
   - Create a new issue with all the information above

3. **Common Debugging Commands:**

```sql
-- See all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- See all functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- See all triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- See checkpoint data
SELECT * FROM balance_checkpoints;

-- See flagged transactions
SELECT * FROM original_transaction WHERE is_flagged = true;

-- See accounts with opening balance dates
SELECT account_id, account_name, opening_balance_date, earliest_transaction_date
FROM accounts;
```

---

## Next Steps After Fixing

Once checkpoints are working:

1. Test importing transactions from CSV
2. Test manual transaction creation
3. Test splitting transactions
4. Verify recalculation happens automatically
5. Test checkpoint deletion
6. Test updating declared balance

---

**Document Version:** 1.0
**Last Updated:** November 5, 2025
**Status:** Active Debugging Guide
