# Balance Checkpoint & Adjustment System

## Overview

The Balance Checkpoint System implements the core principle: **"No money without origin."** Every account starts with an opening balance of 0. When users declare a balance at a specific date (checkpoint), the system automatically creates a "Balance Adjustment" transaction to reconcile the declared balance with the calculated balance from transactions.

This adjustment is flagged until users add sufficient historical transactions to explain all the money.

---

## Core Concepts

### 1. Balance Checkpoint
A checkpoint is a point in time where the user declares they know their account balance (e.g., from a bank statement).

### 2. Calculated Balance
The balance calculated from all non-adjustment transactions up to the checkpoint date.

### 3. Adjustment Amount
The difference between declared balance and calculated balance:
- **Positive adjustment** (Credit) = Missing income
- **Negative adjustment** (Debit) = Missing expense
- **Zero adjustment** = Fully reconciled

### 4. Flagged Transactions
Balance adjustment transactions are flagged to indicate they represent unexplained money. As users add historical transactions, the adjustment amount decreases.

### 5. Reconciliation
When the adjustment amount becomes effectively zero (within 1 cent), the checkpoint is marked as reconciled and the adjustment transaction is removed.

---

## Database Schema

### New Tables

#### `balance_checkpoints`
Stores checkpoint records for accounts.

| Column | Type | Description |
|--------|------|-------------|
| checkpoint_id | SERIAL | Primary key |
| account_id | INTEGER | Reference to accounts table |
| checkpoint_date | TIMESTAMPTZ | Date of the checkpoint |
| declared_balance | NUMERIC(15,2) | Balance declared by user |
| calculated_balance | NUMERIC(15,2) | Balance calculated from transactions |
| adjustment_amount | NUMERIC(15,2) | Difference (declared - calculated) |
| is_reconciled | BOOLEAN | True if adjustment < 1 cent |
| notes | TEXT | Optional notes |
| created_by_user_id | INTEGER | User who created checkpoint |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Modified Tables

#### `original_transaction` (Added columns)
- `checkpoint_id` - Links to balance_checkpoints
- `is_balance_adjustment` - Marks adjustment transactions
- `is_flagged` - Marks transactions needing review

#### `accounts` (Added columns)
- `opening_balance_date` - Date before earliest transaction
- `earliest_transaction_date` - Date of earliest transaction

---

## Database Functions

### `calculate_balance_up_to_date(p_account_id, p_up_to_date)`
Calculates account balance from transactions up to a specific date, excluding balance adjustments.

```sql
SELECT calculate_balance_up_to_date(123, '2020-03-01T00:00:00Z');
```

### `update_account_opening_balance_date(p_account_id)`
Updates the opening balance date to one day before the earliest transaction.

```sql
SELECT update_account_opening_balance_date(123);
```

---

## API Endpoints

### Create Checkpoint
```http
POST /api/accounts/{accountId}/checkpoints
Content-Type: application/json

{
  "checkpoint_date": "2020-03-01T00:00:00Z",
  "declared_balance": 100000000,
  "notes": "From bank statement"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "checkpoint_id": 1,
    "account_id": 123,
    "checkpoint_date": "2020-03-01T00:00:00Z",
    "declared_balance": 100000000,
    "calculated_balance": 24000000,
    "adjustment_amount": 76000000,
    "is_reconciled": false,
    "notes": "From bank statement",
    "created_at": "2025-11-04T01:30:00Z",
    "updated_at": "2025-11-04T01:30:00Z"
  },
  "message": "Checkpoint created with balance adjustment"
}
```

### List Checkpoints
```http
GET /api/accounts/{accountId}/checkpoints?include_reconciled=true&order_by=date_desc&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "checkpoint_id": 1,
      "account_id": 123,
      "checkpoint_date": "2020-03-01T00:00:00Z",
      "declared_balance": 100000000,
      "calculated_balance": 24000000,
      "adjustment_amount": 76000000,
      "is_reconciled": false,
      "notes": "From bank statement",
      "created_at": "2025-11-04T01:30:00Z",
      "updated_at": "2025-11-04T01:30:00Z"
    }
  ],
  "count": 1
}
```

### Get Single Checkpoint
```http
GET /api/accounts/{accountId}/checkpoints/{checkpointId}
```

### Update Checkpoint
```http
PUT /api/accounts/{accountId}/checkpoints/{checkpointId}
Content-Type: application/json

{
  "declared_balance": 105000000,
  "notes": "Corrected from bank statement"
}
```

