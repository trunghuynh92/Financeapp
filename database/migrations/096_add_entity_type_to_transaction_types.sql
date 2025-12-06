-- ============================================================================
-- Add entity_type to transaction_types
-- Migration: 096_add_entity_type_to_transaction_types.sql
--
-- Adds entity_type column to filter transaction types by personal/business
-- ============================================================================

-- Add entity_type column
ALTER TABLE transaction_types
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'both'
CHECK (entity_type IN ('business', 'personal', 'both'));

-- Update entity_type for each transaction type
-- Business only: DIVIDEND, LOAN_DISBURSE, LOAN_COLLECT, LOAN_WRITEOFF
UPDATE transaction_types SET entity_type = 'business' WHERE type_code IN ('DIVIDEND', 'LOAN_DISBURSE', 'LOAN_COLLECT', 'LOAN_WRITEOFF');

-- Both personal and business (default)
UPDATE transaction_types SET entity_type = 'both' WHERE type_code IN (
  'INC', 'EXP', 'TRF_IN', 'TRF_OUT',
  'DEBT_TAKE', 'DEBT_PAY',
  'CAPITAL_IN', 'CAPITAL_OUT',
  'INV_CONTRIB', 'INV_WITHDRAW',
  'CC_CHARGE', 'CC_PAY'
);

-- Verify
SELECT type_code, type_display_name, entity_type
FROM transaction_types
WHERE is_active = true
ORDER BY display_order;
