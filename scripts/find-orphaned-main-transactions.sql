-- Script: Find and optionally clean up orphaned main_transactions
-- Purpose: Identify main_transactions whose original_transaction has been deleted
-- Created: 2025-11-10

-- ==============================================================================
-- Step 1: Count orphaned records
-- ==============================================================================

SELECT COUNT(*) as orphaned_count
FROM main_transaction mt
LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
WHERE ot.raw_transaction_id IS NULL;

-- ==============================================================================
-- Step 2: View orphaned records with details
-- ==============================================================================

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
    mt.split_sequence,
    mt.created_at
FROM main_transaction mt
LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
LEFT JOIN accounts a ON a.account_id = mt.account_id
WHERE ot.raw_transaction_id IS NULL
ORDER BY mt.created_at DESC;

-- ==============================================================================
-- Step 3: Delete orphaned records (UNCOMMENT TO EXECUTE)
-- ==============================================================================

-- WARNING: This will permanently delete orphaned main_transactions!
-- Make sure to review the records above before running this.

-- DELETE FROM main_transaction
-- WHERE raw_transaction_id IN (
--     SELECT mt.raw_transaction_id
--     FROM main_transaction mt
--     LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
--     WHERE ot.raw_transaction_id IS NULL
-- );

-- ==============================================================================
-- Step 4: Verify cleanup (if you ran the DELETE)
-- ==============================================================================

-- SELECT COUNT(*) as remaining_orphaned_count
-- FROM main_transaction mt
-- LEFT JOIN original_transaction ot ON ot.raw_transaction_id = mt.raw_transaction_id
-- WHERE ot.raw_transaction_id IS NULL;
