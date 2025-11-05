# Balance Checkpoint System - Test Scenarios

This document provides detailed test scenarios to verify the checkpoint system works correctly.

---

## Test Case 1: Basic Checkpoint Creation

**Objective:** Verify that creating a checkpoint with no prior transactions creates a flagged adjustment transaction.

### Setup
```sql
-- Create test account
INSERT INTO accounts (entity_id, account_name, account_type, currency)
VALUES ('test-entity-uuid', 'Test Account 1', 'bank', 'VND')
RETURNING account_id; -- Let's say this returns 999
```

### Test Steps

1. **Create checkpoint**
```http
POST /api/accounts/999/checkpoints
{
  "checkpoint_date": "2020-03-01T00:00:00Z",
  "declared_balance": 100000000,
  "notes": "Initial balance from bank statement"
}
```

### Expected Results

✅ **Checkpoint Created:**
- `declared_balance` = 100,000,000
- `calculated_balance` = 0 (no transactions yet)
- `adjustment_amount` = 100,000,000
- `is_reconciled` = false

✅ **Balance Adjustment Transaction Created:**
```sql
SELECT * FROM original_transaction
WHERE account_id = 999 AND is_balance_adjustment = true;

-- Expected:
-- transaction_date = '2020-03-01'
-- description = 'Balance Adjustment (Checkpoint)'
-- credit_amount = 100,000,000
-- debit_amount = 0
-- is_flagged = true
-- checkpoint_id = (the checkpoint_id just created)
```

✅ **Account Opening Date Updated:**
```sql
SELECT opening_balance_date, earliest_transaction_date
FROM accounts WHERE account_id = 999;

-- Expected:
-- opening_balance_date = '2020-02-29' (one day before earliest transaction)
-- earliest_transaction_date = '2020-03-01' (date of adjustment transaction)
```

---

## Test Case 2: Adding Historical Transaction

**Objective:** Verify that adding a transaction before the checkpoint recalculates the adjustment.

### Setup
Continue from Test Case 1 (checkpoint exists with 100M adjustment)

### Test Steps

1. **Add transaction before checkpoint**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(999, '2019-11-21T00:00:00Z', 'MacBook Sale', 24000000, 0);
```

2. **Manually trigger recalculation (or wait for trigger)**
```http
PUT /api/accounts/999/checkpoints?action=recalculate
```

### Expected Results

✅ **Checkpoint Recalculated:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 999;

-- Expected:
-- calculated_balance = 24,000,000 (from MacBook transaction)
-- adjustment_amount = 76,000,000 (100M - 24M)
-- is_reconciled = false
```

✅ **Balance Adjustment Transaction Updated:**
```sql
SELECT credit_amount FROM original_transaction
WHERE account_id = 999 AND is_balance_adjustment = true;

-- Expected:
-- credit_amount = 76,000,000 (reduced from 100M)
```

✅ **Account Opening Date Updated:**
```sql
SELECT opening_balance_date, earliest_transaction_date
FROM accounts WHERE account_id = 999;

-- Expected:
-- opening_balance_date = '2019-11-20' (one day before MacBook transaction)
-- earliest_transaction_date = '2019-11-21'
```

---

## Test Case 3: Full Reconciliation

**Objective:** Verify that when transactions fully explain the declared balance, the adjustment is removed.

### Setup
Continue from Test Case 2 (checkpoint has 76M adjustment)

### Test Steps

1. **Add transaction that completes the balance**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(999, '2019-12-01T00:00:00Z', 'Freelance Project', 76000000, 0);
```

2. **Recalculate**
```http
PUT /api/accounts/999/checkpoints?action=recalculate
```

### Expected Results

✅ **Checkpoint Fully Reconciled:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 999;

-- Expected:
-- calculated_balance = 100,000,000 (24M + 76M)
-- adjustment_amount = 0
-- is_reconciled = true
```

✅ **Balance Adjustment Transaction DELETED:**
```sql
SELECT COUNT(*) FROM original_transaction
WHERE account_id = 999 AND is_balance_adjustment = true;

-- Expected: 0 (transaction deleted)
```

✅ **Only Real Transactions Remain:**
```sql
SELECT transaction_date, description, credit_amount
FROM original_transaction
WHERE account_id = 999
ORDER BY transaction_date;

-- Expected:
-- 2019-11-21 | MacBook Sale     | 24,000,000
-- 2019-12-01 | Freelance Project | 76,000,000
```

---

## Test Case 4: Over-Explanation (Negative Adjustment)

**Objective:** Verify that if transactions exceed the declared balance, a negative adjustment is created.

### Setup
Create fresh account and checkpoint

