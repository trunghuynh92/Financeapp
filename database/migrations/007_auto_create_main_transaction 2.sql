-- ============================================================================
-- MIGRATION 007: Auto-create main_transaction from original_transaction
-- Purpose: Automatically create corresponding main_transaction records when
--          original_transaction records are inserted
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Auto-create main_transaction from original_transaction
-- Purpose: Creates a default main_transaction record for each new original
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_create_main_transaction()
RETURNS TRIGGER AS $$
DECLARE
  default_type_id INTEGER;
  direction VARCHAR(10);
  amt DECIMAL(15,2);
BEGIN
  -- Determine transaction direction and amount from original
  IF NEW.debit_amount IS NOT NULL THEN
    direction := 'debit';
    amt := NEW.debit_amount;
  ELSIF NEW.credit_amount IS NOT NULL THEN
    direction := 'credit';
    amt := NEW.credit_amount;
  ELSE
    -- Skip if neither debit nor credit (shouldn't happen due to constraint)
    RETURN NEW;
  END IF;

  -- Get default transaction type (Expense for debit, Income for credit)
  -- This is just a default - user will update it properly later
  IF direction = 'debit' THEN
    SELECT transaction_type_id INTO default_type_id
    FROM transaction_types
    WHERE type_code = 'EXP'
    LIMIT 1;
  ELSE
    SELECT transaction_type_id INTO default_type_id
    FROM transaction_types
    WHERE type_code = 'INC'
    LIMIT 1;
  END IF;

  -- Create main_transaction record
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
  ) VALUES (
    NEW.raw_transaction_id,
    NEW.account_id,
    default_type_id,
    amt,
    direction,
    NEW.transaction_date,
    NEW.description,
    false,
    1,
    NEW.created_by_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run after original_transaction insert
CREATE TRIGGER trigger_auto_create_main_transaction
AFTER INSERT ON original_transaction
FOR EACH ROW
EXECUTE FUNCTION auto_create_main_transaction();

-- ============================================================================
-- BACKFILL: Create main_transactions for existing original_transactions
-- Purpose: Batch-create main_transactions for any existing originals without them
-- ============================================================================

-- Function to backfill main_transactions for existing originals
CREATE OR REPLACE FUNCTION backfill_main_transactions()
RETURNS TABLE (
  processed_count INTEGER,
  error_count INTEGER,
  errors TEXT[]
) AS $$
DECLARE
  rec RECORD;
  default_type_id INTEGER;
  direction VARCHAR(10);
  amt DECIMAL(15,2);
  processed INTEGER := 0;
  errors_count INTEGER := 0;
  error_messages TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Loop through all original_transactions without main_transactions
  FOR rec IN
    SELECT
      ot.raw_transaction_id,
      ot.account_id,
      ot.transaction_date,
      ot.description,
      ot.debit_amount,
      ot.credit_amount,
      ot.created_by_user_id
    FROM original_transaction ot
    WHERE NOT EXISTS (
      SELECT 1
      FROM main_transaction mt
      WHERE mt.raw_transaction_id = ot.raw_transaction_id
    )
  LOOP
    BEGIN
      -- Determine direction and amount
      IF rec.debit_amount IS NOT NULL THEN
        direction := 'debit';
        amt := rec.debit_amount;
        SELECT transaction_type_id INTO default_type_id
        FROM transaction_types WHERE type_code = 'EXP' LIMIT 1;
      ELSIF rec.credit_amount IS NOT NULL THEN
        direction := 'credit';
        amt := rec.credit_amount;
        SELECT transaction_type_id INTO default_type_id
        FROM transaction_types WHERE type_code = 'INC' LIMIT 1;
      ELSE
        -- Skip invalid records
        CONTINUE;
      END IF;

      -- Insert main_transaction
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
      ) VALUES (
        rec.raw_transaction_id,
        rec.account_id,
        default_type_id,
        amt,
        direction,
        rec.transaction_date,
        rec.description,
        false,
        1,
        rec.created_by_user_id
      );

      processed := processed + 1;

    EXCEPTION
      WHEN OTHERS THEN
        errors_count := errors_count + 1;
        error_messages := array_append(error_messages,
          'Error processing ' || rec.raw_transaction_id || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT processed, errors_count, error_messages;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RUN BACKFILL (comment out if you want to run manually later)
-- ============================================================================

-- Execute backfill for existing records
-- SELECT * FROM backfill_main_transactions();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- Check trigger exists:
-- SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_create_main_transaction';

-- Check unprocessed originals:
-- SELECT * FROM get_unprocessed_originals();

-- Run backfill manually:
-- SELECT * FROM backfill_main_transactions();
