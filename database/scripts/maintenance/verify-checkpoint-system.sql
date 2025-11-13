-- ============================================================================
-- CHECKPOINT SYSTEM VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify your setup
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'CHECKPOINT SYSTEM VERIFICATION';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 1. Check which account balance table exists
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_plural_exists BOOLEAN;
    v_singular_exists BOOLEAN;
BEGIN
    RAISE NOTICE '1. Checking account balance table...';

    -- Check for account_balances (plural)
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'account_balances'
    ) INTO v_plural_exists;

    -- Check for account_balance (singular)
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'account_balance'
    ) INTO v_singular_exists;

    IF v_plural_exists THEN
        RAISE NOTICE '   ✅ account_balances (plural) table EXISTS';
    ELSE
        RAISE NOTICE '   ❌ account_balances (plural) table NOT FOUND';
    END IF;

    IF v_singular_exists THEN
        RAISE NOTICE '   ✅ account_balance (singular) table EXISTS';
    ELSE
        RAISE NOTICE '   ❌ account_balance (singular) table NOT FOUND';
    END IF;

    IF v_plural_exists AND v_singular_exists THEN
        RAISE NOTICE '   ⚠️  WARNING: Both tables exist! This may cause confusion.';
    ELSIF NOT v_plural_exists AND NOT v_singular_exists THEN
        RAISE NOTICE '   ❌ ERROR: No account balance table found!';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 2. Check balance_checkpoints table
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_exists BOOLEAN;
    v_count INTEGER;
BEGIN
    RAISE NOTICE '2. Checking balance_checkpoints table...';

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'balance_checkpoints'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE '   ✅ balance_checkpoints table EXISTS';

        -- Count records
        SELECT COUNT(*) INTO v_count FROM balance_checkpoints;
        RAISE NOTICE '   📊 Contains % checkpoint(s)', v_count;
    ELSE
        RAISE NOTICE '   ❌ balance_checkpoints table NOT FOUND';
        RAISE NOTICE '   💡 You need to run migration: 003_add_balance_checkpoint_system.sql';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 3. Check original_transaction checkpoint columns
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_checkpoint_id_exists BOOLEAN;
    v_is_balance_adjustment_exists BOOLEAN;
    v_is_flagged_exists BOOLEAN;
BEGIN
    RAISE NOTICE '3. Checking original_transaction checkpoint columns...';

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'checkpoint_id'
    ) INTO v_checkpoint_id_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'is_balance_adjustment'
    ) INTO v_is_balance_adjustment_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'original_transaction' AND column_name = 'is_flagged'
    ) INTO v_is_flagged_exists;

    IF v_checkpoint_id_exists THEN
        RAISE NOTICE '   ✅ checkpoint_id column EXISTS';
    ELSE
        RAISE NOTICE '   ❌ checkpoint_id column NOT FOUND';
    END IF;

    IF v_is_balance_adjustment_exists THEN
        RAISE NOTICE '   ✅ is_balance_adjustment column EXISTS';
    ELSE
        RAISE NOTICE '   ❌ is_balance_adjustment column NOT FOUND';
    END IF;

    IF v_is_flagged_exists THEN
        RAISE NOTICE '   ✅ is_flagged column EXISTS';
    ELSE
        RAISE NOTICE '   ❌ is_flagged column NOT FOUND';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 4. Check required database functions
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_calc_balance_exists BOOLEAN;
    v_update_opening_exists BOOLEAN;
BEGIN
    RAISE NOTICE '4. Checking database functions...';

    SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'calculate_balance_up_to_date'
    ) INTO v_calc_balance_exists;

    SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'update_account_opening_balance_date'
    ) INTO v_update_opening_exists;

    IF v_calc_balance_exists THEN
        RAISE NOTICE '   ✅ calculate_balance_up_to_date() function EXISTS';
    ELSE
        RAISE NOTICE '   ❌ calculate_balance_up_to_date() function NOT FOUND';
    END IF;

    IF v_update_opening_exists THEN
        RAISE NOTICE '   ✅ update_account_opening_balance_date() function EXISTS';
    ELSE
        RAISE NOTICE '   ❌ update_account_opening_balance_date() function NOT FOUND';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 5. Check triggers
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    RAISE NOTICE '5. Checking triggers...';

    SELECT EXISTS (
        SELECT FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE t.tgname = 'transaction_checkpoint_recalc'
        AND c.relname = 'original_transaction'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE '   ✅ transaction_checkpoint_recalc trigger EXISTS';
    ELSE
        RAISE NOTICE '   ❌ transaction_checkpoint_recalc trigger NOT FOUND';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 6. Check accounts table checkpoint columns
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_opening_date_exists BOOLEAN;
    v_earliest_tx_exists BOOLEAN;
BEGIN
    RAISE NOTICE '6. Checking accounts table checkpoint columns...';

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'opening_balance_date'
    ) INTO v_opening_date_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'earliest_transaction_date'
    ) INTO v_earliest_tx_exists;

    IF v_opening_date_exists THEN
        RAISE NOTICE '   ✅ opening_balance_date column EXISTS';
    ELSE
        RAISE NOTICE '   ❌ opening_balance_date column NOT FOUND';
    END IF;

    IF v_earliest_tx_exists THEN
        RAISE NOTICE '   ✅ earliest_transaction_date column EXISTS';
    ELSE
        RAISE NOTICE '   ❌ earliest_transaction_date column NOT FOUND';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- 7. Test checkpoint creation (dry run)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_test_account_id INTEGER;
BEGIN
    RAISE NOTICE '7. Testing if checkpoint creation would work...';

    -- Get first account for testing
    SELECT account_id INTO v_test_account_id
    FROM accounts
    LIMIT 1;

    IF v_test_account_id IS NOT NULL THEN
        RAISE NOTICE '   ℹ️  Test account ID: %', v_test_account_id;

        -- Try to calculate balance (this will test if function works)
        BEGIN
            PERFORM calculate_balance_up_to_date(v_test_account_id, NOW());
            RAISE NOTICE '   ✅ calculate_balance_up_to_date() function WORKS';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ❌ calculate_balance_up_to_date() function FAILED: %', SQLERRM;
        END;

        -- Try to update opening balance date
        BEGIN
            PERFORM update_account_opening_balance_date(v_test_account_id);
            RAISE NOTICE '   ✅ update_account_opening_balance_date() function WORKS';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ❌ update_account_opening_balance_date() function FAILED: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '   ⚠️  No accounts found to test with';
    END IF;

    RAISE NOTICE '';
END $$;

-- ----------------------------------------------------------------------------
-- SUMMARY
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'VERIFICATION COMPLETE';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps based on results above:';
    RAISE NOTICE '';
    RAISE NOTICE 'If you see ❌ errors:';
    RAISE NOTICE '  1. Run migrations/003_add_balance_checkpoint_system.sql';
    RAISE NOTICE '  2. Verify table name (account_balances vs account_balance)';
    RAISE NOTICE '  3. Re-run this verification script';
    RAISE NOTICE '';
    RAISE NOTICE 'If everything shows ✅:';
    RAISE NOTICE '  1. Check browser console for errors when creating account';
    RAISE NOTICE '  2. Check Next.js server logs for checkpoint errors';
    RAISE NOTICE '  3. Try creating a test account with opening balance';
    RAISE NOTICE '';
    RAISE NOTICE '==============================================================';
END $$;