```sql
INSERT INTO accounts (entity_id, account_name, account_type, currency)
VALUES ('test-entity-uuid', 'Test Account 2', 'bank', 'VND')
RETURNING account_id; -- Returns 1000
```

### Test Steps

1. **Create checkpoint with 100M declared balance**
```http
POST /api/accounts/1000/checkpoints
{
  "checkpoint_date": "2020-03-01T00:00:00Z",
  "declared_balance": 100000000,
  "notes": "Bank statement balance"
}
```

2. **Add transactions totaling 110M (more than declared)**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(1000, '2020-02-01T00:00:00Z', 'Income 1', 60000000, 0),
(1000, '2020-02-15T00:00:00Z', 'Income 2', 50000000, 0);
```

3. **Recalculate**
```http
PUT /api/accounts/1000/checkpoints?action=recalculate
```

### Expected Results

✅ **Checkpoint Shows Negative Adjustment:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 1000;

-- Expected:
-- calculated_balance = 110,000,000
-- adjustment_amount = -10,000,000 (100M declared - 110M calculated)
-- is_reconciled = false
```

✅ **Balance Adjustment Transaction is DEBIT:**
```sql
SELECT credit_amount, debit_amount FROM original_transaction
WHERE account_id = 1000 AND is_balance_adjustment = true;

-- Expected:
-- credit_amount = 0
-- debit_amount = 10,000,000 (negative adjustment = debit)
```

**Interpretation:** User has 10M MORE in transactions than declared. Either:
- Bank statement was incorrect
- User forgot to record some expenses
- Need to adjust declared balance upward to 110M

---

## Test Case 5: Multiple Checkpoints

**Objective:** Verify that multiple checkpoints can exist and are managed independently.

### Setup
Create fresh account

```sql
INSERT INTO accounts (entity_id, account_name, account_type, currency)
VALUES ('test-entity-uuid', 'Test Account 3', 'bank', 'VND')
RETURNING account_id; -- Returns 1001
```

### Test Steps

1. **Create first checkpoint (January)**
```http
POST /api/accounts/1001/checkpoints
{
  "checkpoint_date": "2020-01-31T00:00:00Z",
  "declared_balance": 50000000,
  "notes": "January statement"
}
```

2. **Create second checkpoint (March)**
```http
POST /api/accounts/1001/checkpoints
{
  "checkpoint_date": "2020-03-31T00:00:00Z",
  "declared_balance": 100000000,
  "notes": "March statement"
}
```

3. **Add transaction in February**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(1001, '2020-02-15T00:00:00Z', 'February Income', 30000000, 0);
```

4. **Recalculate all checkpoints**
```http
PUT /api/accounts/1001/checkpoints?action=recalculate
```

### Expected Results

✅ **January Checkpoint:**
```sql
SELECT * FROM balance_checkpoints
WHERE account_id = 1001 AND checkpoint_date = '2020-01-31';

-- Expected:
-- calculated_balance = 0 (no transactions before Jan 31)
-- adjustment_amount = 50,000,000
-- is_reconciled = false
```

✅ **March Checkpoint:**
```sql
SELECT * FROM balance_checkpoints
WHERE account_id = 1001 AND checkpoint_date = '2020-03-31';

-- Expected:
-- calculated_balance = 30,000,000 (February transaction)
-- adjustment_amount = 70,000,000 (100M - 30M)
-- is_reconciled = false
```

✅ **Two Adjustment Transactions:**
```sql
SELECT transaction_date, credit_amount FROM original_transaction
WHERE account_id = 1001 AND is_balance_adjustment = true
ORDER BY transaction_date;

-- Expected:
-- 2020-01-31 | 50,000,000 (adjustment for Jan checkpoint)
-- 2020-03-31 | 70,000,000 (adjustment for Mar checkpoint)
```

---

## Test Case 6: Update Checkpoint Declared Balance

**Objective:** Verify that updating a checkpoint's declared balance recalculates the adjustment.

### Setup
Use checkpoint from Test Case 1

### Test Steps

1. **Update declared balance**
```http
PUT /api/accounts/999/checkpoints/1
{
  "declared_balance": 120000000,
  "notes": "Corrected from updated bank statement"
}
```

### Expected Results

✅ **Checkpoint Updated:**
```sql
SELECT * FROM balance_checkpoints WHERE checkpoint_id = 1;

-- Expected:
-- declared_balance = 120,000,000 (updated)
-- calculated_balance = 100,000,000 (unchanged)
-- adjustment_amount = 20,000,000 (120M - 100M)
-- notes = 'Corrected from updated bank statement'
```

✅ **Adjustment Transaction Updated:**
```sql
SELECT credit_amount FROM original_transaction
WHERE checkpoint_id = 1;

