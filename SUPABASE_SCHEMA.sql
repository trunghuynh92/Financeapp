-- Create entities table
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'personal')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_created_at ON entities(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can customize this based on your auth setup)
CREATE POLICY "Enable all access for all users" ON entities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FINANCE MANAGEMENT SYSTEM - TRANSACTION TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Account Table
-- Purpose: Store bank accounts or cash accounts for tracking transactions
-- ----------------------------------------------------------------------------
CREATE TABLE accounts (
  account_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('bank', 'cash', 'credit_card', 'investment')),
  bank_name VARCHAR(255),
  account_number VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'VND',
  current_balance DECIMAL(15,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_account_number UNIQUE (account_number, bank_name)
);

CREATE INDEX idx_accounts_entity ON accounts(entity_id);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_active ON accounts(is_active);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for accounts" ON accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Import_Batch Table
-- Purpose: Track CSV/Excel file import batches for audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE import_batch (
  import_batch_id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  import_file_name VARCHAR(255) NOT NULL,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  imported_by_user_id INTEGER,
  total_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  import_status VARCHAR(50) DEFAULT 'pending' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_batch_account ON import_batch(account_id);
CREATE INDEX idx_import_batch_date ON import_batch(import_date DESC);
CREATE INDEX idx_import_batch_status ON import_batch(import_status);

ALTER TABLE import_batch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for import_batch" ON import_batch
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Transaction Source ENUM Type
-- Purpose: Define valid transaction source types
-- ----------------------------------------------------------------------------
CREATE TYPE transaction_source_type AS ENUM (
  'imported_bank',      -- From bank CSV/Excel import
  'user_manual',        -- User created manually
  'system_opening',     -- System-generated opening balance
  'auto_adjustment'     -- Auto balance adjustment
);

-- ----------------------------------------------------------------------------
-- Original_transaction Table
-- Purpose: Store transaction data from TWO sources:
--   1. IMPORTED bank transactions (from CSV/Excel files)
--   2. USER-CREATED manual transactions (before splitting into Main_transaction)
--
-- This table serves as the source of truth for reconciliation.
-- It CAN be modified but changes are tracked via audit fields.
--
-- TWO MAIN USE CASES:
--
-- Case 1: Imported Bank Transactions
--   - Source: CSV/Excel bank statement files
--   - transaction_source = 'imported_bank'
--   - Has import_batch_id and import_file_name
--   - Example: Monthly Techcombank statement import
--
-- Case 2: User Manual Transactions
--   - Source: User creates transaction manually in UI
--   - transaction_source = 'user_manual'
--   - import_batch_id = NULL
--   - Example: "Paid 50M cash to contractor for renovating 3 stores"
--   - This stays in Original_transaction as single entry
--   - Later user splits it in Main_transaction by branches/categories
--
-- Case 3: System-Generated
--   - Opening balance transactions (transaction_source = 'system_opening')
--   - Balance adjustments (transaction_source = 'auto_adjustment')
--
-- CRITICAL WORKFLOW:
--   1. User creates manual transaction → Inserts into Original_transaction
--   2. User splits transaction by branches → Creates multiple rows in Main_transaction
--   3. All Main_transaction rows link back via raw_transaction_id
--   4. Original_transaction preserves the unsplit version
--
-- IMPORTANT RULES:
--   1. ✅ This table CAN be modified (not purely read-only)
--   2. ✅ Track all changes with updated_at and updated_by_user_id
--   3. ✅ Each row here has 1 or more corresponding rows in Main_transaction
--   4. ✅ User manual entries are created here FIRST, then split in Main_transaction
--   5. ✅ Imported bank transactions should rarely be modified
--   6. ✅ Auto-adjustments are system-created for balance reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE original_transaction (
  raw_transaction_id VARCHAR(100) PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  transaction_date TIMESTAMPTZ NOT NULL,
  description VARCHAR(500),
  debit_amount DECIMAL(15,2),
  credit_amount DECIMAL(15,2),
  balance DECIMAL(15,2),
  bank_reference VARCHAR(100),

  -- Source tracking
  transaction_source transaction_source_type DEFAULT 'user_manual',

  -- Import tracking
  import_batch_id INTEGER NULL REFERENCES import_batch(import_batch_id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  import_file_name VARCHAR(255),

  -- Audit trail
  created_by_user_id INTEGER,
  updated_at TIMESTAMPTZ NULL,
  updated_by_user_id INTEGER NULL,

  -- Validation: Either debit_amount OR credit_amount should be set, not both
  CONSTRAINT check_debit_or_credit CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL) OR
    (debit_amount IS NULL AND credit_amount IS NOT NULL)
  )
);

-- Create indexes for optimal query performance
CREATE INDEX idx_original_transaction_account_date ON original_transaction(account_id, transaction_date);
CREATE INDEX idx_original_transaction_imported ON original_transaction(imported_at);
CREATE INDEX idx_original_transaction_source ON original_transaction(transaction_source);
CREATE INDEX idx_original_transaction_batch ON original_transaction(import_batch_id);
CREATE INDEX idx_original_transaction_date ON original_transaction(transaction_date DESC);

-- Enable Row Level Security
ALTER TABLE original_transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for original_transaction" ON original_transaction
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for automatic updated_at timestamp
CREATE TRIGGER update_original_transaction_updated_at
  BEFORE UPDATE ON original_transaction
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
