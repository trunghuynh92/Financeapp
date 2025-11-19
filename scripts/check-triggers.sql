-- Check for triggers on original_transaction table
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'original_transaction'
ORDER BY trigger_name;

-- Check for the auto_maintain_main_transaction function
SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%main_transaction%'
    AND routine_schema = 'public';
