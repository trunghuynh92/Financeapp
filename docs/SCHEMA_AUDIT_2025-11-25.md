# Database Schema Audit - November 25, 2025

## Executive Summary

Complete audit of Supabase database schema focusing on entity deletion, transaction ordering, and date/timestamp handling after migrations 079-086.

## Key Findings

### ✅ Entity CASCADE Delete Chain (FIXED)

**Entities table** uses `ON DELETE CASCADE` for all child tables:
- accounts
- branches
- business_partners
- categories
- category_budgets
- contracts
- entity_users
- investment_contribution
- projects (duplicate FK - both CASCADE)
- scheduled_payments

**Accounts table** CASCADE deletes:
- balance_checkpoints
- debt_drawdown (FIXED - removed duplicate RESTRICT constraint)
- import_batch
- investment_contribution (both source_account_id and investment_account_id)
- loan_disbursement
- main_transaction (duplicate FK - both CASCADE)
- original_transaction

**Result**: Deleting an entity will now cascade delete ALL associated data with ZERO residue.

### ✅ Date vs Timestamp Handling (FIXED)

**Transaction tables now use DATE type** (migration 079):
- `original_transaction.transaction_date` → **DATE**
- `main_transaction.transaction_date` → **DATE**

**Audit timestamps still use TIMESTAMPTZ**:
- `created_at` → TIMESTAMPTZ
- `updated_at` → TIMESTAMPTZ
- `imported_at` → TIMESTAMPTZ

**Why this matters**: DATE type eliminates timezone conversion bugs. Business dates (transaction_date) are stored as calendar dates, not midnight timestamps that shift across timezones.

### ✅ Transaction Ordering System

**Primary ordering** uses composite index:
```sql
idx_original_transaction_order (account_id, transaction_date, transaction_sequence)
```

**Ordering logic**:
1. **account_id** - group by account
2. **transaction_date** - order by business date (DATE type)
3. **transaction_sequence** - order within same day (INTEGER)

**Transaction sequence**:
- Auto-assigned during import
- Preserved through imports (maintains bank statement order)
- Can be manually adjusted for same-day ordering

**Date indexes**:
- `idx_original_transaction_date` (transaction_date DESC)
- `idx_main_transaction_date` (transaction_date DESC)
- Both optimized for recent transactions first

## Issues Fixed

### Migration 085: Dropped account_balances References
Removed obsolete functions that referenced deleted `account_balances` table:
- `create_account_balance()` + trigger
- `sync_account_balance_from_checkpoints()`
- `trigger_recalculate_checkpoints()` + trigger

### Migration 086: Fixed debt_drawdown Duplicate Constraint
Removed duplicate RESTRICT constraint:
- **Dropped**: `fk_drawdown_account` (RESTRICT)
- **Kept**: `debt_drawdown_account_id_fkey` (CASCADE)

## CASCADE Delete Verification

**Delete entity** → cascades to:
```
entities (parent)
├─ accounts → CASCADE
│  ├─ balance_checkpoints → CASCADE
│  ├─ debt_drawdown → CASCADE ✅ (fixed in 086)
│  ├─ import_batch → CASCADE
│  ├─ investment_contribution → CASCADE
│  ├─ loan_disbursement → CASCADE
│  ├─ main_transaction → CASCADE
│  └─ original_transaction → CASCADE
├─ branches → CASCADE
├─ business_partners → CASCADE
├─ categories → CASCADE
├─ category_budgets → CASCADE
├─ contracts → CASCADE
├─ entity_users → CASCADE
├─ investment_contribution → CASCADE
├─ projects → CASCADE (duplicate FK)
└─ scheduled_payments → CASCADE
```

**Result**: ZERO residue after entity deletion ✅

## Active Triggers on Transaction Tables

### original_transaction
- `sync_main_transaction_amount_trigger` - Syncs amounts to main_transaction
- `trigger_auto_create_main_transaction` - Auto-creates main_transaction on insert
- `update_original_transaction_updated_at` - Updates timestamp

### main_transaction
- `check_split_amounts` - Validates split transaction amounts
- `process_debt_payment_trigger` - Processes debt payments
- `trigger_auto_create_loan_settle_on_match` - Creates loan settlement
- `trigger_auto_delete_debt_drawdown_on_unmatch` - Cleans up unmatched drawdowns
- `trigger_auto_delete_investment_on_unmatch` - Cleans up unmatched investments
- `trigger_auto_delete_loan_disbursement_on_unmatch` - Cleans up unmatched loans
- `trigger_create_loan_disbursement_on_loan_give` - Creates loan disbursement
- `trigger_update_drawdown_on_settlement` - Updates drawdown balances
- `trigger_update_investment_balance` - Updates investment balances
- `trigger_update_loan_disbursement_after_settlement` - Updates loan tracking
- `trigger_validate_transfer_match` - Validates transfer matches
- `update_main_transaction_updated_at` - Updates timestamp

## Data Type Summary

| Column | Type | Notes |
|--------|------|-------|
| transaction_date | DATE | Business date (no timezone) |
| created_at | TIMESTAMPTZ | Audit timestamp with timezone |
| updated_at | TIMESTAMPTZ | Audit timestamp with timezone |
| imported_at | TIMESTAMPTZ | Import timestamp with timezone |
| transaction_sequence | INTEGER | Within-day ordering |
| amount | NUMERIC(15,2) | Monetary values |
| balance | NUMERIC(15,2) | Running balance |

## Recommendations

1. ✅ **Entity deletion is fully functional** - All CASCADE constraints in place
2. ✅ **Date handling is correct** - DATE type eliminates timezone bugs
3. ✅ **Transaction ordering is robust** - Composite index + sequence number
4. ✅ **No orphaned data** - Complete CASCADE chain verified
5. ⚠️ **Duplicate FK on projects.entity_id** - Both CASCADE, but redundant (non-critical)
6. ⚠️ **Duplicate FK on main_transaction.account_id** - Both CASCADE, but redundant (non-critical)

## Migration History

- **079**: Converted TIMESTAMPTZ → DATE for transaction_date
- **081**: Cleanup all transactions for fresh import
- **082**: Fixed CASCADE on main_transaction, original_transaction, import_batch
- **084**: Dropped account_balances table, fixed CASCADE on debt/loan/investment tables
- **085**: Dropped obsolete functions referencing account_balances
- **086**: Fixed debt_drawdown duplicate RESTRICT constraint

## Status: ✅ ALL ISSUES RESOLVED

Entity deletion, transaction ordering, and date handling are all functioning correctly.
