-- ==============================================================================
-- DIAGNOSTIC QUERIES FOR BALANCE CALCULATION ISSUE
-- Account ID: 14
-- Issue: Checkpoint showing -151,547,028 but UI shows +53,684,403
-- ==============================================================================

-- Query 1: Count all transactions for account 14 (including adjustments)
SELECT
  'Total Transactions' as description,
  COUNT(*) as count
FROM original_transaction
WHERE account_id = 14;

-- Query 2: Count non-adjustment transactions
SELECT
  'Non-Adjustment Transactions' as description,
  COUNT(*) as count
FROM original_transaction
WHERE account_id = 14
  AND is_balance_adjustment = false;

-- Query 3: Sum credits and debits for NON-ADJUSTMENT transactions
SELECT
  'Non-Adjustment Totals' as description,
  SUM(COALESCE(credit_amount, 0)) as total_credits,
  SUM(COALESCE(debit_amount, 0)) as total_debits,
  SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)) as balance
FROM original_transaction
WHERE account_id = 14
  AND is_balance_adjustment = false;

-- Query 4: Check for duplicate raw_transaction_id
SELECT
  raw_transaction_id,
  COUNT(*) as duplicate_count,
  array_agg(transaction_date) as dates,
  array_agg(credit_amount) as credits,
  array_agg(debit_amount) as debits
FROM original_transaction
WHERE account_id = 14
GROUP BY raw_transaction_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Query 5: Get checkpoint details
SELECT
  checkpoint_id,
  checkpoint_date,
  declared_balance,
  calculated_balance,
  adjustment_amount,
  is_reconciled,
  import_batch_id
FROM balance_checkpoints
WHERE account_id = 14
ORDER BY checkpoint_date DESC;

-- Query 6: Check transaction_sequence distribution
SELECT
  COUNT(*) as total,
  COUNT(transaction_sequence) as with_sequence,
  COUNT(*) - COUNT(transaction_sequence) as null_sequences,
  MIN(transaction_sequence) as min_seq,
  MAX(transaction_sequence) as max_seq
FROM original_transaction
WHERE account_id = 14;

-- Query 7: Check for transactions with same date/amount/description (potential duplicates)
SELECT
  transaction_date,
  credit_amount,
  debit_amount,
  description,
  COUNT(*) as count,
  array_agg(raw_transaction_id) as transaction_ids
FROM original_transaction
WHERE account_id = 14
  AND is_balance_adjustment = false
GROUP BY transaction_date, credit_amount, debit_amount, description
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Query 8: Get actual transaction list to compare with UI
SELECT
  transaction_date,
  transaction_sequence,
  description,
  credit_amount,
  debit_amount,
  is_balance_adjustment,
  raw_transaction_id
FROM original_transaction
WHERE account_id = 14
ORDER BY transaction_date ASC, transaction_sequence ASC NULLS LAST
LIMIT 20;

-- Query 9: Test the database function directly
SELECT calculate_balance_up_to_date(14, '2024-11-01 23:59:59'::timestamptz) as function_result;

-- Query 10: Check if there are adjustment transactions
SELECT
  'Balance Adjustments' as description,
  COUNT(*) as count,
  SUM(COALESCE(credit_amount, 0)) as total_credits,
  SUM(COALESCE(debit_amount, 0)) as total_debits,
  array_agg(checkpoint_id) as checkpoint_ids
FROM original_transaction
WHERE account_id = 14
  AND is_balance_adjustment = true;

-- ==============================================================================
-- ANALYSIS INSTRUCTIONS:
-- ==============================================================================
-- 1. Run Query 1-3 first to see basic counts and totals
-- 2. Query 3 should show the correct balance that matches the UI
-- 3. Run Query 4 to check for exact duplicate transactions (same raw_transaction_id)
-- 4. Run Query 5 to see checkpoint details
-- 5. Run Query 7 to check for logical duplicates (same date/amount/description)
-- 6. Run Query 9 to test the database function directly
--
-- Expected:
-- - Query 3 should show balance = 53,684,403
-- - Query 9 should also return 53,684,403
-- - If checkpoint shows -151,547,028, there's a calculation bug in recalculation logic
