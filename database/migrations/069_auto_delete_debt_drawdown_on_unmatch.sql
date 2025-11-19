-- Migration 069: Auto-delete debt drawdown and paired transaction when unmatching
-- When a DEBT_TAKE transaction is unmatched, automatically delete:
-- 1. The paired transaction on the debt_payable account
-- 2. The debt_drawdown record

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_delete_debt_drawdown_on_unmatch ON main_transaction;
DROP FUNCTION IF EXISTS auto_delete_debt_drawdown_on_unmatch();

-- Create the trigger function
CREATE OR REPLACE FUNCTION auto_delete_debt_drawdown_on_unmatch()
RETURNS TRIGGER AS $$
DECLARE
    v_drawdown_id INTEGER;
    v_paired_transaction_id INTEGER;
    v_debt_account_id INTEGER;
BEGIN
    -- Only proceed if this is an UNMATCH operation
    -- (transfer_matched_transaction_id changed from NOT NULL to NULL)
    IF OLD.transfer_matched_transaction_id IS NOT NULL
       AND NEW.transfer_matched_transaction_id IS NULL
       AND OLD.drawdown_id IS NOT NULL THEN

        v_drawdown_id := OLD.drawdown_id;
        v_paired_transaction_id := OLD.transfer_matched_transaction_id;

        RAISE NOTICE 'Auto-delete triggered for debt_drawdown_id: %, paired_transaction_id: %',
            v_drawdown_id, v_paired_transaction_id;

        -- Get the debt_payable account_id from the drawdown
        SELECT account_id INTO v_debt_account_id
        FROM debt_drawdown
        WHERE drawdown_id = v_drawdown_id;

        -- Delete the paired transaction on the debt_payable account
        -- This is the debit transaction that was auto-created during matching
        IF v_paired_transaction_id IS NOT NULL THEN
            -- First delete from main_transaction
            DELETE FROM main_transaction
            WHERE main_transaction_id = v_paired_transaction_id
              AND account_id = v_debt_account_id;

            RAISE NOTICE 'Deleted paired transaction: %', v_paired_transaction_id;
        END IF;

        -- Delete the debt_drawdown record
        DELETE FROM debt_drawdown
        WHERE drawdown_id = v_drawdown_id;

        RAISE NOTICE 'Deleted debt_drawdown: %', v_drawdown_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_auto_delete_debt_drawdown_on_unmatch
    AFTER UPDATE OF transfer_matched_transaction_id ON main_transaction
    FOR EACH ROW
    EXECUTE FUNCTION auto_delete_debt_drawdown_on_unmatch();

-- Add comment
COMMENT ON FUNCTION auto_delete_debt_drawdown_on_unmatch() IS
    'Automatically deletes debt_drawdown record and paired transaction when a DEBT_TAKE transaction is unmatched.
     This maintains data integrity by ensuring that when a transaction is no longer considered a debt drawdown,
     all related records are cleaned up.';
