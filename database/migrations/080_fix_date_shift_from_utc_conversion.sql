-- ============================================================================
-- MIGRATION 080: Fix Date Shift from UTC Conversion
-- Purpose: Correct dates that were shifted back 1 day due to UTC conversion
-- ============================================================================

-- Background:
-- Migration 079 converted TIMESTAMPTZ to DATE using UTC timezone instead of GMT+7
-- This caused all transactions to shift back by 1 day:
--   Original: 2025-05-01T17:00:00Z (May 2 in GMT+7) → became 2025-05-01
--   Should be: 2025-05-02
--
-- Since all bank import dates were originally midnight GMT+7 (17:00 UTC),
-- we can reliably fix this by adding 1 day to all dates.

DO $$
BEGIN
  RAISE NOTICE 'Starting date shift correction...';
  RAISE NOTICE 'Adding 1 day to all transaction dates to correct UTC conversion error';
END $$;

-- ============================================================================
-- STEP 1: Fix original_transaction.transaction_date
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing original_transaction dates (adding 1 day)...';
END $$;

UPDATE original_transaction
SET transaction_date = transaction_date + INTERVAL '1 day';

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM original_transaction;
  RAISE NOTICE 'OK: Fixed % rows in original_transaction', v_count;
END $$;

-- ============================================================================
-- STEP 2: Fix main_transaction.transaction_date
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing main_transaction dates (adding 1 day)...';
END $$;

UPDATE main_transaction
SET transaction_date = transaction_date + INTERVAL '1 day';

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM main_transaction;
  RAISE NOTICE 'OK: Fixed % rows in main_transaction', v_count;
END $$;

-- ============================================================================
-- STEP 3: Fix balance_checkpoints.checkpoint_date
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing balance_checkpoints dates (adding 1 day)...';
END $$;

UPDATE balance_checkpoints
SET checkpoint_date = checkpoint_date + INTERVAL '1 day';

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM balance_checkpoints;
  RAISE NOTICE 'OK: Fixed % rows in balance_checkpoints', v_count;
END $$;

-- ============================================================================
-- STEP 4: Fix account_balance.balance_date (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'account_balance'
  ) THEN
    RAISE NOTICE 'Fixing account_balance dates (adding 1 day)...';

    UPDATE account_balance
    SET balance_date = balance_date + INTERVAL '1 day';

    DECLARE
      v_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_count FROM account_balance;
      RAISE NOTICE 'OK: Fixed % rows in account_balance', v_count;
    END;
  ELSE
    RAISE NOTICE 'Skipping account_balance (table does not exist)';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_min_date DATE;
  v_max_date DATE;
  v_sample_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';

  -- Check date range in original_transaction
  SELECT MIN(transaction_date), MAX(transaction_date), COUNT(*)
  INTO v_min_date, v_max_date, v_sample_count
  FROM original_transaction;

  RAISE NOTICE 'original_transaction date range: % to %', v_min_date, v_max_date;
  RAISE NOTICE 'Total transactions: %', v_sample_count;

  -- Check a sample of recent dates
  RAISE NOTICE '';
  RAISE NOTICE 'Sample of recent dates (should now be correct):';

  FOR v_min_date IN
    SELECT DISTINCT transaction_date
    FROM original_transaction
    ORDER BY transaction_date DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  - %', v_min_date;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'SUCCESS: All dates have been shifted forward by 1 day';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 080 COMPLETE ===';
  RAISE NOTICE 'Fixed date shift caused by UTC conversion in migration 079';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - Added 1 day to all original_transaction.transaction_date';
  RAISE NOTICE '  - Added 1 day to all main_transaction.transaction_date';
  RAISE NOTICE '  - Added 1 day to all balance_checkpoints.checkpoint_date';
  RAISE NOTICE '  - Added 1 day to all account_balance.balance_date (if exists)';
  RAISE NOTICE '';
  RAISE NOTICE 'Why this works:';
  RAISE NOTICE '  - All bank imports store dates as midnight GMT+7';
  RAISE NOTICE '  - This became 17:00 previous day UTC when using toISOString()';
  RAISE NOTICE '  - Migration 079 converted using UTC, shifting dates back 1 day';
  RAISE NOTICE '  - Adding 1 day restores the correct business dates';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Recalculate all balance checkpoints';
END $$;
