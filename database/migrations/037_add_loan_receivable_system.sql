-- Migration 037: Add Loan Receivable System
-- Purpose: Track loans given out by company to owners, employees, partners, etc.
-- Mirror of debt/drawdown system but for assets (money owed TO company)
-- Created: 2025-11-10

-- ==============================================================================
-- Step 1: Add loan_receivable to account_type CHECK constraint
-- ==============================================================================

-- Drop the existing CHECK constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;

-- Add the new CHECK constraint with loan_receivable included
ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check
  CHECK (account_type IN ('bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan', 'loan_receivable'));

-- ==============================================================================
-- Step 2: Add LOAN transaction types
-- ==============================================================================

-- LOAN_GIVE: Money disbursed to borrower (cash out, asset increases)
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('LOAN_GIVE', 'Loan Disbursement', 'LOAN_GIVE', true, 50, 'Money disbursed to borrower (loan given out)')
ON CONFLICT (type_name) DO NOTHING;

-- LOAN_RECEIVE: Payment received from borrower (cash in, asset decreases)
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('LOAN_RECEIVE', 'Loan Payment Received', 'LOAN_RECEIVE', true, 51, 'Payment received from borrower')
ON CONFLICT (type_name) DO NOTHING;

-- LOAN_SETTLE: Auto-created settlement record (mirror of DEBT_SETTLE)
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('LOAN_SETTLE', 'Loan Settlement', 'LOAN_SETTLE', false, 52, 'Auto-created settlement on loan receivable account')
ON CONFLICT (type_name) DO NOTHING;

-- LOAN_WRITEOFF: Write off uncollectible loan (non-cash adjustment)
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('LOAN_WRITEOFF', 'Loan Write-off', 'LOAN_WRITEOFF', false, 53, 'Write-off of uncollectible loan (non-cash adjustment)')
ON CONFLICT (type_name) DO NOTHING;

-- ==============================================================================
-- Step 3: Create borrower_type and loan_category enums
-- ==============================================================================

CREATE TYPE borrower_type AS ENUM (
    'owner',
    'employee',
    'partner',
    'customer',
    'related_party',
    'other'
);

CREATE TYPE loan_category AS ENUM (
    'short_term',      -- < 12 months
    'long_term',       -- >= 12 months
    'advance',         -- Employee/owner advance
    'other'
);

CREATE TYPE loan_status AS ENUM (
    'active',          -- Loan outstanding, not overdue
    'overdue',         -- Past due date
    'repaid',          -- Fully repaid
    'partially_written_off',  -- Partial write-off
    'written_off'      -- Fully written off
);

-- ==============================================================================
-- Step 4: Create loan_disbursement table (mirror of debt_drawdown)
-- ==============================================================================

CREATE TABLE loan_disbursement (
    loan_disbursement_id SERIAL PRIMARY KEY,

    -- Link to loan_receivable account
    account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,

    -- Borrower information
    borrower_name TEXT NOT NULL,
    borrower_type borrower_type NOT NULL DEFAULT 'other',

    -- Loan details
    loan_category loan_category NOT NULL DEFAULT 'short_term',
    principal_amount DECIMAL(15, 2) NOT NULL CHECK (principal_amount > 0),
    remaining_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Dates
    disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,  -- Can be NULL for open-ended loans
    term_months INTEGER,  -- Duration in months (optional)

    -- Interest (for reference only, not calculated)
    interest_rate DECIMAL(5, 2),  -- e.g., 5.00 for 5% per annum

    -- Status tracking
    status loan_status NOT NULL DEFAULT 'active',
    is_overpaid BOOLEAN NOT NULL DEFAULT false,

    -- Write-off tracking
    written_off_amount DECIMAL(15, 2) DEFAULT 0,
    written_off_date DATE,

    -- Notes
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT remaining_balance_not_negative CHECK (remaining_balance >= 0),
    CONSTRAINT written_off_amount_not_negative CHECK (written_off_amount >= 0)
);

-- Indexes for performance
CREATE INDEX idx_loan_disbursement_account ON loan_disbursement(account_id);
CREATE INDEX idx_loan_disbursement_status ON loan_disbursement(status);
CREATE INDEX idx_loan_disbursement_borrower_type ON loan_disbursement(borrower_type);
CREATE INDEX idx_loan_disbursement_disbursement_date ON loan_disbursement(disbursement_date);
CREATE INDEX idx_loan_disbursement_due_date ON loan_disbursement(due_date) WHERE due_date IS NOT NULL;

COMMENT ON TABLE loan_disbursement IS 'Tracks individual loans disbursed to borrowers';
COMMENT ON COLUMN loan_disbursement.borrower_type IS 'Type of borrower: owner, employee, partner, etc.';
COMMENT ON COLUMN loan_disbursement.loan_category IS 'Loan category: short_term, long_term, advance';
COMMENT ON COLUMN loan_disbursement.interest_rate IS 'Interest rate for reference only (not auto-calculated)';
COMMENT ON COLUMN loan_disbursement.is_overpaid IS 'True if borrower paid more than owed';

-- ==============================================================================
-- Step 5: Add loan_disbursement_id to main_transaction
-- ==============================================================================

