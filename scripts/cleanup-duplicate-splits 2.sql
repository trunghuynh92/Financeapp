-- Cleanup Script: Remove Duplicate Split Records
-- This script identifies and removes duplicate split records that were created
-- when data_entry users couldn't delete old splits before creating new ones

-- Step 1: Identify affected raw_transaction_ids
-- (transactions where the sum of splits is more than 2x the original amount)

WITH split_totals AS (
  SELECT
    mt.raw_transaction_id,
    SUM(mt.amount) as total_split_amount,
    COUNT(*) as split_count,
    COALESCE(ot.debit_amount, ot.credit_amount) as original_amount
  FROM main_transaction mt
  JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
  WHERE mt.is_split = true
  GROUP BY mt.raw_transaction_id, ot.debit_amount, ot.credit_amount
  HAVING SUM(mt.amount) > COALESCE(ot.debit_amount, ot.credit_amount) * 1.5
)
SELECT
  raw_transaction_id,
  split_count,
  original_amount,
  total_split_amount,
  (total_split_amount - original_amount) as excess_amount
FROM split_totals
ORDER BY split_count DESC;

-- Step 2: For each affected transaction, keep only the NEWEST splits
-- (Delete older splits based on created_at timestamp)

-- IMPORTANT: Review the output above before running this DELETE!
-- Uncomment the DELETE statement below only after reviewing:

/*
WITH split_totals AS (
  SELECT
    mt.raw_transaction_id,
    SUM(mt.amount) as total_split_amount,
    COALESCE(ot.debit_amount, ot.credit_amount) as original_amount
  FROM main_transaction mt
  JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
  WHERE mt.is_split = true
  GROUP BY mt.raw_transaction_id, ot.debit_amount, ot.credit_amount
  HAVING SUM(mt.amount) > COALESCE(ot.debit_amount, ot.credit_amount) * 1.5
),
ranked_splits AS (
  SELECT
    mt.main_transaction_id,
    mt.raw_transaction_id,
    mt.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY mt.raw_transaction_id, mt.split_sequence
      ORDER BY mt.created_at DESC
    ) as rn
  FROM main_transaction mt
  WHERE mt.raw_transaction_id IN (SELECT raw_transaction_id FROM split_totals)
    AND mt.is_split = true
)
DELETE FROM main_transaction
WHERE main_transaction_id IN (
  SELECT main_transaction_id
  FROM ranked_splits
  WHERE rn > 1  -- Keep only the newest (rn = 1), delete older duplicates
);
*/

-- After cleanup, verify:
-- SELECT
--   mt.raw_transaction_id,
--   COUNT(*) as split_count,
--   SUM(mt.amount) as total_amount,
--   COALESCE(ot.debit_amount, ot.credit_amount) as original_amount
-- FROM main_transaction mt
-- JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
-- WHERE mt.is_split = true
-- GROUP BY mt.raw_transaction_id, ot.debit_amount, ot.credit_amount;
