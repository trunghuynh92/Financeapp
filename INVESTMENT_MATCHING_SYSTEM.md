# Investment Matching System Implementation

**Version**: 5.0.0
**Date**: November 19, 2025
**Status**: Complete ✅

---

## Overview

This document describes the complete implementation of the Investment Matching System added in version 5.0.0. This feature enables users to track investments by linking bank/cash account transactions with investment account positions, creating paired double-entry bookkeeping records.

## Business Purpose

Investment tracking requires linking source transactions (withdrawals from bank/cash accounts) with investment positions (credits to investment accounts). This system:
- Maintains double-entry accounting for investments
- Tracks investment contributions and withdrawals
- Provides clear visibility of matched vs unmatched investment transactions
- Enables proper balance tracking across accounts

---

## System Architecture

### Database Schema

#### 1. Investment Accounts Table (`investment_accounts`)

Stores investment account types and metadata.

**Key Features:**
- Investment types: Stocks, Bonds, Mutual Funds, Real Estate, Cryptocurrency, Commodities, etc.
- Risk level tracking (Low, Medium, High, Very High)
- Account number and institution tracking
- Entity-based isolation with RLS

**Columns:**
- `investment_account_id` (SERIAL PRIMARY KEY)
- `investment_type` (TEXT) - Type of investment
- `risk_level` (TEXT) - Investment risk classification
- `account_number` (TEXT, UNIQUE) - Investment account identifier
- `institution_name` (TEXT) - Financial institution name
- `notes` (TEXT) - Additional information
- Metadata: entity_id, timestamps

**Migration**: 064_add_investment_accounts.sql

#### 2. Investment Types Table (`investment_types`)

Predefined investment categories for classification.

**Supported Types:**
- Stocks
- Bonds
- Mutual Funds
- ETFs (Exchange-Traded Funds)
- Real Estate
- Cryptocurrency
- Commodities
- Savings Accounts
- Certificates of Deposit (CDs)
- Retirement Accounts
- Hedge Funds
- Private Equity
- Other

**Migration**: 065_add_investment_types.sql

#### 3. Investment Contribution Table (`investment_contribution`)

Links source account transactions with investment account positions.

**Key Features:**
- Creates paired transactions for double-entry bookkeeping
- Links existing source transactions or creates new ones
- Automatically creates corresponding investment account transaction
- Tracks contribution amounts and dates

**Columns:**
- `contribution_id` (SERIAL PRIMARY KEY)
- `entity_id` (UUID, FK → entities)
- `investment_account_id` (INTEGER, FK → accounts)
- `source_account_id` (INTEGER, FK → accounts)
- `contribution_amount` (NUMERIC(15,2))
- `contribution_date` (DATE)
- `notes` (TEXT)
- `main_transaction_id` (INTEGER, FK → main_transaction)
- Metadata: created_at, created_by_user_id

**Migration**: Not explicitly created (managed through application)

#### 4. Investment Contribution Link

Added `investment_contribution_id` column to `main_transaction` table to link transactions.

**Purpose**: Links both source and investment account transactions to the same contribution record

**Migration**: 066_add_investment_contribution_link.sql

#### 5. View Update

Updated `main_transaction_details` view to include `investment_contribution_id`.

**Purpose**: Enables UI to display matched/unmatched status on transaction badges

**Migration**: 067_add_investment_contribution_to_view.sql

---

## API Endpoints

### Investment Contributions

**Base Path**: `/api/investment-contributions`

#### POST `/api/investment-contributions`
Creates a new investment contribution (matches an investment).

**Request Body:**
```json
{
  "source_account_id": 10,
  "investment_account_id": 36,
  "contribution_amount": 2000000000,
  "contribution_date": "2025-11-19",
  "notes": "Q4 2025 contribution",
  "existing_source_transaction_id": 27808  // Optional
}
```

**Response:**
```json
{
  "data": {
    "contribution_id": 5,
    "entity_id": "uuid",
    "investment_account_id": 36,
    "source_account_id": 10,
    "contribution_amount": 2000000000,
    "contribution_date": "2025-11-19",
    "notes": "Q4 2025 contribution",
    "main_transaction_id": 27808
  }
}
```

**Behavior:**
- If `existing_source_transaction_id` is provided:
  - Updates the existing transaction with INV_CONTRIB type
  - Sets `investment_contribution_id` on the transaction
