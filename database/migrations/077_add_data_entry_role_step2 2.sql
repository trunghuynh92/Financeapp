-- Migration 077 Step 2: Update Functions and Policies for Data Entry Role
-- IMPORTANT: Run this AFTER step 1 has been committed

-- Step 1: Update the user_has_permission function to include data_entry in hierarchy
CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_entity_id UUID,
    p_user_id UUID,
    p_required_role user_role
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role user_role;
    v_role_hierarchy INTEGER;
    v_required_hierarchy INTEGER;
BEGIN
    -- Get user's role for this entity
    SELECT role INTO v_user_role
    FROM entity_users
    WHERE entity_id = p_entity_id AND user_id = p_user_id;

    -- If user has no role, they have no permission
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Define role hierarchy (higher number = more permissions)
    -- owner > admin > editor > data_entry > viewer
    v_role_hierarchy := CASE v_user_role
        WHEN 'owner' THEN 5
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'data_entry' THEN 2
        WHEN 'viewer' THEN 1
    END;

    v_required_hierarchy := CASE p_required_role
        WHEN 'owner' THEN 5
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'data_entry' THEN 2
        WHEN 'viewer' THEN 1
    END;

    -- Check if user's role meets or exceeds required role
    RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update main_transaction policies to allow data_entry CRUD (except delete)
-- Drop existing policies
DROP POLICY IF EXISTS "Editor and above can create transactions" ON main_transaction;
DROP POLICY IF EXISTS "Editor and above can update transactions" ON main_transaction;

-- Data Entry+ can create transactions
CREATE POLICY "Data Entry and above can create transactions"
    ON main_transaction FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

-- Data Entry+ can update transactions
CREATE POLICY "Data Entry and above can update transactions"
    ON main_transaction FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

-- Step 3: Update original_transaction policies similarly
DROP POLICY IF EXISTS "Editor and above can create original transactions" ON original_transaction;
DROP POLICY IF EXISTS "Editor and above can update original transactions" ON original_transaction;

CREATE POLICY "Data Entry and above can create original transactions"
    ON original_transaction FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

CREATE POLICY "Data Entry and above can update original transactions"
    ON original_transaction FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

-- Step 4: Update import_batch policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_batch') THEN
        -- Drop old policy
        DROP POLICY IF EXISTS "Editor and above can manage import batches" ON import_batch;

        -- Data Entry+ can manage import batches
        EXECUTE 'CREATE POLICY "Data Entry and above can manage import batches"
            ON import_batch FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM accounts a
                    JOIN entity_users eu ON eu.entity_id = a.entity_id
                    WHERE a.account_id = import_batch.account_id
                    AND eu.user_id = auth.uid()
                    AND eu.role IN (''owner'', ''admin'', ''editor'', ''data_entry'')
                )
            )';
    END IF;
END $$;

-- Step 5: Create helper function to check if user is data_entry or lower
CREATE OR REPLACE FUNCTION public.user_is_data_entry_or_lower(
    p_entity_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role user_role;
BEGIN
    SELECT role INTO v_user_role
    FROM entity_users
    WHERE entity_id = p_entity_id AND user_id = p_user_id;

    RETURN v_user_role IN ('data_entry', 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration complete!
-- Summary:
-- 1. Updated user_has_permission function with new role hierarchy (5 levels instead of 4)
-- 2. Updated main_transaction policies to allow data_entry CRUD (except delete - that's still editor+)
-- 3. Updated original_transaction policies to allow data_entry CRUD (except delete)
-- 4. Updated import_batch policies to allow data_entry to import
-- 5. Added helper function to check if user is data_entry or lower (for UI restrictions)
--
-- Role Hierarchy:
-- Owner (5) - Full access
-- Admin (4) - Manage accounts, users (except owner actions)
-- Editor (3) - Full transaction access including delete
-- Data Entry (2) - Transaction CRUD, imports, but NO delete, NO reports/analytics access
-- Viewer (1) - Read-only
--
-- Data Entry Role Permissions:
-- ✅ CAN: Read transactions, create transactions, update transactions, categorize, split, add notes, import
-- ❌ CANNOT: Delete transactions, access reports, access cash flow, access analytics, manage accounts, manage users
