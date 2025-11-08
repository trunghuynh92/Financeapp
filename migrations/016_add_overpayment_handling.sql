-- ============================================================================
-- MIGRATION 016: Add Overpayment Handling
-- Purpose: Track and flag overpayments for debt drawdowns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD OVERPAYMENT_AMOUNT COLUMN
-- Purpose: Track excess payments beyond what was owed
-- ----------------------------------------------------------------------------

ALTER TABLE debt_drawdown
ADD COLUMN overpayment_amount DECIMAL(15,2) DEFAULT 0 CHECK (overpayment_amount >= 0);

COMMENT ON COLUMN debt_drawdown.overpayment_amount IS
'Amount paid in excess of what was owed. Occurs when payment exceeds remaining_balance. Serves as a flag that this drawdown was overpaid.';

-- ----------------------------------------------------------------------------
-- 2. UPDATE PROCESS_DEBT_PAYMENT FUNCTION
-- Purpose: Allow overpayments but flag them
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_debt_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_drawdown_record RECORD;
  v_overpayment DECIMAL(15,2);
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

    -- Check for overpayment
    IF NEW.amount > v_drawdown_record.remaining_balance THEN
      -- Calculate overpayment amount
      v_overpayment := NEW.amount - v_drawdown_record.remaining_balance;

      -- Update drawdown: set balance to 0, record overpayment
      UPDATE debt_drawdown
      SET remaining_balance = 0,
          overpayment_amount = overpayment_amount + v_overpayment,
          status = 'settled',
          updated_at = NOW()
      WHERE drawdown_id = NEW.drawdown_id;

      -- Log warning
      RAISE WARNING 'Overpayment detected for drawdown %: Paid %, Owed %, Excess %',
        v_drawdown_record.drawdown_reference,
        NEW.amount,
        v_drawdown_record.remaining_balance,
        v_overpayment;

    ELSE
      -- Normal payment: reduce remaining balance
      UPDATE debt_drawdown
      SET remaining_balance = remaining_balance - NEW.amount,
          updated_at = NOW()
      WHERE drawdown_id = NEW.drawdown_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_debt_payment IS
'Automatically reduce drawdown balance when principal payment is recorded. Allows overpayments and flags them in overpayment_amount field.';

-- ----------------------------------------------------------------------------
-- 3. UPDATE GET_ACTIVE_DRAWDOWNS FUNCTION
-- Purpose: Include overpayment information
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_active_drawdowns(p_account_id INTEGER)
RETURNS TABLE (
  drawdown_id INTEGER,
  drawdown_reference VARCHAR(100),
  drawdown_date DATE,
  original_amount DECIMAL(15,2),
  remaining_balance DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  overpayment_amount DECIMAL(15,2),
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
    dd.overpayment_amount,
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

-- ----------------------------------------------------------------------------
-- 4. UPDATE DEBT_SUMMARY VIEW
-- Purpose: Include overpayment totals
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS debt_summary;

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
  COALESCE(SUM(dd.overpayment_amount), 0) as total_overpaid,
  COUNT(CASE WHEN dd.overpayment_amount > 0 THEN 1 END) as overpaid_drawdowns_count,
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

COMMENT ON VIEW debt_summary IS 'Summary view of all debt accounts with drawdown statistics including overpayments';

-- ----------------------------------------------------------------------------
-- 5. FUNCTION TO GET OVERPAID DRAWDOWNS
-- Purpose: List all drawdowns that were overpaid (for review)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_overpaid_drawdowns(p_account_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  drawdown_id INTEGER,
  account_id INTEGER,
  account_name VARCHAR(255),
  drawdown_reference VARCHAR(100),
  drawdown_date DATE,
  original_amount DECIMAL(15,2),
  overpayment_amount DECIMAL(15,2),
  status VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dd.drawdown_id,
    dd.account_id,
    a.account_name,
    dd.drawdown_reference,
    dd.drawdown_date,
    dd.original_amount,
    dd.overpayment_amount,
    dd.status
  FROM debt_drawdown dd
  JOIN accounts a ON dd.account_id = a.account_id
  WHERE dd.overpayment_amount > 0
    AND (p_account_id IS NULL OR dd.account_id = p_account_id)
  ORDER BY dd.overpayment_amount DESC, dd.drawdown_date DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_overpaid_drawdowns IS
'List all drawdowns that were overpaid. Useful for reviewing payment errors and reconciliation.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- SELECT * FROM get_overpaid_drawdowns();
-- SELECT * FROM debt_summary WHERE total_overpaid > 0;
