-- ============================================================================
-- MIGRATION 060: Fix Debt Payback Delete and Unmatch
-- Purpose: Fix drawdown balance updates when DEBT_PAY/DEBT_SETTLE are deleted or unmatched
-- ============================================================================

-- First, fix the update_drawdown_after_settlement function to handle UNMATCH
CREATE OR REPLACE FUNCTION update_drawdown_after_settlement()
RETURNS TRIGGER AS $$
DECLARE
  v_drawdown_id INTEGER;
  v_original_amount DECIMAL(15,2);
  v_total_settled DECIMAL(15,2);
  v_new_balance DECIMAL(15,2);
  v_type_code VARCHAR(50);
  v_transaction_record RECORD;
  v_should_recalculate BOOLEAN;
BEGIN
  -- Use OLD for DELETE, NEW for INSERT/UPDATE
  IF TG_OP = 'DELETE' THEN
    v_transaction_record := OLD;
  ELSE
    v_transaction_record := NEW;
  END IF;

  -- Only process DEBT_SETTLE transactions that have a drawdown
  IF v_transaction_record.drawdown_id IS NOT NULL THEN
    -- Get transaction type
    SELECT tt.type_code INTO v_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = v_transaction_record.transaction_type_id;

    IF v_type_code = 'DEBT_SETTLE' THEN
      -- Determine if we should recalculate
      v_should_recalculate := FALSE;

      IF TG_OP = 'DELETE' THEN
        -- Always recalculate on delete
        v_should_recalculate := TRUE;
      ELSIF TG_OP = 'INSERT' THEN
        -- Only recalculate if the new transaction is matched
        v_should_recalculate := (NEW.transfer_matched_transaction_id IS NOT NULL);
      ELSIF TG_OP = 'UPDATE' THEN
        -- Recalculate if match status changed OR transaction is currently matched
        v_should_recalculate := (
          OLD.transfer_matched_transaction_id IS DISTINCT FROM NEW.transfer_matched_transaction_id
          OR NEW.transfer_matched_transaction_id IS NOT NULL
        );
      END IF;

      IF v_should_recalculate THEN
        -- Get drawdown details
        SELECT dd.drawdown_id, dd.original_amount
        INTO v_drawdown_id, v_original_amount
        FROM debt_drawdown dd
        WHERE dd.drawdown_id = v_transaction_record.drawdown_id;

        IF v_drawdown_id IS NOT NULL THEN
          -- Calculate total settled amount
          v_total_settled := get_drawdown_settled_amount(v_drawdown_id);

          -- Calculate new remaining balance
          v_new_balance := v_original_amount - v_total_settled;

          -- Update drawdown
          UPDATE debt_drawdown
          SET
            remaining_balance = GREATEST(0, v_new_balance),
            is_overpaid = (v_total_settled > v_original_amount),
            status = CASE
              WHEN v_new_balance <= 0 THEN 'settled'
              WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE AND v_new_balance > 0 THEN 'overdue'
              ELSE 'active'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE drawdown_id = v_drawdown_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_drawdown_after_settlement IS
  'Updates drawdown balance when DEBT_SETTLE is created/matched/unmatched/deleted. Key fix: detects match removal (unmatch operation)';

-- Second, create function to clear bidirectional matches when transaction is deleted
CREATE OR REPLACE FUNCTION clear_match_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If the deleted transaction had a match, clear the match on the other side
  IF OLD.transfer_matched_transaction_id IS NOT NULL THEN
    UPDATE main_transaction
    SET
      transfer_matched_transaction_id = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE main_transaction_id = OLD.transfer_matched_transaction_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clear_match_on_delete IS
  'Clears bidirectional match when a transaction is deleted, ensuring the matched transaction is also unmatched';

-- Create BEFORE DELETE trigger to clear matches
DROP TRIGGER IF EXISTS trigger_clear_match_on_delete ON main_transaction;

CREATE TRIGGER trigger_clear_match_on_delete
  BEFORE DELETE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION clear_match_on_delete();

COMMENT ON TRIGGER trigger_clear_match_on_delete ON main_transaction IS
  'Clears the bidirectional match before a transaction is deleted';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This migration fixes TWO critical bugs:
--
-- BUG 1: UNMATCH not triggering recalculation
--   Problem: When DEBT_SETTLE is unmatched (transfer_matched_transaction_id set to NULL),
--            the trigger checked NEW.transfer_matched_transaction_id (which is NULL)
--            and skipped recalculation, leaving drawdown as "settled"
--   Fix: Check if OLD.transfer_matched_transaction_id IS DISTINCT FROM NEW.transfer_matched_transaction_id
--        This detects when match status changes (including unmatch operation)
--
-- BUG 2: DELETE not clearing bidirectional match
--   Problem: When DEBT_PAY is deleted, DEBT_SETTLE still had transfer_matched_transaction_id
--            pointing to non-existent transaction, and was still counted as "matched"
--   Fix: BEFORE DELETE trigger clears the match on the other side first
--
-- After this migration:
-- 1. Unmatching DEBT_PAY/DEBT_SETTLE correctly recalculates drawdown balance and status
-- 2. Deleting DEBT_PAY clears DEBT_SETTLE match, then recalculates drawdown
-- 3. Works for all transaction pairs (TRF_OUT/IN, DEBT_DRAW/ACQ, DEBT_PAY/SETTLE)
