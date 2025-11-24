-- Migration 073: Set initial investment contribution balance on INSERT
-- Description: Automatically set remaining_amount = contribution_amount when new contribution is created
-- Date: 2025-01-20
-- Related: Fixes issue where new contributions have remaining_amount = 0 instead of contribution_amount

-- =============================================================================
-- Function: Set initial balance on new contribution
-- =============================================================================

CREATE OR REPLACE FUNCTION set_initial_investment_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Set initial values for new contributions
  -- remaining_amount should equal contribution_amount (no withdrawals yet)
  IF NEW.remaining_amount IS NULL OR NEW.remaining_amount = 0 THEN
    NEW.remaining_amount := NEW.contribution_amount;
  END IF;

  IF NEW.withdrawn_amount IS NULL THEN
    NEW.withdrawn_amount := 0;
  END IF;

  IF NEW.is_overdrawn IS NULL THEN
    NEW.is_overdrawn := FALSE;
  END IF;

  RAISE NOTICE 'Setting initial balance for contribution: amount=%, remaining=%',
    NEW.contribution_amount, NEW.remaining_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger: Set initial balance on INSERT
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_set_initial_investment_balance ON investment_contribution;

CREATE TRIGGER trigger_set_initial_investment_balance
  BEFORE INSERT ON investment_contribution
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_investment_balance();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION set_initial_investment_balance() IS
  'Automatically sets remaining_amount = contribution_amount, withdrawn_amount = 0, and is_overdrawn = FALSE '
  'when a new investment contribution is created. This ensures new contributions have correct initial balance values '
  'regardless of how they are created (API, manual SQL, etc).';

COMMENT ON TRIGGER trigger_set_initial_investment_balance ON investment_contribution IS
  'Fires BEFORE INSERT to set initial balance values for new investment contributions.';

-- =============================================================================
-- Migration complete
-- =============================================================================
