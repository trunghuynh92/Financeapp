# Debt Drawdown System - Technical Guide

## Overview

The Debt Drawdown System tracks money borrowed from financial institutions (credit lines, term loans, credit cards). This system uses an **account-based matching approach** where DEBT_TAKE transactions are matched with debt_payable accounts, automatically creating the necessary records and paired transactions.

## Key Concepts

### What is a Debt Drawdown?

A **debt drawdown** represents a specific borrowing instance from a credit facility. When a company draws money from a credit line or takes a term loan, this creates:

1. **Source Transaction**: Credit on bank account (money received)
2. **Debt Drawdown Record**: Tracks the borrowing details (amount, due date, interest rate)
3. **Paired Transaction**: Debit on debt_payable account (liability increases)

### Account-Based Matching (Current System)

**User Action**: Match DEBT_TAKE transaction → Select debt_payable ACCOUNT
**System Action**: Auto-creates drawdown record + paired debit transaction

This is a **1-step process** that creates everything automatically.

### Transaction-Based Matching (Old System - Deprecated)

**User Action**: Match DEBT_TAKE transaction → Select another DEBT_TAKE transaction
**System Action**: Links two existing transactions

This required both transactions to already exist (imported separately).

## Database Schema

### Table: `debt_drawdown`

```sql
CREATE TABLE debt_drawdown (
  drawdown_id SERIAL PRIMARY KEY,

  -- Link to debt account (credit_line, term_loan, or credit_card)
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,

  -- Drawdown details
  drawdown_reference VARCHAR(100) NOT NULL,
  drawdown_date DATE NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL CHECK (original_amount > 0),
  remaining_balance DECIMAL(15,2) NOT NULL CHECK (remaining_balance >= 0),

  -- Terms
  due_date DATE,
  interest_rate DECIMAL(5,2),

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'settled', 'overdue', 'written_off')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_remaining_lte_original CHECK (remaining_balance <= original_amount)
);
```

### Column: `main_transaction.drawdown_id`

Links transactions to their debt drawdown:

```sql
ALTER TABLE main_transaction
ADD COLUMN drawdown_id INTEGER REFERENCES debt_drawdown(drawdown_id) ON DELETE SET NULL;
```

## Transaction Types

### DEBT_TAKE

- **Purpose**: Records money borrowed from credit facility
- **Direction**: Credit on bank account (asset increases)
- **Paired Transaction**: Debit on debt_payable account (liability increases)
- **Usage**: Used for both source transaction and paired transaction

### DEBT_PAY

- **Purpose**: Records debt repayment
- **Direction**: Debit on bank account (asset decreases)
- **Paired Transaction**: Credit on debt_payable account (liability decreases)
- **Features**: Supports transaction subtypes (principal, interest, fee, penalty)

## Workflow: Creating a Debt Drawdown

### Step 1: User Imports Transaction

User imports a bank statement showing money received:

```
Bank Account (Cash/Bank)
Credit: 5,000,000 VND
Description: "Credit line disbursement"
```

### Step 2: User Opens Match Dialog

User clicks "Unmatched Debt" badge → Opens `QuickMatchDebtDialog`

### Step 3: User Selects Debt Payable Account

Dialog shows list of debt_payable accounts:
- Credit Line - ABC Bank
- Term Loan - XYZ Bank
- Credit Card - DEF Bank

User selects: **Credit Line - ABC Bank**

### Step 4: User Enters Drawdown Details

Required:
- **Drawdown Reference**: DWN-2025-001 (auto-generated)

Optional:
- **Due Date**: 2026-01-19
- **Interest Rate**: 12.5%
- **Notes**: "Working capital for Q1"

### Step 5: System Creates Records

API: `POST /api/main-transactions/[id]/match-debt-drawdown`

**Creates:**

1. **debt_drawdown record**
```sql
INSERT INTO debt_drawdown (
  account_id,           -- Credit Line account
  drawdown_reference,   -- DWN-2025-001
  original_amount,      -- 5,000,000
  remaining_balance,    -- 5,000,000
  drawdown_date,        -- Transaction date
  due_date,             -- 2026-01-19
  interest_rate,        -- 12.5
  notes,                -- User notes
  status                -- 'active'
)
```

