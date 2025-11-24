/**
 * Migration 076: Change receipts to link to raw_transaction instead of main_transaction
 *
 * Purpose: Receipts should be attached to the original imported transaction (raw_transaction)
 *          not the derived main_transaction, since:
 *          - Raw transactions are the source of truth from bank imports
 *          - One raw_transaction can become multiple main_transactions (splits)
 *          - Receipts represent the original proof of the raw transaction
 *
 * Changes:
 * 1. Drop main_transaction_id column and its index
 * 2. Add raw_transaction_id column with FK to original_transaction table
 * 3. Add new index on raw_transaction_id
 */

-- ============================================================================
-- 1. Drop the main_transaction_id foreign key constraint and column
-- ============================================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_receipts_transaction;

-- Drop the column (this automatically drops the FK constraint)
ALTER TABLE receipts
DROP COLUMN IF EXISTS main_transaction_id;

-- ============================================================================
-- 2. Add raw_transaction_id column linked to original_transaction table
-- ============================================================================

-- Add the new column
ALTER TABLE receipts
ADD COLUMN raw_transaction_id TEXT REFERENCES original_transaction(raw_transaction_id) ON DELETE CASCADE;

-- ============================================================================
-- 3. Create index for performance
-- ============================================================================

CREATE INDEX idx_receipts_raw_transaction ON receipts(raw_transaction_id);

-- ============================================================================
-- 4. Update table comment
-- ============================================================================

COMMENT ON COLUMN receipts.raw_transaction_id IS 'Link to original transaction this receipt belongs to (optional)';

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verification query (run this to verify migration worked):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'receipts'
-- AND column_name IN ('raw_transaction_id', 'main_transaction_id');
