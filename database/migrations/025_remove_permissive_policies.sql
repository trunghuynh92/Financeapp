-- Migration 025: Remove old permissive "Enable all access" policies
-- These policies were allowing all users to see all data, bypassing entity isolation
-- Created: 2025-11-09

-- Step 1: Remove permissive policies from accounts table
DROP POLICY IF EXISTS "Enable all access for accounts" ON accounts;
DROP POLICY IF EXISTS "Enable all operations for accounts" ON accounts;

-- Step 2: Remove permissive policies from entities table
DROP POLICY IF EXISTS "Enable all access for all users" ON entities;

-- Step 3: Remove permissive policies from transaction tables
DROP POLICY IF EXISTS "Enable all access for main_transaction" ON main_transaction;
DROP POLICY IF EXISTS "Enable all access for original_transaction" ON original_transaction;

-- Step 4: Verify RLS is enabled on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE original_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_transaction ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify the correct policies are in place
-- Run this to check:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('accounts', 'entities', 'entity_users', 'original_transaction', 'main_transaction')
-- ORDER BY tablename, policyname;

-- Expected policies after cleanup:
-- accounts:
--   - Admin and above can create accounts
--   - Admin and above can update accounts
--   - Only owners can delete accounts
--   - Users can read accounts for their entities
--
-- entities:
--   - Authenticated users can create entities
--   - Only owners can delete entities
--   - Only owners can update entities
--   - Users can read entities they belong to
--
-- entity_users:
--   - Only owners can change user roles
--   - Only owners can invite users to entities
--   - Only owners can remove users from entities
--   - Users can read their own entity memberships
--
-- original_transaction:
--   - Admin and above can delete original transactions
--   - Editor and above can create original transactions
--   - Editor and above can update original transactions
--   - Users can read original transactions for their accounts
--
-- main_transaction:
--   - Admin and above can delete transactions
--   - Editor and above can create transactions
--   - Editor and above can update transactions
--   - Users can read transactions for their accounts