2. **original_transaction (payable side)**
```sql
INSERT INTO original_transaction (
  raw_transaction_id,   -- DEBT_TAKE_PAYABLE_[timestamp]_[random]
  account_id,           -- Credit Line account
  transaction_date,     -- Same as source
  description,          -- "Debt drawdown: DWN-2025-001"
  debit_amount,         -- 5,000,000 (liability increases)
  credit_amount,        -- NULL
  transaction_source    -- 'user_manual'
)
```

3. **main_transaction (auto-created by trigger)**
   - Sets transaction_type = DEBT_TAKE
   - Sets drawdown_id = new drawdown ID
   - Sets transfer_matched_transaction_id = source transaction ID

4. **Updates source transaction**
   - Sets transaction_type = DEBT_TAKE
   - Sets drawdown_id = new drawdown ID
   - Sets transfer_matched_transaction_id = payable transaction ID

### Step 6: Result

Two matched transactions:

**Bank Account** (source):
```
Date: 2025-01-19
Type: DEBT_TAKE
Amount: 5,000,000 (credit)
Drawdown ID: 123
Matched to: Credit Line transaction
```

**Credit Line** (auto-created):
```
Date: 2025-01-19
Type: DEBT_TAKE
Amount: 5,000,000 (debit)
Drawdown ID: 123
Matched to: Bank transaction
```

## Workflow: Unmatching a Debt Drawdown

### User Action

User clicks "Matched Debt" badge → Clicks "Change Match" → Confirms unmatch

### System Action (Automatic via Trigger)

API: `DELETE /api/transfers/unmatch/[id]`

**Trigger: `trigger_auto_delete_debt_drawdown_on_unmatch`**

When `transfer_matched_transaction_id` changes from NOT NULL → NULL:

```sql
1. Get raw_transaction_id from paired transaction
2. DELETE FROM original_transaction (payable side)
3. DELETE FROM main_transaction (payable side)
4. DELETE FROM debt_drawdown
```

**Result**: Clean slate - no orphaned records, proper bookkeeping maintained

### Why Auto-Delete?

**Bookkeeping Logic**: If a transaction is no longer matched as a debt drawdown, it means it's NOT a debt. Therefore:
- The drawdown record should not exist
- The paired transaction should not exist
- Only the source bank transaction remains (unmatched)

## API Endpoints

### 1. Match DEBT_TAKE to Create Drawdown

**Endpoint**: `POST /api/main-transactions/[id]/match-debt-drawdown`

**Request Body**:
```json
{
  "debt_payable_account_id": 38,
  "drawdown_reference": "DWN-2025-001",
  "due_date": "2026-01-19",
  "interest_rate": 12.5,
  "notes": "Working capital for Q1"
}
```

**Response**:
```json
{
  "data": {
    "drawdown": {
      "drawdown_id": 123,
      "account_id": 38,
      "drawdown_reference": "DWN-2025-001",
      "original_amount": 5000000,
      "remaining_balance": 5000000,
      "drawdown_date": "2025-01-19",
      "due_date": "2026-01-19",
      "interest_rate": 12.5,
      "status": "active",
      "account": {
        "account_id": 38,
        "account_name": "Credit Line - ABC Bank",
        "account_type": "credit_line",
        "bank_name": "ABC Bank"
      }
    },
    "source_transaction": { ... },
    "payable_transaction": { ... }
  },
  "message": "Debt drawdown created and matched successfully"
}
```

**Validations**:
- Source account must be bank or cash
- Source transaction must be credit (money in)
- Debt payable account must be credit_line, term_loan, or credit_card
- Accounts must belong to same entity
- Transaction must not already be linked to a drawdown

### 2. Get Drawdowns for Account

