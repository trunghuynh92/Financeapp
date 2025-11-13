-- ============================================================================
-- MIGRATION 021: Add Debt Payback System
-- Purpose: Enable matching DEBT_PAYBACK transactions with drawdowns and auto-create DEBT_SETTLE
-- ============================================================================

-- Add new transaction type for debt settlement
-- Note: DEBT_PAY already exists from migration 006, we'll use that for payback
INSERT INTO transaction_types (type_code, type_name, type_display_name, affects_cashflow, display_order, description)
VALUES
  ('DEBT_SETTLE', 'debt_settle', 'Settle Drawdown', true, 9, 'Drawdown settlement (auto-created from DEBT_PAY match)')
ON CONFLICT (type_code) DO NOTHING;

-- Add is_overpaid flag to debt_drawdown table
ALTER TABLE debt_drawdown
ADD COLUMN IF NOT EXISTS is_overpaid BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN debt_drawdown.is_overpaid IS 'True if total payments exceed original drawdown amount';

-- Create function to calculate total settled amount for a drawdown
CREATE OR REPLACE FUNCTION get_drawdown_settled_amount(p_drawdown_id INTEGER)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(mt.amount)
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    WHERE mt.drawdown_id = p_drawdown_id
      AND tt.type_code = 'DEBT_SETTLE'
      AND mt.transfer_matched_transaction_id IS NOT NULL  -- Only count matched settlements
  ), 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_drawdown_settled_amount IS 'Calculate total settled amount from matched DEBT_SETTLE transactions for a drawdown';

-- Create function to update drawdown balance and overpayment status
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

-- Create trigger to auto-update drawdown when DEBT_SETTLE is created/updated/deleted
DROP TRIGGER IF EXISTS trigger_update_drawdown_on_settlement ON main_transaction;

CREATE TRIGGER trigger_update_drawdown_on_settlement
  AFTER INSERT OR UPDATE OR DELETE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION update_drawdown_after_settlement();

COMMENT ON TRIGGER trigger_update_drawdown_on_settlement ON main_transaction IS
  'Automatically update drawdown balance and overpayment status when DEBT_SETTLE transactions are matched or deleted';

-- Update main_transaction_details view to include debt payback info
DROP VIEW IF EXISTS main_transaction_details;

CREATE VIEW main_transaction_details AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transaction_subtype,
  mt.drawdown_id,
  mt.transfer_matched_transaction_id,
  a.account_name,
  a.bank_name,
  a.account_type,
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,
  tt.transaction_type_id,
  tt.type_code as transaction_type_code,
  tt.type_display_name as transaction_type,
  tt.affects_cashflow,
  c.category_id,
  c.category_name,
  c.category_code,
  b.branch_id,
  b.branch_name,
  b.branch_code,
  dd.drawdown_reference,
  dd.drawdown_date,
  dd.original_amount as drawdown_original_amount,
  dd.remaining_balance as drawdown_remaining_balance,
  dd.due_date as drawdown_due_date,
  dd.status as drawdown_status,
  dd.is_overpaid as drawdown_is_overpaid,
  mt.created_at,
  mt.updated_at,
  -- Check if transaction needs drawdown matching
  CASE
    WHEN tt.type_code = 'DEBT_PAY' AND mt.drawdown_id IS NULL
    THEN TRUE
    ELSE FALSE
  END as needs_drawdown_match,
  -- Check if transfer/debt is unmatched
  CASE
    WHEN tt.type_code IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE')
      AND mt.transfer_matched_transaction_id IS NULL
    THEN TRUE
    ELSE FALSE
  END as is_unmatched
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN debt_drawdown dd ON mt.drawdown_id = dd.drawdown_id
ORDER BY mt.transaction_date DESC, mt.main_transaction_id;

COMMENT ON VIEW main_transaction_details IS 'Complete view of main transactions with all related information including drawdown details and matching information';

-- Update validate_transfer_match function to allow DEBT_PAY ↔ DEBT_SETTLE matching
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
    IF my_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE') THEN
      RAISE EXCEPTION 'Cannot match non-transfer/debt transaction';
    END IF;

    IF matched_type_code NOT IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE') THEN
      RAISE EXCEPTION 'Cannot match with non-transfer/debt transaction';
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
      RAISE EXCEPTION 'Transaction types must match: TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, or DEBT_PAY↔DEBT_SETTLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_transfer_match IS 'Validates that matched transactions are proper pairs: TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, or DEBT_PAY↔DEBT_SETTLE';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- SELECT * FROM transaction_types WHERE type_code IN ('DEBT_PAYBACK', 'DEBT_SETTLE');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'debt_drawdown' AND column_name = 'is_overpaid';
-- SELECT * FROM main_transaction_details WHERE needs_drawdown_match = TRUE;