- If not provided:
  - Creates new source transaction (debit in source account)
- Always creates paired investment account transaction (credit)
- Links both transactions via `investment_contribution_id`

#### GET `/api/investment-contributions`
Fetches investment contributions with optional filtering.

**Query Parameters:**
- `investment_account_id` - Filter by investment account
- `source_account_id` - Filter by source account
- `entity_id` - Filter by entity

**Response:**
```json
{
  "data": [
    {
      "contribution_id": 5,
      "contribution_amount": 2000000000,
      "contribution_date": "2025-11-19",
      "source_account": {
        "account_name": "ACB Checking",
        "bank_name": "ACB Bank"
      }
    }
  ]
}
```

#### DELETE `/api/investment-contributions/[id]`
Deletes an investment contribution (unmatches).

**Behavior:**
1. Finds all transactions linked to the contribution
2. **For investment account transactions**: Deletes completely (original_transaction + main_transaction)
3. **For source account transactions**: Clears `investment_contribution_id` link only (keeps the transaction)
4. Deletes the contribution record

**Important**: Source transactions are preserved, only the link is removed. This allows re-matching if needed.

---

## UI Components

### 1. Transaction Badges

**Location**: `app/dashboard/main-transactions/page.tsx`

**Badge States:**
- **Yellow "Unmatched Investment"**: Transaction has INV_CONTRIB type but no investment_contribution_id
  - Clickable → Opens QuickMatch dialog
- **Green "Matched Investment"**: Transaction has investment_contribution_id set
  - Clickable → Opens Unmatch dialog
- Similar badges for INV_WITHDRAW type

### 2. QuickMatchInvestmentDialog

**Location**: `components/main-transactions/QuickMatchInvestmentDialog.tsx`

**Purpose**: Match an existing transaction to an investment account

**Features:**
- Displays source transaction details
- Lists available investment accounts for the entity
- Radio button selection
- Calls investment-contributions POST API with `existing_source_transaction_id`

**User Flow:**
1. Click yellow "Unmatched Investment" badge
2. Dialog shows transaction details
3. Select target investment account
4. Click "Create Matched Investment"
5. Badge turns green

### 3. UnmatchInvestmentDialog

**Location**: `components/main-transactions/UnmatchInvestmentDialog.tsx`

**Purpose**: Remove investment match (unlink transactions)

**Features:**
- Shows warning about what will be deleted
- Displays source transaction details
- Calls investment-contributions DELETE API

**User Flow:**
1. Click green "Matched Investment" badge
2. Dialog warns about deletion
3. Confirms unmatch
4. Deletes investment account transaction
5. Clears link on source transaction
6. Badge returns to yellow "Unmatched"

### 4. InvestmentContributionListCard

**Location**: `components/investment-contribution-list-card.tsx`

**Purpose**: Display all contributions for an investment account

