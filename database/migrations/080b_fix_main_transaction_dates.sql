-- ============================================================================
-- MIGRATION 080b: Fix main_transaction dates (Part 2 of 4)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing main_transaction dates (adding 1 day)...';
END $$;

UPDATE main_transaction
SET transaction_date = transaction_date + 1;

DO $$
BEGIN
  RAISE NOTICE 'OK: Fixed main_transaction dates';
  RAISE NOTICE 'Total rows: %', (SELECT COUNT(*) FROM main_transaction);
END $$;
