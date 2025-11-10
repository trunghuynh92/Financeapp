-- Migration 042: Simplify and Rename Transaction Types
-- Purpose: Consolidate and clarify DEBT and LOAN transaction types
--
-- Changes:
-- LOAN: LOAN_GIVE → LOAN_DISBURSE, LOAN_RECEIVE → LOAN_COLLECT, remove LOAN_SETTLE
-- DEBT: Consolidate DEBT_ACQ + DEBT_DRAW → DEBT_TAKE, remove DEBT_SETTLE
--
-- Result: Just 2 types per system instead of 4
-- Created: 2025-11-10

-- ==============================================================================
-- Step 1: Update LOAN transaction types
-- ==============================================================================

-- Rename LOAN_GIVE to LOAN_DISBURSE
UPDATE transaction_types
SET
  type_name = 'loan_disburse',
  type_display_name = 'Loan Disbursement',
  type_code = 'LOAN_DISBURSE',
  description = 'Money disbursed to borrower (loan given out)'
WHERE type_code = 'LOAN_GIVE';

-- Rename LOAN_RECEIVE to LOAN_COLLECT
UPDATE transaction_types
SET
  type_name = 'loan_collect',
  type_display_name = 'Loan Collection',
  type_code = 'LOAN_COLLECT',
  description = 'Payment collected from borrower (loan repayment)'
WHERE type_code = 'LOAN_RECEIVE';

-- Update all existing LOAN_SETTLE transactions to use LOAN_COLLECT instead
UPDATE main_transaction
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'LOAN_COLLECT'
)
WHERE transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'LOAN_SETTLE'
);

-- Delete LOAN_SETTLE type (no longer needed)
DELETE FROM transaction_types WHERE type_code = 'LOAN_SETTLE';

-- ==============================================================================
-- Step 2: Update categories that reference old transaction types
-- ==============================================================================

-- Update categories that reference DEBT_ACQ to use DEBT_PAY instead
-- (DEBT_ACQ categories like "Loan Received" should now use DEBT_TAKE once we create it)
-- For now, we'll update them after creating DEBT_TAKE

-- ==============================================================================
-- Step 3: Update DEBT transaction types
-- ==============================================================================

-- Create DEBT_TAKE type (consolidates DEBT_ACQ + DEBT_DRAW)
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('debt_take', 'Debt Taken', 'DEBT_TAKE', true, 5, 'Money borrowed or debt taken on')
ON CONFLICT (type_code) DO UPDATE
SET
  type_name = EXCLUDED.type_name,
  type_display_name = EXCLUDED.type_display_name,
  description = EXCLUDED.description;

-- Update categories that reference DEBT_ACQ to use DEBT_TAKE
UPDATE categories
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_TAKE'
)
WHERE transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_ACQ'
);

-- Update all DEBT_ACQ transactions to use DEBT_TAKE
UPDATE main_transaction
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_TAKE'
)
WHERE transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_ACQ'
);

-- Update all DEBT_DRAW transactions to use DEBT_TAKE
UPDATE main_transaction
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_TAKE'
)
WHERE transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_DRAW'
);

-- Update all DEBT_SETTLE transactions to use DEBT_PAY
UPDATE main_transaction
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_PAY'
)
WHERE transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_SETTLE'
);

-- Update categories that reference DEBT_SETTLE to use DEBT_PAY
UPDATE categories
SET transaction_type_id = (
  SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_PAY'
)
WHERE transaction_type_id IN (
  SELECT transaction_type_id FROM transaction_types WHERE type_code IN ('DEBT_SETTLE', 'DEBT_DRAW')
);

-- Delete old DEBT types (no longer needed)
DELETE FROM transaction_types WHERE type_code IN ('DEBT_ACQ', 'DEBT_DRAW', 'DEBT_SETTLE');

