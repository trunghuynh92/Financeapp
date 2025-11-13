-- Check for split transactions causing the discrepancy

-- Query 1: Count actual main_transaction records vs original_transaction
SELECT
  'original_transaction' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT raw_transaction_id) as unique_raw_ids
FROM original_transaction
WHERE account_id = 14
UNION ALL
SELECT
  'main_transaction' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT raw_transaction_id) as unique_raw_ids
FROM main_transaction
WHERE account_id = 14;

-- Query 2: Find split transactions (1 original → multiple mains)
SELECT
  ot.raw_transaction_id,
  ot.transaction_date,
  ot.description,
  ot.credit_amount as original_credit,
  ot.debit_amount as original_debit,
  COUNT(mt.main_transaction_id) as num_main_transactions,
  array_agg(mt.main_transaction_id) as main_ids,
  array_agg(mt.amount) as main_amounts,
  array_agg(mt.transaction_direction::text) as main_directions,
  SUM(CASE WHEN mt.transaction_direction = 'credit' THEN mt.amount ELSE 0 END) as total_main_credits,
  SUM(CASE WHEN mt.transaction_direction = 'debit' THEN mt.amount ELSE 0 END) as total_main_debits
FROM original_transaction ot
LEFT JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14
GROUP BY ot.raw_transaction_id, ot.transaction_date, ot.description, ot.credit_amount, ot.debit_amount
HAVING COUNT(mt.main_transaction_id) > 1
ORDER BY ot.transaction_date;

-- Query 3: Sum all main_transaction amounts by direction
SELECT
  transaction_direction,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM main_transaction
WHERE account_id = 14
GROUP BY transaction_direction;

-- Query 4: Check if split transactions explain the difference
SELECT
  COUNT(*) as split_transaction_count,
  SUM(
    CASE WHEN mt.transaction_direction = 'credit'
    THEN mt.amount
    ELSE 0
    END
  ) as total_split_credits,
  SUM(
    CASE WHEN mt.transaction_direction = 'debit'
    THEN mt.amount
    ELSE 0
    END
  ) as total_split_debits
FROM main_transaction mt
WHERE account_id = 14
  AND raw_transaction_id IN (
    SELECT raw_transaction_id
    FROM main_transaction
    WHERE account_id = 14
    GROUP BY raw_transaction_id
    HAVING COUNT(*) > 1
  );