-- Expected:
-- credit_amount = 20,000,000
```

---

## Test Case 7: Delete Checkpoint

**Objective:** Verify that deleting a checkpoint removes the adjustment transaction and updates account dates.

### Setup
Use checkpoint from previous tests

### Test Steps

1. **Delete checkpoint**
```http
DELETE /api/accounts/999/checkpoints/1
```

### Expected Results

✅ **Checkpoint Deleted:**
```sql
SELECT COUNT(*) FROM balance_checkpoints WHERE checkpoint_id = 1;

-- Expected: 0
```

✅ **Adjustment Transaction Deleted (CASCADE):**
```sql
SELECT COUNT(*) FROM original_transaction
WHERE checkpoint_id = 1;

-- Expected: 0
```

✅ **Account Opening Date Recalculated:**
```sql
SELECT opening_balance_date, earliest_transaction_date
FROM accounts WHERE account_id = 999;

-- Expected: Based on remaining transactions only
```

---

## Test Case 8: Checkpoint with Expenses

**Objective:** Verify checkpoints work correctly when transactions include both income and expenses.

### Setup
Create fresh account

```sql
INSERT INTO accounts (entity_id, account_name, account_type, currency)
VALUES ('test-entity-uuid', 'Test Account 4', 'bank', 'VND')
RETURNING account_id; -- Returns 1002
```

### Test Steps

1. **Create checkpoint**
```http
POST /api/accounts/1002/checkpoints
{
  "checkpoint_date": "2020-12-31T00:00:00Z",
  "declared_balance": 50000000,
  "notes": "Year end balance"
}
```

2. **Add mixed transactions**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(1002, '2020-01-15T00:00:00Z', 'Salary', 100000000, 0),
(1002, '2020-06-10T00:00:00Z', 'Rent Payment', 0, 30000000),
(1002, '2020-09-05T00:00:00Z', 'Freelance', 20000000, 0),
(1002, '2020-11-20T00:00:00Z', 'Shopping', 0, 10000000);

-- Net: +100M + 20M - 30M - 10M = +80M
```

3. **Recalculate**
```http
PUT /api/accounts/1002/checkpoints?action=recalculate
```

### Expected Results

✅ **Checkpoint Calculated Correctly:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 1002;

-- Expected:
-- calculated_balance = 80,000,000 (net of transactions)
-- adjustment_amount = -30,000,000 (50M declared - 80M calculated)
-- is_reconciled = false
```

✅ **Negative Adjustment (Debit):**
```sql
SELECT debit_amount FROM original_transaction
WHERE account_id = 1002 AND is_balance_adjustment = true;

-- Expected:
-- debit_amount = 30,000,000
```

**Interpretation:** User has 30M MORE in net transactions than declared. Need to either:
- Add 30M in expenses that were missed
- Increase declared balance to 80M

---

## Test Case 9: Checkpoint at Same Date as Transaction

**Objective:** Verify checkpoint includes transactions on the same date.

### Setup
Create fresh account

### Test Steps

1. **Add transaction on March 1**
```sql
INSERT INTO accounts (entity_id, account_name, account_type, currency)
VALUES ('test-entity-uuid', 'Test Account 5', 'bank', 'VND')
RETURNING account_id; -- Returns 1003

INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(1003, '2020-03-01T10:00:00Z', 'Morning Sale', 50000000, 0);
```

2. **Create checkpoint on same date**
```http
POST /api/accounts/1003/checkpoints
{
  "checkpoint_date": "2020-03-01T23:59:59Z",
  "declared_balance": 100000000,
  "notes": "End of day balance"
}
```

### Expected Results

✅ **Transaction Included in Calculation:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 1003;

-- Expected:
-- calculated_balance = 50,000,000 (includes March 1 transaction)
-- adjustment_amount = 50,000,000 (100M - 50M)
```

---

## Test Case 10: Rounding Reconciliation

**Objective:** Verify that adjustments under 1 cent are considered reconciled.

### Setup
Create checkpoint with small adjustment

### Test Steps

1. **Create checkpoint**
```http
POST /api/accounts/999/checkpoints
{
  "checkpoint_date": "2020-03-01T00:00:00Z",
  "declared_balance": 100.00,
  "notes": "Test rounding"
}
```

2. **Add transaction with 0.005 difference**
```sql
INSERT INTO original_transaction
(account_id, transaction_date, description, credit_amount, debit_amount)
VALUES
(999, '2020-02-15T00:00:00Z', 'Test', 99.995, 0);
```

3. **Recalculate**

### Expected Results

