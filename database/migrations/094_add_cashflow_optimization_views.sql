-- ============================================================================
-- Cash Flow Optimization Views
-- Migration: 094_add_cashflow_optimization_views.sql
--
-- Creates SQL views to optimize cash flow calculations by moving aggregation
-- from JavaScript to PostgreSQL. These are regular views (not materialized)
-- so they update in real-time when transactions change.
-- ============================================================================

-- ============================================================================
-- VIEW 1: Monthly Transaction Summary by Category
-- Replaces the heavy JS loop in analyzeHistoricalIncome/Expenses
-- ============================================================================
CREATE OR REPLACE VIEW monthly_category_summary AS
SELECT
  entity_id,
  category_id,
  category_name,
  date_trunc('month', transaction_date)::DATE as month,
  transaction_direction,

  -- Aggregations
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  STDDEV(amount) as std_dev,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount

FROM main_transaction_details
WHERE
  category_id IS NOT NULL
  AND affects_cashflow = true
  AND transaction_type_code NOT IN ('TRF_IN', 'TRF_OUT', 'DEBT_TAKE', 'DEBT_PAYBACK')
GROUP BY
  entity_id,
  category_id,
  category_name,
  date_trunc('month', transaction_date),
  transaction_direction;

-- Add comment
COMMENT ON VIEW monthly_category_summary IS
'Pre-aggregated monthly transaction totals by category. Used for cashflow predictions.';


-- ============================================================================
-- VIEW 2: Income Prediction Stats (6-month rolling)
-- Aggregates income by category with variance calculation
-- ============================================================================
CREATE OR REPLACE VIEW income_prediction_stats AS
WITH monthly_income AS (
  SELECT
    entity_id,
    category_id,
    category_name,
    date_trunc('month', transaction_date)::DATE as month,
    SUM(amount) as monthly_total
  FROM main_transaction_details
  WHERE
    transaction_direction = 'credit'
    AND affects_cashflow = true
    AND category_id IS NOT NULL
    AND transaction_type_code NOT IN ('TRF_IN', 'DEBT_TAKE', 'DEBT_PAYBACK')
    AND transaction_date >= (CURRENT_DATE - INTERVAL '6 months')
  GROUP BY entity_id, category_id, category_name, date_trunc('month', transaction_date)
),
category_stats AS (
  SELECT
    entity_id,
    category_id,
    category_name,
    COUNT(DISTINCT month) as months_of_data,
    AVG(monthly_total) as monthly_average,
    STDDEV(monthly_total) as std_dev,
    SUM(monthly_total) as total_amount
  FROM monthly_income
  GROUP BY entity_id, category_id, category_name
)
SELECT
  entity_id,
  category_id,
  category_name,
  months_of_data,
  COALESCE(monthly_average, 0) as monthly_average,
  COALESCE(std_dev, 0) as std_dev,
  CASE
    WHEN monthly_average > 0 THEN (COALESCE(std_dev, 0) / monthly_average) * 100
    ELSE 100
  END as variance_percentage,
  total_amount,
  -- Confidence scoring (same logic as JS)
  CASE
    WHEN months_of_data >= 4 AND (COALESCE(std_dev, 0) / NULLIF(monthly_average, 0)) * 100 < 10 THEN 'high'
    WHEN months_of_data >= 3 AND (COALESCE(std_dev, 0) / NULLIF(monthly_average, 0)) * 100 < 30 THEN 'medium'
    ELSE 'low'
  END as confidence,
  -- Is recurring (low variance, appears in most months)
  CASE
    WHEN (COALESCE(std_dev, 0) / NULLIF(monthly_average, 0)) * 100 < 15 AND months_of_data >= 3 THEN true
    ELSE false
  END as is_recurring
FROM category_stats
WHERE monthly_average > 0;

COMMENT ON VIEW income_prediction_stats IS
'Rolling 6-month income statistics by category with confidence scoring. Real-time updated.';


-- ============================================================================
-- VIEW 3: Expense Prediction Stats (6-month rolling)
-- Aggregates expenses by category with variance calculation
-- ============================================================================
CREATE OR REPLACE VIEW expense_prediction_stats AS
WITH monthly_expenses AS (
  SELECT
    entity_id,
    category_id,
    category_name,
    date_trunc('month', transaction_date)::DATE as month,
    SUM(amount) as monthly_total
  FROM main_transaction_details
  WHERE
    transaction_direction = 'debit'
    AND affects_cashflow = true
    AND category_id IS NOT NULL
    AND transaction_type_code NOT IN ('TRF_OUT', 'DEBT_TAKE', 'DEBT_PAYBACK')
    AND transaction_date >= (CURRENT_DATE - INTERVAL '6 months')
  GROUP BY entity_id, category_id, category_name, date_trunc('month', transaction_date)
),
category_stats AS (
  SELECT
    entity_id,
    category_id,
    category_name,
    COUNT(DISTINCT month) as months_of_data,
    AVG(monthly_total) as monthly_average,
    STDDEV(monthly_total) as std_dev,
    SUM(monthly_total) as total_amount
  FROM monthly_expenses
  GROUP BY entity_id, category_id, category_name
)
SELECT
  entity_id,
  category_id,
  category_name,
  months_of_data,
  COALESCE(monthly_average, 0) as monthly_average,
  COALESCE(std_dev, 0) as std_dev,
  CASE
    WHEN monthly_average > 0 THEN (COALESCE(std_dev, 0) / monthly_average) * 100
    ELSE 100
  END as variance_percentage,
  total_amount,
  -- Confidence scoring
  CASE
    WHEN months_of_data >= 4 AND (COALESCE(std_dev, 0) / NULLIF(monthly_average, 0)) * 100 < 10 THEN 'high'
    WHEN months_of_data >= 3 AND (COALESCE(std_dev, 0) / NULLIF(monthly_average, 0)) * 100 < 30 THEN 'medium'
    ELSE 'low'
  END as confidence
