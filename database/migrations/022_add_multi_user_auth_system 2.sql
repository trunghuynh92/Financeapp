-- Migration 022: Multi-User Authentication System with Role-Based Access Control
-- This migration adds support for multiple users with roles and entity-level permissions

-- Step 1: Create users table (extends Supabase auth.users)
-- This table stores additional user profile information
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create role enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- Step 3: Create entity_users junction table for multi-entity access with roles
-- This allows users to have different roles in different entities
CREATE TABLE IF NOT EXISTS public.entity_users (
    id SERIAL PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID REFERENCES public.users(id),

    -- Ensure a user can only have one role per entity
    UNIQUE(entity_id, user_id)
);

-- Step 4: Add indexes for performance
CREATE INDEX idx_entity_users_entity_id ON entity_users(entity_id);
CREATE INDEX idx_entity_users_user_id ON entity_users(user_id);
CREATE INDEX idx_users_email ON users(email);

-- Step 5: Update entities table to track the owner
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.users(id);

-- Step 6: Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Create function to check user role for an entity
CREATE OR REPLACE FUNCTION public.get_user_role(p_entity_id UUID, p_user_id UUID)
RETURNS user_role AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM entity_users
    WHERE entity_id = p_entity_id AND user_id = p_user_id;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create function to check if user has access to entity
CREATE OR REPLACE FUNCTION public.user_has_entity_access(p_entity_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM entity_users
        WHERE entity_id = p_entity_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create function to check if user has specific permission
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
    v_role_hierarchy := CASE v_user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
    END;

    v_required_hierarchy := CASE p_required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
    END;

    -- Check if user's role meets or exceeds required role
    RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Enable Row Level Security on new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;

-- Step 12: Create RLS policies for users table
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Step 13: Create RLS policies for entity_users table
-- Users can read entity_users for entities they have access to
CREATE POLICY "Users can read entity memberships they have access to"
    ON entity_users FOR SELECT
    USING (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_users.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Only owners can insert new entity_users (invite users)
CREATE POLICY "Only owners can invite users to entities"
    ON entity_users FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_id
            AND eu.user_id = auth.uid()
            AND eu.role = 'owner'
        )
    );

-- Only owners can update entity_users (change roles)
CREATE POLICY "Only owners can change user roles"
    ON entity_users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_users.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role = 'owner'
        )
    );

-- Only owners can delete entity_users (remove users)
CREATE POLICY "Only owners can remove users from entities"
    ON entity_users FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_users.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role = 'owner'
        )
    );

-- Step 14: Update RLS policies for entities table
DROP POLICY IF EXISTS "Enable read access for all users" ON entities;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON entities;
DROP POLICY IF EXISTS "Enable update for users based on email" ON entities;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON entities;

-- Users can only read entities they have access to
CREATE POLICY "Users can read entities they belong to"
    ON entities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
        )
    );

-- Authenticated users can create new entities (they become the owner)
CREATE POLICY "Authenticated users can create entities"
    ON entities FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can update entities
CREATE POLICY "Only owners can update entities"
    ON entities FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    );

-- Only owners can delete entities
CREATE POLICY "Only owners can delete entities"
    ON entities FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    );

-- Step 15: Create trigger to automatically add creator as owner when creating entity
CREATE OR REPLACE FUNCTION public.handle_new_entity()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the owner_user_id
    NEW.owner_user_id := auth.uid();

    -- After insert, add the creator as owner in entity_users
    -- This will be handled by an AFTER INSERT trigger
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_entity_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Add creator as owner in entity_users table
    INSERT INTO entity_users (entity_id, user_id, role, created_by_user_id)
    VALUES (NEW.id, auth.uid(), 'owner', auth.uid());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_entity_created_set_owner ON entities;
CREATE TRIGGER on_entity_created_set_owner
    BEFORE INSERT ON entities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_entity();

DROP TRIGGER IF EXISTS on_entity_created_add_owner ON entities;
CREATE TRIGGER on_entity_created_add_owner
    AFTER INSERT ON entities
    FOR EACH ROW
    EXECUTE FUNCTION public.add_entity_owner();

-- Step 16: Update accounts table RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON accounts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON accounts;
DROP POLICY IF EXISTS "Enable update for users based on email" ON accounts;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON accounts;

-- Users can read accounts for entities they have access to
CREATE POLICY "Users can read accounts for their entities"
    ON accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = accounts.entity_id
            AND entity_users.user_id = auth.uid()
        )
    );

-- Admin+ can create accounts
CREATE POLICY "Admin and above can create accounts"
    ON accounts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entity_id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role IN ('owner', 'admin')
        )
    );

-- Admin+ can update accounts
CREATE POLICY "Admin and above can update accounts"
    ON accounts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = accounts.entity_id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role IN ('owner', 'admin')
        )
    );

-- Only owners can delete accounts
CREATE POLICY "Only owners can delete accounts"
    ON accounts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = accounts.entity_id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    );

-- Step 17: Update main_transaction table RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON main_transaction;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON main_transaction;
DROP POLICY IF EXISTS "Enable update for users based on email" ON main_transaction;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON main_transaction;

-- Users can read transactions for accounts they have access to
CREATE POLICY "Users can read transactions for their accounts"
    ON main_transaction FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
        )
    );

-- Editor+ can create transactions
CREATE POLICY "Editor and above can create transactions"
    ON main_transaction FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Editor+ can update transactions
CREATE POLICY "Editor and above can update transactions"
    ON main_transaction FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- Admin+ can delete transactions