### Delete Checkpoint
```http
DELETE /api/accounts/{accountId}/checkpoints/{checkpointId}
```

### Recalculate Checkpoints
```http
PUT /api/accounts/{accountId}/checkpoints?action=recalculate
```

Triggers recalculation of all checkpoints for the account.

### Get Flagged Transactions
```http
GET /api/accounts/{accountId}/flagged-transactions
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "transaction_id": 456,
      "account_id": 123,
      "transaction_date": "2020-03-01T00:00:00Z",
      "description": "Balance Adjustment (Checkpoint)",
      "credit_amount": 76000000,
      "debit_amount": 0,
      "checkpoint_id": 1,
      "is_balance_adjustment": true,
      "is_flagged": true,
      "checkpoint": {
        "checkpoint_id": 1,
        "checkpoint_date": "2020-03-01T00:00:00Z",
        "declared_balance": 100000000,
        "adjustment_amount": 76000000,
        "is_reconciled": false
      }
    }
  ],
  "count": 1,
  "summary": {
    "total_flagged": 1,
    "total_adjustment_amount": 76000000
  }
}
```

### Get Checkpoint Summary
```http
GET /api/accounts/{accountId}/checkpoint-summary
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_checkpoints": 3,
    "reconciled_checkpoints": 1,
    "unreconciled_checkpoints": 2,
    "total_adjustment_amount": 50000000,
    "earliest_checkpoint_date": "2019-11-01T00:00:00Z",
    "latest_checkpoint_date": "2020-06-01T00:00:00Z"
  }
}
```

---

## Usage Examples

### Scenario 1: Setting Initial Balance

**Situation:** User creates a new account and knows their current balance from a bank statement.

```typescript
// Step 1: Create account
const account = await createAccount({
  entity_id: 'uuid',
  account_name: 'Main Checking',
  account_type: 'bank',
  currency: 'VND',
})

// Step 2: Create checkpoint with known balance
const checkpoint = await fetch(`/api/accounts/${account.account_id}/checkpoints`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    checkpoint_date: '2020-03-01T00:00:00Z',
    declared_balance: 100000000, // 100M VND
    notes: 'Opening balance from bank statement',
  }),
})

// Result:
// - Checkpoint created with 100M adjustment (flagged)
// - Balance adjustment transaction created (+100M credit)
// - Account opening date set to Feb 29, 2020
```

### Scenario 2: Adding Historical Transactions

**Situation:** User adds transactions before the checkpoint to explain the money.

```typescript
// Add a transaction before the checkpoint
const transaction = await createTransaction({
  account_id: account.account_id,
  transaction_date: '2019-11-21T00:00:00Z',
  description: 'MacBook Sale',
  credit_amount: 24000000, // +24M income
  debit_amount: 0,
})

// System automatically:
// 1. Trigger fires on original_transaction INSERT
// 2. Recalculates checkpoint: 100M declared - 24M calculated = 76M adjustment
// 3. Updates balance adjustment transaction to +76M
// 4. Updates account opening date to Nov 20, 2019

// Check updated checkpoint
const updatedCheckpoint = await fetch(`/api/accounts/${account.account_id}/checkpoints/${checkpoint.checkpoint_id}`)
// adjustment_amount is now 76M (down from 100M)
```

### Scenario 3: Full Reconciliation

**Situation:** User adds enough transactions to fully explain the balance.

```typescript
// Add more transactions totaling exactly 100M
await createTransaction({
  account_id: account.account_id,
  transaction_date: '2019-12-01T00:00:00Z',
  description: 'Freelance Project',
  credit_amount: 76000000, // +76M income
  debit_amount: 0,
})

// System automatically:
// 1. Recalculates: 100M declared - 100M calculated = 0M adjustment
// 2. Sets is_reconciled = true
// 3. DELETES the balance adjustment transaction
// 4. Checkpoint is now fully reconciled ✓

// The account now has a complete transaction history
```

### Scenario 4: Multiple Checkpoints

**Situation:** User has multiple bank statements at different dates.

```typescript
// Create first checkpoint (earlier date)
await createCheckpoint(accountId, {
  checkpoint_date: '2020-01-01T00:00:00Z',
  declared_balance: 50000000,
  notes: 'January statement',
})

// Create second checkpoint (later date)
await createCheckpoint(accountId, {
  checkpoint_date: '2020-03-01T00:00:00Z',
  declared_balance: 100000000,
  notes: 'March statement',
})

// System manages each checkpoint independently
// Each checkpoint tracks its own adjustment amount
```

