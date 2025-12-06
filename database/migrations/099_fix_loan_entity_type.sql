-- ============================================================================
-- MIGRATION 099: Fix Loan Transaction Types Entity Type
-- Purpose: Allow personal entities to use LOAN_DISBURSE and LOAN_COLLECT
-- Date: 2025-12-06
-- ============================================================================

-- Personal entities CAN lend money and collect repayments
-- Only DIVIDEND should remain business-only (profit distribution to shareholders)

UPDATE transaction_types
SET entity_type = 'both'
WHERE type_code IN ('LOAN_DISBURSE', 'LOAN_COLLECT');

-- Verify the changes
DO $$
DECLARE
  v_disburse_type text;
  v_collect_type text;
BEGIN
  SELECT entity_type INTO v_disburse_type FROM transaction_types WHERE type_code = 'LOAN_DISBURSE';
  SELECT entity_type INTO v_collect_type FROM transaction_types WHERE type_code = 'LOAN_COLLECT';

  RAISE NOTICE 'Migration 099: Fixed loan transaction types entity_type';
  RAISE NOTICE '  LOAN_DISBURSE entity_type: %', v_disburse_type;
  RAISE NOTICE '  LOAN_COLLECT entity_type: %', v_collect_type;
  RAISE NOTICE '  Personal entities can now lend money and collect repayments';
END $$;