ALTER TABLE main_transaction
ADD COLUMN loan_disbursement_id INTEGER REFERENCES loan_disbursement(loan_disbursement_id) ON DELETE SET NULL;

CREATE INDEX idx_main_transaction_loan_disbursement ON main_transaction(loan_disbursement_id);

COMMENT ON COLUMN main_transaction.loan_disbursement_id IS 'Links LOAN_RECEIVE and LOAN_SETTLE transactions to loan disbursement';

-- ==============================================================================
-- Step 6: Create trigger to auto-create loan_disbursement on LOAN_GIVE
-- ==============================================================================

CREATE OR REPLACE FUNCTION create_loan_disbursement_on_loan_give()
RETURNS TRIGGER AS $$
DECLARE
    v_transaction_type TEXT;
    v_account_type VARCHAR;
    v_borrower_name TEXT;
    v_disbursement_date DATE;
    v_due_date DATE;
    v_interest_rate DECIMAL(5,2);
    v_notes TEXT;
BEGIN
    -- Get transaction type name
    SELECT type_name INTO v_transaction_type
    FROM transaction_types
    WHERE transaction_type_id = NEW.transaction_type_id;

    -- Only process LOAN_GIVE transactions
    IF v_transaction_type != 'LOAN_GIVE' THEN
        RETURN NEW;
    END IF;

    -- Get account type to verify it's loan_receivable
    SELECT account_type INTO v_account_type
    FROM accounts
    WHERE account_id = NEW.account_id;

    IF v_account_type != 'loan_receivable' THEN
        RAISE EXCEPTION 'LOAN_GIVE transactions must be on loan_receivable accounts';
    END IF;

    -- Extract borrower info from description (format: "Borrower: John Doe | Due: 2024-12-31 | Rate: 5%")
    -- Or use notes field for structured data
    v_borrower_name := COALESCE(NULLIF(SPLIT_PART(NEW.description, '|', 1), ''), 'Unknown Borrower');
    v_disbursement_date := NEW.transaction_date;
    v_due_date := NULL;  -- Can be set via description parsing or left NULL
    v_interest_rate := NULL;  -- Can be set via description parsing or left NULL
    v_notes := NEW.notes;

    -- Create loan disbursement record
    INSERT INTO loan_disbursement (
        account_id,
        borrower_name,
        borrower_type,
        loan_category,
        principal_amount,
        remaining_balance,
        disbursement_date,
        due_date,
        interest_rate,
        notes,
        status,
        created_by_user_id
    ) VALUES (
        NEW.account_id,
        v_borrower_name,
        'other',  -- Default, should be updated by UI
        'short_term',  -- Default
        NEW.amount,
        NEW.amount,  -- Initially, full amount is outstanding
        v_disbursement_date,
        v_due_date,
        v_interest_rate,
        v_notes,
        'active',
        NEW.created_by_user_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_loan_disbursement_on_loan_give
    AFTER INSERT ON main_transaction
    FOR EACH ROW
    EXECUTE FUNCTION create_loan_disbursement_on_loan_give();

COMMENT ON FUNCTION create_loan_disbursement_on_loan_give IS 'Auto-creates loan_disbursement record when LOAN_GIVE transaction is created';

-- ==============================================================================
-- Step 7: Create trigger to auto-create LOAN_SETTLE on match
-- ==============================================================================

CREATE OR REPLACE FUNCTION auto_create_loan_settle_on_match()
RETURNS TRIGGER AS $$
DECLARE
    v_transaction_type TEXT;
    v_loan_give_raw_tx_id TEXT;
    v_loan_settle_type_id INTEGER;
BEGIN
    -- Only process when loan_disbursement_id is newly set (was NULL, now has value)
    IF OLD.loan_disbursement_id IS NOT NULL OR NEW.loan_disbursement_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get transaction type
    SELECT type_name INTO v_transaction_type
    FROM transaction_types
    WHERE transaction_type_id = NEW.transaction_type_id;

    -- Only process LOAN_RECEIVE transactions
    IF v_transaction_type != 'LOAN_RECEIVE' THEN
        RETURN NEW;
    END IF;

    -- Get LOAN_SETTLE transaction type ID
    SELECT transaction_type_id INTO v_loan_settle_type_id
    FROM transaction_types
    WHERE type_name = 'LOAN_SETTLE';

    -- Find the original LOAN_GIVE transaction for this disbursement
    SELECT raw_transaction_id INTO v_loan_give_raw_tx_id
    FROM main_transaction mt
    JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
    WHERE tt.type_name = 'LOAN_GIVE'
    AND mt.account_id IN (
        SELECT account_id FROM loan_disbursement WHERE loan_disbursement_id = NEW.loan_disbursement_id
    )
    LIMIT 1;

    -- Create LOAN_SETTLE transaction on loan_receivable account
    INSERT INTO original_transaction (
        raw_transaction_id,
        account_id,
        transaction_date,
        description,
        debit_amount,
        credit_amount,
        transaction_source,
        notes,
        created_by_user_id
    ) VALUES (
        'LOAN_SETTLE-' || NEW.raw_transaction_id || '-' || EXTRACT(EPOCH FROM NOW())::TEXT,
        NEW.account_id,  -- Same loan_receivable account
        NEW.transaction_date,
        'Loan settlement for ' || COALESCE(
            (SELECT borrower_name FROM loan_disbursement WHERE loan_disbursement_id = NEW.loan_disbursement_id),
            'borrower'
        ),
        NULL,  -- No debit
        NEW.amount,  -- Credit (reduces loan receivable balance)
        'system_generated',
        'Auto-created on LOAN_RECEIVE match',
        NEW.created_by_user_id
    );

    -- Link the LOAN_SETTLE transaction to the same disbursement
    UPDATE main_transaction
    SET loan_disbursement_id = NEW.loan_disbursement_id
    WHERE raw_transaction_id = 'LOAN_SETTLE-' || NEW.raw_transaction_id || '-' || EXTRACT(EPOCH FROM NOW())::TEXT;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_loan_settle_on_match
    AFTER UPDATE OF loan_disbursement_id ON main_transaction
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_loan_settle_on_match();

COMMENT ON FUNCTION auto_create_loan_settle_on_match IS 'Auto-creates LOAN_SETTLE transaction when LOAN_RECEIVE is matched to loan_disbursement';

-- ==============================================================================
-- Step 8: Create trigger to update loan_disbursement after settlement
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

    -- Only process LOAN_SETTLE transactions
    IF v_transaction_type != 'LOAN_SETTLE' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get principal and due date
    SELECT principal_amount, due_date
    INTO v_principal, v_due_date
    FROM loan_disbursement
    WHERE loan_disbursement_id = v_disbursement_id;

    -- Calculate total settled amount
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_settled
    FROM main_transaction mt
    JOIN transaction_types tt ON tt.transaction_type_id = mt.transaction_type_id
    WHERE mt.loan_disbursement_id = v_disbursement_id
    AND tt.type_name = 'LOAN_SETTLE';

    -- Calculate new remaining balance
    v_new_balance := v_principal - v_total_settled;

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

CREATE TRIGGER trigger_update_loan_disbursement_after_settlement
    AFTER INSERT OR UPDATE OR DELETE ON main_transaction
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_disbursement_after_settlement();

COMMENT ON FUNCTION update_loan_disbursement_after_settlement IS 'Updates loan_disbursement balance and status when LOAN_SETTLE transactions change';

-- ==============================================================================
-- Step 9: RLS Policies for loan_disbursement
-- ==============================================================================

ALTER TABLE loan_disbursement ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view loan disbursements for their entities' accounts
CREATE POLICY "Users can view loan disbursements for their entities"
    ON loan_disbursement FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = loan_disbursement.account_id
            AND eu.user_id = auth.uid()
        )
    );

