-- ============================================================================
-- MIGRATION 015: Debt Drawdown System
-- Purpose: Track individual drawdowns for credit lines and term loans
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE DEBT_DRAWDOWN TABLE
-- Purpose: Track each individual drawdown/loan within a debt account
-- ----------------------------------------------------------------------------

CREATE TABLE debt_drawdown (
  drawdown_id SERIAL PRIMARY KEY,

  -- Link to debt account (credit_line or term_loan)
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,

  -- Drawdown details
  drawdown_reference VARCHAR(100) NOT NULL, -- Bank's reference number or internal ID
  drawdown_date DATE NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL CHECK (original_amount > 0),
  remaining_balance DECIMAL(15,2) NOT NULL CHECK (remaining_balance >= 0),

  -- Terms
  due_date DATE,
  interest_rate DECIMAL(5,2), -- e.g., 12.5 for 12.5%

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'settled', 'overdue', 'written_off')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_drawdown_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT,
  CONSTRAINT check_remaining_lte_original CHECK (remaining_balance <= original_amount)
);

-- Indexes
CREATE INDEX idx_debt_drawdown_account ON debt_drawdown(account_id);
CREATE INDEX idx_debt_drawdown_status ON debt_drawdown(status);
CREATE INDEX idx_debt_drawdown_due_date ON debt_drawdown(due_date);
CREATE INDEX idx_debt_drawdown_reference ON debt_drawdown(drawdown_reference);

-- RLS
ALTER TABLE debt_drawdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for debt_drawdown" ON debt_drawdown
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_debt_drawdown_updated_at
  BEFORE UPDATE ON debt_drawdown
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE debt_drawdown IS 'Tracks individual drawdowns/loans within credit lines and term loans. Each drawdown represents a separate borrowing that needs to be repaid.';
COMMENT ON COLUMN debt_drawdown.drawdown_reference IS 'Bank reference number or internal ID for this drawdown';
COMMENT ON COLUMN debt_drawdown.original_amount IS 'Original amount borrowed in this drawdown';
COMMENT ON COLUMN debt_drawdown.remaining_balance IS 'Amount still owed on this drawdown (reduced by principal payments)';
COMMENT ON COLUMN debt_drawdown.status IS 'active: still being paid, settled: fully paid, overdue: past due date, written_off: bad debt';

-- ----------------------------------------------------------------------------
-- 2. ADD TRANSACTION_SUBTYPE TO MAIN_TRANSACTION
-- Purpose: Differentiate between principal, interest, and fee payments
-- ----------------------------------------------------------------------------

-- Add transaction_subtype column
ALTER TABLE main_transaction
ADD COLUMN transaction_subtype VARCHAR(20) DEFAULT 'regular'
  CHECK (transaction_subtype IN ('regular', 'principal', 'interest', 'fee', 'penalty'));

