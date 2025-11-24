-- Migration 054: Fix Loan Balance Trigger
-- Purpose: Update the loan disbursement balance trigger to use LOAN_COLLECT instead of LOAN_SETTLE
-- Background: Migration 042 consolidated LOAN_SETTLE into LOAN_COLLECT, but the trigger was never updated
-- Created: 2025-11-16

-- ==============================================================================
-- Update the trigger to use LOAN_COLLECT instead of LOAN_SETTLE
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_loan_disbursement_after_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_transaction_type TEXT;
    v_disbursement_id INTEGER;
    v_total_settled DECIMAL(15,2);
    v_principal DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
    v_due_date DATE;
    v_new_status loan_status;
BEGIN
    -- Determine disbursement_id based on operation
    IF TG_OP = 'DELETE' THEN
        v_disbursement_id := OLD.loan_disbursement_id;
    ELSE
        v_disbursement_id := NEW.loan_disbursement_id;
    END IF;

    -- Skip if no disbursement linked
    IF v_disbursement_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get transaction type
    IF TG_OP = 'DELETE' THEN
        SELECT type_name INTO v_transaction_type
        FROM transaction_types WHERE transaction_type_id = OLD.transaction_type_id;
    ELSE
        SELECT type_name INTO v_transaction_type
        FROM transaction_types WHERE transaction_type_id = NEW.transaction_type_id;
    END IF;

    -- Only process LOAN_COLLECT transactions (changed from LOAN_SETTLE)
    -- LOAN_COLLECT is now used for both cash and receivable-side transactions
    IF v_transaction_type != 'loan_collect' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get principal and due date
    SELECT principal_amount, due_date
    INTO v_principal, v_due_date
    FROM loan_disbursement
    WHERE loan_disbursement_id = v_disbursement_id;

    -- Calculate total settled amount from all LOAN_COLLECT transactions
    -- linked to this disbursement that are matched (have transfer_matched_transaction_id)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_settled
    FROM main_transaction mt
    JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
    WHERE mt.loan_disbursement_id = v_disbursement_id
    AND tt.type_code = 'LOAN_COLLECT'
    AND mt.transfer_matched_transaction_id IS NOT NULL;  -- Only count matched collections

    -- Calculate new remaining balance
    -- We divide by 2 because each collection creates TWO transactions:
    -- 1. Cash side (debit to bank/cash account)
    -- 2. Receivable side (debit to loan_receivable account)
    -- Both are LOAN_COLLECT type and both have the same amount
    -- So we need to divide the total by 2 to get the actual collected amount
    v_new_balance := v_principal - (v_total_settled / 2);

    -- Determine status
    IF v_new_balance <= 0 THEN
        v_new_status := 'repaid';
    ELSIF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE THEN
        v_new_status := 'overdue';
    ELSE
        v_new_status := 'active';
    END IF;

    -- Update loan_disbursement
    UPDATE loan_disbursement
    SET
        remaining_balance = GREATEST(v_new_balance, 0),
        is_overpaid = (v_new_balance < 0),
        status = v_new_status,
        updated_at = NOW()
    WHERE loan_disbursement_id = v_disbursement_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- No need to recreate the trigger itself, just the function

-- ==============================================================================
-- Verify the migration
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 054 completed successfully!';
    RAISE NOTICE 'Updated update_loan_disbursement_after_settlement() to use LOAN_COLLECT instead of LOAN_SETTLE';
    RAISE NOTICE 'Loan disbursement balances will now update correctly when collections are matched';
END $$;
