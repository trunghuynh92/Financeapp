# Investment Matching System

## Overview

The investment matching system allows users to track money flowing in and out of investment accounts. Unlike loans (which track specific disbursements) or debts (which track specific drawdowns), investments work as a **fungible pool** where contributions and withdrawals are not tied to specific transactions.

## Core Concepts

### Investment as a Pool

Investments are treated as a pool of money where:
- **Contributions**: Money transferred into the investment account
- **Withdrawals**: Money taken out of the investment account
- **Mark-to-Market**: Unrealized gains/losses tracked via balance adjustments
- No need to link specific withdrawals to specific contributions

### Example Scenario

1. **Initial Contributions**
   - Transfer 200,000 VND to investment account → Creates INV_CONTRIB pair
   - Transfer 250,000 VND to investment account → Creates INV_CONTRIB pair
   - Total invested: 450,000 VND

2. **Mark-to-Market Adjustment**
   - Portfolio grows by 20% (90,000 VND unrealized gain)
   - Create balance adjustment checkpoint: 540,000 VND
   - This is recorded as a balance adjustment, not a transaction

3. **Withdrawal**
   - Sell part of portfolio for 120,000 VND (includes 20,000 VND realized profit)
   - Transfer 120,000 VND to bank account → Creates INV_WITHDRAW pair
   - The profit stays in the investment account as part of the pool

## Transaction Types

### INV_CONTRIB (Investment Contribution)
- Used when money flows **into** an investment account
- Always matched in pairs (both sides use INV_CONTRIB)
- Example: Bank account (debit) ↔ Investment account (credit)

### INV_WITHDRAW (Investment Withdrawal)
- Used when money flows **out of** an investment account
- Always matched in pairs (both sides use INV_WITHDRAW)
- Example: Investment account (debit) ↔ Bank account (credit)

## Matching Process

### Creating a Match

The QuickMatchInvestmentDialog handles the matching workflow:

1. **User selects source transaction** (INV_CONTRIB or INV_WITHDRAW in a bank account)
2. **User selects investment account** to pair with
3. **System creates paired transaction**:
   - Creates `original_transaction` in investment account
   - Database trigger auto-creates `main_transaction`
   - Updates transaction type to INV_CONTRIB or INV_WITHDRAW
4. **System links the transactions** using transfer matching API
   - Sets `transfer_matched_transaction_id` on both transactions

**Flow diagram:**
```
Source Transaction (Bank)          Paired Transaction (Investment)
├─ INV_CONTRIB (debit)      ↔     INV_CONTRIB (credit)
└─ transfer_matched_transaction_id = [paired_id]
```

### Unmatching

The UnmatchInvestmentDialog handles the unmatch workflow:

1. **User clicks unmatch** on a matched investment transaction
2. **System unlinks and deletes**:
   - Clears `transfer_matched_transaction_id` on source transaction
   - Deletes paired `main_transaction`
   - Deletes paired `original_transaction`
3. **Source transaction remains** as unmatched

This is different from regular transfers, which unmatch but keep both transactions.

## Database Structure

### Key Fields

**main_transaction table:**
- `transfer_matched_transaction_id`: Links to the paired transaction
- `transaction_type_id`: References INV_CONTRIB or INV_WITHDRAW type

**original_transaction table:**
- `debit_amount`: For withdrawals from investment or contributions from bank
- `credit_amount`: For contributions to investment or withdrawals to bank

### No Investment-Specific Tables

Unlike loans (which have `loan_disbursement` table) or debts (which have `debt_drawdown` table), investments do NOT have a separate tracking table. The balance is maintained through:
- Individual matched transactions
- Balance adjustment checkpoints for mark-to-market

## API Endpoints

### POST /api/transfers/match
Matches two transactions as an investment pair.

**Request:**
```json
{
  "transfer_out_id": 123,  // Source transaction ID
  "transfer_in_id": 456     // Paired transaction ID
}
```

**Validation:**
- Both transactions must have type INV_CONTRIB or both INV_WITHDRAW
- Transactions must be from different accounts
- Amounts must match
- Neither can already be matched

### DELETE /api/transfers/unmatch/[id]
Unmatches an investment transaction and deletes the paired transaction.

**Special handling for INV_CONTRIB and INV_WITHDRAW:**
1. Fetches the paired transaction
2. Deletes paired `main_transaction`
3. Deletes paired `original_transaction`
4. Clears `transfer_matched_transaction_id` from source

### POST /api/transactions
Creates a new original transaction (used internally by matching dialog).

**Request:**
```json
{
  "account_id": 123,
  "transaction_date": "2025-09-15",
  "description": "Investment contribution",
  "debit_amount": null,
  "credit_amount": 450000,
  "transaction_source": "user_manual"
}
```