-- Add drawdown_id column (link to specific drawdown)
ALTER TABLE main_transaction
ADD COLUMN drawdown_id INTEGER REFERENCES debt_drawdown(drawdown_id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_main_transaction_drawdown ON main_transaction(drawdown_id);
CREATE INDEX idx_main_transaction_subtype ON main_transaction(transaction_subtype);

COMMENT ON COLUMN main_transaction.transaction_subtype IS 'Type of debt payment: regular (normal transaction), principal (reduces debt), interest (debt cost), fee (bank charges), penalty (late payment)';
COMMENT ON COLUMN main_transaction.drawdown_id IS 'Links to specific drawdown for debt-related transactions. Used to track which drawdown a payment is for.';

-- ----------------------------------------------------------------------------
-- 3. UPDATE MAIN_TRANSACTION_DETAILS VIEW
-- Purpose: Include drawdown information in the view
-- ----------------------------------------------------------------------------

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
  mt.created_at,
  mt.updated_at
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN debt_drawdown dd ON mt.drawdown_id = dd.drawdown_id
ORDER BY mt.transaction_date DESC, mt.main_transaction_id;

COMMENT ON VIEW main_transaction_details IS 'Complete view of main transactions with all related information including drawdown details';

-- ----------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS FOR DEBT MANAGEMENT
-- ----------------------------------------------------------------------------

-- Function: Get active drawdowns for an account
CREATE OR REPLACE FUNCTION get_active_drawdowns(p_account_id INTEGER)
RETURNS TABLE (
  drawdown_id INTEGER,
  drawdown_reference VARCHAR(100),
  drawdown_date DATE,
  original_amount DECIMAL(15,2),
  remaining_balance DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  due_date DATE,
  days_until_due INTEGER,
  interest_rate DECIMAL(5,2),
  status VARCHAR(20),
  total_interest_paid DECIMAL(15,2),
  total_fees_paid DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dd.drawdown_id,
    dd.drawdown_reference,
    dd.drawdown_date,
    dd.original_amount,
    dd.remaining_balance,
    dd.original_amount - dd.remaining_balance as paid_amount,
    dd.due_date,
    CASE
      WHEN dd.due_date IS NOT NULL
      THEN EXTRACT(DAY FROM (dd.due_date - CURRENT_DATE))::INTEGER
      ELSE NULL
    END as days_until_due,
    dd.interest_rate,
    dd.status,
    -- Calculate total interest paid for this drawdown
    COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      WHERE mt.drawdown_id = dd.drawdown_id
        AND mt.transaction_subtype = 'interest'
        AND mt.transaction_direction = 'debit'
    ), 0) as total_interest_paid,
    -- Calculate total fees/penalties paid for this drawdown
    COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      WHERE mt.drawdown_id = dd.drawdown_id
        AND mt.transaction_subtype IN ('fee', 'penalty')
        AND mt.transaction_direction = 'debit'
    ), 0) as total_fees_paid
  FROM debt_drawdown dd
  WHERE dd.account_id = p_account_id
    AND dd.status = 'active'
  ORDER BY dd.due_date NULLS LAST, dd.drawdown_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_drawdowns IS 'Get all active drawdowns for an account with payment summaries';

