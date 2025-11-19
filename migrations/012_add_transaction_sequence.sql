-- ============================================================================
-- MIGRATION 012: Add Transaction Sequence for Order Preservation
-- Purpose: Preserve the exact order of transactions from CSV imports
-- Why: Transaction order matters for balance calculations, especially when
--      multiple transactions occur on the same date
-- ============================================================================

-- Add transaction_sequence to original_transaction
ALTER TABLE original_transaction
ADD COLUMN transaction_sequence INTEGER;

COMMENT ON COLUMN original_transaction.transaction_sequence IS
'Preserves the original order of transactions from CSV import. Used for ordering transactions with the same date.';

-- Create index for efficient ordering queries
CREATE INDEX idx_original_transaction_order
ON original_transaction(account_id, transaction_date, transaction_sequence);

-- Update existing transactions to have sequence based on date + import batch + created_at
-- Sequence is GLOBAL per account, not per import batch
-- IMPORTANT: Balance adjustments are always LAST on their date
WITH ranked AS (
  SELECT
    raw_transaction_id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id
      ORDER BY
        transaction_date ASC,
        is_balance_adjustment ASC NULLS FIRST,  -- false before true
        COALESCE(import_batch_id, 999999) ASC,  -- manual transactions last
        created_at ASC,
        raw_transaction_id ASC
    ) as seq
  FROM original_transaction
)
UPDATE original_transaction ot
SET transaction_sequence = ranked.seq
FROM ranked
WHERE ot.raw_transaction_id = ranked.raw_transaction_id;

-- Update the calculate_balance_up_to_date function to order by sequence
CREATE OR REPLACE FUNCTION calculate_balance_up_to_date(
  p_account_id INTEGER,
  p_up_to_date TIMESTAMPTZ
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
BEGIN
  -- Calculate balance from all transactions up to the specified date
  -- Ordered by date, then sequence to maintain CSV order
  SELECT COALESCE(
    SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
    0
  )
  INTO v_balance
  FROM original_transaction
  WHERE account_id = p_account_id
    AND transaction_date <= p_up_to_date
    AND is_balance_adjustment = false
  ORDER BY transaction_date, transaction_sequence;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Update the main_transaction_details view to include sequence and other missing fields
-- This ensures the UI displays transactions in the correct order
DROP VIEW IF EXISTS main_transaction_details;

CREATE VIEW main_transaction_details AS
SELECT
  -- Main transaction fields (explicitly listed to avoid conflicts)
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.transaction_type_id,  -- IMPORTANT: Include the ID
  mt.category_id,
  mt.branch_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transfer_matched_transaction_id,
  mt.loan_id,
  mt.created_at,
  mt.updated_at,
  mt.created_by_user_id,
  mt.updated_by_user_id,

  -- Original transaction fields (including new transaction_sequence)
  ot.is_balance_adjustment,
  ot.checkpoint_id,
  ot.is_flagged,
  ot.import_batch_id,
  ot.transaction_sequence,

  -- Account info
  a.account_name,
  a.bank_name,
  a.account_type,

  -- Entity info (entities table uses id, name, type columns)
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,

  -- Transaction type info
  tt.type_code AS transaction_type_code,
  tt.type_display_name AS transaction_type,
  tt.affects_cashflow,

  -- Category info (optional)
  c.category_name,
  c.category_code,

  -- Branch info (optional)
  b.branch_name,
  b.branch_code

FROM main_transaction mt
INNER JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
INNER JOIN accounts a ON mt.account_id = a.account_id
INNER JOIN entities e ON a.entity_id = e.id
INNER JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id;

-- Add comment explaining the view
COMMENT ON VIEW main_transaction_details IS
'Complete view of main transactions with all related data including transaction_sequence for proper ordering.';

-- Create function to renumber transaction sequences globally for an account
-- This should be called after imports to ensure sequences are correct across all imports
-- IMPORTANT: Balance adjustments are always LAST on their date (critical for checkpoint calculations)
-- IMPORTANT: Preserves existing sequence for same-import transactions to maintain CSV order
CREATE OR REPLACE FUNCTION renumber_transaction_sequences(p_account_id INTEGER)
RETURNS void AS $$
BEGIN
  -- Renumber all transactions for the account in chronological order
  -- Order priority:
  -- 1. transaction_date (ascending)
  -- 2. is_balance_adjustment (false first, true last) - balance adjustments ALWAYS last on their date
  -- 3. import_batch_id (ascending) - earlier imports first
  -- 4. transaction_sequence (ascending) - PRESERVE CSV ORDER within same import!
  -- 5. created_at (ascending) - for transactions without import_batch_id (manual)
  -- 6. raw_transaction_id (ascending) - final tie-breaker
  WITH ranked AS (
    SELECT
      raw_transaction_id,
      ROW_NUMBER() OVER (
        ORDER BY
          transaction_date ASC,
          is_balance_adjustment ASC NULLS FIRST,  -- false (0) before true (1)
          COALESCE(import_batch_id, 999999) ASC,  -- NULL (manual) goes last
          transaction_sequence ASC NULLS LAST,    -- PRESERVE CSV ORDER!
          created_at ASC,
          raw_transaction_id ASC
      ) as new_seq
    FROM original_transaction
    WHERE account_id = p_account_id
  )
  UPDATE original_transaction ot
  SET transaction_sequence = ranked.new_seq
  FROM ranked
  WHERE ot.raw_transaction_id = ranked.raw_transaction_id
    AND ot.account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION renumber_transaction_sequences IS
'Renumbers transaction sequences globally for an account. Preserves CSV order within same import. Balance adjustments are always LAST on their date.';
