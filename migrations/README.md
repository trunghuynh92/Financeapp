# Database Migration Guide

This directory contains migration scripts to upgrade your Supabase schema with missing transaction tracking features.

## 📋 What's Being Fixed

### Critical Issues
- ❌ `original_transaction` missing transaction source tracking
- ❌ Missing audit trail (who created/modified transactions)
- ❌ No link between transactions and import batches
- ❌ No performance indexes
- ❌ Missing data integrity constraints
- ❌ No automatic `updated_at` triggers

### After Migration
- ✅ Full transaction source tracking (imported vs manual)
- ✅ Complete audit trail with user tracking
- ✅ Link transactions to import batches
- ✅ Performance indexes on all tables
- ✅ Data integrity constraints
- ✅ Automatic timestamp updates

## 🚀 Migration Steps

### Step 1: Run Main Migration (REQUIRED)

**File:** `001_add_missing_transaction_features.sql`

This migration adds:
- `transaction_source` ENUM type with 4 values
- 7 new columns to `original_transaction` table
- 5 performance indexes
- Data integrity constraint (debit OR credit)
- Triggers for automatic `updated_at` timestamps
- Indexes on all tables

**How to run:**
1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `001_add_missing_transaction_features.sql`
4. Click **Run**

**Duration:** ~5-10 seconds

### Step 2: Verify Migration (RECOMMENDED)

**File:** `verification_queries.sql`

Run these queries to verify everything was migrated correctly.

**How to run:**
1. Open Supabase SQL Editor
2. Copy and paste the contents of `verification_queries.sql`
3. Click **Run**
4. Review the results to ensure all columns, indexes, and constraints exist

**Expected output:**
- ✅ All 16 columns in `original_transaction`
- ✅ 4 ENUM values in `transaction_source_type`
- ✅ 5 indexes on `original_transaction`
- ✅ `check_debit_or_credit` constraint exists
- ✅ Triggers on all tables

### Step 3: Optional - Migrate to Historical Balance Tracking (OPTIONAL)

**File:** `002_migrate_account_balances_optional.sql`

⚠️ **Only run if you want historical balance tracking**

**Current design:**
- `account_balances` table stores ONE balance per account
- Simple, but no history

**After migration:**
- `account_balance` table stores MULTIPLE balances per account
- Supports opening/closing balances
- Full balance history and reconciliation

**If you're happy with simple balance tracking, SKIP this migration.**

**How to run:**
1. Open Supabase SQL Editor
2. Copy and paste the contents of `002_migrate_account_balances_optional.sql`
3. Click **Run**

**What it does:**
- Creates new `account_balance` table
- Migrates existing data
- Renames old table to `account_balances_deprecated`
- Creates backup table

## 📊 Migration Details

### New Columns in `original_transaction`

| Column | Type | Purpose |
|--------|------|---------|
| `transaction_source` | ENUM | Track source: imported_bank, user_manual, system_opening, auto_adjustment |
| `import_batch_id` | INTEGER | Link to import_batch table |
| `imported_at` | TIMESTAMPTZ | When transaction was created |
| `import_file_name` | VARCHAR(255) | Source file name |
| `created_by_user_id` | INTEGER | Who created the transaction |
| `updated_at` | TIMESTAMPTZ | Last modification time (auto-updated) |
| `updated_by_user_id` | INTEGER | Who last modified the transaction |

### New Indexes

**On `original_transaction`:**
- `idx_original_transaction_account_date` - Fast queries by account + date
- `idx_original_transaction_imported` - Fast queries by import time
- `idx_original_transaction_source` - Fast filtering by source type
- `idx_original_transaction_batch` - Fast queries by import batch
- `idx_original_transaction_date` - Fast queries for recent transactions

**On other tables:**
- `idx_accounts_entity`, `idx_accounts_type`, `idx_accounts_active`
- `idx_import_batch_account`, `idx_import_batch_date`, `idx_import_batch_status`
- `idx_entities_type`, `idx_entities_created_at`

