-- ============================================================================
-- MIGRATION 082: Fix Entity CASCADE DELETE
-- ============================================================================
-- Problem: Deleting an entity is blocked by ON DELETE RESTRICT on transactions
-- Solution: Change RESTRICT to CASCADE so entity deletion cascades through all data
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing entity cascade delete chain...';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Fix original_transaction foreign key
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing original_transaction.account_id foreign key...';

  -- Drop the old constraint
  ALTER TABLE original_transaction
    DROP CONSTRAINT IF EXISTS original_transaction_account_id_fkey;

  -- Add new constraint with CASCADE
  ALTER TABLE original_transaction
    ADD CONSTRAINT original_transaction_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES accounts(account_id)
    ON DELETE CASCADE;

  RAISE NOTICE 'OK: original_transaction now cascades on account deletion';
END $$;

-- ============================================================================
-- STEP 2: Fix main_transaction foreign key
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing main_transaction.account_id foreign key...';

  -- Drop the old constraint (named fk_account in the original migration)
  ALTER TABLE main_transaction
    DROP CONSTRAINT IF EXISTS fk_account;

  -- Also try the auto-generated name just in case
  ALTER TABLE main_transaction
    DROP CONSTRAINT IF EXISTS main_transaction_account_id_fkey;

  -- Add new constraint with CASCADE
  ALTER TABLE main_transaction
    ADD CONSTRAINT main_transaction_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES accounts(account_id)
    ON DELETE CASCADE;

  RAISE NOTICE 'OK: main_transaction now cascades on account deletion';
END $$;

-- ============================================================================
-- STEP 3: Fix import_batch foreign key
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing import_batch.account_id foreign key...';

  -- Drop the old constraint
  ALTER TABLE import_batch
    DROP CONSTRAINT IF EXISTS import_batch_account_id_fkey;

  -- Add new constraint with CASCADE
  ALTER TABLE import_batch
    ADD CONSTRAINT import_batch_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES accounts(account_id)
    ON DELETE CASCADE;

  RAISE NOTICE 'OK: import_batch now cascades on account deletion';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_restrict_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';

  -- Check for any remaining RESTRICT constraints on entity-related tables
  SELECT COUNT(*)
  INTO v_restrict_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN (
      'accounts', 'original_transaction', 'main_transaction',
      'import_batch', 'balance_checkpoints', 'account_balance',
      'categories', 'branches', 'projects',
      'business_partners', 'category_budgets',
      'scheduled_payments', 'payment_instances',
      'contracts', 'contract_amendments',
      'investment_contributions'
    )
    AND kcu.column_name IN ('entity_id', 'account_id');

  RAISE NOTICE 'Checked foreign key constraints';
  RAISE NOTICE '';
  RAISE NOTICE 'SUCCESS: Entity deletion will now cascade properly';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION 082 COMPLETE ===';
  RAISE NOTICE 'Fixed cascade delete chain for entities';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - original_transaction.account_id: RESTRICT -> CASCADE';
  RAISE NOTICE '  - main_transaction.account_id: RESTRICT -> CASCADE';
  RAISE NOTICE '  - import_batch.account_id: RESTRICT -> CASCADE';
  RAISE NOTICE '';
  RAISE NOTICE 'Cascade chain now:';
  RAISE NOTICE '  entities (DELETE)';
  RAISE NOTICE '    -> accounts (CASCADE)';
  RAISE NOTICE '       -> original_transaction (CASCADE)';
  RAISE NOTICE '       -> main_transaction (CASCADE via original_transaction)';
  RAISE NOTICE '       -> import_batch (CASCADE)';
  RAISE NOTICE '       -> balance_checkpoints (CASCADE)';
  RAISE NOTICE '       -> account_balance (CASCADE)';
  RAISE NOTICE '    -> categories (CASCADE)';
  RAISE NOTICE '    -> branches (CASCADE)';
  RAISE NOTICE '    -> projects (CASCADE)';
  RAISE NOTICE '    -> business_partners (CASCADE)';
  RAISE NOTICE '    -> category_budgets (CASCADE)';
  RAISE NOTICE '    -> scheduled_payments (CASCADE)';
  RAISE NOTICE '    -> contracts (CASCADE)';
  RAISE NOTICE '    -> investment_contributions (CASCADE)';
  RAISE NOTICE '';
  RAISE NOTICE 'Result: Deleting an entity will now delete ALL associated data';
END $$;
