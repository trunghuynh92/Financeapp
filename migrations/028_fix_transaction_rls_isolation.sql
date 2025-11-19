-- Migration 028: Fix transaction data isolation - ensure RLS is properly enforced
-- Issue: Users can see transactions from other entities they don't belong to
-- Root cause: Possible permissive policies or RLS not fully enforced
-- Created: 2025-11-10

-- Step 1: Drop ALL existing policies on original_transaction to start fresh
DROP POLICY IF EXISTS "Enable all access for original_transaction" ON original_transaction;
DROP POLICY IF EXISTS "Enable read access for all users" ON original_transaction;
DROP POLICY IF EXISTS "Users can read original transactions for their accounts" ON original_transaction;
DROP POLICY IF EXISTS "Editor and above can create original transactions" ON original_transaction;
DROP POLICY IF EXISTS "Editor and above can update original transactions" ON original_transaction;
DROP POLICY IF EXISTS "Admin and above can delete original transactions" ON original_transaction;

-- Step 2: Drop ALL existing policies on main_transaction to start fresh
DROP POLICY IF EXISTS "Enable all access for main_transaction" ON main_transaction;
DROP POLICY IF EXISTS "Enable read access for all users" ON main_transaction;
DROP POLICY IF EXISTS "Users can read transactions for their accounts" ON main_transaction;
DROP POLICY IF EXISTS "Editor and above can create transactions" ON main_transaction;
DROP POLICY IF EXISTS "Editor and above can update transactions" ON main_transaction;
DROP POLICY IF EXISTS "Admin and above can delete transactions" ON main_transaction;

-- Step 3: Ensure RLS is enabled on transaction tables
ALTER TABLE original_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_transaction ENABLE ROW LEVEL SECURITY;

-- Step 4: Create strict SELECT policy for original_transaction
-- Users can ONLY read transactions from accounts that belong to entities they're members of
CREATE POLICY "Users can read original transactions for their entities"
    ON original_transaction FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
        )
    );

-- Step 5: Create strict INSERT policy for original_transaction
-- Editor+ can create transactions for accounts in their entities
CREATE POLICY "Editor and above can create original transactions"
    ON original_transaction FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Step 6: Create strict UPDATE policy for original_transaction
-- Editor+ can update transactions for accounts in their entities
CREATE POLICY "Editor and above can update original transactions"
    ON original_transaction FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Step 7: Create strict DELETE policy for original_transaction
-- Admin+ can delete transactions for accounts in their entities
CREATE POLICY "Admin and above can delete original transactions"
    ON original_transaction FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Step 8: Create strict SELECT policy for main_transaction
-- Users can ONLY read transactions from accounts that belong to entities they're members of
CREATE POLICY "Users can read transactions for their entities"
    ON main_transaction FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
        )
    );

-- Step 9: Create strict INSERT policy for main_transaction
-- Editor+ can create transactions for accounts in their entities
CREATE POLICY "Editor and above can create transactions"
    ON main_transaction FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Step 10: Create strict UPDATE policy for main_transaction
-- Editor+ can update transactions for accounts in their entities
CREATE POLICY "Editor and above can update transactions"
    ON main_transaction FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Step 11: Create strict DELETE policy for main_transaction
-- Admin+ can delete transactions for accounts in their entities
CREATE POLICY "Admin and above can delete transactions"
    ON main_transaction FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Step 12: Verification query
-- Run this after migration to verify:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('original_transaction', 'main_transaction')
-- ORDER BY tablename, cmd;
