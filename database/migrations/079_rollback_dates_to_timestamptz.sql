-- ============================================================================
-- ROLLBACK for Migration 079: Revert DATE columns back to TIMESTAMPTZ
-- ============================================================================
-- WARNING: Only use this if migration 079 caused issues
-- This will convert DATE columns back to TIMESTAMPTZ with midnight UTC time
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting rollback of migration 079...';
  RAISE NOTICE 'Converting DATE columns back to TIMESTAMPTZ';
END $$;

-- ============================================================================
-- STEP 0: Drop dependent views
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping dependent views...';
END $$;

DROP VIEW IF EXISTS main_transaction_details CASCADE;
DROP VIEW IF EXISTS unmatched_transfers CASCADE;
DROP VIEW IF EXISTS debt_summary CASCADE;
DROP VIEW IF EXISTS amendment_history CASCADE;
DROP VIEW IF EXISTS budget_overview CASCADE;
DROP VIEW IF EXISTS contract_overview CASCADE;
DROP VIEW IF EXISTS scheduled_payment_overview CASCADE;

-- ============================================================================
-- STEP 1: Revert original_transaction.transaction_date to TIMESTAMPTZ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Reverting original_transaction.transaction_date to TIMESTAMPTZ...';
END $$;

ALTER TABLE original_transaction
  ALTER COLUMN transaction_date TYPE TIMESTAMPTZ USING transaction_date::TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE '✓ original_transaction.transaction_date reverted to TIMESTAMPTZ';
END $$;

-- ============================================================================
-- STEP 2: Revert main_transaction.transaction_date to TIMESTAMPTZ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Reverting main_transaction.transaction_date to TIMESTAMPTZ...';
END $$;

ALTER TABLE main_transaction
  ALTER COLUMN transaction_date TYPE TIMESTAMPTZ USING transaction_date::TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE '✓ main_transaction.transaction_date reverted to TIMESTAMPTZ';
END $$;

-- ============================================================================
-- STEP 3: Revert balance_checkpoints.checkpoint_date to TIMESTAMPTZ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Reverting balance_checkpoints.checkpoint_date to TIMESTAMPTZ...';
END $$;

ALTER TABLE balance_checkpoints
  ALTER COLUMN checkpoint_date TYPE TIMESTAMPTZ USING checkpoint_date::TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE '✓ balance_checkpoints.checkpoint_date reverted to TIMESTAMPTZ';
END $$;

-- ============================================================================
-- STEP 4: Revert account_balance.balance_date to TIMESTAMPTZ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Reverting account_balance.balance_date to TIMESTAMPTZ...';
END $$;

ALTER TABLE account_balance
  ALTER COLUMN balance_date TYPE TIMESTAMPTZ USING balance_date::TIMESTAMPTZ;

DO $$
BEGIN
  RAISE NOTICE '✓ account_balance.balance_date reverted to TIMESTAMPTZ';
END $$;

-- ============================================================================
-- STEP 5: Revert calculate_balance_up_to_date function to accept TIMESTAMPTZ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Reverting calculate_balance_up_to_date function...';
END $$;

CREATE OR REPLACE FUNCTION calculate_balance_up_to_date(
  p_account_id INTEGER,
  p_up_to_date TIMESTAMPTZ  -- Changed back to TIMESTAMPTZ
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
BEGIN
  SELECT COALESCE(
    SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
    0
  )
  INTO v_balance
  FROM original_transaction
  WHERE account_id = p_account_id
    AND transaction_date <= p_up_to_date
    AND is_balance_adjustment = false
  ORDER BY transaction_date, transaction_sequence;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  RAISE NOTICE '✓ calculate_balance_up_to_date function reverted';
END $$;

-- ============================================================================
-- STEP 6: Recreate views (they will automatically use TIMESTAMPTZ now)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Recreating views with TIMESTAMPTZ columns...';
END $$;

-- You'll need to run the view creation from the latest migration that defines them
-- Or manually recreate them here

DO $$
BEGIN
  RAISE NOTICE '⚠️  Views need to be recreated manually from their source migrations';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_ot_type text;
  v_mt_type text;
  v_cp_type text;
  v_ab_type text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ROLLBACK VERIFICATION ===';

  SELECT data_type INTO v_ot_type
  FROM information_schema.columns
  WHERE table_name = 'original_transaction' AND column_name = 'transaction_date';

  SELECT data_type INTO v_mt_type
  FROM information_schema.columns
  WHERE table_name = 'main_transaction' AND column_name = 'transaction_date';

  SELECT data_type INTO v_cp_type
  FROM information_schema.columns
  WHERE table_name = 'balance_checkpoints' AND column_name = 'checkpoint_date';

  SELECT data_type INTO v_ab_type
  FROM information_schema.columns
  WHERE table_name = 'account_balance' AND column_name = 'balance_date';

  RAISE NOTICE 'original_transaction.transaction_date: %', v_ot_type;
  RAISE NOTICE 'main_transaction.transaction_date: %', v_mt_type;
  RAISE NOTICE 'balance_checkpoints.checkpoint_date: %', v_cp_type;
  RAISE NOTICE 'account_balance.balance_date: %', v_ab_type;

  IF v_ot_type = 'timestamp with time zone' AND v_mt_type = 'timestamp with time zone'
     AND v_cp_type = 'timestamp with time zone' AND v_ab_type = 'timestamp with time zone' THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ ROLLBACK SUCCESSFUL: All columns reverted to TIMESTAMPTZ';
  ELSE
    RAISE EXCEPTION 'Rollback failed: Some columns not reverted';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 079 ROLLBACK COMPLETE ===';
  RAISE NOTICE 'Reverted columns:';
  RAISE NOTICE '  - original_transaction.transaction_date (DATE → TIMESTAMPTZ)';
  RAISE NOTICE '  - main_transaction.transaction_date (DATE → TIMESTAMPTZ)';
  RAISE NOTICE '  - balance_checkpoints.checkpoint_date (DATE → TIMESTAMPTZ)';
  RAISE NOTICE '  - account_balance.balance_date (DATE → TIMESTAMPTZ)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You need to:';
  RAISE NOTICE '  1. Revert backend code changes (git revert)';
  RAISE NOTICE '  2. Manually recreate views from source migrations';
  RAISE NOTICE '  3. Restart application to use old date handling';
END $$;
