-- Migration 024: Prevent Cross-Entity Transfers
-- Purpose: Ensure transfers can only happen between accounts within the SAME entity
-- Critical Security Fix: Prevents accountants managing multiple entities from
--                        accidentally or maliciously transferring money between different entities

-- Drop existing function to replace it
DROP FUNCTION IF EXISTS validate_transfer_match() CASCADE;

-- Recreate with entity validation
CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
  my_type_code VARCHAR(20);
  matched_type_code VARCHAR(20);
  my_entity_id UUID;
  matched_entity_id UUID;
  my_account_id INTEGER;
  matched_account_id INTEGER;
BEGIN
  IF NEW.transfer_matched_transaction_id IS NOT NULL THEN
    -- Get my transaction details
    SELECT
      tt.type_code,
      a.entity_id,
      NEW.account_id
    INTO
      my_type_code,
      my_entity_id,
      my_account_id
    FROM transaction_types tt
    JOIN accounts a ON a.account_id = NEW.account_id
    WHERE tt.transaction_type_id = NEW.transaction_type_id;

    -- Get matched transaction details
    SELECT
      tt.type_code,
      a.entity_id,
      mt.account_id
    INTO
      matched_type_code,
      matched_entity_id,
      matched_account_id
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    JOIN accounts a ON a.account_id = mt.account_id
    WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

    -- CRITICAL CHECK: Both transactions must belong to the SAME entity
    IF my_entity_id != matched_entity_id THEN
      RAISE EXCEPTION 'Cross-entity transfers are not allowed. Cannot transfer between accounts in different entities. Account % (entity %) cannot be matched with account % (entity %)',
        my_account_id,
        my_entity_id,
        matched_account_id,
        matched_entity_id;
    END IF;

    -- Validate both accounts are different (can't transfer to same account)
    IF my_account_id = matched_account_id THEN
      RAISE EXCEPTION 'Cannot create transfer to the same account (account %)', my_account_id;
    END IF;

    -- Validate both are matchable types (transfers or debt transactions)
    IF my_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE') THEN
      RAISE EXCEPTION 'Cannot match non-transfer/debt transaction (type: %)', my_type_code;
    END IF;

    IF matched_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE') THEN
      RAISE EXCEPTION 'Cannot match with non-transfer/debt transaction (type: %)', matched_type_code;
    END IF;

    -- Validate opposite types
    -- TRF_OUT ↔ TRF_IN
    -- DEBT_DRAW ↔ DEBT_ACQ
    -- DEBT_PAY ↔ DEBT_SETTLE
    IF (my_type_code = 'TRF_OUT' AND matched_type_code != 'TRF_IN') OR
       (my_type_code = 'TRF_IN' AND matched_type_code != 'TRF_OUT') OR
       (my_type_code = 'DEBT_DRAW' AND matched_type_code != 'DEBT_ACQ') OR
       (my_type_code = 'DEBT_ACQ' AND matched_type_code != 'DEBT_DRAW') OR
       (my_type_code = 'DEBT_PAY' AND matched_type_code != 'DEBT_SETTLE') OR
       (my_type_code = 'DEBT_SETTLE' AND matched_type_code != 'DEBT_PAY') THEN
      RAISE EXCEPTION 'Transaction types must match: TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, or DEBT_PAY↔DEBT_SETTLE. Got % and %',
        my_type_code, matched_type_code;
    END IF;

    -- Additional validation: amounts should match (with small tolerance for rounding)
    -- This is a warning, not an error
    DECLARE
      my_amount DECIMAL(15,2);
      matched_amount DECIMAL(15,2);
    BEGIN
      SELECT NEW.amount INTO my_amount;

      SELECT mt.amount INTO matched_amount
      FROM main_transaction mt
      WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

      IF ABS(my_amount - matched_amount) > 0.01 THEN
        RAISE WARNING 'Transfer amounts do not match: % vs %. This may indicate an error.',
          my_amount, matched_amount;
      END IF;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_validate_transfer_match ON main_transaction;

CREATE TRIGGER trigger_validate_transfer_match
  BEFORE INSERT OR UPDATE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION validate_transfer_match();

COMMENT ON FUNCTION validate_transfer_match IS
'Validates transfer matching with entity boundary enforcement:
1. Ensures both transactions belong to the SAME entity (prevents cross-entity transfers)
2. Ensures different accounts (prevents same-account transfers)
3. Validates proper type pairs: TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, DEBT_PAY↔DEBT_SETTLE
4. Warns if amounts do not match';

-- Create helper function to check if transfer is allowed between two accounts
CREATE OR REPLACE FUNCTION can_transfer_between_accounts(
  p_from_account_id INTEGER,
  p_to_account_id INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_from_entity_id UUID;
  v_to_entity_id UUID;
BEGIN
  -- Get entity IDs for both accounts
  SELECT entity_id INTO v_from_entity_id
  FROM accounts
  WHERE account_id = p_from_account_id;

  SELECT entity_id INTO v_to_entity_id
  FROM accounts
  WHERE account_id = p_to_account_id;

  -- Return TRUE only if same entity and different accounts
  RETURN v_from_entity_id = v_to_entity_id
     AND p_from_account_id != p_to_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_transfer_between_accounts IS
'Check if a transfer is allowed between two accounts.
Returns TRUE only if:
1. Both accounts belong to the same entity
2. Accounts are different
Use this in UI to filter available transfer destination accounts.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Security Summary:
-- 1. Cross-entity transfers are now BLOCKED at database level
-- 2. Accountants managing multiple entities cannot accidentally transfer between them
-- 3. All existing validation rules still apply (type matching, etc.)
-- 4. Helper function added for UI to show only valid transfer destinations

-- Test queries:
/*
-- Test 1: Check if two accounts can have transfers (should use this in UI)
SELECT can_transfer_between_accounts(1, 2);

-- Test 2: Try to create cross-entity transfer (should fail)
-- This will raise an exception if accounts belong to different entities
INSERT INTO main_transaction (account_id, transaction_type_id, amount, ...)
VALUES (...);

-- Test 3: View which accounts are in the same entity (for transfer dropdown)
SELECT
  a1.account_id as from_account,
  a2.account_id as to_account,
  a1.account_name as from_name,
  a2.account_name as to_name
FROM accounts a1
CROSS JOIN accounts a2
WHERE a1.entity_id = a2.entity_id
  AND a1.account_id != a2.account_id;
*/
