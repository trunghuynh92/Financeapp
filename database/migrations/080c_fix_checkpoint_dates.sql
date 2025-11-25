-- ============================================================================
-- MIGRATION 080c: Fix balance_checkpoints dates (Part 3 of 4)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing balance_checkpoints dates (adding 1 day)...';
END $$;

UPDATE balance_checkpoints
SET checkpoint_date = checkpoint_date + 1;

DO $$
BEGIN
  RAISE NOTICE 'OK: Fixed balance_checkpoints dates';
  RAISE NOTICE 'Total rows: %', (SELECT COUNT(*) FROM balance_checkpoints);
END $$;
