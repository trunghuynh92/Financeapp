-- ============================================================================
-- ORIGINAL_TRANSACTION TABLE - USAGE EXAMPLES
-- ============================================================================
-- This file demonstrates how to use the Original_transaction table for:
-- 1. User Manual Transactions
-- 2. Imported Bank Transactions
-- 3. System-Generated Transactions
-- ============================================================================

-- ============================================================================
-- SETUP: Create sample data for testing
-- ============================================================================

-- Step 1: Create a test entity (company)
INSERT INTO entities (id, name, type, description)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tech Coffee Shop', 'company', 'Coffee shop chain with multiple branches');

-- Step 2: Create test accounts
INSERT INTO accounts (account_id, entity_id, account_name, account_type, bank_name, account_number, currency)
VALUES
  (1, '11111111-1111-1111-1111-111111111111', 'Techcombank Business Account', 'bank', 'Techcombank', '19036521488888', 'VND'),
  (2, '11111111-1111-1111-1111-111111111111', 'Cash Register - District 1 Store', 'cash', NULL, NULL, 'VND');

-- Step 3: Create initial balance records
INSERT INTO account_balance (account_id, balance_date, balance_amount, balance_type, notes, created_by_user_id)
VALUES
  (1, '2024-11-01 00:00:00+07', 500000000.00, 'opening', 'Opening balance for Nov 2024', 1001),
  (2, '2024-11-01 00:00:00+07', 150000000.00, 'opening', 'Opening balance for Nov 2024', 1001);

-- ============================================================================
-- EXAMPLE 1: USER MANUAL TRANSACTION
-- ============================================================================
-- Use Case: User manually creates a transaction for cash payment to contractor
-- This transaction will later be split in Main_transaction by branches/categories
-- ============================================================================

INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'MANUAL_USER_20250101_001',           -- Unique ID for manual transaction
  2,                                     -- Cash account
  '2025-01-01 14:30:00+07',             -- Transaction date
  'Paid contractor for renovating 3 stores: Dist1, Dist2, Dist3', -- Description
  50000000.00,                           -- Debit amount (money OUT)
  NULL,                                  -- Credit amount (NULL for debit)
  100000000.00,                          -- Running balance after transaction
  NULL,                                  -- No bank reference for manual entry
  'user_manual',                         -- Source: manually created by user
  NULL,                                  -- No import batch (manual entry)
  NOW(),                                 -- Created now
  NULL,                                  -- No import file (manual entry)
  1001,                                  -- User ID who created this
  NULL,                                  -- Not yet updated
  NULL                                   -- No updater yet
);

-- ============================================================================
-- EXAMPLE 2: USER MANUAL TRANSACTION - Income
-- ============================================================================
-- Use Case: User records cash income from daily sales
-- ============================================================================

INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'MANUAL_USER_20250102_001',
  2,                                     -- Cash account
  '2025-01-02 18:00:00+07',
  'Daily cash sales - District 1 Store',
  NULL,                                  -- Debit amount (NULL for credit)
  15000000.00,                           -- Credit amount (money IN)
  115000000.00,                          -- Running balance
  NULL,
  'user_manual',                         -- Manually entered by user
  NULL,
  NOW(),
  NULL,
  1001,
  NULL,
  NULL
);

-- ============================================================================
-- EXAMPLE 3: IMPORTED BANK TRANSACTIONS
-- ============================================================================
-- Use Case: Import transactions from Techcombank monthly statement CSV
-- Step 1: Create an import batch record
-- Step 2: Insert multiple transactions from the import
-- ============================================================================

-- Step 1: Create import batch
INSERT INTO import_batch (
  import_batch_id,
  account_id,
  import_file_name,
  import_date,
  imported_by_user_id,
  total_records,
  successful_records,
  failed_records,
  import_status,
  error_log
) VALUES (
  1,
  1,                                     -- Techcombank account
  'techcombank_statement_2024_11.csv',
  NOW(),
  1001,                                  -- User who imported
  3,                                     -- Total records in CSV
  3,                                     -- Successfully imported
  0,                                     -- Failed records
  'completed',
  NULL
);

