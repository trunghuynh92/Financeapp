-- Check for amount mismatches between original_transaction and main_transaction

-- Query 1: Compare amounts for each raw_transaction_id
SELECT
  ot.raw_transaction_id,
  ot.transaction_date,
  ot.description,
  ot.credit_amount as original_credit,
  ot.debit_amount as original_debit,
  mt.amount as main_amount,
  mt.transaction_direction as main_direction,
  CASE
    WHEN mt.transaction_direction = 'credit' AND ot.credit_amount != mt.amount THEN 'MISMATCH'
    WHEN mt.transaction_direction = 'debit' AND ot.debit_amount != mt.amount THEN 'MISMATCH'
    ELSE 'OK'
  END as status
FROM original_transaction ot
JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14
  AND (
    (mt.transaction_direction = 'credit' AND COALESCE(ot.credit_amount, 0) != mt.amount)
    OR
    (mt.transaction_direction = 'debit' AND COALESCE(ot.debit_amount, 0) != mt.amount)
  )
ORDER BY ot.transaction_date;

-- Query 2: Count mismatches
SELECT
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (
    WHERE (mt.transaction_direction = 'credit' AND COALESCE(ot.credit_amount, 0) != mt.amount)
       OR (mt.transaction_direction = 'debit' AND COALESCE(ot.debit_amount, 0) != mt.amount)
  ) as mismatched_amounts,
  COUNT(*) FILTER (
    WHERE (mt.transaction_direction = 'credit' AND COALESCE(ot.credit_amount, 0) = mt.amount)
       OR (mt.transaction_direction = 'debit' AND COALESCE(ot.debit_amount, 0) = mt.amount)
  ) as matching_amounts
FROM original_transaction ot
JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14;

-- Query 3: Check for split transactions (multiple main_transactions for one original_transaction)
SELECT
  ot.raw_transaction_id,
  ot.transaction_date,
  ot.description,
  ot.credit_amount,
  ot.debit_amount,
  COUNT(mt.main_transaction_id) as main_transaction_count,
  array_agg(mt.amount) as main_amounts,
  array_agg(mt.transaction_direction) as main_directions
FROM original_transaction ot
JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14
GROUP BY ot.raw_transaction_id, ot.transaction_date, ot.description, ot.credit_amount, ot.debit_amount
HAVING COUNT(mt.main_transaction_id) > 1;

-- Query 4: Sum of differences
SELECT
  SUM(
    CASE WHEN mt.transaction_direction = 'credit'
    THEN mt.amount - COALESCE(ot.credit_amount, 0)
    ELSE 0
    END
  ) as credit_difference,
  SUM(
    CASE WHEN mt.transaction_direction = 'debit'
    THEN mt.amount - COALESCE(ot.debit_amount, 0)
    ELSE 0
    END
  ) as debit_difference
FROM original_transaction ot
JOIN main_transaction mt ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.account_id = 14;
