# Investment Account System - Technical Documentation

**Feature**: Investment Account Contribution Tracking
**Version**: 5.0.0
**Status**: Production
**Date**: 2025-01-19

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Transaction Types](#transaction-types)
4. [API Endpoints](#api-endpoints)
5. [UI Components](#ui-components)
6. [Transaction Flow](#transaction-flow)
7. [Usage Examples](#usage-examples)
8. [Future Enhancements](#future-enhancements)

---

## Overview

The Investment Account System allows users to track money invested from bank/cash accounts into investment accounts. It follows a similar pattern to the Loan Receivable system but is simpler since investments are personal assets without third-party relationships.

### Key Features

- Track investment contributions from bank/cash to investment accounts
- Auto-create investment accounts when needed
- Record withdrawals from investments
- Track unrealized gains/losses via checkpoints
- Record realized gains via income transactions
- Support for paired transaction matching

### Core Concepts

**Investment Contribution**: Money moved from a bank/cash account to an investment account
```
Bank Account (Debit ₫60M) → Investment Account (Credit ₫60M)
```

**Investment Withdrawal**: Money moved from investment account back to bank/cash
```
Investment Account (Debit ₫63M) → Bank Account (Credit ₫63M)
```

**Gain/Loss Tracking**: Tracked separately via:
- **Unrealized gains**: Balance adjustments via checkpoints
- **Realized gains**: Income transactions when withdrawn

---

## Database Schema

### Migration 064: `investment_contribution` Table

```sql
CREATE TABLE investment_contribution (
  contribution_id SERIAL PRIMARY KEY,

  -- Entity and account relationships
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  investment_account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  source_account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,

  -- Contribution details
  contribution_amount DECIMAL(15, 2) NOT NULL CHECK (contribution_amount > 0),
  contribution_date DATE NOT NULL,

  -- Transaction linking
  main_transaction_id INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'partial_withdrawal', 'fully_withdrawn')),

  -- Optional fields
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

### Indexes

```sql
CREATE INDEX idx_investment_contribution_entity
  ON investment_contribution(entity_id);

CREATE INDEX idx_investment_contribution_investment_account
  ON investment_contribution(investment_account_id);

CREATE INDEX idx_investment_contribution_source_account
  ON investment_contribution(source_account_id);

CREATE INDEX idx_investment_contribution_date
  ON investment_contribution(contribution_date DESC);

CREATE INDEX idx_investment_contribution_status
  ON investment_contribution(status);

CREATE INDEX idx_investment_contribution_main_transaction
  ON investment_contribution(main_transaction_id);
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `contribution_id` | Serial | Primary key |
| `entity_id` | UUID | Entity that owns the investment |
| `investment_account_id` | Integer | Investment account receiving funds |
| `source_account_id` | Integer | Bank/cash account providing funds |
| `contribution_amount` | Decimal(15,2) | Amount invested |
| `contribution_date` | Date | Date of contribution |
| `main_transaction_id` | Integer | Links to main transaction (optional) |
| `status` | Text | Status: active, partial_withdrawal, fully_withdrawn |
| `notes` | Text | Optional notes |
| `created_by` | UUID | User who created the contribution |

---

## Transaction Types

### Migration 065: Investment Transaction Types

Two new transaction types were added:

#### 1. `investment_contribution` (INV_CONTRIB)
- **Code**: `INV_CONTRIB`
- **Display**: "Investment Contribution"
- **Affects Cashflow**: `true`
- **Usage**: Money moved FROM bank/cash TO investment account
- **Applied to**: Both source (bank/cash) and destination (investment) transactions

#### 2. `investment_withdrawal` (INV_WITHDRAW)
- **Code**: `INV_WITHDRAW`
- **Display**: "Investment Withdrawal"
- **Affects Cashflow**: `true`
- **Usage**: Money moved FROM investment TO bank/cash account
- **Applied to**: Both source (investment) and destination (bank/cash) transactions

---

## API Endpoints

### POST `/api/investment-contributions`

Creates a new investment contribution with paired transactions.

**Request Body** (`CreateInvestmentContributionInput`):
```typescript
{
  investment_account_id?: number,          // Optional: auto-created if not provided
  source_account_id: number,               // Required: bank/cash account
  contribution_amount: number,             // Required: amount to invest
  contribution_date: string,               // Required: ISO date
  notes?: string,                          // Optional: additional notes
  existing_source_transaction_id?: number  // Optional: link to existing transaction
}
```

**Response** (201 Created):
```typescript
{
  data: InvestmentContribution,
  message: string,
  investment_account_id: number,
  account_auto_created: boolean,
  suggest_match: boolean,
  match_data: {
    main_transaction_id: number,
    investment_transaction_id: number
  }
}
```

**Behavior**:
1. Validates source account (must be bank/cash)
2. Auto-creates investment account if not provided
3. Creates investment_contribution record
4. Creates source transaction (bank debit)
5. Creates investment transaction (investment credit)
6. Both transactions use `INV_CONTRIB` type
7. Links contribution to main_transaction_id
8. Returns match suggestions for UI

### GET `/api/investment-contributions`

Retrieves investment contributions for an account or entity.

**Query Parameters**:
- `account_id`: Filter by investment account ID
- `entity_id`: Filter by entity ID (fetches all investment accounts)

**Response** (200 OK):
```typescript
{
  data: InvestmentContributionWithAccounts[],
  count: number
}
```

**Returns**:
```typescript
{
  contribution_id: number,
  entity_id: string,
  investment_account_id: number,
  source_account_id: number,
  contribution_amount: number,
  contribution_date: string,
  status: 'active' | 'partial_withdrawal' | 'fully_withdrawn',
  notes: string | null,
  investment_account: {
    account_id: number,
    account_name: string,
    account_type: string,
    entity: { id: string, name: string }
  },
  source_account: {
    account_id: number,
    account_name: string,
    account_type: string
  }
}
```

---

## UI Components

### 1. `InvestmentContributionListCard`

**Location**: `components/investment-contribution-list-card.tsx`

**Purpose**: Display list of investment contributions for an investment account

**Props**:
```typescript
{
  accountId: number,       // Investment account ID
  accountName: string,     // Investment account name
  currency: string,        // Currency code (VND, USD, etc.)
  onRefresh?: () => void   // Callback after data changes
}
```

**Features**:
- Stats summary: total invested, active contributions, latest date
- Filterable table by status
- View transactions dialog
- Create new contribution button

### 2. `CreateInvestmentContributionDialog`

**Location**: `components/create-investment-contribution-dialog.tsx`

**Purpose**: Dialog for creating new investment contributions

**Props**:
```typescript
{
  open: boolean,
  onOpenChange: (open: boolean) => void,
  accountId?: number,                    // Optional: pre-fill investment account
  accountName?: string,
  prefilledSourceAccountId?: number,     // Optional: pre-fill source account
  prefilledAmount?: number,              // Optional: pre-fill amount
  prefilledDate?: string,                // Optional: pre-fill date
  existingSourceTransactionId?: number,  // Optional: link to existing transaction
  onSuccess: () => void
}
```

**Features**:
- Source account selection (bank/cash only)
- Investment account selection (auto-create option)
- Amount input
- Date picker
- Notes textarea
- Validation and error handling
- Loading states

---

## Transaction Flow

### Making an Investment Contribution

**Example**: Invest ₫60M from Bank Account to Investment Account on Nov 1st

#### Step 1: Create Contribution Record
```sql
INSERT INTO investment_contribution (
  entity_id, investment_account_id, source_account_id,
  contribution_amount, contribution_date, status
) VALUES (
  'entity-uuid', 101, 201, 60000000, '2025-11-01', 'active'
);
```

#### Step 2: Create Source Transaction (Bank Debit)
```sql
INSERT INTO original_transaction (
  raw_transaction_id, account_id, transaction_date, description,
  debit_amount, credit_amount, transaction_source
) VALUES (
  'TXN-1234567890-abc123', 201, '2025-11-01',
  'Investment contribution', 60000000, NULL, 'user_manual'
);

UPDATE main_transaction SET
  transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV_CONTRIB'),
  description = 'Investment contribution'
WHERE raw_transaction_id = 'TXN-1234567890-abc123';
```

#### Step 3: Create Investment Transaction (Investment Credit)
```sql
INSERT INTO original_transaction (
  raw_transaction_id, account_id, transaction_date, description,
  debit_amount, credit_amount, transaction_source
) VALUES (
  'TXN-1234567891-def456', 101, '2025-11-01',
  'Investment contribution', NULL, 60000000, 'user_manual'
);

UPDATE main_transaction SET
  transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV_CONTRIB'),
  description = 'Investment contribution'
WHERE raw_transaction_id = 'TXN-1234567891-def456';
```

#### Result
- Bank Account: Balance decreased by ₫60M (debit)
- Investment Account: Balance increased by ₫60M (credit)
- Both transactions linked via `INV_CONTRIB` type
- Contribution record created with `active` status

### Tracking Market Value Changes

**Example**: Investment grows from ₫100M to ₫112M by Nov 30th

#### Step 1: Create Checkpoint
```sql
-- User creates a checkpoint with market value ₫112M
-- This generates a balance adjustment of +₫12M (unrealized gain)
INSERT INTO balance_checkpoint (
  account_id, checkpoint_date, checkpoint_balance
) VALUES (
  101, '2025-11-30', 112000000
);
```

#### Step 2: System Calculates Adjustment
```
Previous balance: ₫100M
Checkpoint balance: ₫112M
Adjustment needed: +₫12M (unrealized gain)
```

### Withdrawing from Investment (with Realized Gain)

**Example**: Sell stocks worth ₫63M on Dec 8th (original cost ₫60M, profit ₫3M)

#### Step 1: Create Withdrawal Transactions
```sql
-- Investment Account Debit
INSERT INTO original_transaction VALUES (
  'TXN-1234567892-ghi789', 101, '2025-12-08',
  'Investment withdrawal', 63000000, NULL, 'user_manual'
);

-- Bank Account Credit
INSERT INTO original_transaction VALUES (
  'TXN-1234567893-jkl012', 201, '2025-12-08',
  'Investment withdrawal', NULL, 63000000, 'user_manual'
);

-- Both use INV_WITHDRAW type
UPDATE main_transaction SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV_WITHDRAW'
) WHERE raw_transaction_id IN ('TXN-1234567892-ghi789', 'TXN-1234567893-jkl012');
```

#### Step 2: Record Realized Gain
```sql
-- Create income transaction for ₫3M gain on investment account
INSERT INTO original_transaction VALUES (
  'TXN-1234567894-mno345', 101, '2025-12-08',
  'Realized gain from sale', NULL, 3000000, 'user_manual'
);

UPDATE main_transaction SET
  transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'),
  description = 'Realized gain from sale'
WHERE raw_transaction_id = 'TXN-1234567894-mno345';
```

#### Result
- Investment Account: -₫63M (withdrawal) + ₫3M (gain) = -₫60M net
- Bank Account: +₫63M (cash received)
- Realized gain of ₫3M recorded as income

---

## Usage Examples

### Example 1: Simple Investment

```typescript
// Create investment contribution
const contribution = {
  source_account_id: 201,        // Bank account
  contribution_amount: 60000000, // ₫60M
  contribution_date: '2025-11-01',
  notes: 'Initial investment in stocks'
}

const response = await fetch('/api/investment-contributions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(contribution)
})

const result = await response.json()
console.log('Investment created:', result.data)
console.log('Account auto-created:', result.account_auto_created)
```

### Example 2: Investment with Pre-existing Account

```typescript
// Use existing investment account
const contribution = {
  investment_account_id: 101,    // Existing investment account
  source_account_id: 201,
  contribution_amount: 40000000, // ₫40M additional
  contribution_date: '2025-11-15',
  notes: 'Second investment tranche'
}

const response = await fetch('/api/investment-contributions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(contribution)
})
```

### Example 3: Fetch Contributions for Account

```typescript
// Get all contributions for investment account
const response = await fetch('/api/investment-contributions?account_id=101')
const data = await response.json()

console.log(`Found ${data.count} contributions`)
data.data.forEach(contrib => {
  console.log(`${contrib.contribution_date}: ${contrib.contribution_amount} from ${contrib.source_account.account_name}`)
})
```

### Example 4: Fetch Contributions for Entity

```typescript
// Get all contributions across all investment accounts for an entity
const response = await fetch('/api/investment-contributions?entity_id=entity-uuid')
const data = await response.json()

console.log(`Total contributions across all accounts: ${data.count}`)
```

---

## Future Enhancements

### Planned Features

1. **Investment Withdrawal API**
   - POST `/api/investment-withdrawals`
   - Track partial and full withdrawals
   - Auto-update contribution status

2. **Gain/Loss Reporting**
   - Calculate realized gains per contribution
   - Track unrealized gains via checkpoints
   - Generate investment performance reports

3. **Investment Categories**
   - Add `investment_category` field (stocks, bonds, real estate, crypto, etc.)
   - Filter and group by category
   - Category-specific analytics

4. **Investment Performance Tracking**
   - ROI calculations
   - Time-weighted returns
   - Benchmark comparisons
   - Performance charts

5. **Dividend/Interest Tracking**
   - Record dividends as income transactions
   - Link dividends to specific contributions
   - Calculate dividend yield

6. **Tax Reporting**
   - Capital gains/losses summary
   - Dividend income summary
   - Cost basis tracking
   - Export tax reports

### Known Limitations

1. **No withdrawal API yet**: Withdrawals must be created manually as transactions
2. **No investment categories**: All investments are generic (no stock vs bond distinction)
3. **No automatic gain/loss calculation**: Must be done manually via checkpoints
4. **No dividend tracking**: Dividends recorded as generic income

---

## Related Files

**Database Migrations**:
- `database/migrations/064_create_investment_contributions.sql` - Main table
- `database/migrations/065_add_investment_transaction_types.sql` - Transaction types
- `scripts/run-migration-064.ts` - Migration 064 runner
- `scripts/run-migration-065.ts` - Migration 065 runner

**Type Definitions**:
- `types/investment.ts` - TypeScript types and interfaces

**API Routes**:
- `app/api/investment-contributions/route.ts` - GET and POST endpoints

**UI Components**:
- `components/investment-contribution-list-card.tsx` - List and stats display
- `components/create-investment-contribution-dialog.tsx` - Creation dialog

**Documentation**:
- `docs/features/LOAN_RECEIVABLE_IMPLEMENTATION.md` - Similar pattern reference
- `database/schema/SCHEMA.md` - Overall database schema

---

## Support

For issues or questions about the investment system:
1. Check this documentation first
2. Review the Loan Receivable implementation (similar pattern)
3. Check migration logs for database-related issues
4. Review API error messages and console logs

---

**End of Documentation**
