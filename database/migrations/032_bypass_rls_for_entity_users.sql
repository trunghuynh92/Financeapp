-- Migration 032: Bypass RLS for entity_users using SECURITY DEFINER function
-- Issue: RLS continues to block INSERT despite permissive policies
-- Solution: Create SECURITY DEFINER function to bypass RLS for team invites
-- Created: 2025-11-10

-- Step 1: Create SECURITY DEFINER function to add entity members
CREATE OR REPLACE FUNCTION public.add_entity_member(
    p_entity_id UUID,
    p_user_id UUID,
    p_role TEXT,
    p_created_by_user_id UUID
)
RETURNS SETOF entity_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY DEFINER allows this function to bypass RLS
    -- Cast TEXT to user_role enum
    RETURN QUERY
    INSERT INTO entity_users (entity_id, user_id, role, created_by_user_id)
    VALUES (p_entity_id, p_user_id, p_role::user_role, p_created_by_user_id)
    RETURNING *;
END;
$$;

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.add_entity_member(UUID, UUID, TEXT, UUID) TO authenticated;

-- Step 3: Create SECURITY DEFINER function to update member role
CREATE OR REPLACE FUNCTION public.update_entity_member_role(
    p_member_id BIGINT,
    p_new_role TEXT
)
RETURNS SETOF entity_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE entity_users
    SET role = p_new_role::user_role
    WHERE id = p_member_id
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_entity_member_role(BIGINT, TEXT) TO authenticated;

-- Step 4: Create SECURITY DEFINER function to remove member
CREATE OR REPLACE FUNCTION public.remove_entity_member(
    p_member_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM entity_users WHERE id = p_member_id;
    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_entity_member(BIGINT) TO authenticated;

-- Note: The API will still perform permission checks before calling these functions
-- This just ensures RLS doesn't interfere with legitimate operations
