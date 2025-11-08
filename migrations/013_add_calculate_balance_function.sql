-- Migration: Add calculate_account_balance function
-- Purpose: Efficiently calculate account balance using SQL aggregation
-- Avoids 1000 row limit when fetching all transactions

CREATE OR REPLACE FUNCTION calculate_account_balance(p_account_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  total_credits NUMERIC;
  total_debits NUMERIC;
  balance NUMERIC;
BEGIN
  -- Sum all credits and debits for the account
  SELECT
    COALESCE(SUM(credit_amount), 0),
    COALESCE(SUM(debit_amount), 0)
  INTO total_credits, total_debits
  FROM original_transaction
  WHERE account_id = p_account_id;

  -- Calculate balance: Credits - Debits
  balance := total_credits - total_debits;

  RETURN balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_account_balance IS
'Calculates the current balance for an account by summing all credits and debits. Returns Credits - Debits.';

-- Function to calculate balance up to a specific date
CREATE OR REPLACE FUNCTION calculate_account_balance_up_to_date(
  p_account_id INTEGER,
  p_date TIMESTAMP WITH TIME ZONE
)
RETURNS NUMERIC AS $$
DECLARE
  total_credits NUMERIC;
  total_debits NUMERIC;
  balance NUMERIC;
BEGIN
  -- Sum all credits and debits up to the specified date
  SELECT
    COALESCE(SUM(credit_amount), 0),
    COALESCE(SUM(debit_amount), 0)
  INTO total_credits, total_debits
  FROM original_transaction
  WHERE account_id = p_account_id
    AND transaction_date <= p_date;

  -- Calculate balance: Credits - Debits
  balance := total_credits - total_debits;

  RETURN balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_account_balance_up_to_date IS
'Calculates the balance for an account up to a specific date by summing all credits and debits. Returns Credits - Debits.';

-- Function to get grouped transactions by source
CREATE OR REPLACE FUNCTION get_grouped_transactions(
  p_account_id INTEGER DEFAULT NULL,
  p_transaction_source TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  transaction_source TEXT,
  import_batch_id INTEGER,
  transaction_count BIGINT,
  total_debit NUMERIC,
  total_credit NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.transaction_source::TEXT,
    ot.import_batch_id,
    COUNT(*)::BIGINT as transaction_count,
    COALESCE(SUM(ot.debit_amount), 0) as total_debit,
    COALESCE(SUM(ot.credit_amount), 0) as total_credit
  FROM original_transaction ot
  WHERE
    (p_account_id IS NULL OR ot.account_id = p_account_id)
    AND (p_transaction_source IS NULL OR ot.transaction_source = p_transaction_source)
    AND (p_start_date IS NULL OR ot.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ot.transaction_date <= p_end_date)
    AND (
      p_search IS NULL OR
      ot.description ILIKE '%' || p_search || '%' OR
      ot.bank_reference ILIKE '%' || p_search || '%'
    )
  GROUP BY ot.transaction_source, ot.import_batch_id
  ORDER BY ot.transaction_source, ot.import_batch_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_grouped_transactions IS
'Groups transactions by source and import batch, returning aggregated counts and totals.';
