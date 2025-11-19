-- ============================================================================
-- ROLLBACK Migration 060: Remove the changes made by migration 060
-- ============================================================================

-- Drop the new trigger and function created by migration 060
DROP TRIGGER IF EXISTS trigger_clear_match_on_delete ON main_transaction;
DROP FUNCTION IF EXISTS clear_match_on_delete();

-- Restore the original update_drawdown_after_settlement function from migration 021
CREATE OR REPLACE FUNCTION update_drawdown_after_settlement()
RETURNS TRIGGER AS $$
DECLARE
  v_drawdown_id INTEGER;
  v_original_amount DECIMAL(15,2);
  v_total_settled DECIMAL(15,2);
  v_new_balance DECIMAL(15,2);
  v_type_code VARCHAR(50);
  v_transaction_record RECORD;
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
      -- For DELETE, we always recalculate
      -- For INSERT/UPDATE, only if the transaction is matched
      IF TG_OP = 'DELETE' OR v_transaction_record.transfer_matched_transaction_id IS NOT NULL THEN
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
  'Original function from migration 021 - updates drawdown balance when DEBT_SETTLE transactions change';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

SELECT 'Migration 060 has been rolled back. Original function restored.' AS message;