## 🔄 Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove new columns
ALTER TABLE original_transaction DROP COLUMN IF EXISTS transaction_source;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS import_batch_id;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS imported_at;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS import_file_name;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS updated_at;
ALTER TABLE original_transaction DROP COLUMN IF EXISTS updated_by_user_id;

-- Remove constraint
ALTER TABLE original_transaction DROP CONSTRAINT IF EXISTS check_debit_or_credit;

-- Drop indexes
DROP INDEX IF EXISTS idx_original_transaction_account_date;
DROP INDEX IF EXISTS idx_original_transaction_imported;
DROP INDEX IF EXISTS idx_original_transaction_source;
DROP INDEX IF EXISTS idx_original_transaction_batch;
DROP INDEX IF EXISTS idx_original_transaction_date;

-- Drop ENUM type
DROP TYPE IF EXISTS transaction_source_type;
```

## 📝 After Migration - Update Your Code

### Example 1: Insert User Manual Transaction

```sql
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  transaction_source,  -- NEW
  created_by_user_id   -- NEW
) VALUES (
  'MANUAL_USER_20250101_001',
  2,
  '2025-01-01 14:30:00+07',
  'Paid contractor for renovating stores',
  50000000.00,
  NULL,
  'user_manual',      -- NEW: Specify source
  1001                -- NEW: Track who created it
);
```

### Example 2: Insert Imported Bank Transaction

```sql
-- First create import batch
INSERT INTO import_batch (account_id, import_file_name, imported_by_user_id, total_records)
VALUES (1, 'techcombank_nov_2024.csv', 1001, 10)
RETURNING import_batch_id;  -- Returns e.g., 5

-- Then insert transactions
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  bank_reference,
  transaction_source,    -- NEW
  import_batch_id,       -- NEW
  import_file_name,      -- NEW
  created_by_user_id     -- NEW
) VALUES (
  'TECH_NOV_001',
  1,
  '2024-11-15 09:15:00+07',
  'Transfer from customer',
  NULL,
  25000000.00,
  'FT24111500123456',
  'imported_bank',       -- NEW: Mark as imported
  5,                     -- NEW: Link to batch
  'techcombank_nov_2024.csv',  -- NEW: Source file
  1001                   -- NEW: Who imported it
);
```

### Example 3: Update Transaction (Audit Trail)

```sql
UPDATE original_transaction
SET
  description = 'Updated description',
  debit_amount = 52000000.00,
  updated_by_user_id = 1001  -- NEW: Track who modified it
WHERE raw_transaction_id = 'MANUAL_USER_20250101_001';

-- updated_at will be automatically set by trigger
```

### Example 4: Query by Transaction Source

```sql
-- Get all imported bank transactions
SELECT * FROM original_transaction
WHERE transaction_source = 'imported_bank'
ORDER BY transaction_date DESC;

-- Get all manual transactions
SELECT * FROM original_transaction
WHERE transaction_source = 'user_manual'
ORDER BY transaction_date DESC;

-- Get all transactions from a specific import batch
SELECT * FROM original_transaction
WHERE import_batch_id = 5
ORDER BY transaction_date;
```

## ✅ Success Criteria

After running the migration, verify:

1. ✅ All new columns exist in `original_transaction`
2. ✅ `transaction_source_type` ENUM created with 4 values
3. ✅ All 5 indexes created on `original_transaction`
4. ✅ `check_debit_or_credit` constraint prevents invalid data
5. ✅ Foreign keys link to `accounts` and `import_batch`
6. ✅ Triggers auto-update `updated_at` on all tables
7. ✅ No errors when inserting test transactions

## 🆘 Need Help?

If you encounter any issues:

1. Check the Supabase logs for error messages
2. Run the verification queries to see what's missing
3. Review the migration script for any failed steps
4. Check that you have sufficient permissions in Supabase

## 📚 Related Files

- `../SUPABASE_SCHEMA.sql` - Original designed schema
- `../TRANSACTION_EXAMPLES.sql` - Usage examples
- `../ROLLBACK_TRANSACTION_TABLES.sql` - Complete rollback script

---

**Migration created:** 2025-01-04
**Tested on:** PostgreSQL 15+ (Supabase)
