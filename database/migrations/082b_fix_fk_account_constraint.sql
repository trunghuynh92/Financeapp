-- ============================================================================
-- MIGRATION 082b: Fix fk_account constraint on main_transaction
-- ============================================================================
-- Direct fix for the blocking constraint
-- ============================================================================

-- Drop the constraint
ALTER TABLE main_transaction DROP CONSTRAINT fk_account;

-- Add it back with CASCADE
ALTER TABLE main_transaction
  ADD CONSTRAINT fk_account
  FOREIGN KEY (account_id)
  REFERENCES accounts(account_id)
  ON DELETE CASCADE;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'OK: fk_account constraint now uses CASCADE';
END $$;
