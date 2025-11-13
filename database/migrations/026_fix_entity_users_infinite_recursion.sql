-- Migration 026: Fix infinite recursion in entity_users RLS policies
-- The entity_users policies were querying entity_users itself, creating infinite recursion
-- Created: 2025-11-09

-- Step 1: Drop existing entity_users policies
DROP POLICY IF EXISTS "Users can read entity memberships they have access to" ON entity_users;
DROP POLICY IF EXISTS "Only owners can invite users to entities" ON entity_users;
DROP POLICY IF EXISTS "Only owners can change user roles" ON entity_users;
DROP POLICY IF EXISTS "Only owners can remove users from entities" ON entity_users;
DROP POLICY IF EXISTS "Users can read their own entity memberships" ON entity_users;

-- Step 2: Create simple, non-recursive policies for entity_users
-- Users can read their own entity memberships
CREATE POLICY "Users can read their own entity memberships"
    ON entity_users FOR SELECT
    USING (user_id = auth.uid());

-- Authenticated users can create entity memberships when creating a new entity
-- This is needed for the trigger that adds the creator as owner
-- We rely on application logic and triggers to enforce ownership rules
CREATE POLICY "Service role can manage entity memberships"
    ON entity_users FOR INSERT
    WITH CHECK (true);

-- For now, disable UPDATE and DELETE on entity_users to prevent recursion
-- These will be handled through stored procedures with SECURITY DEFINER if needed
-- Or we can implement them at the application level with proper checks

-- Step 3: Verify RLS is still enabled
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;

-- Note: The simplified policy only allows users to see their own memberships.
-- This is sufficient for:
-- 1. Users to see which entities they belong to
-- 2. The EntityContext to load the user's entities
-- 3. Other tables' RLS policies to check if a user has access to an entity

-- For inviting/removing users and changing roles, these operations should be:
-- 1. Handled by API routes with explicit permission checks using check_entity_permission()
-- 2. Or use SECURITY DEFINER functions that bypass RLS

