-- ============================================================================
-- MIGRATION 080d: Fix account_balance dates (Part 4 of 4)
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
    SET balance_date = balance_date + 1;

    RAISE NOTICE 'OK: Fixed account_balance dates';
    RAISE NOTICE 'Total rows: %', (SELECT COUNT(*) FROM account_balance);
  ELSE
    RAISE NOTICE 'Skipping account_balance (table does not exist)';
  END IF;
END $$;