**Endpoint**: `GET /api/debt/drawdowns?account_id=38`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "drawdown_id": 123,
      "drawdown_reference": "DWN-2025-001",
      "original_amount": 5000000,
      "remaining_balance": 2500000,
      "status": "active",
      "drawdown_date": "2025-01-19",
      "due_date": "2026-01-19",
      "interest_rate": 12.5,
      "account_id": 38
    }
  ]
}
```

### 3. Match DEBT_PAY to Drawdown (Payment)

**Endpoint**: `POST /api/debt/match-payback`

**Request Body**:
```json
{
  "payback_transaction_id": 456,
  "drawdown_id": 123
}
```

**What It Does**:
- Creates DEBT_PAY transaction on credit line account
- Matches with bank payment transaction
- Updates drawdown.remaining_balance (via trigger)
- Handles overpayment with credit memo

### 4. Unmatch Transaction

**Endpoint**: `DELETE /api/transfers/unmatch/[id]`

**What It Does**:
- Sets transfer_matched_transaction_id to NULL
- Triggers auto-delete of drawdown and paired transaction
- Maintains data integrity

## Database Triggers

### Trigger #1: `update_drawdown_after_settlement`

**Purpose**: Auto-update drawdown balance when payments are made

**Fires On**: INSERT, UPDATE, DELETE on main_transaction (DEBT_PAY)

**What It Does**:
```sql
1. Sum all DEBT_PAY amounts for this drawdown
2. Calculate remaining_balance = original_amount - total_paid
3. Update drawdown.remaining_balance
4. Update drawdown.status if fully paid
5. Set drawdown.is_overpaid flag if overpayment detected
```

### Trigger #2: `trigger_auto_delete_debt_drawdown_on_unmatch`

**Purpose**: Auto-delete drawdown when unmatched

**Fires On**: UPDATE of transfer_matched_transaction_id on main_transaction

**Detects**: NULL transition (transfer_matched_transaction_id: value → NULL)

**What It Does**:
```sql
IF OLD.transfer_matched_transaction_id IS NOT NULL
   AND NEW.transfer_matched_transaction_id IS NULL
   AND OLD.drawdown_id IS NOT NULL THEN

   1. Get raw_transaction_id from paired transaction
   2. DELETE FROM original_transaction (payable side)
   3. DELETE FROM main_transaction (payable side)
   4. DELETE FROM debt_drawdown
END IF
```

**Why Original Transaction First?**

The original_transaction must be deleted BEFORE main_transaction to avoid:
- Orphaned records in original_transaction table
- Foreign key constraint violations
- Incomplete cleanup

## UI Components

### QuickMatchDebtDialog

**Location**: `components/main-transactions/QuickMatchDebtDialog.tsx`

**Features**:
- Shows list of debt_payable accounts
- Input fields for drawdown details
- Auto-generates drawdown reference
- Real-time validation
- Account selection with radio buttons
- Optional fields (due date, interest rate, notes)

**Workflow**:
1. User opens dialog from "Unmatched Debt" badge
2. Selects debt_payable account from list
3. Enters drawdown reference (auto-filled)
4. Optionally enters due date, interest rate, notes
5. Clicks "Create Debt Drawdown"
6. System creates everything automatically

## Account Types for Debt

### credit_line
- Revolving credit facility
- Can draw and repay multiple times
- Each draw creates a separate drawdown record
- Tracks total drawn vs credit limit

### term_loan
- Fixed-term borrowing
- Usually single drawdown at loan origination
- Fixed repayment schedule
- Interest rate typically fixed

### credit_card
- Revolving credit for purchases
- Multiple small transactions (optional)
- Monthly billing cycles
- Interest charged on outstanding balance

## Transaction Subtypes (DEBT_PAY only)

```sql
ALTER TABLE main_transaction
ADD COLUMN transaction_subtype VARCHAR(20) DEFAULT 'regular'
  CHECK (transaction_subtype IN ('regular', 'principal', 'interest', 'fee', 'penalty'));