CREATE POLICY "Admin and above can delete transactions"
    ON main_transaction FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Step 18: Update original_transaction table RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON original_transaction;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON original_transaction;
DROP POLICY IF EXISTS "Enable update for users based on email" ON original_transaction;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON original_transaction;

CREATE POLICY "Users can read original transactions for their accounts"
    ON original_transaction FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
        )
    );

CREATE POLICY "Editor and above can create original transactions"
    ON original_transaction FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

CREATE POLICY "Editor and above can update original transactions"
    ON original_transaction FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

CREATE POLICY "Admin and above can delete original transactions"
    ON original_transaction FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = original_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Step 19: Update balance_checkpoints RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON balance_checkpoints;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON balance_checkpoints;
DROP POLICY IF EXISTS "Enable update for users based on email" ON balance_checkpoints;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON balance_checkpoints;

CREATE POLICY "Users can read checkpoints for their accounts"
    ON balance_checkpoints FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = balance_checkpoints.account_id
            AND eu.user_id = auth.uid()
        )
    );

CREATE POLICY "Admin and above can manage checkpoints"
    ON balance_checkpoints FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = balance_checkpoints.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- Step 20: Update debt_drawdown and drawdown_payment RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON debt_drawdown;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON debt_drawdown;
DROP POLICY IF EXISTS "Enable update for users based on email" ON debt_drawdown;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON debt_drawdown;

CREATE POLICY "Users can read drawdowns for their accounts"
    ON debt_drawdown FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = debt_drawdown.account_id
            AND eu.user_id = auth.uid()
        )
    );

CREATE POLICY "Admin and above can manage drawdowns"
    ON debt_drawdown FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = debt_drawdown.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- NOTE: drawdown_payment table does not exist
-- Payments are tracked in main_transaction with transaction_subtype and drawdown_id

-- Step 21: Update import_batch RLS policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_batch') THEN
        -- Drop old policies
        DROP POLICY IF EXISTS "Enable read access for all users" ON import_batch;
        DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON import_batch;
        DROP POLICY IF EXISTS "Enable update for users based on email" ON import_batch;
        DROP POLICY IF EXISTS "Enable delete for users based on email" ON import_batch;

        -- Create new policies
        EXECUTE 'CREATE POLICY "Users can read import batches for their accounts"
            ON import_batch FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM accounts a
                    JOIN entity_users eu ON eu.entity_id = a.entity_id
                    WHERE a.account_id = import_batch.account_id
                    AND eu.user_id = auth.uid()
                )
            )';

        EXECUTE 'CREATE POLICY "Editor and above can manage import batches"
            ON import_batch FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM accounts a
                    JOIN entity_users eu ON eu.entity_id = a.entity_id
                    WHERE a.account_id = import_batch.account_id
                    AND eu.user_id = auth.uid()
                    AND eu.role IN (''owner'', ''admin'', ''editor'')
                )
            )';
    END IF;
END $$;

-- Step 22: Categories, Branches, and Transaction Types remain GLOBALLY accessible
-- Since they don't have entity_id, all authenticated users can read them
-- Only system admins should manage these (future enhancement)

-- For now, keep read access open for authenticated users
DROP POLICY IF EXISTS "Enable read access for all users" ON categories;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON categories;
DROP POLICY IF EXISTS "Enable update for users based on email" ON categories;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON categories;

CREATE POLICY "Authenticated users can read categories"
    ON categories FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- For categories management, restrict to users who have at least one entity with admin+ role
CREATE POLICY "Entity admins can manage categories"
    ON categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.user_id = auth.uid()
            AND entity_users.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Enable read access for all users" ON branches;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON branches;
DROP POLICY IF EXISTS "Enable update for users based on email" ON branches;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON branches;

CREATE POLICY "Authenticated users can read branches"
    ON branches FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Entity admins can manage branches"
    ON branches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.user_id = auth.uid()
            AND entity_users.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Enable read access for all users" ON transaction_types;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transaction_types;
DROP POLICY IF EXISTS "Enable update for users based on email" ON transaction_types;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON transaction_types;

CREATE POLICY "Authenticated users can read transaction types"
    ON transaction_types FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Entity admins can manage transaction types"
    ON transaction_types FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.user_id = auth.uid()
            AND entity_users.role IN ('owner', 'admin')
        )
    );

-- Migration complete!
-- Summary:
-- 1. Created users table for profile data (UUID references to auth.users)
-- 2. Created entity_users junction table with role-based access (UUID entity_id)
-- 3. Added user_role ENUM type ('owner', 'admin', 'editor', 'viewer')
-- 4. Added helper functions for role checking (get_user_role, user_has_entity_access, user_has_permission)
-- 5. Added triggers for auto user/entity setup (on_auth_user_created, on_entity_created_set_owner, on_entity_created_add_owner)
-- 6. Added owner_user_id column to entities table
-- 7. Updated RLS policies on all 10 existing tables (entities, accounts, main_transaction, original_transaction,
--    balance_checkpoints, debt_drawdown, categories, branches, transaction_types, import_batch)
-- 8. Role hierarchy: Owner > Admin > Editor > Viewer
-- 9. Permissions:
--    - Viewer: Read-only access
--    - Editor: Can create/edit transactions and imports
--    - Admin: Can manage accounts, checkpoints, drawdowns (cannot delete accounts or manage users)
--    - Owner: Full access including user management
-- 10. Categories, Branches, Transaction Types are global resources
--     All authenticated users can read, only entity admins can manage
--
-- Note: There is NO drawdown_payment table - payments are tracked in main_transaction with drawdown_id