-- Step 2: Insert imported transactions
-- Transaction 1: Incoming transfer
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'TECH_NOV_001',                        -- Transaction ID from bank statement
  1,                                     -- Techcombank account
  '2024-11-15 09:15:00+07',
  'Transfer from customer - Invoice #INV-2024-001',
  NULL,                                  -- No debit (money coming in)
  25000000.00,                           -- Credit amount (money IN)
  525000000.00,                          -- Balance after transaction
  'FT24111500123456',                    -- Bank reference number
  'imported_bank',                       -- Source: imported from bank
  1,                                     -- Links to import batch
  NOW(),
  'techcombank_statement_2024_11.csv',
  1001,
  NULL,
  NULL
);

-- Transaction 2: Outgoing payment
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'TECH_NOV_002',
  1,
  '2024-11-20 14:30:00+07',
  'Payment to supplier - Coffee beans order',
  18000000.00,                           -- Debit amount (money OUT)
  NULL,                                  -- No credit
  507000000.00,
  'FT24112000987654',
  'imported_bank',
  1,
  NOW(),
  'techcombank_statement_2024_11.csv',
  1001,
  NULL,
  NULL
);

-- Transaction 3: Bank fee
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'TECH_NOV_003',
  1,
  '2024-11-30 23:59:00+07',
  'Monthly account maintenance fee',
  50000.00,                              -- Small debit for bank fee
  NULL,
  506950000.00,
  'FEE24113000001',
  'imported_bank',
  1,
  NOW(),
  'techcombank_statement_2024_11.csv',
  1001,
  NULL,
  NULL
);

-- ============================================================================
-- EXAMPLE 4: SYSTEM-GENERATED TRANSACTIONS
-- ============================================================================
-- Use Case 1: Opening balance when account is first created
-- ============================================================================

INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'SYSTEM_OPENING_ACC1_20250101',
  1,
  '2025-01-01 00:00:00+07',
  'Opening balance for Techcombank Business Account',
  NULL,
  500000000.00,                          -- Starting balance
  500000000.00,
  NULL,
  'system_opening',                      -- System-generated opening balance
  NULL,
  NOW(),
  NULL,
  NULL,                                  -- System-generated (no user)
  NULL,
  NULL
);

-- Use Case 2: Auto balance adjustment for reconciliation
INSERT INTO original_transaction (
  raw_transaction_id,
  account_id,
  transaction_date,
  description,
  debit_amount,
  credit_amount,
  balance,
  bank_reference,
  transaction_source,
  import_batch_id,
  imported_at,
  import_file_name,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) VALUES (
  'SYSTEM_ADJUST_ACC2_20250115',
  2,
  '2025-01-15 12:00:00+07',
  'Balance adjustment - Reconciliation discrepancy correction',
  NULL,
  500000.00,                             -- Adjustment amount
  115500000.00,
  NULL,
  'auto_adjustment',                     -- Auto adjustment
  NULL,
  NOW(),
  NULL,
  NULL,
  NULL,
  NULL
);

-- ============================================================================
-- EXAMPLE 5: UPDATING AN EXISTING TRANSACTION
-- ============================================================================
-- Use Case: User realizes they made a mistake in manual entry and needs to correct it
-- ============================================================================

UPDATE original_transaction
SET
  description = 'Paid contractor for renovating 3 stores: Dist1, Dist2, Dist3 - CORRECTED AMOUNT',
  debit_amount = 52000000.00,            -- Corrected amount
  balance = 98000000.00,                 -- Corrected balance
  updated_by_user_id = 1001              -- Track who made the update
WHERE raw_transaction_id = 'MANUAL_USER_20250101_001';

-- Note: updated_at will be automatically set by the trigger

-- ============================================================================
-- EXAMPLE QUERIES FOR COMMON USE CASES
-- ============================================================================

-- Query 1: Get all manual transactions for an account
SELECT * FROM original_transaction
WHERE account_id = 2
  AND transaction_source = 'user_manual'
ORDER BY transaction_date DESC;

-- Query 2: Get all transactions from a specific import batch
SELECT * FROM original_transaction
WHERE import_batch_id = 1
ORDER BY transaction_date;

-- Query 3: Get all transactions for an account in a date range
SELECT * FROM original_transaction
WHERE account_id = 1
  AND transaction_date BETWEEN '2024-11-01' AND '2024-11-30'
ORDER BY transaction_date;

-- Query 4: Calculate total debits and credits for an account
SELECT
  account_id,
  SUM(debit_amount) as total_debits,
  SUM(credit_amount) as total_credits,
  SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)) as net_change
