-- ============================================================================
-- MIGRATION 050: Add Flag Field to Main Transactions
-- Purpose: Allow users to flag transactions for investigation or follow-up
-- Date: 2025-01-13
-- ============================================================================

BEGIN;

-- Add is_flagged column to main_transaction table
ALTER TABLE main_transaction
ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN flagged_at TIMESTAMPTZ,
ADD COLUMN flagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN flag_note TEXT;

-- Create index for faster querying of flagged transactions
CREATE INDEX idx_main_transaction_is_flagged ON main_transaction(is_flagged) WHERE is_flagged = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN main_transaction.is_flagged IS 'Whether this transaction is flagged for investigation';
COMMENT ON COLUMN main_transaction.flagged_at IS 'Timestamp when the transaction was flagged';
COMMENT ON COLUMN main_transaction.flagged_by IS 'User who flagged the transaction';
COMMENT ON COLUMN main_transaction.flag_note IS 'Optional note about why the transaction was flagged';

COMMIT;
