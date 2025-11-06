-- ============================================================================
-- MIGRATION 008: Optimized Backfill for main_transaction
-- Purpose: Fast batch insert instead of looping (prevents timeouts)
-- ============================================================================

-- Drop the old slow function
DROP FUNCTION IF EXISTS backfill_main_transactions();

-- Create optimized backfill using single INSERT statement
CREATE OR REPLACE FUNCTION backfill_main_transactions()
RETURNS TABLE (
  processed_count INTEGER,
  error_count INTEGER,
  errors TEXT[]
) AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Single batch INSERT - much faster than looping
  INSERT INTO main_transaction (
    raw_transaction_id,
    account_id,
    transaction_type_id,
    amount,
    transaction_direction,
    transaction_date,
    description,
    is_split,
    split_sequence,
    created_by_user_id
  )
  SELECT
    ot.raw_transaction_id,
    ot.account_id,
    -- Default type: Expense for debit, Income for credit
    CASE
      WHEN ot.debit_amount IS NOT NULL THEN
        (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP' LIMIT 1)
      ELSE
        (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC' LIMIT 1)
    END as transaction_type_id,
    -- Amount: debit or credit (always positive)
    COALESCE(ot.debit_amount, ot.credit_amount) as amount,
    -- Direction: debit or credit
    CASE
      WHEN ot.debit_amount IS NOT NULL THEN 'debit'
      ELSE 'credit'
    END as transaction_direction,
    ot.transaction_date,
    ot.description,
    false as is_split,
    1 as split_sequence,
    ot.created_by_user_id
  FROM original_transaction ot
  WHERE NOT EXISTS (
    SELECT 1
    FROM main_transaction mt
    WHERE mt.raw_transaction_id = ot.raw_transaction_id
  )
  AND (ot.debit_amount IS NOT NULL OR ot.credit_amount IS NOT NULL);

  -- Get count of inserted rows
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Return success
  RETURN QUERY SELECT inserted_count, 0::INTEGER, ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RUN BACKFILL NOW (optimized version)
-- ============================================================================

SELECT * FROM backfill_main_transactions();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check counts
-- SELECT COUNT(*) as original_count FROM original_transaction;
-- SELECT COUNT(*) as main_count FROM main_transaction;
-- SELECT * FROM get_unprocessed_originals();
