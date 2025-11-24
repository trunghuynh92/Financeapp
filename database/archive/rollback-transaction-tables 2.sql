-- ============================================================================
-- ROLLBACK SCRIPT FOR TRANSACTION TABLES
-- ============================================================================
-- Purpose: This script removes all transaction-related tables added to the schema
-- Use this if you need to revert the changes made by SUPABASE_SCHEMA.sql
--
-- WARNING: This will permanently delete all data in these tables!
-- Make sure to backup your data before running this script.
-- ============================================================================

-- Drop tables in reverse order to respect foreign key dependencies
-- Start with the most dependent table first

-- Drop Original_transaction table
DROP TABLE IF EXISTS original_transaction CASCADE;

-- Drop Import_Batch table
DROP TABLE IF EXISTS import_batch CASCADE;

-- Drop Account_Balance table
DROP TABLE IF EXISTS account_balance CASCADE;

-- Drop Accounts table
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop custom ENUM type
DROP TYPE IF EXISTS transaction_source_type CASCADE;

-- Note: The update_updated_at_column() function is still preserved
-- as it's used by the entities table as well.
-- If you want to remove it, uncomment the line below:
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this script, verify the tables are removed by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================================
