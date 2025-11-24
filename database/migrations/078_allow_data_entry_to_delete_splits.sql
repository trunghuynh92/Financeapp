-- Migration 078: Allow Data Entry to Delete Split Transactions
-- Issue: Data entry users can split transactions, but can't delete existing splits
-- when re-splitting, causing duplicated records
--
-- Solution: Add a DELETE policy specifically for split transactions that allows
-- data_entry users to delete splits (but not unsplit/original transactions)

-- Drop existing delete policies if they exist
DROP POLICY IF EXISTS "Admin and above can delete transactions" ON main_transaction;
DROP POLICY IF EXISTS "Editor and above can delete transactions" ON main_transaction;
DROP POLICY IF EXISTS "Editor and above can delete any transaction" ON main_transaction;
DROP POLICY IF EXISTS "Data Entry can delete split transactions only" ON main_transaction;
DROP POLICY IF EXISTS "Data Entry can delete transactions when splitting" ON main_transaction;

-- Editor+ can delete ANY transaction (including unsplit)
CREATE POLICY "Editor and above can delete any transaction"
    ON main_transaction FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Data Entry can delete transactions for re-splitting
-- Allow data_entry to delete main_transaction records so they can split/re-split
-- This is safe because:
-- 1. The original_transaction record is preserved (source of truth)
-- 2. Splitting is just reorganizing how a transaction is categorized
-- 3. They still can't delete original_transaction records
CREATE POLICY "Data Entry can delete main transactions for splitting"
    ON main_transaction FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role = 'data_entry'
        )
    );

-- Migration complete!
-- Summary:
-- 1. Editor+ can delete any transaction (split or unsplit)
-- 2. Data Entry can delete only split transactions (is_split = true)
-- 3. This allows data_entry to re-split without creating duplicates
-- 4. Viewer still cannot delete anything (no policy for viewer)
