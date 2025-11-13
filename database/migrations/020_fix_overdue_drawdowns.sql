-- ============================================================================
-- MIGRATION 020: Fix overdue drawdowns to show in UI and count in credit
-- Purpose: Include overdue drawdowns in get_active_drawdowns and get_available_credit
-- ============================================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_active_drawdowns(INTEGER);
DROP FUNCTION IF EXISTS get_available_credit(INTEGER);

-- Update get_active_drawdowns to include overdue drawdowns
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
      THEN (dd.due_date - CURRENT_DATE)::INTEGER
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
    AND dd.status IN ('active', 'overdue')  -- Include both active and overdue
  ORDER BY dd.due_date NULLS LAST, dd.drawdown_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_drawdowns IS 'Get all active and overdue drawdowns for an account with payment summaries';

-- Update get_available_credit to include overdue drawdowns
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
  LEFT JOIN debt_drawdown dd ON a.account_id = dd.account_id
    AND dd.status IN ('active', 'overdue')  -- Include both active and overdue
  WHERE a.account_id = p_account_id
    AND a.account_type IN ('credit_line', 'term_loan')
  GROUP BY a.account_id, a.credit_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_credit IS 'Calculate available credit for a credit line or term loan account (includes overdue drawdowns)';

-- Update debt_summary view to include overdue drawdowns
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
  COALESCE(SUM(CASE WHEN dd.status IN ('active', 'overdue') THEN dd.remaining_balance ELSE 0 END), 0) as total_outstanding,
  COALESCE(SUM(dd.original_amount - dd.remaining_balance), 0) as total_paid,
  CASE
    WHEN a.credit_limit IS NOT NULL
    THEN a.credit_limit - COALESCE(SUM(CASE WHEN dd.status IN ('active', 'overdue') THEN dd.remaining_balance ELSE 0 END), 0)
    ELSE NULL
  END as available_credit
FROM accounts a
JOIN entities e ON a.entity_id = e.id
LEFT JOIN debt_drawdown dd ON a.account_id = dd.account_id
WHERE a.account_type IN ('credit_line', 'term_loan')
GROUP BY a.account_id, a.account_name, a.account_type, a.bank_name, a.credit_limit, e.id, e.name
ORDER BY a.account_name;

COMMENT ON VIEW debt_summary IS 'Summary view of all debt accounts with drawdown statistics (includes overdue drawdowns in total_outstanding)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification:
-- SELECT * FROM get_active_drawdowns(YOUR_ACCOUNT_ID);
-- SELECT * FROM get_available_credit(YOUR_ACCOUNT_ID);