```

**Usage**:
- **principal**: Reduces the borrowed amount
- **interest**: Interest payment
- **fee**: Bank fees, service charges
- **penalty**: Late payment penalties

**Benefit**: Detailed tracking of where payments are going

## Payment Workflow

### Scenario: Paying Down a Drawdown

**Starting State**:
```
Drawdown #123
Original: 5,000,000 VND
Remaining: 5,000,000 VND
Status: active
```

**User Action**: Import bank debit of 1,000,000 VND

**Matching**: Call `/api/debt/match-payback`
```json
{
  "payback_transaction_id": 789,
  "drawdown_id": 123
}
```

**System Creates**:

1. DEBT_PAY transaction on credit line (credit = liability decreases)
2. Matches with bank debit transaction
3. Trigger updates drawdown:
   - remaining_balance: 4,000,000 VND
   - status: still 'active'

**Result**:
```
Drawdown #123
Original: 5,000,000 VND
Remaining: 4,000,000 VND
Paid: 1,000,000 VND
Status: active
```

## Status Transitions

### active
- Initial state when drawdown is created
- Has outstanding balance > 0
- Not overdue

### overdue
- Due date has passed
- Still has outstanding balance > 0
- Auto-updated by scheduled job (if implemented)

### settled
- Fully paid (remaining_balance = 0)
- All payments recorded
- Auto-updated by trigger

### written_off
- Manually set by user
- Debt determined uncollectible
- Remaining balance written off as loss

## Overpayment Handling

### Scenario: Payment Exceeds Balance

**Starting State**:
```
Drawdown #123
Original: 5,000,000 VND
Remaining: 1,000,000 VND
```

**User Action**: Pay 1,500,000 VND

**System Action**:
1. Updates remaining_balance: 0 VND
2. Sets is_overpaid: true
3. Records overpayment_amount: 500,000 VND
4. Creates credit memo (optional, if configured)

**Result**:
```
Drawdown #123
Original: 5,000,000 VND
Remaining: 0 VND
Overpaid: 500,000 VND
Status: settled
is_overpaid: true
```

## Integration with Main Transaction View

### Badge System

**Unmatched Debt** (Yellow Badge):
- Shows when DEBT_TAKE has no transfer_matched_transaction_id
- Clicking opens QuickMatchDebtDialog
- Prompts user to match with debt_payable account

**Matched Debt** (Green Badge):
- Shows when DEBT_TAKE has transfer_matched_transaction_id
- Clicking opens QuickMatchDebtDialog in "Change Match" mode
- Can unmatch (auto-deletes drawdown)

### Dropdown in Edit Dialog

When editing a transaction, users can:
1. Select "Debt Drawdown" from category dropdown
2. Change transaction type to DEBT_TAKE
3. Badge automatically appears
4. User can then match via badge

## Key Differences: Old vs New System

| Aspect | Old System (Deprecated) | New System (Current) |
|--------|------------------------|---------------------|
| **Matching** | Transaction ↔ Transaction | Transaction ↔ Account |
| **Workflow** | 2-step: Create drawdown separately → Import both transactions → Match | 1-step: Match → Creates everything |
| **Paired Transaction** | Must exist beforehand | Auto-created |
| **Drawdown Record** | Must be created manually first | Auto-created during match |
| **Unmatch Behavior** | Leaves drawdown intact | Auto-deletes drawdown + paired transaction |
| **User Experience** | Complex, error-prone | Simple, automated |
| **Data Integrity** | Manual cleanup needed | Automatic via triggers |

## Key Takeaways

1. **Account-Based Matching**: DEBT_TAKE transactions are matched with debt_payable ACCOUNTS, not with other transactions

2. **Auto-Creation**: System automatically creates:
   - debt_drawdown record
   - Paired debit transaction on debt_payable account
   - Bidirectional matching links

3. **Auto-Delete on Unmatch**: When unmatching, trigger automatically deletes:
   - Paired transaction's original_transaction (first!)
   - Paired transaction's main_transaction
   - debt_drawdown record
   - This maintains proper bookkeeping integrity

4. **No Partner/Debtor**: Unlike loans (which have partner_id), debt drawdowns don't link to business partners. The lender information is in the account's bank_name.

5. **Transaction Subtypes**: DEBT_PAY supports subtypes (principal, interest, fee, penalty) for detailed payment tracking

6. **Balance Auto-Update**: Triggers automatically maintain remaining_balance when payments are made

7. **Parallel to Loans**: Debt system mirrors the loan disbursement system but inverted (liability vs asset)

## Related Files

### API Routes
- `app/api/main-transactions/[id]/match-debt-drawdown/route.ts` - Create drawdown via matching
- `app/api/debt/match-payback/route.ts` - Match payment to drawdown
- `app/api/debt/drawdowns/route.ts` - Get drawdowns for account

### UI Components
- `components/main-transactions/QuickMatchDebtDialog.tsx` - Match dialog with account selection
- `components/create-drawdown-dialog.tsx` - Create drawdown manually (legacy)
- `components/edit-drawdown-dialog.tsx` - Edit drawdown details
- `components/drawdown-list-card.tsx` - Display drawdown list

### Database Migrations
- `015_debt_drawdown_system.sql` - Initial debt drawdown tables and triggers
- `021_add_debt_payback_system.sql` - Payment matching system
- `042_simplify_transaction_types.sql` - Consolidated to DEBT_TAKE, DEBT_PAY
- `069_auto_delete_debt_drawdown_on_unmatch.sql` - Auto-delete trigger (new system)

### Types
- `types/debt.ts` - TypeScript interfaces for debt drawdown system

---

**Last Updated**: January 2025
**System Version**: Account-Based Matching (v2.0)