### PATCH /api/main-transactions/[id]
Updates transaction type after creation (used internally by matching dialog).

**Request:**
```json
{
  "transaction_type_id": 42  // INV_CONTRIB or INV_WITHDRAW type ID
}
```

## UI Components

### QuickMatchInvestmentDialog
Located: `components/main-transactions/QuickMatchInvestmentDialog.tsx`

**Purpose:** Create matched investment contribution or withdrawal

**Features:**
- Fetches investment accounts for the entity
- Shows source transaction details
- Allows selection of investment account
- Creates paired transaction and matches them

**Workflow:**
1. Fetch transaction types to get INV_CONTRIB or INV_WITHDRAW ID
2. Create original_transaction with debit/credit amount
3. Fetch the auto-created main_transaction_id
4. Update transaction type to INV_CONTRIB or INV_WITHDRAW
5. Match the two transactions via transfer API

### UnmatchInvestmentDialog
Located: `components/main-transactions/UnmatchInvestmentDialog.tsx`

**Purpose:** Unmatch and delete paired investment transaction

**Features:**
- Shows source transaction details
- Displays warning about deletion
- Calls unmatch API with DELETE method

## Badge Display

**Transaction List:**
- **Matched Investment** (green): Transaction is matched with `transfer_matched_transaction_id`
- **Unmatched Investment** (yellow): INV_CONTRIB or INV_WITHDRAW without match

**Code reference:**
```tsx
{tx.transfer_matched_transaction_id &&
 tx.transaction_type_code === 'INV_CONTRIB' && (
  <Badge variant="success">Matched Investment</Badge>
)}
```

## Key Differences from Loans and Debts

| Feature | Investments | Loans | Debts |
|---------|------------|-------|-------|
| Tracking Table | None | `loan_disbursement` | `debt_drawdown` |
| Withdrawal Logic | Pool-based | Tied to specific disbursement | Tied to specific drawdown |
| Balance Tracking | Sum of matched transactions + checkpoints | `remaining_balance` field | `remaining_balance` field |
| Unmatch Behavior | Delete paired transaction | Keep both, recalculate balance | Keep both, recalculate balance |
| Match Type | Simple transfer match | Links via `loan_disbursement_id` | Links via `drawdown_id` |

## Design Rationale

### Why No Investment Tracking Table?

Investments work differently from loans and debts:

1. **Loans/Debts**: Each disbursement/drawdown is a specific obligation that needs tracking
   - Loan: "I lent John $1000 on Jan 1" → Track specific receivable
   - Debt: "I borrowed $5000 from Bank on Feb 1" → Track specific payable

2. **Investments**: Money is fungible and not tied to specific events
   - If I invest 200k + 250k, then withdraw 540k, I cannot (and don't need to) tie the withdrawal to specific contributions
   - The portfolio is a pool, not a collection of individual obligations

### Why Delete Paired Transaction on Unmatch?

When unmatching an investment:
- The paired transaction was system-generated and has no independent meaning
- Unlike regular transfers (where both sides exist independently), the investment account transaction only exists because of the match
- Similar to loan disbursements: the credit to Loan Receivable is deleted when unmatching

## Migration Notes

### Previous Implementation

Previously, the system used an `investment_contribution` table that recorded:
- Both contributions AND withdrawals as "contributions"
- Positive amounts even for withdrawals
- Unnecessary complexity for a simple pool-based system

### Current Implementation

Simplified to use the existing transfer matching system:
- No separate tracking table
- Transfer matching handles all the linking
- Balance calculated from matched transactions + checkpoints

### Breaking Changes

If you had the old `investment_contribution` system:
1. Migrate existing investment_contribution records to use transfer matching
2. Remove references to `investment_contribution_id`
3. Update badges to check `transfer_matched_transaction_id` instead

## Future Enhancements

Potential features that could be added:

1. **Investment Portfolio Tracking**: Add optional tracking of specific stocks/assets within investment account
2. **Automated Cost Basis**: Calculate cost basis for realized gains
3. **Performance Metrics**: Track ROI, IRR for investment accounts
4. **Multi-Currency**: Support foreign investment accounts
5. **Tax Lot Tracking**: For jurisdictions requiring specific cost basis methods

## Related Documentation

- [Transfer Matching System](./TRANSFER_MATCHING_SYSTEM.md) (if exists)
- [Balance Adjustment System](./BALANCE_ADJUSTMENT_SYSTEM.md) (if exists)
- [Loan Disbursement System](./LOAN_DISBURSEMENT_SYSTEM.md) (if exists)
- [Debt Drawdown System](./DEBT_DRAWDOWN_SYSTEM.md) (if exists)