-- ==============================================================================
-- Step 3: Update validate_transfer_match function
-- ==============================================================================

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

    -- Validate valid transfer pairs (simplified!)
    -- TRF_OUT ↔ TRF_IN: Internal transfers
    -- DEBT_TAKE ↔ DEBT_TAKE: Taking on debt (credit line → bank)
    -- DEBT_PAY ↔ DEBT_PAY: Paying back debt (bank → credit line)
    -- LOAN_DISBURSE ↔ LOAN_DISBURSE: Disbursing loan (bank → loan receivable)
    -- LOAN_COLLECT ↔ LOAN_COLLECT: Collecting loan (loan receivable → bank)
    IF NOT (
      (my_type_code = 'TRF_OUT' AND matched_type_code = 'TRF_IN') OR
      (my_type_code = 'TRF_IN' AND matched_type_code = 'TRF_OUT') OR
      (my_type_code = 'DEBT_TAKE' AND matched_type_code = 'DEBT_TAKE') OR
      (my_type_code = 'DEBT_PAY' AND matched_type_code = 'DEBT_PAY') OR
      (my_type_code = 'LOAN_DISBURSE' AND matched_type_code = 'LOAN_DISBURSE') OR
      (my_type_code = 'LOAN_COLLECT' AND matched_type_code = 'LOAN_COLLECT')
    ) THEN
      RAISE EXCEPTION 'Invalid transfer match: % cannot be matched with %', my_type_code, matched_type_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Step 4: Update functions that reference old type codes
-- ==============================================================================

-- Update get_drawdown_settled_amount function to use DEBT_PAY instead of DEBT_SETTLE
CREATE OR REPLACE FUNCTION get_drawdown_settled_amount(p_drawdown_id INTEGER)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(mt.amount)
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    WHERE mt.drawdown_id = p_drawdown_id
      AND tt.type_code = 'DEBT_PAY'  -- Changed from DEBT_SETTLE
      AND mt.transfer_matched_transaction_id IS NOT NULL  -- Only count matched payments
  ), 0);
END;
$$ LANGUAGE plpgsql;

-- Update auto_update_drawdown_balance trigger function to use DEBT_PAY
CREATE OR REPLACE FUNCTION auto_update_drawdown_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_record main_transaction%ROWTYPE;
  v_type_code VARCHAR(20);
BEGIN
  -- Determine if we're working with NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    v_transaction_record := OLD;
  ELSE
    v_transaction_record := NEW;
  END IF;

  -- Only process DEBT_PAY transactions that have a drawdown
  IF v_transaction_record.drawdown_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT type_code INTO v_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = v_transaction_record.transaction_type_id;

  IF v_type_code = 'DEBT_PAY' THEN  -- Changed from DEBT_SETTLE
    -- Recalculate the drawdown's remaining balance and overpayment status
    UPDATE debt_drawdown
    SET
      remaining_balance = GREATEST(original_amount - get_drawdown_settled_amount(drawdown_id), 0),
      is_overpaid = (get_drawdown_settled_amount(drawdown_id) > original_amount),
      status = CASE
        WHEN get_drawdown_settled_amount(drawdown_id) >= original_amount THEN 'settled'::drawdown_status
        WHEN CURRENT_DATE > due_date AND due_date IS NOT NULL THEN 'overdue'::drawdown_status
        ELSE 'active'::drawdown_status
      END
    WHERE drawdown_id = v_transaction_record.drawdown_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Verify the migration
-- ==============================================================================

DO $$
DECLARE
  loan_disburse_count INTEGER;
  loan_collect_count INTEGER;
  debt_take_count INTEGER;
  debt_pay_count INTEGER;
  old_types_count INTEGER;
BEGIN
  -- Count new types
  SELECT COUNT(*) INTO loan_disburse_count FROM transaction_types WHERE type_code = 'LOAN_DISBURSE';
  SELECT COUNT(*) INTO loan_collect_count FROM transaction_types WHERE type_code = 'LOAN_COLLECT';
  SELECT COUNT(*) INTO debt_take_count FROM transaction_types WHERE type_code = 'DEBT_TAKE';
  SELECT COUNT(*) INTO debt_pay_count FROM transaction_types WHERE type_code = 'DEBT_PAY';

  -- Count old types (should be 0)
  SELECT COUNT(*) INTO old_types_count
  FROM transaction_types
  WHERE type_code IN ('LOAN_GIVE', 'LOAN_RECEIVE', 'LOAN_SETTLE', 'DEBT_ACQ', 'DEBT_DRAW', 'DEBT_SETTLE');

  RAISE NOTICE 'Migration 042 completed successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'New transaction types:';
  RAISE NOTICE '  LOAN_DISBURSE: % records', loan_disburse_count;
  RAISE NOTICE '  LOAN_COLLECT: % records', loan_collect_count;
  RAISE NOTICE '  DEBT_TAKE: % records', debt_take_count;
  RAISE NOTICE '  DEBT_PAY: % records', debt_pay_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Old transaction types remaining: %', old_types_count;

  IF old_types_count > 0 THEN
    RAISE WARNING 'Some old transaction types still exist! Check manually.';
  END IF;
END $$;
