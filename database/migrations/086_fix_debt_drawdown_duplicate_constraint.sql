-- ============================================================================
-- MIGRATION 086: Fix duplicate constraint on debt_drawdown
-- ============================================================================
-- Remove the RESTRICT constraint that blocks entity deletion
-- Keep only the CASCADE constraint
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing debt_drawdown duplicate constraint...';
END $$;

-- Drop the RESTRICT constraint
ALTER TABLE debt_drawdown DROP CONSTRAINT IF EXISTS fk_drawdown_account;

DO $$
BEGIN
  RAISE NOTICE 'OK: Dropped fk_drawdown_account (RESTRICT)';
  RAISE NOTICE 'Keeping debt_drawdown_account_id_fkey (CASCADE)';
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 086 COMPLETE ===';
  RAISE NOTICE 'Entity deletion now fully functional';
END $$;
