-- Migration 033: Fix entity_users SELECT - use SECURITY DEFINER function
-- Issue: Users can only see their own membership, not other team members
-- Solution: Use SECURITY DEFINER function to bypass RLS for listing members
-- Created: 2025-11-10

-- Step 1: Keep the simple SELECT policy (for user's own memberships)
-- This is used by EntityContext to load user's entities
DROP POLICY IF EXISTS "entity_users_select_policy" ON entity_users;
DROP POLICY IF EXISTS "Users can read their own entity memberships" ON entity_users;
DROP POLICY IF EXISTS "Users can view their own memberships" ON entity_users;

CREATE POLICY "Users can view their own memberships"
    ON entity_users FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Step 2: Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_entity_members(UUID);

-- Step 3: Create SECURITY DEFINER function to list all members of an entity
CREATE OR REPLACE FUNCTION public.get_entity_members(p_entity_id UUID)
RETURNS TABLE (
    id INTEGER,
    entity_id UUID,
    user_id UUID,
    role user_role,
    created_at TIMESTAMPTZ,
    created_by_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the calling user is a member of this entity
    IF NOT EXISTS (
        SELECT 1 FROM entity_users
        WHERE entity_users.entity_id = p_entity_id
        AND entity_users.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this entity';
    END IF;

    -- Return all members of the entity
    RETURN QUERY
    SELECT eu.id, eu.entity_id, eu.user_id, eu.role, eu.created_at, eu.created_by_user_id
    FROM entity_users eu
    WHERE eu.entity_id = p_entity_id
    ORDER BY eu.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_entity_members(UUID) TO authenticated;
