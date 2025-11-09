-- ============================================================================
-- Database Schema Export Script
-- Run this in Supabase SQL Editor to get current schema details
-- ============================================================================

-- ============================================================================
-- 1. LIST ALL TABLES
-- ============================================================================
SELECT
    '=== TABLES ===' as section,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- 2. DETAILED TABLE STRUCTURES
-- ============================================================================

-- Get all columns with details
SELECT
    '=== TABLE: ' || table_name || ' ===' as info,
    column_name,
    data_type,
    CASE
        WHEN character_maximum_length IS NOT NULL
        THEN data_type || '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL
        THEN data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
        ELSE data_type
    END as full_type,
    column_default,
    is_nullable,
    CASE
        WHEN column_name LIKE '%_id' OR column_name = 'id' THEN 'PRIMARY/FOREIGN KEY'
        ELSE ''
    END as likely_key
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN (
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    )
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 3. PRIMARY KEYS
-- ============================================================================
SELECT
    '=== PRIMARY KEYS ===' as section,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- 4. FOREIGN KEYS
-- ============================================================================
SELECT
    '=== FOREIGN KEYS ===' as section,
    tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
SELECT
    '=== INDEXES ===' as section,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. VIEWS
-- ============================================================================
SELECT
    '=== VIEWS ===' as section,
    table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- 7. FUNCTIONS (RPC)
-- ============================================================================
SELECT
    '=== FUNCTIONS ===' as section,
    routine_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================
SELECT
    '=== TRIGGERS ===' as section,
    trigger_name,
    event_object_table as table_name,
    action_timing || ' ' || event_manipulation as timing_event,
    action_statement as trigger_action
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 9. CHECK CONSTRAINTS
-- ============================================================================
SELECT
    '=== CHECK CONSTRAINTS ===' as section,
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- 10. UNIQUE CONSTRAINTS
-- ============================================================================
SELECT
    '=== UNIQUE CONSTRAINTS ===' as section,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 11. TABLE COMMENTS
-- ============================================================================
SELECT
    '=== TABLE COMMENTS ===' as section,
    c.relname as table_name,
    d.description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND d.description IS NOT NULL
ORDER BY c.relname;

-- ============================================================================
-- 12. COLUMN COMMENTS
-- ============================================================================
SELECT
    '=== COLUMN COMMENTS ===' as section,
    c.relname as table_name,
    a.attname as column_name,
    d.description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND d.description IS NOT NULL
ORDER BY c.relname, a.attnum;

-- ============================================================================
-- 13. ENUM TYPES (if any)
-- ============================================================================
SELECT
    '=== ENUM TYPES ===' as section,
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

-- ============================================================================
-- 14. SEQUENCE INFO
-- ============================================================================
SELECT
    '=== SEQUENCES ===' as section,
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- ============================================================================
-- END OF SCHEMA EXPORT
-- ============================================================================

-- To save results: Copy all output and paste into a text file
-- Or use: psql -h your-host -U your-user -d your-db -f export-schema.sql > schema-export.txt
