# Credit Card Mechanics

## Overview

Credit cards in the Finance SaaS system use a specialized transaction model to properly track:
1. **Expenses** - What you spent (for expense reporting)
2. **Debt** - What you owe (for debt tracking)
3. **Cashflow** - When cash actually moves (for cash basis reporting)

This document explains the credit card transaction mechanics and how they differ from other account types.

## Core Concept: Cash Basis Accounting

The system uses **cash basis accounting** for cashflow reporting, meaning:
- **Cashflow is recorded when cash actually moves**, not when obligations are created
- Credit card swipes create expenses and debt, but **don't affect cashflow**
- Credit card payments move cash from bank to card, **affecting cashflow**

## Transaction Types for Credit Cards

### CC_CHARGE - Credit Card Charge (Swipes/Purchases)

**Purpose**: Record expenses charged to credit card

**Characteristics**:
- Transaction Type: `CC_CHARGE`
- Direction: `debit` (increases credit card balance/debt)
- `affects_cashflow`: **false** (no cash moved yet)
- Requires: `category_id` (to categorize the expense)

**Example**: Swipe $100 on groceries
```
Account: Credit Card
Type: CC_CHARGE
Category: Groceries
Amount: $100
Direction: debit
```

**Reporting Impact**:
- ✓ Shows in **Expense Reports** (grouped by category)
- ✓ Shows in **Debt Taken Reports** (new debt)
- ✗ Does NOT show in **Cashflow Reports** (no cash moved)

### CC_PAY - Credit Card Payment

**Purpose**: Receive payment on credit card (reduces debt)

**Characteristics**:
- Transaction Type: `CC_PAY`
- Direction: `credit` (reduces credit card balance/debt)
- `affects_cashflow`: **true** (cash movement occurred)
- Creates: Matched transaction pair (Bank CC_PAY ↔ Credit Card CC_PAY)

**Example**: Pay $200 from bank to credit card
```
Transaction 1 (Bank):
  Account: Bank Account
  Type: CC_PAY
  Amount: $200
  Direction: debit
  affects_cashflow: true

Transaction 2 (Credit Card):
  Account: Credit Card
  Type: CC_PAY
  Amount: $200
  Direction: credit
  affects_cashflow: true

Matching: CC_PAY ↔ CC_PAY (same type, different accounts)
```

**Reporting Impact**:
- ✓ Shows in **Cashflow Reports** (cash out)
- ✗ Does NOT show in **Expense Reports** (not a new expense, just payment)
- ✗ Does NOT show in **Debt Payment Reports** (CC_PAY is separate from DEBT_PAY for credit lines)

## Why Not Use EXP for Credit Card Swipes?

**Problem with using EXP**:
- `EXP` has `affects_cashflow: true`
- Credit card swipe with EXP would show cash leaving when it didn't
- Payment with DEBT_PAY would show cash leaving again
- **Result**: Double counting in cashflow reports ❌

**Example of the problem**:
```
Swipe $100 groceries (EXP, affects_cashflow: true)
  → Cashflow: -$100 ❌ (no cash left yet!)

Pay $100 to card (DEBT_PAY, affects_cashflow: true)
  → Cashflow: -$100 ✓

Total cashflow: -$200 for a $100 purchase ❌ WRONG!
```

**Correct approach with CC_CHARGE**:
```
Swipe $100 groceries (CC_CHARGE, affects_cashflow: false)
  → Cashflow: $0 ✓ (correct, no cash moved)

Pay $100 to card (DEBT_PAY, affects_cashflow: true)
  → Cashflow: -$100 ✓

Total cashflow: -$100 ✓ CORRECT!
```

## Reporting Examples

### Monthly Expense Report
**Question**: "What did I spend this month?"

**Data**:
- Cash groceries: $500 (EXP)
- Credit card groceries: $1,000 (CC_CHARGE)
- Credit card gas: $300 (CC_CHARGE)

**Report**:
```
Groceries: $1,500 ($500 cash + $1,000 credit)
Gas: $300 (credit)
Total Expenses: $1,800
```

**Query Logic**:
```sql
SELECT category_name, SUM(amount)
FROM main_transaction
WHERE transaction_type_id IN (
  SELECT transaction_type_id
  FROM transaction_types
  WHERE type_code IN ('EXP', 'CC_CHARGE')
)
GROUP BY category_name
```

### Monthly Cashflow Report
**Question**: "How much cash actually moved this month?"

**Data**:
- Cash groceries: $500 (EXP, affects_cashflow: true)
- Credit card groceries: $1,000 (CC_CHARGE, affects_cashflow: false)
- Credit card payment: $2,000 (DEBT_PAY, affects_cashflow: true)

**Report**:
```
Cash Out:
  Groceries (cash): -$500
  Credit card payment: -$2,000
Total Cash Out: -$2,500
```

Note: The $1,000 CC_CHARGE doesn't appear because no cash moved!

