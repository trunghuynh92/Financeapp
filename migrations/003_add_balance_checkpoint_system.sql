-- Migration: Add Balance Checkpoint & Adjustment System
-- Description: Implements "No money without origin" principle through balance checkpoints
-- Author: Claude Code
-- Date: 2025-11-04

-- ==============================================================================
-- PART 1: Create balance_checkpoints table
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Creating balance_checkpoints table...';
END $$;

CREATE TABLE IF NOT EXISTS balance_checkpoints (
  checkpoint_id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  checkpoint_date TIMESTAMPTZ NOT NULL,
  declared_balance NUMERIC(15,2) NOT NULL,
  calculated_balance NUMERIC(15,2) DEFAULT 0,
  adjustment_amount NUMERIC(15,2) DEFAULT 0,
  is_reconciled BOOLEAN DEFAULT false,
  notes TEXT,
  created_by_user_id INTEGER, -- REFERENCES users(user_id) when auth is implemented
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_account_checkpoint_date UNIQUE(account_id, checkpoint_date),
  CONSTRAINT check_declared_balance CHECK (declared_balance IS NOT NULL)
);

DO $$
BEGIN
  RAISE NOTICE 'Creating indexes for balance_checkpoints...';
END $$;

-- Indexes for balance_checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_account ON balance_checkpoints(account_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_date ON balance_checkpoints(checkpoint_date);
CREATE INDEX IF NOT EXISTS idx_checkpoints_reconciled ON balance_checkpoints(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_checkpoints_account_date ON balance_checkpoints(account_id, checkpoint_date);

-- ==============================================================================
-- PART 2: Modify original_transaction table
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Adding checkpoint columns to original_transaction table...';
END $$;

-- Add new columns to original_transaction table
ALTER TABLE original_transaction
ADD COLUMN IF NOT EXISTS checkpoint_id INTEGER REFERENCES balance_checkpoints(checkpoint_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_balance_adjustment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

DO $$
BEGIN
  RAISE NOTICE 'Creating indexes for original_transaction checkpoint columns...';
END $$;

-- Indexes for checkpoint-related columns
CREATE INDEX IF NOT EXISTS idx_transactions_flagged ON original_transaction(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_transactions_checkpoint ON original_transaction(checkpoint_id) WHERE checkpoint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_balance_adjustment ON original_transaction(is_balance_adjustment) WHERE is_balance_adjustment = true;

-- ==============================================================================
-- PART 3: Modify accounts table
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Adding opening balance tracking to accounts table...';
END $$;

-- Add opening balance date tracking to accounts
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS opening_balance_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS earliest_transaction_date TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE 'Creating indexes for accounts opening date columns...';
END $$;

-- Index for opening balance date
CREATE INDEX IF NOT EXISTS idx_accounts_opening_date ON accounts(opening_balance_date);
CREATE INDEX IF NOT EXISTS idx_accounts_earliest_transaction ON accounts(earliest_transaction_date);

-- ==============================================================================
-- PART 4: Create helper functions
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Creating helper functions for checkpoint system...';
END $$;

-- Function to calculate balance up to a specific date
CREATE OR REPLACE FUNCTION calculate_balance_up_to_date(
  p_account_id INTEGER,
  p_up_to_date TIMESTAMPTZ
)
RETURNS NUMERIC(15,2) AS $$
DECLARE
  v_balance NUMERIC(15,2);
BEGIN
  -- Calculate balance from all non-adjustment transactions up to date
  SELECT
    COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0)
  INTO v_balance
  FROM original_transaction
  WHERE account_id = p_account_id
    AND transaction_date <= p_up_to_date
    AND is_balance_adjustment = false;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update account opening balance date
CREATE OR REPLACE FUNCTION update_account_opening_balance_date(
  p_account_id INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_earliest_date TIMESTAMPTZ;
  v_opening_date TIMESTAMPTZ;
BEGIN
  -- Find earliest transaction (excluding balance adjustments)
  SELECT MIN(transaction_date)
  INTO v_earliest_date
  FROM original_transaction
  WHERE account_id = p_account_id
    AND is_balance_adjustment = false;

  IF v_earliest_date IS NOT NULL THEN
    -- Set opening balance date to one day before earliest transaction
    v_opening_date := v_earliest_date - INTERVAL '1 day';

    UPDATE accounts
    SET opening_balance_date = v_opening_date,
        earliest_transaction_date = v_earliest_date,
        updated_at = NOW()
    WHERE account_id = p_account_id;
  ELSE
    -- No transactions - set to today
    UPDATE accounts
    SET opening_balance_date = NOW(),
        earliest_transaction_date = NULL,
        updated_at = NOW()
    WHERE account_id = p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PART 5: Create trigger for automatic checkpoint recalculation
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Creating trigger for automatic checkpoint recalculation...';
END $$;

-- Function to trigger checkpoint recalculation
CREATE OR REPLACE FUNCTION trigger_recalculate_checkpoints()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id INTEGER;
BEGIN
  -- Determine which account_id to use
  IF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
  ELSE
    v_account_id := NEW.account_id;
  END IF;

  -- Only recalculate if it's not a balance adjustment transaction
  IF (TG_OP = 'DELETE' AND OLD.is_balance_adjustment = false) OR
     (TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_balance_adjustment = false) THEN

    -- Notify that checkpoints need recalculation
    -- In application code, you should listen to this notification
    -- or call recalculate_all_checkpoints() directly
    PERFORM pg_notify(
      'recalculate_checkpoints',
      json_build_object('account_id', v_account_id)::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS transaction_checkpoint_recalc ON original_transaction;

CREATE TRIGGER transaction_checkpoint_recalc
AFTER INSERT OR UPDATE OR DELETE ON original_transaction
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_checkpoints();

-- ==============================================================================
-- PART 6: Create updated_at trigger for balance_checkpoints
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Creating updated_at trigger for balance_checkpoints...';
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to balance_checkpoints
DROP TRIGGER IF EXISTS set_updated_at ON balance_checkpoints;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON balance_checkpoints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- PART 7: Grant permissions (for Supabase RLS)
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Granting permissions...';
END $$;

-- Grant permissions on the new table
-- Note: Adjust these based on your security requirements
GRANT ALL ON balance_checkpoints TO postgres;
GRANT ALL ON SEQUENCE balance_checkpoints_checkpoint_id_seq TO postgres;

-- If you have authenticated users
-- GRANT SELECT, INSERT, UPDATE, DELETE ON balance_checkpoints TO authenticated;
-- GRANT USAGE ON SEQUENCE balance_checkpoints_checkpoint_id_seq TO authenticated;

-- ==============================================================================
-- PART 8: Verification queries
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created/modified:';
  RAISE NOTICE '  - balance_checkpoints';
  RAISE NOTICE '  - original_transaction (added 3 columns)';
  RAISE NOTICE '  - accounts (added 2 columns)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - calculate_balance_up_to_date()';
  RAISE NOTICE '  - update_account_opening_balance_date()';
  RAISE NOTICE '  - trigger_recalculate_checkpoints()';
  RAISE NOTICE '  - update_updated_at_column()';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  - transaction_checkpoint_recalc on original_transaction';
  RAISE NOTICE '  - set_updated_at on balance_checkpoints';
  RAISE NOTICE '=================================================================';
END $$;

-- Optional: Run these queries to verify the migration
/*
-- Verify balance_checkpoints table
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'balance_checkpoints'
ORDER BY ordinal_position;

-- Verify original_transaction new columns
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'original_transaction'
  AND column_name IN ('checkpoint_id', 'is_balance_adjustment', 'is_flagged');

-- Verify accounts new columns
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('opening_balance_date', 'earliest_transaction_date');

-- Verify indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('balance_checkpoints', 'original_transaction', 'accounts')
  AND indexname LIKE '%checkpoint%' OR indexname LIKE '%flagged%' OR indexname LIKE '%opening%';

-- Verify functions
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'calculate_balance_up_to_date',
  'update_account_opening_balance_date',
  'trigger_recalculate_checkpoints',
  'update_updated_at_column'
);

-- Verify triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('transaction_checkpoint_recalc', 'set_updated_at');
*/
