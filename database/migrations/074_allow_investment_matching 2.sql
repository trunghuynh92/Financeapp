-- Migration 074: Allow Investment transaction matching
-- Purpose: Enable INV_CONTRIB ↔ INV_CONTRIB and INV_WITHDRAW ↔ INV_WITHDRAW matching
-- Created: 2025-01-20
-- Related: Similar to Migration 052 (LOAN_COLLECT matching)

-- Update validate_transfer_match function to allow investment transaction matching
CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
  my_type_code VARCHAR(20);
  matched_type_code VARCHAR(20);
  my_entity_id UUID;
  matched_entity_id UUID;
BEGIN
  -- Only validate if there's a transfer match
  IF NEW.transfer_matched_transaction_id IS NOT NULL THEN
    -- Get my transaction details
    SELECT
      tt.type_code,
      a.entity_id
    INTO
      my_type_code,
      my_entity_id
    FROM transaction_types tt
    JOIN accounts a ON a.account_id = NEW.account_id
    WHERE tt.transaction_type_id = NEW.transaction_type_id;

    -- Get matched transaction details
    SELECT
      tt.type_code,
      a.entity_id
    INTO
      matched_type_code,
      matched_entity_id
    FROM main_transaction mt
    JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
    JOIN accounts a ON a.account_id = mt.account_id
    WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

    -- Validate same entity
    IF my_entity_id != matched_entity_id THEN
      RAISE EXCEPTION 'Cross-entity transfers are not allowed';
    END IF;

    -- Validate valid transfer pairs
    IF NOT (
      -- Regular transfers
      (my_type_code = 'TRF_OUT' AND matched_type_code = 'TRF_IN') OR
      (my_type_code = 'TRF_IN' AND matched_type_code = 'TRF_OUT') OR
      -- Debt repayment matching
      (my_type_code = 'DEBT_PAY' AND matched_type_code = 'DEBT_SETTLE') OR
      (my_type_code = 'DEBT_SETTLE' AND matched_type_code = 'DEBT_PAY') OR
      -- Loan receivable matching
      (my_type_code = 'LOAN_RECEIVE' AND matched_type_code = 'LOAN_SETTLE') OR
      (my_type_code = 'LOAN_SETTLE' AND matched_type_code = 'LOAN_RECEIVE') OR
      -- Same-type matching for transfers between accounts
      (my_type_code = 'CC_PAY' AND matched_type_code = 'CC_PAY') OR
      (my_type_code = 'DEBT_TAKE' AND matched_type_code = 'DEBT_TAKE') OR
      (my_type_code = 'DEBT_PAY' AND matched_type_code = 'DEBT_PAY') OR
      (my_type_code = 'LOAN_DISBURSE' AND matched_type_code = 'LOAN_DISBURSE') OR
      (my_type_code = 'LOAN_COLLECT' AND matched_type_code = 'LOAN_COLLECT') OR
      -- Investment matching (NEW)
      (my_type_code = 'INV_CONTRIB' AND matched_type_code = 'INV_CONTRIB') OR
      (my_type_code = 'INV_WITHDRAW' AND matched_type_code = 'INV_WITHDRAW')
    ) THEN
      RAISE EXCEPTION 'Invalid transfer match: % cannot be matched with %', my_type_code, matched_type_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 074 completed successfully!';
    RAISE NOTICE 'Added INV_CONTRIB ↔ INV_CONTRIB matching support';
    RAISE NOTICE 'Added INV_WITHDRAW ↔ INV_WITHDRAW matching support';
END $$;
