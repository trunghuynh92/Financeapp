-- Script: Cleanup after failed rollback
-- Purpose: Manually clean up transactions when rollback partially fails
-- Scenario: Checkpoint was deleted but transactions remain
-- Created: 2025-11-10

-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Replace YOUR_IMPORT_BATCH_ID_HERE with the actual import_batch_id
-- 2. Run each section step by step
-- 3. Review the SELECT queries before running DELETE queries
-- ==============================================================================

-- ==============================================================================
-- Step 1: Identify the import batch to clean up
-- ==============================================================================

-- List all import batches with their transaction counts
SELECT
    ib.import_batch_id,
    ib.import_file_name,
    ib.import_date,
    ib.import_status,
    ib.account_id,
    a.account_name,
    COUNT(ot.raw_transaction_id) as transaction_count
FROM import_batch ib
LEFT JOIN accounts a ON a.account_id = ib.account_id
LEFT JOIN original_transaction ot ON ot.import_batch_id = ib.import_batch_id
    AND ot.is_balance_adjustment = false
GROUP BY ib.import_batch_id, ib.import_file_name, ib.import_date,
         ib.import_status, ib.account_id, a.account_name
ORDER BY ib.import_date DESC;

-- ==============================================================================
-- Step 2: Review transactions for the specific import batch
-- ==============================================================================

-- REPLACE YOUR_IMPORT_BATCH_ID_HERE with the actual ID
SELECT
    ot.raw_transaction_id,
    ot.transaction_date,
    ot.description,
    ot.debit_amount,
    ot.credit_amount,
    ot.account_id,
    a.account_name
FROM original_transaction ot
LEFT JOIN accounts a ON a.account_id = ot.account_id
WHERE ot.import_batch_id = YOUR_IMPORT_BATCH_ID_HERE
  AND ot.is_balance_adjustment = false
ORDER BY ot.transaction_date;

-- Count transactions to delete
SELECT COUNT(*) as transactions_to_delete
FROM original_transaction
WHERE import_batch_id = YOUR_IMPORT_BATCH_ID_HERE
  AND is_balance_adjustment = false;

-- ==============================================================================
-- Step 3: Delete original_transactions from the import batch
-- ==============================================================================

-- UNCOMMENT AND REPLACE YOUR_IMPORT_BATCH_ID_HERE TO EXECUTE
-- DELETE FROM original_transaction
-- WHERE import_batch_id = YOUR_IMPORT_BATCH_ID_HERE
--   AND is_balance_adjustment = false;

-- ==============================================================================
-- Step 4: Review orphaned main_transactions
-- ==============================================================================

-- Find orphaned main_transactions (whose original_transaction was deleted)
SELECT
    mt.main_transaction_id,
    mt.raw_transaction_id,
    mt.account_id,
    a.account_name,
    mt.transaction_date,
    mt.amount,
    mt.transaction_direction,
    mt.description,
    mt.is_split,
    mt.created_at
FROM main_transaction mt
LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
LEFT JOIN accounts a ON a.account_id = mt.account_id
WHERE ot.raw_transaction_id IS NULL
ORDER BY mt.created_at DESC;

-- Count orphaned records
SELECT COUNT(*) as orphaned_main_transactions
FROM main_transaction mt
LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.raw_transaction_id IS NULL;

-- ==============================================================================
-- Step 5: Delete orphaned main_transactions
-- ==============================================================================

-- UNCOMMENT TO EXECUTE
-- DELETE FROM main_transaction
-- WHERE raw_transaction_id IN (
--     SELECT mt.raw_transaction_id
--     FROM main_transaction mt
--     LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
--     WHERE ot.raw_transaction_id IS NULL
-- );

-- ==============================================================================
-- Step 6: Verify cleanup is complete
-- ==============================================================================

-- Verify no original_transactions remain for the import batch
SELECT COUNT(*) as remaining_original_transactions
FROM original_transaction
WHERE import_batch_id = YOUR_IMPORT_BATCH_ID_HERE;

-- Verify no orphaned main_transactions
SELECT COUNT(*) as remaining_orphaned_main_transactions
FROM main_transaction mt
LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.raw_transaction_id IS NULL;

-- ==============================================================================
-- Step 7: (Optional) Update import batch status
-- ==============================================================================

-- UNCOMMENT AND REPLACE YOUR_IMPORT_BATCH_ID_HERE TO EXECUTE
-- UPDATE import_batch
-- SET import_status = 'rolled_back',
--     error_log = jsonb_build_object(
--         'manually_cleaned_at', NOW(),
--         'reason', 'Cleaned up after failed automatic rollback'
--     )
-- WHERE import_batch_id = YOUR_IMPORT_BATCH_ID_HERE;

-- ==============================================================================
-- SUMMARY OF SAFE CLEANUP ORDER:
-- 1. Delete original_transactions by import_batch_id (Step 3)
-- 2. Delete orphaned main_transactions (Step 5)
-- 3. Verify cleanup (Step 6)
-- 4. Optionally update import batch status (Step 7)
-- ==============================================================================
