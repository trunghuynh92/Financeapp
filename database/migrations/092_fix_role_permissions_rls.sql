-- Migration: Fix role_permissions RLS policy to allow all entity members to view
-- Purpose: Previously only owners could view role permissions, but all users need to read them to check their own permissions

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Owners can view role permissions" ON role_permissions;

-- Create a new policy that allows all entity members to view role permissions for their entity
CREATE POLICY "Entity members can view role permissions"
  ON role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entity_users
      WHERE entity_users.entity_id = role_permissions.entity_id
        AND entity_users.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Entity members can view role permissions" ON role_permissions IS
'Allow all entity members to view role permissions so they can check their own role permissions';