-- Function: Calculate available credit for credit line
CREATE OR REPLACE FUNCTION get_available_credit(p_account_id INTEGER)
RETURNS TABLE (
  credit_limit DECIMAL(15,2),
  total_drawn DECIMAL(15,2),
  available_credit DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.credit_limit,
    COALESCE(SUM(dd.remaining_balance), 0) as total_drawn,
    a.credit_limit - COALESCE(SUM(dd.remaining_balance), 0) as available_credit
  FROM accounts a
  LEFT JOIN debt_drawdown dd ON a.account_id = dd.account_id AND dd.status = 'active'
  WHERE a.account_id = p_account_id
    AND a.account_type IN ('credit_line', 'term_loan')
  GROUP BY a.account_id, a.credit_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_credit IS 'Calculate available credit for a credit line or term loan account';

-- Function: Get payment history for a drawdown
CREATE OR REPLACE FUNCTION get_drawdown_payment_history(p_drawdown_id INTEGER)
RETURNS TABLE (
  main_transaction_id INTEGER,
  transaction_date TIMESTAMPTZ,
  transaction_subtype VARCHAR(20),
  amount DECIMAL(15,2),
  description TEXT,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.main_transaction_id,
    mt.transaction_date,
    mt.transaction_subtype,
    mt.amount,
    mt.description,
    mt.notes
  FROM main_transaction mt
  WHERE mt.drawdown_id = p_drawdown_id
    AND mt.transaction_direction = 'debit'  -- Only payments out
  ORDER BY mt.transaction_date, mt.main_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_drawdown_payment_history IS 'Get payment history for a specific drawdown';

-- Function: Update drawdown status based on remaining balance and due date
CREATE OR REPLACE FUNCTION update_drawdown_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If fully paid, mark as settled
  IF NEW.remaining_balance = 0 THEN
    NEW.status := 'settled';
  -- If past due date and not settled, mark as overdue
  ELSIF NEW.due_date IS NOT NULL
    AND NEW.due_date < CURRENT_DATE
    AND NEW.status = 'active' THEN
    NEW.status := 'overdue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_drawdown_status
  BEFORE INSERT OR UPDATE ON debt_drawdown
  FOR EACH ROW
  EXECUTE FUNCTION update_drawdown_status();

COMMENT ON FUNCTION update_drawdown_status IS 'Automatically update drawdown status based on balance and due date';

-- ----------------------------------------------------------------------------
-- 5. FUNCTION TO PROCESS DEBT PAYMENTS
-- Purpose: Update drawdown balance when principal payment is made
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_debt_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_drawdown_record RECORD;
BEGIN
  -- Only process if this is a debt payment with drawdown_id
  IF NEW.drawdown_id IS NOT NULL
    AND NEW.transaction_direction = 'debit'
    AND NEW.transaction_subtype = 'principal' THEN

    -- Get the drawdown
    SELECT * INTO v_drawdown_record
    FROM debt_drawdown
    WHERE drawdown_id = NEW.drawdown_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Drawdown % not found', NEW.drawdown_id;
    END IF;

    -- Update drawdown remaining balance
    UPDATE debt_drawdown
    SET remaining_balance = remaining_balance - NEW.amount,
        updated_at = NOW()
    WHERE drawdown_id = NEW.drawdown_id;

    -- Check if the payment exceeds remaining balance
    IF v_drawdown_record.remaining_balance - NEW.amount < 0 THEN
      RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)',
        NEW.amount, v_drawdown_record.remaining_balance;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_debt_payment_trigger
  AFTER INSERT ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION process_debt_payment();

COMMENT ON FUNCTION process_debt_payment IS 'Automatically reduce drawdown balance when principal payment is recorded';

-- ----------------------------------------------------------------------------
-- 6. VIEW: DEBT SUMMARY BY ACCOUNT
-- Purpose: Overview of all debt accounts with totals
-- ----------------------------------------------------------------------------

CREATE VIEW debt_summary AS
SELECT
  a.account_id,
  a.account_name,
  a.account_type,
  a.bank_name,
  a.credit_limit,
  e.id as entity_id,
  e.name as entity_name,
  COUNT(dd.drawdown_id) as total_drawdowns,
  COUNT(CASE WHEN dd.status = 'active' THEN 1 END) as active_drawdowns,
  COUNT(CASE WHEN dd.status = 'settled' THEN 1 END) as settled_drawdowns,
  COUNT(CASE WHEN dd.status = 'overdue' THEN 1 END) as overdue_drawdowns,
  COALESCE(SUM(dd.original_amount), 0) as total_borrowed,
  COALESCE(SUM(CASE WHEN dd.status = 'active' THEN dd.remaining_balance ELSE 0 END), 0) as total_outstanding,
  COALESCE(SUM(dd.original_amount - dd.remaining_balance), 0) as total_paid,
  CASE
    WHEN a.credit_limit IS NOT NULL
    THEN a.credit_limit - COALESCE(SUM(CASE WHEN dd.status = 'active' THEN dd.remaining_balance ELSE 0 END), 0)
    ELSE NULL
  END as available_credit
FROM accounts a
JOIN entities e ON a.entity_id = e.id
LEFT JOIN debt_drawdown dd ON a.account_id = dd.account_id
WHERE a.account_type IN ('credit_line', 'term_loan')
GROUP BY a.account_id, a.account_name, a.account_type, a.bank_name, a.credit_limit, e.id, e.name
ORDER BY a.account_name;

COMMENT ON VIEW debt_summary IS 'Summary view of all debt accounts with drawdown statistics';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- SELECT * FROM debt_drawdown;
-- SELECT * FROM debt_summary;
-- SELECT * FROM get_active_drawdowns(14);
-- SELECT * FROM get_available_credit(14);
