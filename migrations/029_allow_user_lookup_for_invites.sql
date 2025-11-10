-- Migration 029: Allow users to look up other users for entity invites
-- Issue: Cannot invite users to entities because RLS blocks looking up users by email
-- Root cause: "Users can read own profile" policy is too restrictive
-- Created: 2025-11-10

-- Step 1: Add policy to allow authenticated users to look up other users by email
-- This is needed for the team member invite functionality
-- Users should be able to search for other users to invite them to entities
CREATE POLICY "Authenticated users can look up users by email"
    ON users FOR SELECT
    TO authenticated
    USING (true);

-- Note: This allows any authenticated user to see basic user information
-- (id, email, full_name, avatar_url) which is necessary for:
-- 1. Inviting users to entities
-- 2. Displaying team member information
-- 3. User search/autocomplete features
--
-- This is a common pattern in team collaboration apps where users
-- need to be able to find and invite other users.
--
-- Security consideration: The users table only contains public profile info.
-- Sensitive authentication data is in auth.users (not exposed via RLS).