-- INSERT: Editor+ can create loan disbursements
CREATE POLICY "Editor and above can create loan disbursements"
    ON loan_disbursement FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = loan_disbursement.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- UPDATE: Editor+ can update loan disbursements
CREATE POLICY "Editor and above can update loan disbursements"
    ON loan_disbursement FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = loan_disbursement.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = loan_disbursement.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- DELETE: Admin+ can delete loan disbursements
CREATE POLICY "Admin and above can delete loan disbursements"
    ON loan_disbursement FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = loan_disbursement.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- ==============================================================================
-- Step 10: Update validate_transfer_match to allow LOAN_RECEIVE ↔ LOAN_SETTLE
-- ==============================================================================

CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
    v_from_type TEXT;
    v_to_type TEXT;
BEGIN
    -- Get transaction type names
    SELECT tt.type_name INTO v_from_type
    FROM transaction_types tt
    WHERE tt.transaction_type_id = NEW.from_transaction_type_id;

    SELECT tt.type_name INTO v_to_type
    FROM transaction_types tt
    WHERE tt.transaction_type_id = NEW.to_transaction_type_id;

    -- Allow these valid pairs
    IF (v_from_type = 'TRANSFER_OUT' AND v_to_type = 'TRANSFER_IN') OR
       (v_from_type = 'TRANSFER_IN' AND v_to_type = 'TRANSFER_OUT') OR
       (v_from_type = 'DEBT_PAY' AND v_to_type = 'DEBT_SETTLE') OR
       (v_from_type = 'DEBT_SETTLE' AND v_to_type = 'DEBT_PAY') OR
       (v_from_type = 'LOAN_RECEIVE' AND v_to_type = 'LOAN_SETTLE') OR
       (v_from_type = 'LOAN_SETTLE' AND v_to_type = 'LOAN_RECEIVE') THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'Invalid transfer match: % cannot be matched with %', v_from_type, v_to_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Migration Complete
-- ==============================================================================

-- Verify the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 037 completed successfully!';
    RAISE NOTICE 'Added: loan_receivable account type';
    RAISE NOTICE 'Added: LOAN_GIVE, LOAN_RECEIVE, LOAN_SETTLE, LOAN_WRITEOFF transaction types';
    RAISE NOTICE 'Created: loan_disbursement table with RLS policies';
    RAISE NOTICE 'Created: Triggers for auto-creation and balance updates';
END $$;
