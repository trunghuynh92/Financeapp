-- Migration 070: Auto-delete investment contribution on unmatch
-- Description: Automatically delete investment contribution record and paired transaction when unmatched
-- Date: 2025-01-20
-- Related: Similar to Migration 068 (loan) and 069 (debt)

-- =============================================================================
-- Function: Auto-delete investment contribution on unmatch
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_delete_investment_contribution_on_unmatch()
RETURNS TRIGGER AS $$
DECLARE
  v_contribution_id INTEGER;
  v_investment_account_id INTEGER;
  v_paired_raw_transaction_id TEXT;
BEGIN
  -- Only proceed if this is an unmatch operation
  -- (investment_contribution_id changes from NOT NULL to NULL)
  IF OLD.investment_contribution_id IS NOT NULL
     AND NEW.investment_contribution_id IS NULL THEN

    -- Store the contribution ID before deletion
    v_contribution_id := OLD.investment_contribution_id;

    RAISE NOTICE 'Investment unmatch detected for contribution_id: %', v_contribution_id;

    -- Get investment account ID from contribution record
    SELECT investment_account_id INTO v_investment_account_id
    FROM investment_contribution
    WHERE contribution_id = v_contribution_id;

    IF v_investment_account_id IS NULL THEN
      RAISE WARNING 'Investment account not found for contribution_id: %', v_contribution_id;
      RETURN NEW;
    END IF;

    RAISE NOTICE 'Investment account ID: %', v_investment_account_id;

    -- Find the paired transaction on investment account
    -- This is the transaction we need to delete (the one we auto-created)
    SELECT mt.raw_transaction_id INTO v_paired_raw_transaction_id
    FROM main_transaction mt
    WHERE mt.investment_contribution_id = v_contribution_id
      AND mt.account_id = v_investment_account_id
      AND mt.main_transaction_id != NEW.main_transaction_id;

    -- Delete paired transaction if found
    IF v_paired_raw_transaction_id IS NOT NULL THEN
      RAISE NOTICE 'Deleting paired transaction: %', v_paired_raw_transaction_id;

      -- Delete original_transaction FIRST (to avoid orphans)
      -- This is critical - must delete original before main
      DELETE FROM original_transaction
      WHERE raw_transaction_id = v_paired_raw_transaction_id;

      -- Delete main_transaction
      DELETE FROM main_transaction
      WHERE raw_transaction_id = v_paired_raw_transaction_id;

      RAISE NOTICE 'Successfully deleted paired transaction: %', v_paired_raw_transaction_id;
    ELSE
      RAISE WARNING 'Paired transaction not found for contribution_id: %', v_contribution_id;
    END IF;

    -- Delete investment contribution record
    DELETE FROM investment_contribution
    WHERE contribution_id = v_contribution_id;

    RAISE NOTICE 'Successfully auto-deleted investment contribution: %', v_contribution_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger: Auto-delete on investment_contribution_id change
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_auto_delete_investment_on_unmatch ON main_transaction;

CREATE TRIGGER trigger_auto_delete_investment_on_unmatch
  AFTER UPDATE OF investment_contribution_id ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_investment_contribution_on_unmatch();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION auto_delete_investment_contribution_on_unmatch() IS
  'Automatically deletes investment contribution record and paired transaction when source transaction is unmatched. '
  'This maintains data integrity by ensuring that when a transaction is no longer classified as an investment contribution, '
  'all related records are cleaned up automatically. Similar to loan and debt unmatch behavior.';

COMMENT ON TRIGGER trigger_auto_delete_investment_on_unmatch ON main_transaction IS
  'Fires when investment_contribution_id is set to NULL (unmatch operation). '
  'Automatically deletes the paired transaction on the investment account and the contribution record.';

-- =============================================================================
-- Migration complete
-- =============================================================================
