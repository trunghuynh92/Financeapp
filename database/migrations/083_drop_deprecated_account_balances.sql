-- ============================================================================
-- MIGRATION 083: Drop deprecated account_balances tables
-- ============================================================================
-- The old account_balances tables are interfering with entity deletion
-- Safe to drop since we migrated to account_balance (singular) table
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping deprecated account_balances tables...';

  -- Drop the deprecated table if it exists
  DROP TABLE IF EXISTS account_balances_deprecated CASCADE;

  -- Drop the backup table if it exists
  DROP TABLE IF EXISTS account_balances_backup CASCADE;

  -- Drop the original if it somehow still exists
  DROP TABLE IF EXISTS account_balances CASCADE;

  RAISE NOTICE 'OK: All deprecated account_balances tables dropped';
END $$;

-- Verify we're using the correct table
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';

  -- Check account_balance (singular) exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'account_balance'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'OK: account_balance (singular) table exists';
  ELSE
    RAISE NOTICE 'WARNING: account_balance table does not exist';
  END IF;

  -- Check old tables are gone
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'account_balances%'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'OK: No account_balances (plural) tables found';
  ELSE
    RAISE NOTICE 'WARNING: account_balances tables still exist';
  END IF;
END $$;
