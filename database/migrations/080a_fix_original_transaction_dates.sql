-- ============================================================================
-- MIGRATION 080a: Fix original_transaction dates (Part 1 of 4)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing original_transaction dates (adding 1 day)...';
END $$;

UPDATE original_transaction
SET transaction_date = transaction_date + 1;

DO $$
BEGIN
  RAISE NOTICE 'OK: Fixed original_transaction dates';
  RAISE NOTICE 'Total rows: %', (SELECT COUNT(*) FROM original_transaction);
END $$;
