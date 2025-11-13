# All "Balance" Terms in the System

## 1. Balance in `original_transaction.balance` ❌ NOT USED FOR CALCULATIONS
**Column**: `original_transaction.balance`
**Type**: Snapshot value from bank statement
**Purpose**: Stores the balance value from the CSV (if provided by bank)
**Usage**: Display only, NOT used for calculations
**Calculation**: None - it's imported directly from CSV

---

## 2. Checkpoint Declared Balance ✅ USER INPUT
**Column**: `balance_checkpoints.declared_balance`
**Type**: User-declared value
**Purpose**: What the user says the balance SHOULD be on a specific date
**Usage**: Used as the "truth" to compare against calculated balance
**Calculation**: None - entered by user

---

## 3. Checkpoint Calculated Balance ✅ CALCULATED FROM ORIGINAL_TRANSACTION
**Column**: `balance_checkpoints.calculated_balance`
**Type**: Calculated value
**Purpose**: System-calculated balance based on transactions up to checkpoint date
**Source**: `original_transaction` ONLY (excludes balance adjustments)
**Calculation**:
```sql
SELECT SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0))
FROM original_transaction
WHERE account_id = ?
  AND transaction_date <= checkpoint_date
  AND is_balance_adjustment = false
```
**Function**: `calculate_balance_up_to_date(p_account_id, p_up_to_date)`

---

## 4. Checkpoint Adjustment Amount ✅ DIFFERENCE
**Column**: `balance_checkpoints.adjustment_amount`
**Type**: Calculated value
**Purpose**: The unexplained difference between declared and calculated
**Calculation**:
```
adjustment_amount = declared_balance - calculated_balance
```
**Note**: Positive = missing income (credit adjustment), Negative = missing expense (debit adjustment)

---

## 5. Account Current Balance ✅ CACHED VALUE
**Column**: `account_balances.current_balance`
**Type**: Cached calculated value
**Purpose**: Quick access to account's current balance
**Source**: Synced from latest checkpoint's calculated_balance + adjustment_amount
**Calculation**:
```
current_balance = latest_checkpoint.calculated_balance + latest_checkpoint.adjustment_amount
```
**Function**: `syncAccountBalance(accountId)` in checkpoint-service.ts

---

## 6. Running Balance (UI Display) ⚠️ PROBLEMATIC
**Location**: Transaction list UI
**Type**: Calculated on-the-fly
**Purpose**: Show cumulative balance after each transaction in the list
**Source**: **Currently using main_transaction.amount** ❌ WRONG
**Should use**: `original_transaction.credit_amount` and `debit_amount` ✅ CORRECT
**Calculation**:
```
running_balance = SUM(credits) - SUM(debits) up to that row
```

---

## The Core Issue

**Problem**: UI is showing `main_transaction.amount` which totals to:
- Credits: 572,593,403
- Debits: 518,909,000
- **UI Balance: +53,684,403**

**Reality**: `original_transaction` (source of truth) totals to:
- Credits: 480,876,827
- Debits: 518,909,000
- **Actual Balance: -38,032,173**

**Discrepancy**: 91,716,576 in credits

---

## Rules

1. **ALL balance calculations MUST use `original_transaction`**, NOT `main_transaction`
2. **`main_transaction` is for categorization only**, not for balance calculations
3. **UI should display `original_transaction` amounts**, not `main_transaction` amounts
4. **Checkpoint calculations are CORRECT** - they use `original_transaction`

---

## Next Step

Run **CHECK_AMOUNT_MISMATCH.sql** to find which transactions have different amounts between `original_transaction` and `main_transaction`.

Query 3 will show if there are split transactions (1 original → multiple mains).
Query 4 will show the total difference in credits/debits.