FROM category_stats
WHERE monthly_average > 0;

COMMENT ON VIEW expense_prediction_stats IS
'Rolling 6-month expense statistics by category with confidence scoring. Real-time updated.';


-- ============================================================================
-- VIEW 4: Scheduled Payments Summary by Month
-- Pre-aggregates scheduled payment amounts by month and category
-- ============================================================================
CREATE OR REPLACE VIEW scheduled_payments_monthly AS
SELECT
  sp.entity_id,
  date_trunc('month', spi.due_date)::DATE as month,
  sp.category_id,
  c.category_name,
  COUNT(*) as payment_count,
  SUM(spi.amount) as total_amount,
  array_agg(DISTINCT sp.contract_name) as contract_names
FROM scheduled_payment_instances spi
JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
LEFT JOIN categories c ON sp.category_id = c.category_id
WHERE spi.status IN ('pending', 'overdue')
GROUP BY sp.entity_id, date_trunc('month', spi.due_date), sp.category_id, c.category_name;

COMMENT ON VIEW scheduled_payments_monthly IS
'Monthly scheduled payment totals by category. Used for cashflow priority calculations.';


-- ============================================================================
-- VIEW 5: Debt Payments Summary by Month
-- Pre-aggregates debt repayment amounts by month
-- ============================================================================
CREATE OR REPLACE VIEW debt_payments_monthly AS
SELECT
  a.entity_id,
  date_trunc('month', dd.due_date)::DATE as month,
  a.account_type,
  COUNT(*) as payment_count,
  SUM(dd.remaining_balance) as total_amount,
  array_agg(DISTINCT a.account_name) as account_names
FROM debt_drawdown dd
JOIN accounts a ON dd.account_id = a.account_id
WHERE
  dd.status = 'active'
  AND dd.due_date IS NOT NULL
GROUP BY a.entity_id, date_trunc('month', dd.due_date), a.account_type;

COMMENT ON VIEW debt_payments_monthly IS
'Monthly debt repayment totals by account type. Used for cashflow projections.';


-- ============================================================================
-- VIEW 6: Account Liquidity Summary
-- Pre-calculates liquid asset balances by type
-- ============================================================================
CREATE OR REPLACE VIEW account_liquidity_summary AS
SELECT
  a.entity_id,
  a.account_type,
  COUNT(*) as account_count,
  array_agg(a.account_name) as account_names,
  array_agg(a.account_id) as account_ids
FROM accounts a
WHERE
  a.is_active = true
  AND a.account_type IN ('bank', 'cash', 'investment')
GROUP BY a.entity_id, a.account_type;

COMMENT ON VIEW account_liquidity_summary IS
'Summary of liquid asset accounts by type. Balances calculated via RPC.';


-- ============================================================================
-- VIEW 7: Receivables Summary
-- Pre-aggregates outstanding loan receivables
-- ============================================================================
CREATE OR REPLACE VIEW receivables_summary AS
SELECT
  a.entity_id,
  COUNT(*) as loan_count,
  SUM(ld.remaining_balance) as total_receivables,
  SUM(CASE WHEN ld.due_date < CURRENT_DATE THEN ld.remaining_balance ELSE 0 END) as overdue_amount,
  COUNT(CASE WHEN ld.due_date < CURRENT_DATE THEN 1 END) as overdue_count
FROM loan_disbursement ld
JOIN accounts a ON ld.account_id = a.account_id
WHERE ld.status = 'active'
GROUP BY a.entity_id;

COMMENT ON VIEW receivables_summary IS
'Summary of outstanding loan receivables with overdue tracking.';


-- ============================================================================
-- Add indexes to improve view performance
-- ============================================================================

-- Index for monthly_category_summary
CREATE INDEX IF NOT EXISTS idx_mtd_cashflow_monthly
ON main_transaction_details(entity_id, transaction_date, category_id)
WHERE affects_cashflow = true AND category_id IS NOT NULL;

-- Index for scheduled payments
CREATE INDEX IF NOT EXISTS idx_spi_monthly
ON scheduled_payment_instances(due_date, status)
WHERE status IN ('pending', 'overdue');

-- Index for debt payments
CREATE INDEX IF NOT EXISTS idx_dd_monthly
ON debt_drawdown(due_date, status)
WHERE status = 'active' AND due_date IS NOT NULL;


-- ============================================================================
-- Grant permissions (RLS will still apply)
-- ============================================================================
-- Views inherit RLS from underlying tables, no additional grants needed
