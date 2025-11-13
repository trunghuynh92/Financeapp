-- Migration 023: Fix infinite recursion in entity_users RLS policy
-- Issue: The SELECT policy on entity_users was querying itself, causing recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can read entity memberships they have access to" ON entity_users;

-- Create simplified policy: Users can only read their own memberships
-- Admins/owners wanting to see all memberships will need a separate query or function
CREATE POLICY "Users can read their own entity memberships"
    ON entity_users FOR SELECT
    USING (user_id = auth.uid());

-- Optional: Create a security definer function for admins to list all members
-- This bypasses RLS since it's a function
CREATE OR REPLACE FUNCTION get_entity_members(p_entity_id UUID)
RETURNS TABLE (
    id INTEGER,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    role user_role,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is owner/admin of this entity
    IF NOT EXISTS (
        SELECT 1 FROM entity_users
        WHERE entity_id = p_entity_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: You must be an owner or admin of this entity';
    END IF;

    -- Return all members of the entity
    RETURN QUERY
    SELECT
        eu.id,
        eu.user_id,
        u.email as user_email,
        u.full_name as user_name,
        eu.role,
        eu.created_at
    FROM entity_users eu
    JOIN users u ON eu.user_id = u.id
    WHERE eu.entity_id = p_entity_id
    ORDER BY eu.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_entity_members IS 'Get all members of an entity (requires owner/admin role). Use this instead of querying entity_users directly.';

-- Migration complete
-- Users can now read their own entity_users records without recursion
-- Admins/owners use get_entity_members(entity_id) function to list all members
