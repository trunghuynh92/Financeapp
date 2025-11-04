-- ============================================================================
-- MIGRATION: Add Missing Features to Transaction System
-- ============================================================================
-- Purpose: Add transaction source tracking, audit trail, and performance indexes
-- to the original_transaction table
--
-- Run this migration in Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Create transaction_source_type ENUM
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_source_type') THEN
        CREATE TYPE transaction_source_type AS ENUM (
            'imported_bank',      -- From bank CSV/Excel import
            'user_manual',        -- User created manually
            'system_opening',     -- System-generated opening balance
            'auto_adjustment'     -- Auto balance adjustment
        );
        RAISE NOTICE 'Created transaction_source_type ENUM';
    ELSE
        RAISE NOTICE 'transaction_source_type ENUM already exists, skipping';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Add missing columns to original_transaction table
-- ----------------------------------------------------------------------------

-- Add transaction_source column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'transaction_source'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN transaction_source transaction_source_type DEFAULT 'user_manual';
        RAISE NOTICE 'Added transaction_source column';
    ELSE
        RAISE NOTICE 'transaction_source column already exists, skipping';
    END IF;
END $$;

-- Add import_batch_id column with foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'import_batch_id'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN import_batch_id INTEGER NULL;

        ALTER TABLE original_transaction
        ADD CONSTRAINT original_transaction_import_batch_id_fkey
        FOREIGN KEY (import_batch_id) REFERENCES import_batch(import_batch_id) ON DELETE SET NULL;

        RAISE NOTICE 'Added import_batch_id column with foreign key';
    ELSE
        RAISE NOTICE 'import_batch_id column already exists, skipping';
    END IF;
END $$;

-- Add imported_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'imported_at'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN imported_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added imported_at column';
    ELSE
        RAISE NOTICE 'imported_at column already exists, skipping';
    END IF;
END $$;

-- Add import_file_name column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'import_file_name'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN import_file_name VARCHAR(255) NULL;
        RAISE NOTICE 'Added import_file_name column';
    ELSE
        RAISE NOTICE 'import_file_name column already exists, skipping';
    END IF;
END $$;

-- Add created_by_user_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'created_by_user_id'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN created_by_user_id INTEGER NULL;
        RAISE NOTICE 'Added created_by_user_id column';
    ELSE
        RAISE NOTICE 'created_by_user_id column already exists, skipping';
    END IF;
END $$;

-- Add updated_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN updated_at TIMESTAMPTZ NULL;
        RAISE NOTICE 'Added updated_at column';
    ELSE
        RAISE NOTICE 'updated_at column already exists, skipping';
    END IF;
END $$;

-- Add updated_by_user_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'updated_by_user_id'
    ) THEN
        ALTER TABLE original_transaction
        ADD COLUMN updated_by_user_id INTEGER NULL;
        RAISE NOTICE 'Added updated_by_user_id column';
    ELSE
        RAISE NOTICE 'updated_by_user_id column already exists, skipping';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Add data integrity constraint (debit OR credit, not both)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_debit_or_credit'
    ) THEN
        ALTER TABLE original_transaction
        ADD CONSTRAINT check_debit_or_credit CHECK (
            (debit_amount IS NOT NULL AND credit_amount IS NULL) OR
            (debit_amount IS NULL AND credit_amount IS NOT NULL)
        );
        RAISE NOTICE 'Added check_debit_or_credit constraint';
    ELSE
        RAISE NOTICE 'check_debit_or_credit constraint already exists, skipping';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: Create performance indexes
-- ----------------------------------------------------------------------------

-- Index on account_id and transaction_date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_original_transaction_account_date
ON original_transaction(account_id, transaction_date);

-- Index on imported_at for tracking imports
CREATE INDEX IF NOT EXISTS idx_original_transaction_imported
ON original_transaction(imported_at);

-- Index on transaction_source for filtering by source type
CREATE INDEX IF NOT EXISTS idx_original_transaction_source
ON original_transaction(transaction_source);

-- Index on import_batch_id for batch queries
CREATE INDEX IF NOT EXISTS idx_original_transaction_batch
ON original_transaction(import_batch_id);

-- Index on transaction_date descending for recent transactions
CREATE INDEX IF NOT EXISTS idx_original_transaction_date
ON original_transaction(transaction_date DESC);

DO $$
BEGIN
    RAISE NOTICE 'Created all indexes on original_transaction';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 5: Create or replace update_updated_at_column() trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- STEP 6: Add triggers for automatic updated_at timestamp
-- ----------------------------------------------------------------------------

-- Trigger for entities table
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for accounts table
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for original_transaction table
DROP TRIGGER IF EXISTS update_original_transaction_updated_at ON original_transaction;
CREATE TRIGGER update_original_transaction_updated_at
  BEFORE UPDATE ON original_transaction
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for account_balances table
DROP TRIGGER IF EXISTS update_account_balances_updated_at ON account_balances;
CREATE TRIGGER update_account_balances_updated_at
  BEFORE UPDATE ON account_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    RAISE NOTICE 'Created all updated_at triggers';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 7: Create indexes on other tables for performance
-- ----------------------------------------------------------------------------

-- Indexes on accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_entity ON accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);

-- Indexes on import_batch table
CREATE INDEX IF NOT EXISTS idx_import_batch_account ON import_batch(account_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_date ON import_batch(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_import_batch_status ON import_batch(import_status);

-- Indexes on entities table
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at DESC);

DO $$
BEGIN
    RAISE NOTICE 'Created all supporting indexes';
END $$;

-- ----------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Added to original_transaction table:';
    RAISE NOTICE '  - transaction_source (ENUM)';
    RAISE NOTICE '  - import_batch_id (FK to import_batch)';
    RAISE NOTICE '  - imported_at';
    RAISE NOTICE '  - import_file_name';
    RAISE NOTICE '  - created_by_user_id';
    RAISE NOTICE '  - updated_at';
    RAISE NOTICE '  - updated_by_user_id';
    RAISE NOTICE '  - check_debit_or_credit constraint';
    RAISE NOTICE '  - 5 performance indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'Added triggers for auto-updating updated_at on:';
    RAISE NOTICE '  - entities';
    RAISE NOTICE '  - accounts';
    RAISE NOTICE '  - original_transaction';
    RAISE NOTICE '  - account_balances';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run verification queries (see verification.sql)';
    RAISE NOTICE '  2. Optionally run 002_migrate_account_balances.sql for historical tracking';
    RAISE NOTICE '============================================================';
END $$;
