-- Check main_transaction vs original_transaction discrepancy

-- Query 1: Count transactions in main_transaction for account 14
SELECT
  'main_transaction count' as source,
  COUNT(*) as total_count
FROM main_transaction
WHERE account_id = 14;

-- Query 2: Sum credits/debits in main_transaction
SELECT
  'main_transaction totals' as source,
  SUM(amount) FILTER (WHERE transaction_direction = 'credit') as total_credits,
  SUM(amount) FILTER (WHERE transaction_direction = 'debit') as total_debits,
  SUM(amount) FILTER (WHERE transaction_direction = 'credit') -
  SUM(amount) FILTER (WHERE transaction_direction = 'debit') as balance
FROM main_transaction
WHERE account_id = 14;

-- Query 3: Compare counts
SELECT
  'original_transaction' as source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_balance_adjustment = false) as non_adjustment_count
FROM original_transaction
WHERE account_id = 14
UNION ALL
SELECT
  'main_transaction' as source,
  COUNT(*) as count,
  NULL as non_adjustment_count
FROM main_transaction
WHERE account_id = 14;

-- Query 4: Check for orphaned main_transaction records (no matching original_transaction)
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.transaction_date,
  mt.amount,
  mt.transaction_direction,
  mt.description
FROM main_transaction mt
LEFT JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
WHERE mt.account_id = 14
  AND ot.raw_transaction_id IS NULL;

-- Query 5: Check for original_transactions without main_transaction entries
SELECT
  ot.raw_transaction_id,
  ot.transaction_date,
  ot.credit_amount,
  ot.debit_amount,
  ot.description,
  ot.is_balance_adjustment
FROM original_transaction ot
LEFT JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14
  AND mt.raw_transaction_id IS NULL
  AND ot.is_balance_adjustment = false;
