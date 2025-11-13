-- Migration: Sync main_transaction amounts when original_transaction is edited
-- Purpose: Maintain data integrity between original and main transactions

-- ==============================================================================
-- TRIGGER: Sync main_transaction amount when original_transaction is edited
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_main_transaction_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_old_amount NUMERIC;
  v_new_amount NUMERIC;
  v_direction TEXT;
BEGIN
  -- Determine old and new amounts
  v_old_amount := COALESCE(OLD.debit_amount, OLD.credit_amount);
  v_new_amount := COALESCE(NEW.debit_amount, NEW.credit_amount);
  v_direction := CASE
    WHEN NEW.debit_amount IS NOT NULL THEN 'debit'
    ELSE 'credit'
  END;

  -- Only proceed if amount actually changed
  IF v_old_amount IS DISTINCT FROM v_new_amount THEN

    -- Check if splits exist for this transaction
    IF EXISTS (
      SELECT 1 FROM main_transaction
      WHERE raw_transaction_id = NEW.raw_transaction_id
      AND is_split = true
    ) THEN
      -- Splits exist - prevent the update
      RAISE EXCEPTION 'Cannot modify original_transaction amount when splits exist. Unsplit the transaction first.';
    END IF;

    -- No splits - update or create main_transaction
    -- First, try to update existing non-split main_transaction
    UPDATE main_transaction
    SET
      amount = v_new_amount,
      transaction_direction = v_direction,
      updated_at = NOW()
    WHERE raw_transaction_id = NEW.raw_transaction_id
    AND is_split = false;

    -- If no rows were updated (e.g., splits were just deleted), create a new one
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

    -- Log the sync (optional)
    RAISE NOTICE 'Synced main_transaction amount for % from % to %',
      NEW.raw_transaction_id, v_old_amount, v_new_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS sync_main_transaction_amount_trigger ON original_transaction;
CREATE TRIGGER sync_main_transaction_amount_trigger
  AFTER UPDATE ON original_transaction
  FOR EACH ROW
  WHEN (
    OLD.debit_amount IS DISTINCT FROM NEW.debit_amount OR
    OLD.credit_amount IS DISTINCT FROM NEW.credit_amount
  )
  EXECUTE FUNCTION sync_main_transaction_amount();

COMMENT ON FUNCTION sync_main_transaction_amount() IS
'Automatically syncs main_transaction amount when original_transaction amount is edited.
Prevents editing if splits exist to maintain data integrity.';
