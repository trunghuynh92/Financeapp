-- Migration 027: Fix entity creation RLS policy conflict
-- The issue: When creating an entity, the trigger tries to add the creator as owner,
-- but the RLS policy requires the user to already be an owner, creating a chicken-and-egg problem.
-- Created: 2025-11-10

-- Step 1: Ensure RLS is enabled on entities table
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop old policies on entities table
DROP POLICY IF EXISTS "Enable read access for all users" ON entities;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON entities;
DROP POLICY IF EXISTS "Enable update for users based on email" ON entities;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON entities;
DROP POLICY IF EXISTS "Enable all access for all users" ON entities;
DROP POLICY IF EXISTS "Authenticated users can create entities" ON entities;
DROP POLICY IF EXISTS "Users can read entities they belong to" ON entities;
DROP POLICY IF EXISTS "Only owners can update entities" ON entities;
DROP POLICY IF EXISTS "Only owners can delete entities" ON entities;

-- Step 3: Create proper INSERT policy for entities
-- Any authenticated user can create an entity
CREATE POLICY "Authenticated users can create entities"
    ON entities FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Step 4: Create SELECT policy for entities
-- Users can only see entities they belong to
CREATE POLICY "Users can read entities they belong to"
    ON entities FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
        )
    );

-- Step 5: Create UPDATE policy for entities
-- Only owners can update
CREATE POLICY "Only owners can update entities"
    ON entities FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    );

-- Step 6: Create DELETE policy for entities
-- Only owners can delete
CREATE POLICY "Only owners can delete entities"
    ON entities FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users
            WHERE entity_users.entity_id = entities.id
            AND entity_users.user_id = auth.uid()
            AND entity_users.role = 'owner'
        )
    );

-- Step 7: Fix entity_users INSERT policy
DROP POLICY IF EXISTS "Only owners can invite users to entities" ON entity_users;
DROP POLICY IF EXISTS "Owners can invite users and triggers can create initial owner" ON entity_users;

-- Step 8: Create new INSERT policy for entity_users
-- This allows both owners to invite AND triggers to create the initial owner
CREATE POLICY "Owners can invite users and triggers can create initial owner"
    ON entity_users FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow if user is already an owner of this entity
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_id
            AND eu.user_id = auth.uid()
            AND eu.role = 'owner'
        )
        OR
        -- Allow if this is the first owner being created for a new entity
        NOT EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = entity_id
        )
    );

-- Step 9: Ensure triggers are in place
CREATE OR REPLACE FUNCTION public.handle_new_entity()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the owner_user_id
    NEW.owner_user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_entity_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Add creator as owner in entity_users table
    -- SECURITY DEFINER allows this to bypass RLS policies
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
