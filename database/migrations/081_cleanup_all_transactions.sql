-- ============================================================================
-- MIGRATION 081: Clean Up All Transactions for Fresh Re-Import
-- ============================================================================
-- WARNING: This will delete ALL transaction data!
-- Only run this if you're ready to re-import all bank statements.
-- ============================================================================

DO $$
DECLARE
  v_ot_count INTEGER;
  v_mt_count INTEGER;
  v_cp_count INTEGER;
  v_ib_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting cleanup of all transaction data...';
  RAISE NOTICE '';

  -- Get counts before deletion
  SELECT COUNT(*) INTO v_ot_count FROM original_transaction;
  SELECT COUNT(*) INTO v_mt_count FROM main_transaction;
  SELECT COUNT(*) INTO v_cp_count FROM balance_checkpoints;
  SELECT COUNT(*) INTO v_ib_count FROM import_batches;

  RAISE NOTICE 'Current data counts:';
  RAISE NOTICE '  - original_transaction: % rows', v_ot_count;
  RAISE NOTICE '  - main_transaction: % rows', v_mt_count;
  RAISE NOTICE '  - balance_checkpoints: % rows', v_cp_count;
  RAISE NOTICE '  - import_batches: % rows', v_ib_count;
  RAISE NOTICE '';

  -- Delete in correct order to respect foreign key constraints
  RAISE NOTICE 'Deleting balance_checkpoints...';
  DELETE FROM balance_checkpoints;

  RAISE NOTICE 'Deleting main_transaction...';
  DELETE FROM main_transaction;

  RAISE NOTICE 'Deleting original_transaction...';
  DELETE FROM original_transaction;

  RAISE NOTICE 'Deleting import_batches...';
  DELETE FROM import_batches;

  RAISE NOTICE '';
  RAISE NOTICE 'OK: All transaction data deleted';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Re-import your bank statements using the corrected import code';
  RAISE NOTICE '  2. Dates will now be stored correctly as DATE type';
  RAISE NOTICE '  3. No timezone conversion issues!';
END $$;

-- Reset sequences (optional - so IDs start from 1 again)
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Resetting ID sequences...';

  -- Reset sequences to start from 1
  PERFORM setval('original_transaction_raw_transaction_id_seq', 1, false);
  PERFORM setval('main_transaction_main_transaction_id_seq', 1, false);
  PERFORM setval('balance_checkpoints_checkpoint_id_seq', 1, false);
  PERFORM setval('import_batches_import_batch_id_seq', 1, false);

  RAISE NOTICE 'OK: ID sequences reset to 1';
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
  RAISE NOTICE 'Database is ready for fresh import with correct DATE handling';
END $$;
