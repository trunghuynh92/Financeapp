-- Diagnostic query to check which migrations have been applied
-- Run this in Supabase SQL Editor

-- Check entity_users policies (to see if Migration 026 was applied)
SELECT 'entity_users policies' as check_type, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'entity_users'
ORDER BY policyname;

-- Check entities policies (to see if Migration 027 was applied)
SELECT 'entities policies' as check_type, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'entities'
ORDER BY policyname;

-- Check if the entity creation trigger exists (from Migration 027)
SELECT 'triggers on entities' as check_type, trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'entities'
  AND trigger_schema = 'public'
ORDER BY trigger_name;

-- Expected results if migrations are applied:
--
-- Migration 026 applied if you see:
-- - "Users can read their own entity memberships"
-- - "Service role can manage entity memberships"
--
-- Migration 027 applied if you see:
-- - "Authenticated users can create entities" with WITH CHECK (true)
-- - "Owners can invite users and triggers can create initial owner" on entity_users
-- - Triggers: on_entity_created_set_owner, on_entity_created_add_owner
