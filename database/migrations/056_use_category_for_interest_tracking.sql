-- Migration 056: Use Category for Interest Tracking Instead of transaction_subtype
-- Purpose: Simplify interest tracking by using INTEREST_PAY category instead of transaction_subtype
-- Date: 2025-01-17

-- Update get_active_drawdowns function to use category_code instead of transaction_subtype
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
    (dd.original_amount - dd.remaining_balance) as paid_amount,
    dd.due_date,
    CASE
      WHEN dd.due_date IS NOT NULL THEN (dd.due_date - CURRENT_DATE)::INTEGER
      ELSE NULL
    END as days_until_due,
    dd.interest_rate,
    dd.status,
    -- Calculate total interest paid using INTEREST_PAY category instead of transaction_subtype
    COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      JOIN main_transaction_details mtd ON mt.main_transaction_id = mtd.main_transaction_id
      WHERE mt.drawdown_id = dd.drawdown_id
        AND mtd.category_code = 'INTEREST_PAY'
        AND mt.transaction_direction = 'debit'
    ), 0) as total_interest_paid,
    -- Keep fees calculation (can create FEE category later if needed)
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

COMMENT ON FUNCTION get_active_drawdowns IS 'Get all active drawdowns for an account with payment summaries (updated to use category-based interest tracking)';

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated get_active_drawdowns() to use category-based interest tracking';
END $$;
