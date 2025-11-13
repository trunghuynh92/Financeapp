-- Migration 036: Allow editors to delete original_transaction records
-- Issue: Editors cannot delete transactions
-- Root cause: DELETE policy on original_transaction only allows owner/admin
-- Solution: Allow editor to delete as well
-- Created: 2025-11-10

-- Drop the restrictive DELETE policy
DROP POLICY IF EXISTS "Admin and above can delete original transactions" ON original_transaction;

-- Create new DELETE policy that includes editor
CREATE POLICY "Editor and above can delete original transactions"
    ON original_transaction FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );
