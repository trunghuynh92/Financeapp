-- ============================================================================
-- MIGRATION 076: Remove redundant fields from receipts table
-- Purpose: Remove main_transaction_id and account_id from receipts
--          These can be derived from raw_transaction_id relationship
-- ============================================================================

-- Drop the redundant columns
-- Receipts should only link to raw_transaction_id
-- main_transaction and account can be accessed via the raw_transaction relationship

ALTER TABLE receipts DROP COLUMN IF EXISTS main_transaction_id;
ALTER TABLE receipts DROP COLUMN IF EXISTS account_id;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check that receipts now only link via raw_transaction_id:
-- SELECT receipt_id, raw_transaction_id, entity_id FROM receipts LIMIT 5;

-- To get account and main_transaction info, join through raw_transaction:
-- SELECT
--   r.receipt_id,
--   r.raw_transaction_id,
--   ot.account_id,
--   mt.main_transaction_id
-- FROM receipts r
-- LEFT JOIN original_transaction ot ON r.raw_transaction_id = ot.raw_transaction_id
-- LEFT JOIN main_transaction mt ON r.raw_transaction_id = mt.raw_transaction_id
-- LIMIT 5;