---

## Automatic Recalculation

The system automatically recalculates checkpoints when:

1. **Transaction added** - Trigger fires on INSERT
2. **Transaction updated** - Trigger fires on UPDATE
3. **Transaction deleted** - Trigger fires on DELETE

The trigger sends a PostgreSQL notification that can be listened to in the application:

```typescript
// Listen for recalculation notifications
supabase
  .channel('recalculate_checkpoints')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'original_transaction',
  }, (payload) => {
    // Trigger UI refresh
    refetchCheckpoints()
  })
  .subscribe()
```

---

## Running the Migration

### Step 1: Apply Migration

```bash
# Using Supabase CLI
supabase db push

# Or manually run the SQL file
psql -U postgres -d your_database -f migrations/003_add_balance_checkpoint_system.sql
```

### Step 2: Verify Migration

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_name = 'balance_checkpoints';

-- Check columns added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'original_transaction'
AND column_name IN ('checkpoint_id', 'is_balance_adjustment', 'is_flagged');

-- Check functions created
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('calculate_balance_up_to_date', 'update_account_opening_balance_date');

-- Check triggers created
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'transaction_checkpoint_recalc';
```

---

## Testing

See `TEST_SCENARIOS.md` for detailed test cases and expected results.

---

## Rollback (If Needed)

To rollback this migration:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS transaction_checkpoint_recalc ON original_transaction;
DROP TRIGGER IF EXISTS set_updated_at ON balance_checkpoints;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_recalculate_checkpoints();
DROP FUNCTION IF EXISTS calculate_balance_up_to_date(INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS update_account_opening_balance_date(INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop columns from original_transaction
ALTER TABLE original_transaction
DROP COLUMN IF EXISTS checkpoint_id,
DROP COLUMN IF EXISTS is_balance_adjustment,
DROP COLUMN IF EXISTS is_flagged;

-- Drop columns from accounts
ALTER TABLE accounts
DROP COLUMN IF EXISTS opening_balance_date,
DROP COLUMN IF EXISTS earliest_transaction_date;

-- Drop table
DROP TABLE IF EXISTS balance_checkpoints;
```

---

## Best Practices

1. **Create checkpoints from bank statements** - Use official documents as the source of truth
2. **Add historical transactions gradually** - Start with major transactions and add smaller ones over time
3. **Use notes field** - Document the source of each checkpoint (e.g., "March 2020 bank statement")
4. **Monitor flagged transactions** - Regularly review and work to reconcile flagged transactions
5. **Multiple checkpoints** - Create checkpoints at regular intervals (monthly, quarterly) to track progress

---

## Troubleshooting

### Issue: Checkpoint not recalculating after adding transaction

**Solution:** Manually trigger recalculation:
```http
PUT /api/accounts/{accountId}/checkpoints?action=recalculate
```

### Issue: Adjustment amount is off by a few cents

**Cause:** Rounding differences in currency conversion or calculations

**Solution:** The system considers adjustments under 1 cent as reconciled. This is configurable in `CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD`.

### Issue: Can't delete checkpoint

**Cause:** Foreign key constraint from adjustment transaction

**Solution:** Use the DELETE endpoint which handles cascading deletion properly:
```http
DELETE /api/accounts/{accountId}/checkpoints/{checkpointId}
```

---

## Future Enhancements

- [ ] Bulk checkpoint import from CSV
- [ ] Checkpoint templates for common scenarios
- [ ] Automatic checkpoint suggestions based on transaction patterns
- [ ] Checkpoint reconciliation wizard (guided UI flow)
- [ ] Email notifications when checkpoints are fully reconciled
- [ ] Dashboard widget showing unreconciled checkpoint summary
- [ ] Transaction suggestion engine to help reconcile checkpoints
- [ ] Multi-account checkpoint comparison
- [ ] Checkpoint approval workflow (for team accounts)

---

## Support

For questions or issues with the checkpoint system:
1. Review this documentation
2. Check the test scenarios in `TEST_SCENARIOS.md`
3. Review the migration logs for errors
4. Check the database trigger logs for recalculation events

---

**Last Updated:** 2025-11-04
**Version:** 1.0.0
**Author:** Claude Code
