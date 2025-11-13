-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after running the migration to verify everything is correct
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Verify original_transaction table structure
-- ----------------------------------------------------------------------------
SELECT
    'original_transaction columns' AS check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'original_transaction'
ORDER BY ordinal_position;

-- Expected columns:
-- raw_transaction_id, account_id, transaction_date, description,
-- debit_amount, credit_amount, balance, bank_reference, created_at,
-- transaction_source, import_batch_id, imported_at, import_file_name,
-- created_by_user_id, updated_at, updated_by_user_id

-- ----------------------------------------------------------------------------
-- 2. Verify transaction_source_type ENUM exists
-- ----------------------------------------------------------------------------
SELECT
    'ENUM values' AS check_type,
    enumlabel AS enum_value
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'transaction_source_type'
ORDER BY enumsortorder;

-- Expected values:
-- imported_bank, user_manual, system_opening, auto_adjustment

-- ----------------------------------------------------------------------------
-- 3. Verify indexes on original_transaction
-- ----------------------------------------------------------------------------
SELECT
    'original_transaction indexes' AS check_type,
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE tablename = 'original_transaction'
ORDER BY indexname;

-- Expected indexes:
-- idx_original_transaction_account_date
-- idx_original_transaction_batch
-- idx_original_transaction_date
-- idx_original_transaction_imported
-- idx_original_transaction_source
-- original_transaction_pkey (primary key)

-- ----------------------------------------------------------------------------
-- 4. Verify constraints on original_transaction
-- ----------------------------------------------------------------------------
SELECT
    'original_transaction constraints' AS check_type,
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'original_transaction'::regclass
ORDER BY conname;

-- Expected constraints:
-- check_debit_or_credit (CHECK constraint)
-- original_transaction_account_id_fkey (FOREIGN KEY)
-- original_transaction_import_batch_id_fkey (FOREIGN KEY)
-- original_transaction_pkey (PRIMARY KEY)

-- ----------------------------------------------------------------------------
-- 5. Verify foreign keys
-- ----------------------------------------------------------------------------
SELECT
    'Foreign keys' AS check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('original_transaction', 'accounts', 'import_batch')
ORDER BY tc.table_name, kcu.column_name;

-- ----------------------------------------------------------------------------
-- 6. Verify triggers exist
-- ----------------------------------------------------------------------------
SELECT
    'Triggers' AS check_type,
    trigger_name,
    event_object_table AS table_name,
    action_statement AS trigger_function
FROM information_schema.triggers
WHERE trigger_name LIKE '%updated_at%'
ORDER BY event_object_table;

-- Expected triggers on:
-- entities, accounts, original_transaction, account_balances (or account_balance)

-- ----------------------------------------------------------------------------
-- 7. Verify indexes on other tables
-- ----------------------------------------------------------------------------
SELECT
    'All indexes' AS check_type,
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('accounts', 'import_batch', 'entities', 'original_transaction')
ORDER BY tablename, indexname;

-- ----------------------------------------------------------------------------
-- 8. Count records in each table
-- ----------------------------------------------------------------------------
SELECT 'entities' AS table_name, COUNT(*) AS record_count FROM entities
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'account_balances', COUNT(*) FROM account_balances
UNION ALL
SELECT 'import_batch', COUNT(*) FROM import_batch
UNION ALL
SELECT 'original_transaction', COUNT(*) FROM original_transaction
ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- 9. Sample query: Test transaction source filtering
-- ----------------------------------------------------------------------------
SELECT
    'Transaction source distribution' AS check_type,
    transaction_source,
    COUNT(*) AS count
FROM original_transaction
GROUP BY transaction_source
ORDER BY transaction_source;

-- ----------------------------------------------------------------------------
-- 10. Sample query: Test account with balances
-- ----------------------------------------------------------------------------
SELECT
    'Accounts with balances' AS check_type,
    a.account_id,
    a.account_name,
    a.account_type,
    ab.current_balance,
    ab.last_updated
FROM accounts a
LEFT JOIN account_balances ab ON a.account_id = ab.account_id
ORDER BY a.account_id
LIMIT 5;

-- ----------------------------------------------------------------------------
-- 11. Test debit/credit constraint (should FAIL)
-- ----------------------------------------------------------------------------
-- Uncomment to test - this should produce an error
-- INSERT INTO original_transaction (
--     raw_transaction_id, account_id, transaction_date,
--     debit_amount, credit_amount
-- ) VALUES (
--     'TEST_INVALID', 1, NOW(),
--     100.00, 200.00  -- Both debit AND credit (should fail)
-- );

-- ----------------------------------------------------------------------------
-- 12. Test debit/credit constraint (should SUCCEED)
-- ----------------------------------------------------------------------------
-- Uncomment to test - this should work
-- INSERT INTO original_transaction (
--     raw_transaction_id, account_id, transaction_date,
--     debit_amount, credit_amount, transaction_source
-- ) VALUES (
--     'TEST_VALID_DEBIT', 1, NOW(),
--     100.00, NULL, 'user_manual'  -- Only debit (should succeed)
-- );

-- Don't forget to clean up test data:
-- DELETE FROM original_transaction WHERE raw_transaction_id LIKE 'TEST_%';

-- ----------------------------------------------------------------------------
-- 13. Verify all expected columns exist
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    missing_cols TEXT[] := ARRAY[]::TEXT[];
    expected_cols TEXT[] := ARRAY[
        'raw_transaction_id',
        'account_id',
        'transaction_date',
        'description',
        'debit_amount',
        'credit_amount',
        'balance',
        'bank_reference',
        'created_at',
        'transaction_source',
        'import_batch_id',
        'imported_at',
        'import_file_name',
        'created_by_user_id',
        'updated_at',
        'updated_by_user_id'
    ];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY expected_cols
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'original_transaction'
            AND column_name = col
        ) THEN
            missing_cols := array_append(missing_cols, col);
        END IF;
    END LOOP;

    IF array_length(missing_cols, 1) > 0 THEN
        RAISE WARNING 'Missing columns in original_transaction: %', array_to_string(missing_cols, ', ');
    ELSE
        RAISE NOTICE '✅ All expected columns exist in original_transaction table';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 14. Verify all expected indexes exist
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    missing_idx TEXT[] := ARRAY[]::TEXT[];
    expected_idx TEXT[] := ARRAY[
        'idx_original_transaction_account_date',
        'idx_original_transaction_batch',
        'idx_original_transaction_date',
        'idx_original_transaction_imported',
        'idx_original_transaction_source'
    ];
    idx TEXT;
BEGIN
    FOREACH idx IN ARRAY expected_idx
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'original_transaction'
            AND indexname = idx
        ) THEN
            missing_idx := array_append(missing_idx, idx);
        END IF;
    END LOOP;

    IF array_length(missing_idx, 1) > 0 THEN
        RAISE WARNING 'Missing indexes on original_transaction: %', array_to_string(missing_idx, ', ');
    ELSE
        RAISE NOTICE '✅ All expected indexes exist on original_transaction table';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICATION COMPLETE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Review the query results above to verify:';
    RAISE NOTICE '  1. All columns exist in original_transaction';
    RAISE NOTICE '  2. transaction_source_type ENUM has 4 values';
    RAISE NOTICE '  3. All 5 indexes created on original_transaction';
    RAISE NOTICE '  4. check_debit_or_credit constraint exists';
    RAISE NOTICE '  5. Foreign keys to accounts and import_batch';
    RAISE NOTICE '  6. Triggers exist on all tables';
    RAISE NOTICE '============================================================';
END $$;
