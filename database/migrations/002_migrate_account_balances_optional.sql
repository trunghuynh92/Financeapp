-- ============================================================================
-- OPTIONAL MIGRATION: Convert account_balances to Historical Tracking
-- ============================================================================
-- WARNING: This is OPTIONAL. Only run if you want historical balance tracking.
--
-- Current: account_balances stores ONE balance per account
-- After:   account_balance stores MULTIPLE balance snapshots per account
--
-- Benefits of historical tracking:
--   ✅ Track opening/closing balances for reconciliation
--   ✅ Store multiple balance snapshots over time
--   ✅ Audit trail of balance changes
--   ✅ Support daily balance records
--
-- If you're happy with the current simple design (one balance per account),
-- you DON'T need to run this migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Backup existing data
-- ----------------------------------------------------------------------------
-- Create a backup of current account_balances data
CREATE TABLE IF NOT EXISTS account_balances_backup AS
SELECT * FROM account_balances;

RAISE NOTICE 'Created backup table: account_balances_backup';

-- ----------------------------------------------------------------------------
-- STEP 2: Create new account_balance table (historical tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_balance (
  balance_id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  balance_date TIMESTAMPTZ NOT NULL,
  balance_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  balance_type VARCHAR(50) NOT NULL CHECK (balance_type IN ('opening', 'closing', 'current', 'reconciled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id INTEGER,

  -- Ensure one balance record per account per date per type
  CONSTRAINT unique_account_balance_date_type UNIQUE (account_id, balance_date, balance_type)
);

RAISE NOTICE 'Created new account_balance table for historical tracking';

-- ----------------------------------------------------------------------------
-- STEP 3: Migrate existing data from account_balances to account_balance
-- ----------------------------------------------------------------------------
-- Convert each existing balance record to a 'current' balance type
INSERT INTO account_balance (account_id, balance_date, balance_amount, balance_type, notes)
SELECT
  account_id,
  last_updated AS balance_date,
  current_balance AS balance_amount,
  'current' AS balance_type,
  'Migrated from account_balances table' AS notes
FROM account_balances
ON CONFLICT (account_id, balance_date, balance_type) DO NOTHING;

RAISE NOTICE 'Migrated existing balance data to account_balance table';

-- ----------------------------------------------------------------------------
-- STEP 4: Create indexes on new account_balance table
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_account_balance_account ON account_balance(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_date ON account_balance(balance_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_balance_account_date ON account_balance(account_id, balance_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_balance_type ON account_balance(balance_type);

RAISE NOTICE 'Created indexes on account_balance table';

-- ----------------------------------------------------------------------------
-- STEP 5: Enable Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE account_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for account_balance" ON account_balance
  FOR ALL
  USING (true)
  WITH CHECK (true);

RAISE NOTICE 'Enabled RLS on account_balance table';

-- ----------------------------------------------------------------------------
-- STEP 6: Add trigger for automatic updated_at timestamp
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_account_balance_updated_at ON account_balance;
CREATE TRIGGER update_account_balance_updated_at
  BEFORE UPDATE ON account_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE 'Created updated_at trigger on account_balance table';

-- ----------------------------------------------------------------------------
-- STEP 7: Rename old table (don't drop it yet, keep for safety)
-- ----------------------------------------------------------------------------
-- Rename old table to _deprecated for safety
ALTER TABLE account_balances RENAME TO account_balances_deprecated;

RAISE NOTICE 'Renamed old account_balances table to account_balances_deprecated';

-- ----------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Account Balance Migration completed successfully!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '  ✅ Created new account_balance table with historical tracking';
    RAISE NOTICE '  ✅ Migrated existing data from account_balances';
    RAISE NOTICE '  ✅ Created all indexes for performance';
    RAISE NOTICE '  ✅ Enabled Row Level Security';
    RAISE NOTICE '  ✅ Added updated_at trigger';
    RAISE NOTICE '  ✅ Renamed old table to account_balances_deprecated';
    RAISE NOTICE '';
    RAISE NOTICE 'Old table preserved as: account_balances_deprecated';
    RAISE NOTICE 'Backup table created as: account_balances_backup';
    RAISE NOTICE '';
    RAISE NOTICE 'New features available:';
    RAISE NOTICE '  - Track opening/closing balances';
    RAISE NOTICE '  - Store multiple balance snapshots';
    RAISE NOTICE '  - Balance types: opening, closing, current, reconciled';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update your application code to use account_balance table';
    RAISE NOTICE '  2. Test the new table thoroughly';
    RAISE NOTICE '  3. Once confirmed working, drop deprecated tables:';
    RAISE NOTICE '     DROP TABLE account_balances_deprecated;';
    RAISE NOTICE '     DROP TABLE account_balances_backup;';
    RAISE NOTICE '============================================================';
END $$;

-- ----------------------------------------------------------------------------
-- USAGE EXAMPLES FOR NEW account_balance TABLE
-- ----------------------------------------------------------------------------

-- Example 1: Record opening balance
-- INSERT INTO account_balance (account_id, balance_date, balance_amount, balance_type, notes, created_by_user_id)
-- VALUES (1, '2024-11-01 00:00:00+07', 500000000.00, 'opening', 'November opening balance', 1001);

-- Example 2: Record closing balance
-- INSERT INTO account_balance (account_id, balance_date, balance_amount, balance_type, notes, created_by_user_id)
-- VALUES (1, '2024-11-30 23:59:59+07', 506950000.00, 'closing', 'November closing balance', 1001);

-- Example 3: Get current balance for an account
-- SELECT balance_amount, balance_date, balance_type
-- FROM account_balance
-- WHERE account_id = 1
-- ORDER BY balance_date DESC
-- LIMIT 1;

-- Example 4: Get balance history for an account
-- SELECT balance_date, balance_amount, balance_type, notes
-- FROM account_balance
-- WHERE account_id = 1
-- ORDER BY balance_date DESC;

-- Example 5: Get all accounts with their latest balances
-- SELECT
--   a.account_id,
--   a.account_name,
--   ab.balance_amount as current_balance,
--   ab.balance_date as last_updated
-- FROM accounts a
-- LEFT JOIN LATERAL (
--   SELECT balance_amount, balance_date
--   FROM account_balance
--   WHERE account_id = a.account_id
--   ORDER BY balance_date DESC
--   LIMIT 1
-- ) ab ON true
-- WHERE a.is_active = true;