**Features:**
- Shows on investment account detail pages
- Displays stats (total contributed, # of contributions, date range)
- Table of all contributions with dates, amounts, source accounts
- View linked transactions button
- Similar to LoanDisbursementListCard

**Location Used**: `app/dashboard/accounts/[id]/page.tsx` (for investment accounts)

---

## Database Triggers & Automation

### 1. Auto-Create Main Transaction Trigger

**Trigger**: `trigger_auto_create_main_transaction`
**Function**: `auto_create_main_transaction()`
**Table**: `original_transaction`

**Purpose**: Automatically creates main_transaction records when original_transaction records are inserted.

**Behavior for Investment Contributions:**
- When investment-contributions API creates an original_transaction for the investment account
- Trigger automatically creates corresponding main_transaction
- Sets default transaction type (INC for credit)
- Ensures both original and main records exist

**Note**: This trigger is critical for the investment matching system to work properly. Without it, investment account transactions wouldn't appear in the main_transaction table, and badges wouldn't show as matched.

---

## Transaction Types

### INV_CONTRIB (Investment Contribution)
- **Type Code**: INV_CONTRIB
- **Transaction Type ID**: 26
- **Direction**: Debit (for source account)
- **Purpose**: Represents money withdrawn from bank/cash to invest

### INV_WITHDRAW (Investment Withdrawal)
- **Type Code**: INV_WITHDRAW
- **Transaction Type ID**: 27
- **Direction**: Credit (for source account)
- **Purpose**: Represents money withdrawn from investment back to bank/cash

---

## User Workflows

### Workflow 1: Manual Investment Matching

**Scenario**: User has already recorded a withdrawal from their bank account and wants to match it to an investment.

**Steps:**
1. Navigate to Main Transactions page
2. Find the transaction with yellow "Unmatched Investment" badge
3. Click the badge
4. QuickMatchInvestmentDialog opens
5. Select the target investment account from dropdown
6. Click "Create Matched Investment"
7. System creates:
   - Investment contribution record
   - Paired transaction in investment account (credit)
   - Links both transactions via investment_contribution_id
8. Badge turns green showing "Matched Investment"

### Workflow 2: Automatic Investment Creation

**Scenario**: User wants to record a new investment contribution.

**Steps:**
1. Navigate to Main Transactions page
2. Click "Add Transaction"
3. Select transaction type "Investment Contribution"
4. Select source account (bank/cash)
5. Select investment account
6. Enter amount and date
7. Save
8. System creates:
   - Source transaction (debit in bank/cash)
   - Investment transaction (credit in investment account)
   - Investment contribution record linking them
9. Both transactions show green "Matched Investment" badges

### Workflow 3: Unmatch Investment

**Scenario**: User made a mistake and wants to unmatch an investment.

**Steps:**
1. Navigate to Main Transactions page
2. Find the matched transaction with green "Matched Investment" badge
3. Click the badge
4. UnmatchInvestmentDialog opens with warning
5. Click "Unmatch Investment"
6. System:
   - Deletes the investment account transaction completely
   - Clears investment_contribution_id from source transaction
   - Deletes the investment contribution record
7. Source transaction remains with yellow "Unmatched Investment" badge
8. User can re-match to a different investment account if needed

### Workflow 4: View Investment Account Contributions

**Scenario**: User wants to see all contributions to a specific investment account.

**Steps:**
1. Navigate to Accounts page
2. Click on an investment account (e.g., "SSI Securities")
3. Account detail page shows:
   - Current balance
   - InvestmentContributionListCard with:
     - Stats: Total Contributed, Total Contributions, Period
     - Table of all contributions
     - Source account for each contribution
     - Dates and amounts
4. Click receipt icon to view linked transactions
5. Dialog shows both source and investment transactions

---

## Technical Details

### Double-Entry Bookkeeping

Investment matching creates paired transactions:

**Example: $2,000 investment from bank to stocks**

| Account | Type | Direction | Amount | Link |
|---------|------|-----------|--------|------|
| ACB Checking | Bank | Debit | -$2,000 | contribution_id: 5 |
| SSI Securities | Investment | Credit | +$2,000 | contribution_id: 5 |

Both transactions have `investment_contribution_id = 5`, linking them together.

### Badge Logic

```typescript
// Unmatched: Has INV_CONTRIB type but no link
!tx.investment_contribution_id && tx.transaction_type_code === 'INV_CONTRIB'

// Matched: Has link set
tx.investment_contribution_id && tx.transaction_type_code === 'INV_CONTRIB'
```

### Deletion Behavior

When unmatching:
```typescript
if (tx.account_id === investment_account_id) {
  // DELETE investment account transaction
  deleteOriginalTransaction(tx.raw_transaction_id)
} else {
  // CLEAR link only for source transaction
  updateMainTransaction(tx.raw_transaction_id, {
    investment_contribution_id: null
  })
}
```

---

## Files Modified/Created

### Database Migrations
- `database/migrations/064_add_investment_accounts.sql` - Investment accounts table
- `database/migrations/065_add_investment_types.sql` - Investment types reference
- `database/migrations/066_add_investment_contribution_link.sql` - Link column
- `database/migrations/067_add_investment_contribution_to_view.sql` - View update

### API Routes
- `app/api/investment-contributions/route.ts` - GET, POST endpoints
- `app/api/investment-contributions/[id]/route.ts` - DELETE endpoint

### UI Components
- `components/main-transactions/QuickMatchInvestmentDialog.tsx` - Match dialog
- `components/main-transactions/UnmatchInvestmentDialog.tsx` - Unmatch dialog
- `components/investment-contribution-list-card.tsx` - Account detail list
- `app/dashboard/main-transactions/page.tsx` - Badge integration
- `app/dashboard/accounts/[id]/page.tsx` - Investment account detail page

### Types
- `types/investment.ts` - TypeScript interfaces

---

## Testing

### Test Scenarios

1. **Manual Match**
   - Create a bank withdrawal transaction
   - Transaction shows yellow "Unmatched Investment" badge
   - Click badge → QuickMatch dialog opens
   - Select investment account
   - Verify paired transaction created in investment account
   - Verify both badges turn green

2. **Unmatch**
   - Find a matched investment (green badge)
   - Click badge → Unmatch dialog opens
   - Confirm unmatch
   - Verify investment transaction deleted
   - Verify source transaction remains with yellow badge

3. **Re-match**
   - After unmatch, source transaction should be yellow
   - Click badge again
   - Select different investment account
   - Verify new pair created successfully

4. **Account Detail Page**
   - Navigate to investment account
   - Verify InvestmentContributionListCard appears
   - Verify stats are calculated correctly
   - Verify all contributions listed
   - Click receipt icon → verify transactions dialog shows both paired transactions

### Database Verification

```sql
-- Check investment contributions
SELECT * FROM investment_contribution ORDER BY created_at DESC LIMIT 10;

-- Check linked transactions
SELECT
  mt.main_transaction_id,
  a.account_name,
  mt.amount,
  mt.transaction_direction,
  mt.investment_contribution_id
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
WHERE mt.investment_contribution_id IS NOT NULL
ORDER BY mt.created_at DESC;

-- Check original transactions for investment accounts
SELECT
  ot.raw_transaction_id,
  ot.account_id,
  ot.credit_amount,
  ot.transaction_date
FROM original_transaction ot
JOIN accounts a ON ot.account_id = a.account_id
WHERE a.account_type = 'investment'
ORDER BY ot.created_at DESC;
```

---

## Known Issues & Limitations

### Fixed Issues

1. **View Missing Column** ✅
   - **Issue**: main_transaction_details view didn't include investment_contribution_id
   - **Fix**: Migration 067 recreated view with the column
   - **Impact**: Badges now correctly show matched/unmatched status

2. **Trigger Not Firing** ✅
   - **Issue**: Main_transaction records weren't being created for investment accounts
   - **Investigation**: Suspected RLS policies blocking trigger inserts
   - **Resolution**: Trigger works correctly; RLS policies allow function execution
   - **Impact**: Paired transactions now appear in both accounts

3. **Delete Deleting Both Transactions** ✅
   - **Issue**: Unmatch was deleting both source and investment transactions
   - **Fix**: Added account_id check to only delete investment account transaction
   - **Impact**: Source transactions now preserved when unmatching

### Current Limitations

1. **No Withdrawal Matching Yet**
   - Investment withdrawals (INV_WITHDRAW) have badges but no create/match flow
   - Would need similar QuickMatch dialog for withdrawal direction

2. **No Investment Returns/Gains Tracking**
   - System tracks contributions but not investment performance
   - Future enhancement: Add realized/unrealized gains tracking

3. **No Multi-Currency Support**
   - Assumes all accounts use same currency
   - Future enhancement: Handle FX conversions for international investments

---

## Future Enhancements

1. **Investment Performance Tracking**
   - Track current value vs contributed amount
   - Calculate ROI, IRR
   - Show gains/losses

2. **Investment Withdrawal Flow**
   - Complete the INV_WITHDRAW matching flow
   - Track withdrawals from investments back to cash

3. **Investment Transaction Types**
   - Dividends received
   - Capital gains distributions
   - Reinvested dividends
   - Fee payments

4. **Reporting**
   - Investment portfolio summary
   - Performance over time
   - Asset allocation charts
   - Tax reporting (capital gains, dividends)

5. **Bulk Operations**
   - Import investment transactions from CSV
   - Bulk match multiple transactions
   - Rebalancing tools

---

## Conclusion

The Investment Matching System provides a complete double-entry bookkeeping solution for tracking investments. It maintains data integrity through paired transactions while providing an intuitive UI for matching and unmatching investment contributions.

The system is extensible and ready for future enhancements like withdrawal tracking, performance analysis, and advanced investment features.

---

**Questions or Issues?**
Contact: Development Team
Last Updated: November 19, 2025
