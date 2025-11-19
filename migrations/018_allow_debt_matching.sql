-- ============================================================================
-- MIGRATION 018: Allow DEBT_DRAW ↔ DEBT_ACQ matching
-- Purpose: Update transfer matching validation to also allow debt drawdown matching
-- ============================================================================

-- Update the function to allow DEBT_DRAW and DEBT_ACQ matching
CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
  my_type_code VARCHAR(20);
  matched_type_code VARCHAR(20);
BEGIN
  IF NEW.transfer_matched_transaction_id IS NOT NULL THEN
    -- Get my transaction type
    SELECT tt.type_code
    INTO my_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = NEW.transaction_type_id;

    -- Get matched transaction type
    SELECT tt.type_code
    INTO matched_type_code
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

    -- Validate both are matchable types (transfers or debt transactions)
    IF my_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ') THEN
      RAISE EXCEPTION 'Cannot match non-transfer/debt transaction';
    END IF;

    IF matched_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ') THEN
      RAISE EXCEPTION 'Cannot match with non-transfer/debt transaction';
    END IF;

    -- Validate opposite types
    -- TRF_OUT ↔ TRF_IN
    -- DEBT_DRAW ↔ DEBT_ACQ
    IF (my_type_code = 'TRF_OUT' AND matched_type_code != 'TRF_IN') OR
       (my_type_code = 'TRF_IN' AND matched_type_code != 'TRF_OUT') OR
       (my_type_code = 'DEBT_DRAW' AND matched_type_code != 'DEBT_ACQ') OR
       (my_type_code = 'DEBT_ACQ' AND matched_type_code != 'DEBT_DRAW') THEN
      RAISE EXCEPTION 'Transaction types must match: TRF_OUT↔TRF_IN or DEBT_DRAW↔DEBT_ACQ';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_transfer_match IS 'Validates that matched transactions are proper pairs: TRF_OUT↔TRF_IN or DEBT_DRAW↔DEBT_ACQ';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification:
-- Test that DEBT_DRAW can match with DEBT_ACQ
