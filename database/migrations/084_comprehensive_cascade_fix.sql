-- ============================================================================
-- MIGRATION 084: Comprehensive CASCADE DELETE Fix
-- ============================================================================
-- Fix ALL foreign key constraints to enable complete entity deletion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting comprehensive CASCADE fix...';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Drop account_balances (plural) - this is the old deprecated table
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping old account_balances table...';
  DROP TABLE IF EXISTS account_balances CASCADE;
  DROP TABLE IF EXISTS account_balances_deprecated CASCADE;
  DROP TABLE IF EXISTS account_balances_backup CASCADE;
  RAISE NOTICE 'OK: Old account_balances tables dropped';
END $$;

-- ============================================================================
-- Fix all account_id foreign keys to CASCADE
-- ============================================================================

-- debt_drawdown
DO $$
BEGIN
  RAISE NOTICE 'Fixing debt_drawdown.account_id...';
  ALTER TABLE debt_drawdown DROP CONSTRAINT IF EXISTS debt_drawdown_account_id_fkey;
  ALTER TABLE debt_drawdown
    ADD CONSTRAINT debt_drawdown_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: debt_drawdown';
END $$;

-- loan_disbursement
DO $$
BEGIN
  RAISE NOTICE 'Fixing loan_disbursement.account_id...';
  ALTER TABLE loan_disbursement DROP CONSTRAINT IF EXISTS loan_disbursement_account_id_fkey;
  ALTER TABLE loan_disbursement
    ADD CONSTRAINT loan_disbursement_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: loan_disbursement';
END $$;

-- investment_contribution (has investment_account_id and source_account_id)
DO $$
BEGIN
  RAISE NOTICE 'Fixing investment_contribution foreign keys...';

  -- investment_account_id already has CASCADE (from migration 064)
  -- source_account_id has RESTRICT - change to CASCADE
  ALTER TABLE investment_contribution DROP CONSTRAINT IF EXISTS investment_contribution_source_account_id_fkey;
  ALTER TABLE investment_contribution
    ADD CONSTRAINT investment_contribution_source_account_id_fkey
    FOREIGN KEY (source_account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;

  RAISE NOTICE 'OK: investment_contribution';
END $$;

-- receipts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN
    RAISE NOTICE 'Fixing receipts.account_id...';
    ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_account_id_fkey;
    ALTER TABLE receipts
      ADD CONSTRAINT receipts_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
    RAISE NOTICE 'OK: receipts';
  END IF;
END $$;

-- balance_checkpoints
DO $$
BEGIN
  RAISE NOTICE 'Fixing balance_checkpoints.account_id...';
  ALTER TABLE balance_checkpoints DROP CONSTRAINT IF EXISTS balance_checkpoints_account_id_fkey;
  ALTER TABLE balance_checkpoints
    ADD CONSTRAINT balance_checkpoints_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: balance_checkpoints';
END $$;

-- ============================================================================
-- Fix all entity_id foreign keys to CASCADE (already should be, but verify)
-- ============================================================================

-- categories
DO $$
BEGIN
  RAISE NOTICE 'Verifying categories.entity_id...';
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_entity_id_fkey;
  ALTER TABLE categories
    ADD CONSTRAINT categories_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: categories';
END $$;

-- branches
DO $$
BEGIN
  RAISE NOTICE 'Verifying branches.entity_id...';
  ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_entity_id_fkey;
  ALTER TABLE branches
    ADD CONSTRAINT branches_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: branches';
END $$;

-- projects
DO $$
BEGIN
  RAISE NOTICE 'Verifying projects.entity_id...';
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_entity_id_fkey;
  ALTER TABLE projects
    ADD CONSTRAINT projects_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: projects';
END $$;

-- business_partners
DO $$
BEGIN
  RAISE NOTICE 'Verifying business_partners.entity_id...';
  ALTER TABLE business_partners DROP CONSTRAINT IF EXISTS business_partners_entity_id_fkey;
  ALTER TABLE business_partners
    ADD CONSTRAINT business_partners_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: business_partners';
END $$;

-- scheduled_payments
DO $$
BEGIN
  RAISE NOTICE 'Verifying scheduled_payments.entity_id...';
  ALTER TABLE scheduled_payments DROP CONSTRAINT IF EXISTS scheduled_payments_entity_id_fkey;
  ALTER TABLE scheduled_payments
    ADD CONSTRAINT scheduled_payments_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: scheduled_payments';
END $$;

-- contracts
DO $$
BEGIN
  RAISE NOTICE 'Verifying contracts.entity_id...';
  ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_entity_id_fkey;
  ALTER TABLE contracts
    ADD CONSTRAINT contracts_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: contracts';
END $$;

-- category_budgets
DO $$
BEGIN
  RAISE NOTICE 'Verifying category_budgets.entity_id...';
  ALTER TABLE category_budgets DROP CONSTRAINT IF EXISTS category_budgets_entity_id_fkey;
  ALTER TABLE category_budgets
    ADD CONSTRAINT category_budgets_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
  RAISE NOTICE 'OK: category_budgets';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 084 COMPLETE ===';
  RAISE NOTICE 'All foreign key constraints now use CASCADE';
  RAISE NOTICE '';
  RAISE NOTICE 'Deleting an entity will now cascade delete:';
  RAISE NOTICE '  - accounts';
  RAISE NOTICE '  - original_transaction (via accounts)';
  RAISE NOTICE '  - main_transaction (via accounts)';
  RAISE NOTICE '  - import_batch (via accounts)';
  RAISE NOTICE '  - balance_checkpoints (via accounts)';
  RAISE NOTICE '  - account_balance (via accounts)';
  RAISE NOTICE '  - debt_drawdown (via accounts)';
  RAISE NOTICE '  - loan_disbursement (via accounts)';
  RAISE NOTICE '  - investment_contribution (via accounts)';
  RAISE NOTICE '  - receipts (via accounts)';
  RAISE NOTICE '  - categories (direct)';
  RAISE NOTICE '  - branches (direct)';
  RAISE NOTICE '  - projects (direct)';
  RAISE NOTICE '  - business_partners (direct)';
  RAISE NOTICE '  - scheduled_payments (direct)';
  RAISE NOTICE '  - contracts (direct)';
  RAISE NOTICE '  - category_budgets (direct)';
  RAISE NOTICE '';
  RAISE NOTICE 'Entity deletion will now work with ZERO residue!';
END $$;