**Query Logic**:
```sql
SELECT SUM(amount)
FROM main_transaction
JOIN transaction_types USING (transaction_type_id)
WHERE affects_cashflow = true
  AND transaction_direction = 'debit'
```

### Monthly Debt Report
**Question**: "How much debt did I take and pay this month?"

**Data**:
- Credit card groceries: $1,000 (CC_CHARGE)
- Credit card gas: $300 (CC_CHARGE)
- Credit card payment: $2,000 (DEBT_PAY)

**Report**:
```
New Debt Taken: $1,300
Debt Paid: $2,000
Net Debt Change: -$700 (reduced debt)
```

**Query Logic**:
```sql
-- New debt
SELECT SUM(amount)
FROM main_transaction
WHERE transaction_type_id IN (
  SELECT transaction_type_id
  FROM transaction_types
  WHERE type_code IN ('DEBT_TAKE', 'CC_CHARGE')
)

-- Debt paid
SELECT SUM(amount)
FROM main_transaction
WHERE transaction_type_id IN (
  SELECT transaction_type_id
  FROM transaction_types
  WHERE type_code = 'DEBT_PAY'
)
```

## Comparison with Other Account Types

### Bank/Cash Accounts
```
Expense: EXP (affects_cashflow: true)
  → Immediate cash impact ✓

Example: Buy $100 groceries with cash
  → Expense: $100 ✓
  → Cashflow: -$100 ✓
```

### Credit Cards
```
Expense: CC_CHARGE (affects_cashflow: false)
Payment: DEBT_PAY (affects_cashflow: true)
  → Delayed cash impact ✓

Example: Buy $100 groceries with card, pay later
  Swipe → Expense: $100 ✓, Cashflow: $0 ✓
  Pay → Expense: $0 ✓, Cashflow: -$100 ✓
```

### Credit Lines
```
Borrow: DEBT_TAKE (affects_cashflow: true)
Spend: EXP from bank (affects_cashflow: true)
Repay: DEBT_PAY (affects_cashflow: true)
  → Three separate transactions ✓

Example: Draw $100 from credit line, buy groceries, repay $50
  Draw → Debt: +$100, Cashflow: +$100 (money in)
  Spend → Expense: $100, Cashflow: -$100 (money out)
  Repay → Debt: -$50, Cashflow: -$50 (money out)
```

## Transaction Type Rules

Credit card accounts have specific allowed transaction types:

**Debit (Money Out / Charges)**:
- `CC_CHARGE` - Credit card purchases (with category)
- `TRF_OUT` - Balance transfers to other cards

**Credit (Money In / Payments)**:
- `DEBT_PAY` - Payments from bank account
- `TRF_IN` - Balance transfers from other cards, refunds

See `/lib/transaction-type-rules.ts` for complete implementation.

## Implementation Details

### Database Schema

**transaction_types table**:
```sql
INSERT INTO transaction_types
(type_code, type_name, type_display_name, affects_cashflow, display_order, description)
VALUES
('CC_CHARGE', 'credit_card_charge', 'Credit Card Charge', false, 10,
 'Expense charged to credit card - creates debt without immediate cashflow impact');
```

### Categories

CC_CHARGE transactions use the same categories as EXP:
- Groceries
- Gas
- Dining
- Travel
- Entertainment
- etc.

This allows unified expense reporting across cash and credit purchases.

### Balance Calculation

Credit card balances follow standard account balance rules:
- Debit (CC_CHARGE): Balance becomes more negative (owe more)
- Credit (DEBT_PAY): Balance moves toward zero (owe less)

Negative balance = Amount owed

## User Experience

### Creating a Credit Card Charge

1. User swipes card for $100 on groceries
2. User enters transaction:
   - Account: Credit Card
   - Type: CC_CHARGE (automatically filtered for credit card debit)
   - Category: Groceries
   - Amount: $100
3. System records:
   - Expense for reporting: ✓
   - Debt increase: ✓
   - No cashflow impact: ✓

### Paying Credit Card

1. User pays $200 from bank to credit card
2. User creates CC_PAY on bank account ($200 debit)
3. User opens Quick Match dialog on the CC_PAY transaction
4. Dialog shows unmatched CC_PAY transactions on credit card accounts
5. User matches or creates CC_PAY on credit card ($200 credit):
   - Bank: CC_PAY debit (cashflow out)
   - Credit Card: CC_PAY credit (debt reduction)
   - Matching: CC_PAY ↔ CC_PAY

## Summary

Credit cards use **CC_CHARGE** instead of **EXP** to:

1. ✅ Track expenses by category (for expense reports)
2. ✅ Track debt increases (for debt reports)
3. ✅ Exclude from cashflow (until payment)
4. ✅ Avoid double-counting cash in cashflow reports

This approach provides accurate **cash basis reporting** while maintaining complete **expense tracking** across all payment methods.
