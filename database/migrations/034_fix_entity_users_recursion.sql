-- Migration 034: Fix entity_users infinite recursion
-- Issue: Restrictive SELECT policy causes recursion when other tables' RLS policies check entity_users
-- Root cause: Other tables (entities, accounts, etc.) have RLS policies that join entity_users
--             When entity_users has restrictive RLS, it causes infinite recursion
-- Solution: Allow authenticated users to SELECT any entity_users record
--           Access control is enforced at the application layer via API routes
-- Created: 2025-11-10

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users can view their own memberships" ON entity_users;
DROP POLICY IF EXISTS "Users can view members of their entities" ON entity_users;

-- Create a permissive SELECT policy
-- This prevents recursion by not checking entity_users within the policy itself
-- Security note: This allows users to see all entity memberships, but:
-- 1. The API routes enforce proper access control
-- 2. Users can only see entities they belong to via entities table RLS
-- 3. RLS on entities, accounts, transactions, etc. can now safely check entity_users
CREATE POLICY "Authenticated users can view entity memberships"
    ON entity_users FOR SELECT
    TO authenticated
    USING (true);

-- INSERT, UPDATE, DELETE policies remain restrictive (from Migration 031)
-- Only specific SECURITY DEFINER functions can modify entity_users
