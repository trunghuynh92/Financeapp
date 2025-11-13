-- Migration 041: Fix validate_transfer_match function
-- Purpose: Fix broken validate_transfer_match from Migration 037
-- Issue: Migration 037 replaced the function with a broken version that references
--        non-existent fields (from_transaction_type_id, to_transaction_type_id)
-- Created: 2025-11-10

-- Restore proper validate_transfer_match function
-- This function should only run when there's actually a transfer match
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
      (my_type_code = 'TRF_OUT' AND matched_type_code = 'TRF_IN') OR
      (my_type_code = 'TRF_IN' AND matched_type_code = 'TRF_OUT') OR
      (my_type_code = 'DEBT_PAY' AND matched_type_code = 'DEBT_SETTLE') OR
      (my_type_code = 'DEBT_SETTLE' AND matched_type_code = 'DEBT_PAY') OR
      (my_type_code = 'LOAN_RECEIVE' AND matched_type_code = 'LOAN_SETTLE') OR
      (my_type_code = 'LOAN_SETTLE' AND matched_type_code = 'LOAN_RECEIVE')
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
    RAISE NOTICE 'Migration 041 completed successfully!';
    RAISE NOTICE 'Fixed validate_transfer_match to only run when transfer_matched_transaction_id IS NOT NULL';
    RAISE NOTICE 'Added LOAN_RECEIVE ↔ LOAN_SETTLE as valid transfer pair';
END $$;
