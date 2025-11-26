-- Migration: Sync manual transaction edits (date, amount, account) from original_transaction to main_transaction
-- Purpose: Allow editing date, amount, and account for manual transactions

-- ==============================================================================
-- ENHANCED TRIGGER: Sync main_transaction when original_transaction is edited
-- ==============================================================================

-- Drop old trigger and function
DROP TRIGGER IF EXISTS sync_main_transaction_amount_trigger ON original_transaction;
DROP FUNCTION IF EXISTS sync_main_transaction_amount();

-- Create enhanced sync function
CREATE OR REPLACE FUNCTION sync_main_transaction_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_old_amount NUMERIC;
  v_new_amount NUMERIC;
  v_direction TEXT;
  v_has_changes BOOLEAN := false;
BEGIN
  -- Determine old and new amounts
  v_old_amount := COALESCE(OLD.debit_amount, OLD.credit_amount);
  v_new_amount := COALESCE(NEW.debit_amount, NEW.credit_amount);
  v_direction := CASE
    WHEN NEW.debit_amount IS NOT NULL THEN 'debit'
    ELSE 'credit'
  END;

  -- Check if any relevant fields changed
  IF (v_old_amount IS DISTINCT FROM v_new_amount) OR
     (OLD.transaction_date IS DISTINCT FROM NEW.transaction_date) OR
     (OLD.account_id IS DISTINCT FROM NEW.account_id) THEN
    v_has_changes := true;
  END IF;

  -- Only proceed if something actually changed
  IF v_has_changes THEN

    -- Check if splits exist for this transaction (only for amount changes)
    IF (v_old_amount IS DISTINCT FROM v_new_amount) AND EXISTS (
      SELECT 1 FROM main_transaction
      WHERE raw_transaction_id = NEW.raw_transaction_id
      AND is_split = true
    ) THEN
      -- Splits exist - prevent the amount update
      RAISE EXCEPTION 'Cannot modify original_transaction amount when splits exist. Unsplit the transaction first.';
    END IF;

    -- Update main_transaction with all changed fields
    UPDATE main_transaction
    SET
      amount = v_new_amount,
      transaction_direction = v_direction,
      transaction_date = NEW.transaction_date,
      account_id = NEW.account_id,
      updated_at = NOW()
    WHERE raw_transaction_id = NEW.raw_transaction_id
    AND is_split = false;

    -- If no rows were updated (e.g., no main_transaction exists yet), create one
    IF NOT FOUND THEN
      INSERT INTO main_transaction (
        raw_transaction_id,
        account_id,
        transaction_type_id,
        amount,
        transaction_direction,
        transaction_date,
        description,
        is_split,
        split_sequence
      )
      SELECT
        NEW.raw_transaction_id,
        NEW.account_id,
        1, -- Default transaction type (will need manual categorization)
        v_new_amount,
        v_direction,
        NEW.transaction_date,
        NEW.description,
        false,
        1
      WHERE NOT EXISTS (
        SELECT 1 FROM main_transaction
        WHERE raw_transaction_id = NEW.raw_transaction_id
      );
    END IF;

    -- Log the sync
    RAISE NOTICE 'Synced main_transaction for raw_transaction_id=%: amount=%, date=%, account_id=%',
      NEW.raw_transaction_id, v_new_amount, NEW.transaction_date, NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the enhanced trigger
CREATE TRIGGER sync_main_transaction_changes_trigger
  AFTER UPDATE ON original_transaction
  FOR EACH ROW
  WHEN (
    OLD.debit_amount IS DISTINCT FROM NEW.debit_amount OR
    OLD.credit_amount IS DISTINCT FROM NEW.credit_amount OR
    OLD.transaction_date IS DISTINCT FROM NEW.transaction_date OR
    OLD.account_id IS DISTINCT FROM NEW.account_id
  )
  EXECUTE FUNCTION sync_main_transaction_changes();

COMMENT ON FUNCTION sync_main_transaction_changes() IS
'Automatically syncs main_transaction when original_transaction is edited (amount, date, or account).
For manual transactions only (import_batch_id IS NULL).
Prevents editing amount if splits exist to maintain data integrity.';
