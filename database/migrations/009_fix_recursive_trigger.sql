-- ============================================================================
-- MIGRATION 009: Fix Recursive Trigger Issue
-- Purpose: Remove infinite recursion in validate_split_amounts trigger
-- ============================================================================

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS check_split_amounts ON main_transaction;

-- Step 2: Create a better version that doesn't cause recursion
-- This version only validates, doesn't update is_split
CREATE OR REPLACE FUNCTION validate_split_amounts()
RETURNS TRIGGER AS $$
DECLARE
  original_amount DECIMAL(15,2);
  split_sum DECIMAL(15,2);
  split_count INTEGER;
BEGIN
  -- Get original transaction amount (debit or credit)
  SELECT COALESCE(debit_amount, credit_amount, 0)
  INTO original_amount
  FROM original_transaction
  WHERE raw_transaction_id = NEW.raw_transaction_id;

  -- Sum all main_transactions for this raw_transaction_id
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO split_sum, split_count
  FROM main_transaction
  WHERE raw_transaction_id = NEW.raw_transaction_id;

  -- Check if sum matches original (allow 1 cent tolerance for rounding)
  IF ABS(split_sum - original_amount) > 0.01 THEN
    RAISE EXCEPTION 'Split amounts (%) must sum to original transaction amount (%)', split_sum, original_amount;
  END IF;

  -- Don't update is_split here - avoid recursion
  -- is_split will be set manually when creating splits

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Re-create trigger (only validates, no UPDATE)
CREATE TRIGGER check_split_amounts
AFTER INSERT OR UPDATE ON main_transaction
FOR EACH ROW
EXECUTE FUNCTION validate_split_amounts();

-- Step 4: Now run the backfill (should work without recursion)
SELECT * FROM backfill_main_transactions();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check results
SELECT
  (SELECT COUNT(*) FROM original_transaction) as original_count,
  (SELECT COUNT(*) FROM main_transaction) as main_count;

-- Check for any unprocessed
SELECT * FROM get_unprocessed_originals();
