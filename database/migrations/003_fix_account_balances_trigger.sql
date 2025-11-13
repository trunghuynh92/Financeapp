-- Fix for account_balances trigger error
-- Add updated_at column to account_balances table

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'account_balances'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE account_balances
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

        RAISE NOTICE 'Added updated_at column to account_balances table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in account_balances table';
    END IF;
END $$;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS update_account_balance_updated_at ON account_balances;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_account_balance_updated_at
    BEFORE UPDATE ON account_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Account balances trigger fix applied successfully!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '  ✅ Added updated_at column to account_balances (if missing)';
    RAISE NOTICE '  ✅ Created/updated trigger function';
    RAISE NOTICE '  ✅ Created trigger to auto-update updated_at column';
    RAISE NOTICE '';
    RAISE NOTICE 'The balance update endpoint should now work correctly.';
    RAISE NOTICE '============================================================';
END $$;