FROM original_transaction
WHERE account_id = 1
GROUP BY account_id;

-- Query 5: Get all transactions with their import batch information
SELECT
  ot.raw_transaction_id,
  ot.transaction_date,
  ot.description,
  ot.debit_amount,
  ot.credit_amount,
  ot.transaction_source,
  ib.import_file_name,
  ib.import_date
FROM original_transaction ot
LEFT JOIN import_batch ib ON ot.import_batch_id = ib.import_batch_id
WHERE ot.account_id = 1
ORDER BY ot.transaction_date DESC;

-- Query 6: Get transaction count by source type
SELECT
  transaction_source,
  COUNT(*) as transaction_count,
  SUM(debit_amount) as total_debits,
  SUM(credit_amount) as total_credits
FROM original_transaction
GROUP BY transaction_source;

-- Query 7: Find transactions that have been modified
SELECT
  raw_transaction_id,
  description,
  transaction_date,
  debit_amount,
  credit_amount,
  imported_at as created_at,
  updated_at,
  updated_by_user_id
FROM original_transaction
WHERE updated_at IS NOT NULL
ORDER BY updated_at DESC;

-- ============================================================================
-- ACCOUNT BALANCE QUERIES
-- ============================================================================

-- Query 8: Get current balance for an account
SELECT
  ab.account_id,
  a.account_name,
  ab.balance_amount,
  ab.balance_date,
  ab.balance_type
FROM account_balance ab
JOIN accounts a ON ab.account_id = a.account_id
WHERE ab.account_id = 1
ORDER BY ab.balance_date DESC
LIMIT 1;

-- Query 9: Get balance history for an account
SELECT
  balance_date,
  balance_amount,
  balance_type,
  notes,
  created_at
FROM account_balance
WHERE account_id = 1
ORDER BY balance_date DESC;

-- Query 10: Get all accounts with their latest balances
SELECT
  a.account_id,
  a.account_name,
  a.account_type,
  a.bank_name,
  ab.balance_amount as current_balance,
  ab.balance_date as last_updated,
  ab.balance_type
FROM accounts a
LEFT JOIN LATERAL (
  SELECT balance_amount, balance_date, balance_type
  FROM account_balance
  WHERE account_id = a.account_id
  ORDER BY balance_date DESC
  LIMIT 1
) ab ON true
WHERE a.is_active = true
ORDER BY a.account_name;

-- Query 11: Record end-of-day closing balance
INSERT INTO account_balance (account_id, balance_date, balance_amount, balance_type, notes, created_by_user_id)
VALUES (1, '2024-11-30 23:59:59+07', 506950000.00, 'closing', 'End of month closing balance', 1001);

-- Query 12: Get balance reconciliation report (compare opening vs closing)
SELECT
  a.account_name,
  opening.balance_amount as opening_balance,
  closing.balance_amount as closing_balance,
  closing.balance_amount - opening.balance_amount as net_change,
  opening.balance_date as period_start,
  closing.balance_date as period_end
FROM accounts a
LEFT JOIN LATERAL (
  SELECT balance_amount, balance_date
  FROM account_balance
  WHERE account_id = a.account_id AND balance_type = 'opening'
  ORDER BY balance_date DESC
  LIMIT 1
) opening ON true
LEFT JOIN LATERAL (
  SELECT balance_amount, balance_date
  FROM account_balance
  WHERE account_id = a.account_id AND balance_type = 'closing'
  ORDER BY balance_date DESC
  LIMIT 1
) closing ON true
WHERE a.is_active = true;

-- ============================================================================
-- WORKFLOW EXAMPLE: Manual Transaction → Split in Main_transaction
-- ============================================================================
-- This demonstrates the two-table system workflow:
-- 1. User creates manual transaction in Original_transaction (above)
-- 2. User splits it into multiple Main_transaction rows (future table)
--
-- Example: The 50M contractor payment is split across 3 stores:
--
-- Main_transaction would contain:
--   - raw_transaction_id: 'MANUAL_USER_20250101_001' (links back)
--   - Branch: District 1 Store, Amount: 20,000,000 VND
--   - Branch: District 2 Store, Amount: 15,000,000 VND
--   - Branch: District 3 Store, Amount: 15,000,000 VND
--   - Total: 50,000,000 VND (matches Original_transaction)
--
-- Original_transaction preserves the single 50M entry for reconciliation
-- ============================================================================
