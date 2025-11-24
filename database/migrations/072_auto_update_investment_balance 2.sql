-- Migration 072: Auto-update investment contribution balance
-- Description: Automatically update remaining balance when withdrawal transactions are added/modified/deleted
-- Date: 2025-01-20
-- Related: Similar to loan (update_loan_disbursement_after_settlement) and debt (update_drawdown_after_settlement)

-- =============================================================================
-- Function: Auto-update investment contribution balance
-- =============================================================================

CREATE OR REPLACE FUNCTION update_investment_contribution_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_contribution_id INTEGER;
  v_contribution_amount DECIMAL(15,2);
  v_total_withdrawn DECIMAL(15,2);
  v_new_remaining DECIMAL(15,2);
  v_new_status TEXT;
  v_is_overdrawn BOOLEAN;
  v_type_code TEXT;
BEGIN
  -- Determine which contribution_id to update based on operation
  IF TG_OP = 'DELETE' THEN
    v_contribution_id := OLD.investment_contribution_id;
  ELSE
    v_contribution_id := COALESCE(NEW.investment_contribution_id, OLD.investment_contribution_id);
  END IF;

  -- Skip if no contribution linked
  IF v_contribution_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get transaction type code to determine if we should process
  IF TG_OP = 'DELETE' THEN
    SELECT tt.type_code INTO v_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = OLD.transaction_type_id;
  ELSE
    SELECT tt.type_code INTO v_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = COALESCE(NEW.transaction_type_id, OLD.transaction_type_id);
  END IF;

  -- Only process INV_WITHDRAW transactions (similar to how loan only processes LOAN_COLLECT)
  IF v_type_code != 'INV_WITHDRAW' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE NOTICE 'Updating investment contribution balance for contribution_id: %', v_contribution_id;

  -- Get original contribution amount
  SELECT contribution_amount INTO v_contribution_amount
  FROM investment_contribution
  WHERE contribution_id = v_contribution_id;

  IF v_contribution_amount IS NULL THEN
    RAISE WARNING 'Contribution not found: %', v_contribution_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total withdrawn from all INV_WITHDRAW transactions
  -- Only count MATCHED withdrawals (similar to loan system)
  -- This prevents double-counting and ensures both sides of transaction are recorded
  SELECT COALESCE(SUM(mt.amount), 0) INTO v_total_withdrawn
  FROM main_transaction mt
  JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
  WHERE mt.investment_contribution_id = v_contribution_id
    AND tt.type_code = 'INV_WITHDRAW'
    AND mt.transfer_matched_transaction_id IS NOT NULL;

  -- IMPORTANT: Divide by 2 because each withdrawal creates TWO transactions
  -- Similar to loan collection logic (LOAN_COLLECT ↔ LOAN_COLLECT)
  -- Transaction 1: Bank account (credit - cash in)
  -- Transaction 2: Investment account (debit - asset down)
  -- Both have same investment_contribution_id
  v_total_withdrawn := v_total_withdrawn / 2;

  RAISE NOTICE 'Total withdrawn (after /2): % from contribution amount: %', v_total_withdrawn, v_contribution_amount;

  -- Calculate new remaining amount
  v_new_remaining := v_contribution_amount - v_total_withdrawn;

  -- Determine if overdrawn (withdrew more than contributed - represents gains)
  v_is_overdrawn := (v_new_remaining < 0);

  -- Determine new status based on remaining amount
  IF v_new_remaining = v_contribution_amount THEN
    v_new_status := 'active';  -- No withdrawals yet
  ELSIF v_new_remaining > 0 AND v_new_remaining < v_contribution_amount THEN
    v_new_status := 'partial_withdrawal';  -- Some withdrawn, some remaining
  ELSIF v_new_remaining <= 0 THEN
    v_new_status := 'fully_withdrawn';  -- Fully withdrawn (or overdrawn)
  ELSE
    v_new_status := 'active';  -- Fallback
  END IF;

  -- Update the contribution record
  UPDATE investment_contribution
  SET
    remaining_amount = v_new_remaining,  -- Can be negative if overdrawn
    withdrawn_amount = v_total_withdrawn,
    is_overdrawn = v_is_overdrawn,
    status = v_new_status,
    updated_at = NOW()
  WHERE contribution_id = v_contribution_id;

  RAISE NOTICE 'Updated contribution %: remaining=%, withdrawn=%, overdrawn=%, status=%',
    v_contribution_id, v_new_remaining, v_total_withdrawn, v_is_overdrawn, v_new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger: Auto-update balance on transaction changes
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_update_investment_balance ON main_transaction;

CREATE TRIGGER trigger_update_investment_balance
  AFTER INSERT OR UPDATE OR DELETE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_contribution_balance();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION update_investment_contribution_balance() IS
  'Automatically updates investment contribution balance when INV_WITHDRAW transactions are added, modified, or deleted. '
  'Calculates total withdrawn amount (divided by 2 for paired transactions), updates remaining balance, '
  'determines overdrawn status, and auto-updates contribution status. '
  'Similar to loan and debt balance update triggers.';

COMMENT ON TRIGGER trigger_update_investment_balance ON main_transaction IS
  'Fires on any INSERT/UPDATE/DELETE of main_transaction records. '
  'Automatically recalculates investment contribution balances when withdrawal transactions change.';

-- =============================================================================
-- Migration complete
-- =============================================================================

-- Verification query (comment out in production):
-- SELECT
--   ic.contribution_id,
--   ic.contribution_amount,
--   ic.withdrawn_amount,
--   ic.remaining_amount,
--   ic.is_overdrawn,
--   ic.status,
--   COUNT(mt.main_transaction_id) as withdrawal_count,
--   SUM(CASE WHEN tt.type_code = 'INV_WITHDRAW' THEN mt.amount ELSE 0 END) as total_withdrawal_txns
-- FROM investment_contribution ic
-- LEFT JOIN main_transaction mt ON mt.investment_contribution_id = ic.contribution_id
-- LEFT JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
-- GROUP BY ic.contribution_id
-- ORDER BY ic.contribution_id;
