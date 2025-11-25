-- ============================================================================
-- MIGRATION 085: Drop all references to account_balances (plural)
-- ============================================================================
-- Find and drop any functions, triggers, or views that reference the old
-- account_balances table that was dropped in migration 084
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping functions that reference account_balances...';
END $$;

-- Drop functions that reference account_balances
DROP FUNCTION IF EXISTS create_account_balance() CASCADE;
DROP FUNCTION IF EXISTS sync_account_balance_from_checkpoints(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS trigger_recalculate_checkpoints() CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'OK: Dropped obsolete functions';
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 085 COMPLETE ===';
  RAISE NOTICE 'All account_balances references removed';
  RAISE NOTICE 'Entity deletion should now work without errors';
END $$;
