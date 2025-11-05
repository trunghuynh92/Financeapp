-- ============================================================================
-- Migration 005: Add import_batch_id to balance_checkpoints
-- ============================================================================
-- Purpose: Link checkpoints to import batches for proper rollback handling
--
-- When a checkpoint is created during bank statement import, we store the
-- import_batch_id. When rolling back the import, we can delete the checkpoint
-- created by that import.
--
-- Manual checkpoints (created via UI button) will have import_batch_id = NULL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration 005: Adding import_batch_id to balance_checkpoints';
  RAISE NOTICE '============================================================';
END $$;

-- ==============================================================================
-- STEP 1: Add import_batch_id column
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'balance_checkpoints' AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE balance_checkpoints
    ADD COLUMN import_batch_id INTEGER NULL
    REFERENCES import_batch(import_batch_id) ON DELETE SET NULL;

    RAISE NOTICE 'Added import_batch_id column to balance_checkpoints';
  ELSE
    RAISE NOTICE 'import_batch_id column already exists, skipping';
  END IF;
END $$;

-- ==============================================================================
-- STEP 2: Add index for import_batch_id
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_checkpoints_import_batch
ON balance_checkpoints(import_batch_id);

DO $$
BEGIN
  RAISE NOTICE 'Created index on import_batch_id';
END $$;

-- ==============================================================================
-- STEP 3: Add comments for documentation
-- ==============================================================================

COMMENT ON COLUMN balance_checkpoints.import_batch_id IS
'Links checkpoint to import batch. NULL for manual checkpoints. When import is rolled back, checkpoints created by that import can be deleted.';

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration 005 Complete!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✅ Added import_batch_id column to balance_checkpoints';
  RAISE NOTICE '  ✅ Added foreign key to import_batch (ON DELETE SET NULL)';
  RAISE NOTICE '  ✅ Created index on import_batch_id';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  • Import-created checkpoints: import_batch_id = batch ID';
  RAISE NOTICE '  • Manual checkpoints: import_batch_id = NULL';
  RAISE NOTICE '  • On rollback: DELETE checkpoint WHERE import_batch_id = X';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
