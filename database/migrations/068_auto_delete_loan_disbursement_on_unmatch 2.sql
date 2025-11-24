-- Migration 068: Auto-delete loan disbursement and paired transaction when unmatching
-- When a LOAN_DISBURSE transaction is unmatched, automatically delete:
-- 1. The paired transaction on the loan_receivable account
-- 2. The loan_disbursement record

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_delete_loan_disbursement_on_unmatch ON main_transaction;
DROP FUNCTION IF EXISTS auto_delete_loan_disbursement_on_unmatch();

-- Create the trigger function
CREATE OR REPLACE FUNCTION auto_delete_loan_disbursement_on_unmatch()
RETURNS TRIGGER AS $$
DECLARE
    v_disbursement_id INTEGER;
    v_paired_transaction_id INTEGER;
    v_loan_account_id INTEGER;
    v_raw_transaction_id VARCHAR(255);
BEGIN
    -- Only proceed if this is an UNMATCH operation
    -- (transfer_matched_transaction_id changed from NOT NULL to NULL)
    IF OLD.transfer_matched_transaction_id IS NOT NULL
       AND NEW.transfer_matched_transaction_id IS NULL
       AND OLD.loan_disbursement_id IS NOT NULL THEN

        v_disbursement_id := OLD.loan_disbursement_id;
        v_paired_transaction_id := OLD.transfer_matched_transaction_id;

        RAISE NOTICE 'Auto-delete triggered for loan_disbursement_id: %, paired_transaction_id: %',
            v_disbursement_id, v_paired_transaction_id;

        -- Get the loan_receivable account_id from the disbursement
        SELECT account_id INTO v_loan_account_id
        FROM loan_disbursement
        WHERE loan_disbursement_id = v_disbursement_id;

        -- Delete the paired transaction on the loan_receivable account
        -- This is the credit transaction that was auto-created during matching
        IF v_paired_transaction_id IS NOT NULL THEN
            -- First get the raw_transaction_id
            SELECT raw_transaction_id INTO v_raw_transaction_id
            FROM main_transaction
            WHERE main_transaction_id = v_paired_transaction_id
              AND account_id = v_loan_account_id;

            -- Delete from original_transaction first
            IF v_raw_transaction_id IS NOT NULL THEN
                DELETE FROM original_transaction
                WHERE raw_transaction_id = v_raw_transaction_id;

                RAISE NOTICE 'Deleted original_transaction: %', v_raw_transaction_id;
            END IF;

            -- Then delete from main_transaction
            DELETE FROM main_transaction
            WHERE main_transaction_id = v_paired_transaction_id
              AND account_id = v_loan_account_id;

            RAISE NOTICE 'Deleted paired transaction: %', v_paired_transaction_id;
        END IF;

        -- Delete the loan_disbursement record
        DELETE FROM loan_disbursement
        WHERE loan_disbursement_id = v_disbursement_id;

        RAISE NOTICE 'Deleted loan_disbursement: %', v_disbursement_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_auto_delete_loan_disbursement_on_unmatch
    AFTER UPDATE OF transfer_matched_transaction_id ON main_transaction
    FOR EACH ROW
    EXECUTE FUNCTION auto_delete_loan_disbursement_on_unmatch();

-- Add comment
COMMENT ON FUNCTION auto_delete_loan_disbursement_on_unmatch() IS
    'Automatically deletes loan_disbursement record and paired transaction when a LOAN_DISBURSE transaction is unmatched.
     This maintains data integrity by ensuring that when a transaction is no longer considered a loan disbursement,
     all related records are cleaned up.';
