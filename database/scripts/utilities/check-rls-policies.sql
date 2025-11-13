-- Check all RLS policies on critical tables
-- Run this in your Supabase SQL editor to see what policies exist

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'entities', 'entity_users', 'original_transaction', 'main_transaction', 'users')
ORDER BY tablename, policyname;

-- Check if RLS is enabled on tables
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'entities', 'entity_users', 'original_transaction', 'main_transaction', 'users')
ORDER BY tablename;
