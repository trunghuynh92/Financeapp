# Loan Receivable System - Technical Documentation

**Last Updated**: 2025-11-19
**Version**: 5.0.0
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Transaction Flow](#transaction-flow)
4. [Transaction Matching](#transaction-matching)
5. [Balance Calculation](#balance-calculation)
6. [Deletion & Cascade Behavior](#deletion--cascade-behavior)
7. [Triggers & Automation](#triggers--automation)
8. [Complete Examples](#complete-examples)

---

## Overview

The Loan Receivable system tracks money lent to borrowers as **assets** on the balance sheet. When you disburse a loan, cash decreases (source account) and loan receivable increases (asset account). When the borrower pays back, loan receivable decreases and cash increases.

### Key Concepts

- **Loan Receivable Account**: Special account type (`account_type = 'loan_receivable'`) that tracks total loans given out
- **Loan Disbursement Record**: Individual loan tracking with borrower info, terms, and repayment status
- **Business Partner**: Contact record for the borrower (can be owner, employee, customer, etc.)
- **Transaction Matching**: Links disbursement and collection transactions across accounts to maintain balance integrity

---

## Database Schema

### 1. Core Tables

#### `business_partners`

Centralized contact management for all business relationships.

**Created in**: Migration 039

```sql
CREATE TABLE business_partners (
    partner_id SERIAL PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Classification
    partner_type partner_type NOT NULL DEFAULT 'other',
    -- Types: customer, vendor, employee, owner, partner, lender, other

    -- Identity
    partner_name TEXT NOT NULL,
    legal_name TEXT,
    display_name TEXT,
    tax_id TEXT,

    -- Contact info
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    website TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,

    -- Banking
    bank_account_number TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    bank_swift_code TEXT,

    -- Additional
    notes TEXT,
    tags TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id)
);
```

**Key Points**:
- Entity-scoped (multi-tenant isolation)
- Can be referenced by multiple loans
- Partner names must be unique per entity
- **ON DELETE CASCADE** from entities table

#### `loan_disbursement`

Tracks individual loans given to borrowers.

**Created in**: Migration 037
**Modified in**: Migrations 039 (added partner_id), 040 (removed borrower_type)

```sql
CREATE TABLE loan_disbursement (
    loan_disbursement_id SERIAL PRIMARY KEY,

    -- Account linkage
    account_id INTEGER NOT NULL
        REFERENCES accounts(account_id) ON DELETE CASCADE,

    -- Borrower (replaces deprecated borrower_name field)
    partner_id INTEGER
        REFERENCES business_partners(partner_id) ON DELETE RESTRICT,
    borrower_name TEXT,  -- Deprecated, use partner instead

    -- Loan details
    loan_category loan_category NOT NULL DEFAULT 'short_term',
        -- Values: short_term, long_term, advance, other
    principal_amount DECIMAL(15, 2) NOT NULL CHECK (principal_amount > 0),
    remaining_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Dates
    disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,  -- NULL for open-ended loans
    term_months INTEGER,

    -- Interest (reference only, not auto-calculated)
    interest_rate DECIMAL(5, 2),

    -- Status tracking
    status loan_status NOT NULL DEFAULT 'active',
        -- Values: active, overdue, repaid, partially_written_off, written_off
    is_overpaid BOOLEAN NOT NULL DEFAULT false,

    -- Write-off tracking
    written_off_amount DECIMAL(15, 2) DEFAULT 0,
    written_off_date DATE,

    -- Additional
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT remaining_balance_not_negative
        CHECK (remaining_balance >= 0),
    CONSTRAINT written_off_amount_not_negative
        CHECK (written_off_amount >= 0)
);
```

**Key Points**:
- **ON DELETE CASCADE** from accounts table (if account deleted, loans deleted)
- **ON DELETE RESTRICT** from business_partners (cannot delete partner with active loans)
- Interest rate is for reference only, not automatically calculated
- Balance updated automatically via triggers

#### `main_transaction` Foreign Key

The `main_transaction` table has a foreign key linking to loan disbursements:

```sql
ALTER TABLE main_transaction
ADD COLUMN loan_disbursement_id INTEGER
    REFERENCES loan_disbursement(loan_disbursement_id) ON DELETE SET NULL;
```

**Key Points**:
- **ON DELETE SET NULL**: If loan disbursement deleted, transaction remains but loses link
- Used by both `LOAN_DISBURSE` and `LOAN_COLLECT` transactions
- Links all disbursement and collection transactions to the loan record

---

### 2. Transaction Types

#### Current Transaction Types (After Migration 042)

| Type Code | Display Name | Usage | Affects Cash Flow |
|-----------|-------------|-------|-------------------|
| `LOAN_DISBURSE` | Loan Disbursement | Money disbursed to borrower | Yes |
| `LOAN_COLLECT` | Loan Collection | Payment collected from borrower | Yes |

**Note**: Migration 042 consolidated the original 4 types into just 2:
- `LOAN_GIVE` → `LOAN_DISBURSE`
- `LOAN_RECEIVE` → `LOAN_COLLECT`
- `LOAN_SETTLE` → Removed (merged into `LOAN_COLLECT`)
- `LOAN_WRITEOFF` → Still exists for write-offs

#### Historical Transaction Types (Before Migration 042)

For reference, the original system used:
- `LOAN_GIVE`: Money disbursed (cash out, asset increases)
- `LOAN_RECEIVE`: Payment received from borrower (cash in, asset decreases)
- `LOAN_SETTLE`: Auto-created settlement record (non-cash)
- `LOAN_WRITEOFF`: Write off uncollectible loan

---

## Transaction Flow

### Creating a Loan Disbursement

When you create a new loan disbursement, **two transactions** are created:

```
┌─────────────────────────────────────────────────────────┐
│  LOAN DISBURSEMENT CREATION                             │
│  Principal: $10,000                                     │
│  Borrower: John Doe (Partner)                          │
│  Date: 2025-01-15                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  1. Create loan_disbursement   │
         │     record in database         │
         └────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌──────────────────────┐       ┌──────────────────────┐
│ Transaction #1       │       │ Transaction #2       │
│ Source Account       │       │ Loan Receivable Acct │
│ (Bank/Cash)          │       │                      │
├──────────────────────┤       ├──────────────────────┤
│ Type: LOAN_DISBURSE  │       │ Type: LOAN_DISBURSE  │
│ Debit: $10,000       │       │ Credit: $10,000      │
│ Effect: Cash ↓       │       │ Effect: Asset ↑      │
│ loan_disbursement_id │       │ loan_disbursement_id │
└──────────────────────┘       └──────────────────────┘
```

**API Flow** (from `app/api/loan-disbursements/route.ts`):

1. **Create loan_disbursement record**
   ```sql
   INSERT INTO loan_disbursement (
     account_id, partner_id, principal_amount,
     remaining_balance, disbursement_date, ...
   ) VALUES (
     loan_receivable_account_id, partner_id, 10000.00,
     10000.00, '2025-01-15', ...
   )
   ```

2. **Create source account transaction** (money out)
   ```sql
   INSERT INTO original_transaction (
     account_id, transaction_date, description,
     debit_amount, credit_amount
   ) VALUES (
     source_account_id, '2025-01-15', 'Loan disbursement to John Doe',
     10000.00, NULL
   )

   -- Auto-generates main_transaction via trigger
   UPDATE main_transaction SET
     transaction_type_id = LOAN_DISBURSE,
     loan_disbursement_id = <new_id>
   WHERE raw_transaction_id = <generated_id>
   ```

3. **Create loan receivable transaction** (asset increases)
   ```sql
   INSERT INTO original_transaction (
     account_id, transaction_date, description,
     debit_amount, credit_amount
   ) VALUES (
     loan_receivable_account_id, '2025-01-15', 'Loan disbursement to John Doe',
     NULL, 10000.00
   )

   -- Auto-generates main_transaction via trigger
   UPDATE main_transaction SET
     transaction_type_id = LOAN_DISBURSE,
     loan_disbursement_id = <new_id>
   WHERE raw_transaction_id = <generated_id>
   ```

**Important**: Both transactions are linked to the same `loan_disbursement_id`.

---

### Collecting Loan Payment

When a borrower makes a payment, **two LOAN_COLLECT transactions** are created and matched:

```
┌─────────────────────────────────────────────────────────┐
│  LOAN PAYMENT COLLECTION                                │
│  Amount: $2,000                                         │
│  Borrower: John Doe                                     │
│  Date: 2025-02-15                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  User creates LOAN_COLLECT transaction on CASH account  │
│  Links it to loan_disbursement_id                       │
└──────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌──────────────────────┐       ┌──────────────────────┐
│ Transaction #1       │  ←──→ │ Transaction #2       │
│ Cash Account         │ MATCH │ Loan Receivable Acct │
│                      │       │                      │
├──────────────────────┤       ├──────────────────────┤
│ Type: LOAN_COLLECT   │       │ Type: LOAN_COLLECT   │
│ Credit: $2,000       │       │ Debit: $2,000        │
│ Effect: Cash ↑       │       │ Effect: Asset ↓      │
│ loan_disbursement_id │       │ loan_disbursement_id │
│ transfer_matched_id ─┼───────┼─ main_transaction_id │
└──────────────────────┘       └──────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  Trigger: Update Loan Balance  │
         │  remaining_balance = $8,000    │
         │  (only counts MATCHED txns)    │
         └────────────────────────────────┘
```

**Key Points**:
- Both transactions have same `loan_disbursement_id`
- Both transactions have type `LOAN_COLLECT`
- They are matched via `transfer_matched_transaction_id`
- **Only matched collections** update the loan balance (prevents double-counting)

---

## Transaction Matching

### Valid Match Pairs

Transaction matching is controlled by the `validate_transfer_match()` trigger function.

**Current valid pairs** (Migration 042 + 052):

```sql
-- Regular transfers
TRF_OUT ↔ TRF_IN

-- Debt system
DEBT_TAKE ↔ DEBT_TAKE  (borrowing money)
DEBT_PAY ↔ DEBT_PAY    (repaying debt)

-- Loan system
LOAN_DISBURSE ↔ LOAN_DISBURSE  (giving out loan)
LOAN_COLLECT ↔ LOAN_COLLECT    (collecting payment)

-- Credit card
CC_PAY ↔ CC_PAY
```

### Matching Process for Loan Collections

1. **Create first transaction** (cash side):
   ```typescript
   // User creates LOAN_COLLECT on bank account
   {
     account_id: bank_account_id,
     transaction_type: "LOAN_COLLECT",
     amount: 2000,
     loan_disbursement_id: 123
   }
   ```

2. **Create second transaction** (loan receivable side):
   ```typescript
   // User or system creates matching LOAN_COLLECT on loan_receivable account
   {
     account_id: loan_receivable_account_id,
     transaction_type: "LOAN_COLLECT",
     amount: 2000,
     loan_disbursement_id: 123
   }
   ```

3. **Match the transactions**:
   ```typescript
   // Set transfer_matched_transaction_id on both
   UPDATE main_transaction
   SET transfer_matched_transaction_id = <transaction_2_id>
   WHERE main_transaction_id = <transaction_1_id>

   UPDATE main_transaction
   SET transfer_matched_transaction_id = <transaction_1_id>
   WHERE main_transaction_id = <transaction_2_id>
   ```

4. **Trigger fires**: `update_loan_disbursement_after_settlement()` recalculates balance

**Validation** (from migration 052):
```sql
-- Both must be LOAN_COLLECT type
(my_type_code = 'LOAN_COLLECT' AND matched_type_code = 'LOAN_COLLECT')

-- Both must be in same entity
my_entity_id = matched_entity_id

-- Amounts should match (not enforced by DB, but expected)
```

---

## Balance Calculation

### Loan Disbursement Balance Update

**Trigger**: `update_loan_disbursement_after_settlement()`
**Fires on**: INSERT, UPDATE, DELETE on `main_transaction`
**Updated in**: Migration 054

#### Logic Flow

```sql
-- 1. Check if transaction is linked to a loan
IF loan_disbursement_id IS NULL THEN RETURN

-- 2. Check if transaction type is LOAN_COLLECT
IF type_code != 'LOAN_COLLECT' THEN RETURN

-- 3. Calculate total collected amount
SELECT SUM(amount) INTO v_total_settled
FROM main_transaction mt
JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
WHERE mt.loan_disbursement_id = v_disbursement_id
  AND tt.type_code = 'LOAN_COLLECT'
  AND mt.transfer_matched_transaction_id IS NOT NULL  -- Only matched!

-- 4. Calculate remaining balance
-- Divide by 2 because each collection creates TWO transactions
v_new_balance = v_principal - (v_total_settled / 2)

-- 5. Update loan status
IF v_new_balance <= 0 THEN
    status = 'repaid'
ELSIF due_date < CURRENT_DATE THEN
    status = 'overdue'
ELSE
    status = 'active'
END IF

-- 6. Update loan_disbursement record
UPDATE loan_disbursement SET
    remaining_balance = GREATEST(v_new_balance, 0),
    is_overpaid = (v_new_balance < 0),
    status = v_new_status,
    updated_at = NOW()
WHERE loan_disbursement_id = v_disbursement_id
```

#### Why Divide by 2?

**Critical**: Each loan collection creates **two** `LOAN_COLLECT` transactions:
- Transaction 1: Cash account (credit $2,000) - cash increases
- Transaction 2: Loan receivable account (debit $2,000) - asset decreases

Both transactions:
- Have type `LOAN_COLLECT`
- Have same `loan_disbursement_id`
- Have same `amount`
- Are matched together via `transfer_matched_transaction_id`

When we `SUM(amount)` for all matched `LOAN_COLLECT` transactions, we get **double** the actual collected amount:

```
Collection 1: $2,000
  - Cash side: $2,000
  - Loan receivable side: $2,000
  - SUM = $4,000  ← This is why we divide by 2

Actual collected: $2,000
```

### Example Calculation

**Loan Details**:
- Principal: $10,000
- Disbursement date: 2025-01-15

**Collection 1** (2025-02-15): $2,000
- Transaction A (cash): LOAN_COLLECT, amount $2,000, matched_id = B
- Transaction B (loan receivable): LOAN_COLLECT, amount $2,000, matched_id = A
- SUM of matched LOAN_COLLECT: $2,000 + $2,000 = $4,000
- Actual collected: $4,000 / 2 = **$2,000** ✓
- Remaining balance: $10,000 - $2,000 = **$8,000**

**Collection 2** (2025-03-15): $3,000
- Transaction C (cash): LOAN_COLLECT, amount $3,000, matched_id = D
- Transaction D (loan receivable): LOAN_COLLECT, amount $3,000, matched_id = C
- SUM of matched LOAN_COLLECT: $4,000 + $3,000 + $3,000 = $10,000
- Actual collected: $10,000 / 2 = **$5,000** ✓
- Remaining balance: $10,000 - $5,000 = **$5,000**

---

## Deletion & Cascade Behavior

### 1. Deleting Business Partners

**Constraint**: `ON DELETE RESTRICT`

```sql
partner_id INTEGER REFERENCES business_partners(partner_id) ON DELETE RESTRICT
```

**Effect**: Cannot delete a business partner if they have any loan disbursements.

**API Protection** (`app/api/business-partners/[id]/route.ts`):
```typescript
// Check if partner has loans
const { count: loansCount } = await supabase
  .from('loan_disbursement')
  .select('*', { count: 'exact', head: true })
  .eq('partner_id', partnerId)

if (loansCount && loansCount > 0) {
  return NextResponse.json({
    error: 'Cannot delete business partner with active loans',
    loans_count: loansCount
  }, { status: 400 })
}
```

**User Experience**:
- Attempting to delete partner with loans → Error message
- Must first delete all loans OR mark them as written off
- Prevents data integrity issues

---

### 2. Deleting Loan Disbursements

**Constraint**: Loans can be deleted if no payment history exists

**API Protection** (`app/api/loan-disbursements/[id]/route.ts`):
```typescript
// Check if disbursement has any payments
const { count: paymentsCount } = await supabase
  .from('main_transaction')
  .select('*', { count: 'exact', head: true })
  .eq('loan_disbursement_id', disbursementId)

if (paymentsCount && paymentsCount > 0) {
  return NextResponse.json({
    error: 'Cannot delete loan disbursement with payment history',
    message: `This loan has ${paymentsCount} payment(s). Delete payments first or mark as written_off.`,
    payments_count: paymentsCount
  }, { status: 400 })
}
```

**User Experience**:
- Can delete loans with no payments (newly created loans)
- Cannot delete loans with payment history
- Alternative: Mark loan as `written_off` status

---

### 3. Deleting Loan Receivable Accounts

**Constraint**: `ON DELETE CASCADE` from accounts to loan_disbursement

```sql
account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE
```

**Effect**: Deleting a loan_receivable account **will delete all loan disbursements** linked to it.

**Cascade Chain**:
```
DELETE accounts (loan_receivable)
    ↓ ON DELETE CASCADE
DELETE loan_disbursement (all loans in that account)
    ↓ ON DELETE SET NULL
main_transaction.loan_disbursement_id = NULL (transactions remain, lose link)
```

**Warning**: This is a destructive operation!
- All loan records are permanently deleted
- All transactions lose their loan linkage
- Balance history is lost
- **No API endpoint currently allows this** - requires direct database access

---

### 4. Deleting Transactions Linked to Loans

**Constraint**: `ON DELETE SET NULL`

```sql
loan_disbursement_id INTEGER REFERENCES loan_disbursement(loan_disbursement_id) ON DELETE SET NULL
```

**Effect**:
- Deleting a loan disbursement → All transactions with that `loan_disbursement_id` have it set to `NULL`
- Deleting a transaction → No effect on loan_disbursement (trigger recalculates balance)

**Trigger Behavior**:

When a `LOAN_COLLECT` transaction is **deleted**:

```sql
-- Trigger: update_loan_disbursement_after_settlement
-- Fires on: DELETE

-- 1. Uses OLD.loan_disbursement_id to find the loan
-- 2. Recalculates total from remaining LOAN_COLLECT transactions
-- 3. Updates remaining_balance
-- 4. Updates status (active/overdue/repaid)
```

**Example**:
```
Initial state:
  Principal: $10,000
  Collection 1: $2,000 (matched)
  Collection 2: $3,000 (matched)
  Remaining: $5,000

User deletes Collection 2:
  Trigger fires
  Recalculates: SUM = $2,000 (cash) + $2,000 (receivable) = $4,000
  New remaining: $10,000 - ($4,000/2) = $8,000 ✓

Loan balance automatically corrects!
```

---

### 5. Deleting Entities

**Constraint**: Entity deletion cascades to all related records

```
DELETE entities
    ↓ ON DELETE CASCADE
DELETE accounts (all accounts including loan_receivable)
    ↓ ON DELETE CASCADE
DELETE loan_disbursement (all loans)
    ↓ ON DELETE SET NULL
main_transaction.loan_disbursement_id = NULL

AND separately:

DELETE entities
    ↓ ON DELETE CASCADE
DELETE business_partners (all partners)
    ↓ Would fail if partners have loans (ON DELETE RESTRICT)
```

**Protection**: Business partners with loans block entity deletion.

---

## Triggers & Automation

### Active Triggers for Loan System

#### 1. `trigger_update_loan_disbursement_after_settlement`

**Function**: `update_loan_disbursement_after_settlement()`
**Table**: `main_transaction`
**Events**: AFTER INSERT OR UPDATE OR DELETE
**Purpose**: Automatically update loan balance when collections are added/changed/deleted

**Key Logic**:
- Only processes `LOAN_COLLECT` transactions
- Only counts **matched** transactions (prevents double-counting)
- Divides total by 2 (because each collection = 2 transactions)
- Updates `remaining_balance`, `status`, `is_overpaid`

#### 2. `trigger_update_business_partners_updated_at`

**Function**: `update_business_partners_updated_at()`
**Table**: `business_partners`
**Events**: BEFORE UPDATE
**Purpose**: Auto-update `updated_at` timestamp

#### 3. `validate_transfer_match` (on main_transaction)

**Function**: `validate_transfer_match()`
**Table**: `main_transaction`
**Events**: BEFORE INSERT OR UPDATE
**Purpose**: Ensure only valid transaction pairs can be matched

**Relevant validation**:
```sql
-- Must be same entity
my_entity_id = matched_entity_id

-- Must be valid pair
(my_type_code = 'LOAN_COLLECT' AND matched_type_code = 'LOAN_COLLECT')
OR
(my_type_code = 'LOAN_DISBURSE' AND matched_type_code = 'LOAN_DISBURSE')
```

### Deprecated Triggers (Pre-Migration 042)

These triggers existed in the original implementation but were replaced:

#### ~~`trigger_create_loan_disbursement_on_loan_give`~~ (Removed)

**Original Purpose**: Auto-create loan_disbursement when LOAN_GIVE transaction created
**Why Removed**: Disbursement creation now handled by API, not trigger

#### ~~`trigger_auto_create_loan_settle_on_match`~~ (Removed)

**Original Purpose**: Auto-create LOAN_SETTLE when LOAN_RECEIVE matched
**Why Removed**: Migration 042 consolidated types, no longer needed

---

## Complete Examples

### Example 1: Full Loan Lifecycle

**Scenario**: Loan $10,000 to employee John Doe, collect 2 payments, write off remainder.

#### Step 1: Create Business Partner

```sql
INSERT INTO business_partners (
  entity_id, partner_type, partner_name, email
) VALUES (
  'entity-uuid', 'employee', 'John Doe', 'john@company.com'
)
RETURNING partner_id;  -- Returns: 456
```

#### Step 2: Create Loan Disbursement (via API)

**Request**: POST `/api/loan-disbursements`

```json
{
  "source_account_id": 101,
  "partner_id": 456,
  "loan_category": "advance",
  "principal_amount": 10000.00,
  "disbursement_date": "2025-01-15",
  "due_date": "2025-12-15",
  "term_months": 11,
  "notes": "Salary advance"
}
```

**Database Effects**:

```sql
-- 1. loan_disbursement record created
INSERT INTO loan_disbursement (
  account_id, partner_id, principal_amount, remaining_balance, ...
) VALUES (
  202, 456, 10000.00, 10000.00, ...
)
-- Returns loan_disbursement_id: 789

-- 2. Source account transaction (cash out)
INSERT INTO original_transaction (
  account_id, debit_amount, transaction_date, description
) VALUES (
  101, 10000.00, '2025-01-15', 'Loan disbursement to John Doe'
)

UPDATE main_transaction SET
  transaction_type_id = (SELECT id FROM transaction_types WHERE type_code = 'LOAN_DISBURSE'),
  loan_disbursement_id = 789
WHERE raw_transaction_id = 'TXN-...'

-- 3. Loan receivable transaction (asset up)
INSERT INTO original_transaction (
  account_id, credit_amount, transaction_date, description
) VALUES (
  202, 10000.00, '2025-01-15', 'Loan disbursement to John Doe'
)

UPDATE main_transaction SET
  transaction_type_id = (SELECT id FROM transaction_types WHERE type_code = 'LOAN_DISBURSE'),
  loan_disbursement_id = 789
WHERE raw_transaction_id = 'TXN-...'
```

**Account Balances**:
- Bank account 101: -$10,000 (cash decreased)
- Loan receivable account 202: +$10,000 (asset increased)
- Loan 789 remaining_balance: $10,000

---

#### Step 3: First Payment Collection

**Date**: 2025-02-15, **Amount**: $3,000

**Process**:
1. User creates LOAN_COLLECT on bank account
2. System creates matching LOAN_COLLECT on loan receivable account
3. User matches the two transactions
4. Trigger updates loan balance

**Transactions Created**:

```sql
-- Transaction A: Cash side
INSERT INTO original_transaction (
  account_id, credit_amount, transaction_date, description
) VALUES (
  101, 3000.00, '2025-02-15', 'Loan payment from John Doe'
)

UPDATE main_transaction SET
  transaction_type_id = (SELECT id FROM transaction_types WHERE type_code = 'LOAN_COLLECT'),
  loan_disbursement_id = 789,
  transfer_matched_transaction_id = <transaction_B_id>
WHERE raw_transaction_id = 'TXN-A'
-- Creates main_transaction_id: 1001

-- Transaction B: Loan receivable side
INSERT INTO original_transaction (
  account_id, debit_amount, transaction_date, description
) VALUES (
  202, 3000.00, '2025-02-15', 'Loan payment from John Doe'
)

UPDATE main_transaction SET
  transaction_type_id = (SELECT id FROM transaction_types WHERE type_code = 'LOAN_COLLECT'),
  loan_disbursement_id = 789,
  transfer_matched_transaction_id = 1001
WHERE raw_transaction_id = 'TXN-B'
-- Creates main_transaction_id: 1002
```

**Trigger Execution**:

```sql
-- Trigger: update_loan_disbursement_after_settlement()

-- Calculate total collected
SELECT SUM(amount) FROM main_transaction
WHERE loan_disbursement_id = 789
  AND type_code = 'LOAN_COLLECT'
  AND transfer_matched_transaction_id IS NOT NULL
-- Result: $3,000 (txn A) + $3,000 (txn B) = $6,000

-- Calculate remaining balance
remaining_balance = $10,000 - ($6,000 / 2) = $7,000

-- Update loan
UPDATE loan_disbursement SET
  remaining_balance = 7000.00,
  status = 'active',
  updated_at = NOW()
WHERE loan_disbursement_id = 789
```

**Account Balances**:
- Bank account 101: +$3,000 (cash increased)
- Loan receivable account 202: -$3,000 (asset decreased)
- Loan 789 remaining_balance: $7,000

---

#### Step 4: Second Payment Collection

**Date**: 2025-03-15, **Amount**: $2,000

Same process as Step 3.

**Result**:
- Total collected: ($6,000 + $2,000 + $2,000) / 2 = $5,000
- Remaining balance: $10,000 - $5,000 = $5,000
- Status: active

---

#### Step 5: Write Off Remaining Balance

**Date**: 2025-06-30, **Reason**: Employee terminated, uncollectible

**API**: POST `/api/loan-disbursements/789/writeoff`

```json
{
  "writeoff_amount": 5000.00,
  "writeoff_date": "2025-06-30",
  "reason": "Employee terminated, amount deemed uncollectible"
}
```

**Database Update**:

```sql
UPDATE loan_disbursement SET
  remaining_balance = 0.00,
  written_off_amount = 5000.00,
  written_off_date = '2025-06-30',
  status = 'written_off',
  notes = CONCAT(notes, E'\n\nWrite-off: Employee terminated, amount deemed uncollectible')
WHERE loan_disbursement_id = 789
```

**Final State**:
- Principal: $10,000
- Collected: $5,000
- Written off: $5,000
- Remaining: $0
- Status: written_off

---

### Example 2: Deleting a Payment

**Current State**:
- Principal: $10,000
- Payment 1: $3,000 (matched, txn 1001 ↔ 1002)
- Payment 2: $2,000 (matched, txn 1003 ↔ 1004)
- Remaining: $5,000

**User Action**: Delete Payment 1

**Process**:

```sql
-- Delete transaction A (cash side)
DELETE FROM main_transaction WHERE main_transaction_id = 1001;

-- Trigger fires (DELETE event)
-- Uses OLD.loan_disbursement_id = 789

-- Recalculate total collected
SELECT SUM(amount) FROM main_transaction
WHERE loan_disbursement_id = 789
  AND type_code = 'LOAN_COLLECT'
  AND transfer_matched_transaction_id IS NOT NULL
-- Result: $2,000 (txn 1003) + $2,000 (txn 1004) = $4,000

-- Calculate new remaining balance
remaining_balance = $10,000 - ($4,000 / 2) = $8,000

-- Update loan
UPDATE loan_disbursement SET
  remaining_balance = 8000.00,
  status = 'active'
WHERE loan_disbursement_id = 789
```

**Result**:
- Remaining balance automatically updated to $8,000
- Status remains 'active' (not overdue)

**Note**: The orphaned transaction (1002, loan receivable side) still exists but is no longer matched, so it doesn't affect balance calculation.

---

### Example 3: Attempting to Delete Business Partner with Loans

**Setup**:
- Partner: Jane Smith (partner_id: 999)
- Active loan: $50,000 (loan_disbursement_id: 555)

**User Action**: DELETE `/api/business-partners/999`

**API Protection**:

```typescript
const { count: loansCount } = await supabase
  .from('loan_disbursement')
  .select('*', { count: 'exact', head: true })
  .eq('partner_id', 999)

// loansCount = 1

return NextResponse.json({
  error: 'Cannot delete business partner with active loans',
  message: 'Jane Smith has 1 active loan. Delete the loan first or mark as written_off.',
  loans_count: 1
}, { status: 400 })
```

**Database Constraint** (if API bypassed):

```sql
DELETE FROM business_partners WHERE partner_id = 999;

-- ERROR: update or delete on table "business_partners" violates
-- foreign key constraint "loan_disbursement_partner_id_fkey"
-- on table "loan_disbursement"
-- DETAIL: Key (partner_id)=(999) is still referenced from table "loan_disbursement".
```

**Solution**:
1. Delete or write off the loan first
2. Then delete the business partner

---

## Summary

### Key Takeaways

1. **Two-Transaction System**: Every loan disbursement and collection involves TWO linked transactions (source + loan receivable)

2. **Transaction Matching**: Collections must be matched (`LOAN_COLLECT ↔ LOAN_COLLECT`) for balance calculation

3. **Automatic Balance Updates**: Triggers maintain loan balances automatically when transactions are added/changed/deleted

4. **Divide by 2**: Balance calculation divides total by 2 because each collection creates two transactions

5. **Deletion Protection**:
   - Cannot delete partners with loans (`ON DELETE RESTRICT`)
   - Cannot delete loans with payment history (API protection)
   - Deleting accounts cascades to loans (`ON DELETE CASCADE`)
   - Deleting loans nullifies transaction links (`ON DELETE SET NULL`)

6. **Status Tracking**: Loan status (`active`, `overdue`, `repaid`, `written_off`) updates automatically based on balance and due date

### Related Files

**Migrations**:
- `037_add_loan_receivable_system.sql` - Initial loan system
- `039_create_business_partners.sql` - Business partners table
- `040_remove_borrower_type_from_loans.sql` - Data model cleanup
- `042_simplify_transaction_types.sql` - Type consolidation
- `052_allow_loan_collect_matching.sql` - Enable LOAN_COLLECT matching
- `054_fix_loan_balance_trigger.sql` - Updated balance trigger

**API Routes**:
- `app/api/loan-disbursements/route.ts` - List and create loans
- `app/api/loan-disbursements/[id]/route.ts` - Get, update, delete loans
- `app/api/business-partners/route.ts` - Manage partners

**Types**:
- `types/loan.ts` - Loan TypeScript interfaces
- `types/business-partner.ts` - Partner TypeScript interfaces

**Documentation**:
- `docs/features/LOAN_RECEIVABLE_IMPLEMENTATION.md` - Feature overview
- `database/schema/SCHEMA.md` - Complete schema reference

---

**End of Technical Guide**