✅ **Checkpoint Marked as Reconciled:**
```sql
SELECT * FROM balance_checkpoints WHERE account_id = 999;

-- Expected:
-- calculated_balance = 99.995
-- adjustment_amount = 0.005 (less than 0.01 threshold)
-- is_reconciled = true
```

✅ **No Adjustment Transaction:**
```sql
SELECT COUNT(*) FROM original_transaction
WHERE account_id = 999 AND is_balance_adjustment = true;

-- Expected: 0 (adjustment too small, considered reconciled)
```

---

## Integration Test: Complete User Journey

**Objective:** Simulate a complete user journey from account creation to full reconciliation.

### Scenario
User creates a checking account, knows their current balance from a bank statement, then gradually adds historical transactions to reconcile.

### Journey Steps

1. **Day 1: Create account**
```http
POST /api/accounts
{
  "entity_id": "user-uuid",
  "account_name": "Personal Checking",
  "account_type": "bank",
  "currency": "VND"
}
```

2. **Day 1: Set initial balance from bank statement**
```http
POST /api/accounts/1004/checkpoints
{
  "checkpoint_date": "2020-06-01T00:00:00Z",
  "declared_balance": 150000000,
  "notes": "June 2020 bank statement"
}
```

3. **Day 2: Remember a large transaction**
```sql
INSERT INTO original_transaction VALUES
(1004, '2020-04-15T00:00:00Z', 'Tax Refund', 80000000, 0);
```

4. **Day 3: Import bank CSV with multiple transactions**
```sql
INSERT INTO original_transaction VALUES
(1004, '2020-05-01T00:00:00Z', 'Salary', 50000000, 0),
(1004, '2020-05-10T00:00:00Z', 'Rent', 0, 20000000),
(1004, '2020-05-25T00:00:00Z', 'Utilities', 0, 5000000);
-- Net: +50M - 20M - 5M = +25M
```

5. **Day 4: Add opening balance transaction**
```sql
INSERT INTO original_transaction VALUES
(1004, '2020-03-01T00:00:00Z', 'Opening Balance', 45000000, 0);
```

### Expected Journey Results

**After Step 2:**
- Adjustment: +150M (fully flagged)

**After Step 3:**
- Adjustment: +70M (150M - 80M)
- Progress: 53% explained

**After Step 4:**
- Adjustment: +45M (150M - 80M - 25M)
- Progress: 70% explained

**After Step 5:**
- Adjustment: 0 (150M - 80M - 25M - 45M)
- Progress: 100% ✓ FULLY RECONCILED

---

## Performance Tests

### Test 11: Large Number of Transactions

**Objective:** Verify checkpoint calculation performance with many transactions.

### Test Steps

1. **Create account with 10,000 transactions**
```sql
-- Use generate_series to create test data
INSERT INTO original_transaction (account_id, transaction_date, description, credit_amount, debit_amount)
SELECT
  1005,
  '2020-01-01'::date + (i || ' days')::interval,
  'Transaction ' || i,
  CASE WHEN i % 2 = 0 THEN 1000000 ELSE 0 END,
  CASE WHEN i % 2 = 1 THEN 500000 ELSE 0 END
FROM generate_series(1, 10000) AS i;
```

2. **Create checkpoint**
```http
POST /api/accounts/1005/checkpoints
{
  "checkpoint_date": "2027-05-18T00:00:00Z",
  "declared_balance": 2500000000
}
```

3. **Measure calculation time**

### Expected Results

✅ **Calculation completes in < 5 seconds**
✅ **Correct balance calculated** (5M * 5000 credits - 0.5M * 5000 debits = 2.5B)
✅ **Database indexes used** (check with EXPLAIN ANALYZE)

---

## Running All Tests

```bash
# Run migration first
psql -U postgres -d financeapp -f migrations/003_add_balance_checkpoint_system.sql

# Then run each test case in order
# Use a test runner or manually execute each scenario

# Verify all tests pass
echo "All 11 test cases should pass before deployment"
```

---

## Test Checklist

- [ ] Test Case 1: Basic Checkpoint Creation
- [ ] Test Case 2: Adding Historical Transaction
- [ ] Test Case 3: Full Reconciliation
- [ ] Test Case 4: Over-Explanation (Negative Adjustment)
- [ ] Test Case 5: Multiple Checkpoints
- [ ] Test Case 6: Update Checkpoint Declared Balance
- [ ] Test Case 7: Delete Checkpoint
- [ ] Test Case 8: Checkpoint with Expenses
- [ ] Test Case 9: Checkpoint at Same Date as Transaction
- [ ] Test Case 10: Rounding Reconciliation
- [ ] Integration Test: Complete User Journey
- [ ] Performance Test: Large Number of Transactions

---

**Last Updated:** 2025-11-04
