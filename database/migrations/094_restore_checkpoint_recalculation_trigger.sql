-- ============================================================================
-- MIGRATION 094: Restore Checkpoint Recalculation Trigger
-- ============================================================================
-- Problem: Migration 085 dropped trigger_recalculate_checkpoints() with CASCADE,
-- which also dropped the transaction_checkpoint_recalc trigger.
-- This broke automatic checkpoint recalculation when transactions are added/edited/deleted.
--
-- Solution: Recreate the trigger function and trigger (without account_balances sync
-- since that table no longer exists).
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Migration 094: Restoring Checkpoint Recalculation Trigger';
  RAISE NOTICE '==============================================================';
END $$;

-- ==============================================================================
-- STEP 1: Recreate function to recalculate a single checkpoint
-- ==============================================================================

CREATE OR REPLACE FUNCTION recalculate_checkpoint(p_checkpoint_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_checkpoint RECORD;
  v_account RECORD;
  v_calculated_balance NUMERIC(15,2);
  v_new_adjustment NUMERIC(15,2);
  v_is_reconciled BOOLEAN;
  v_is_credit_account BOOLEAN;
BEGIN
  -- Get the checkpoint details
  SELECT * INTO v_checkpoint
  FROM balance_checkpoints
  WHERE checkpoint_id = p_checkpoint_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Checkpoint % not found', p_checkpoint_id;
    RETURN;
  END IF;

  -- Get account type to determine if it's a credit account
  SELECT * INTO v_account
  FROM accounts
  WHERE account_id = v_checkpoint.account_id;

  v_is_credit_account := v_account.account_type IN ('credit_line', 'term_loan', 'credit_card');

  -- Calculate balance up to checkpoint date (excluding balance adjustments)
  -- Also include adjustment transactions from PREVIOUS checkpoints (by date)
  SELECT COALESCE(
    SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
    0
  ) INTO v_calculated_balance
  FROM original_transaction
  WHERE account_id = v_checkpoint.account_id
    AND transaction_date <= v_checkpoint.checkpoint_date
    AND (
      is_balance_adjustment = false
      OR (
        is_balance_adjustment = true
        AND checkpoint_id IN (
          SELECT checkpoint_id FROM balance_checkpoints
          WHERE account_id = v_checkpoint.account_id
            AND checkpoint_date < v_checkpoint.checkpoint_date
        )
      )
    );

  -- Calculate new adjustment amount
  v_new_adjustment := v_checkpoint.declared_balance - v_calculated_balance;

  -- Check if reconciled (within 1 cent threshold)
  v_is_reconciled := ABS(v_new_adjustment) < 0.01;

  -- Update the checkpoint
  UPDATE balance_checkpoints
  SET
    calculated_balance = v_calculated_balance,
    adjustment_amount = v_new_adjustment,
    is_reconciled = v_is_reconciled,
    updated_at = NOW()
  WHERE checkpoint_id = p_checkpoint_id;

  RAISE NOTICE 'Recalculated checkpoint %: declared=%, calculated=%, adjustment=%',
    p_checkpoint_id,
    v_checkpoint.declared_balance,
    v_calculated_balance,
    v_new_adjustment;

  -- Update or delete the balance adjustment transaction
  IF v_is_reconciled THEN
    -- Delete adjustment transaction if reconciled
    DELETE FROM original_transaction
    WHERE checkpoint_id = p_checkpoint_id
      AND is_balance_adjustment = true;

    RAISE NOTICE 'Deleted adjustment transaction for reconciled checkpoint %', p_checkpoint_id;
  ELSE
    -- Check if adjustment transaction exists
    IF EXISTS (
      SELECT 1 FROM original_transaction
      WHERE checkpoint_id = p_checkpoint_id
        AND is_balance_adjustment = true
    ) THEN
      -- Update existing adjustment transaction
      -- For credit accounts: invert the debit/credit logic
      UPDATE original_transaction
      SET
        credit_amount = CASE
          WHEN v_is_credit_account THEN
            CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END
          ELSE
            CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END
        END,
        debit_amount = CASE
          WHEN v_is_credit_account THEN
            CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END
          ELSE
            CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END
        END,
        updated_at = NOW()
      WHERE checkpoint_id = p_checkpoint_id
        AND is_balance_adjustment = true;

      RAISE NOTICE 'Updated adjustment transaction for checkpoint %', p_checkpoint_id;
    ELSE
      -- Create new adjustment transaction
      INSERT INTO original_transaction (
        raw_transaction_id,
        account_id,
        transaction_date,
        description,
        credit_amount,
        debit_amount,
        transaction_source,
        checkpoint_id,
        is_balance_adjustment,
        is_flagged
      ) VALUES (
        'BAL-ADJ-' || p_checkpoint_id,
        v_checkpoint.account_id,
        v_checkpoint.checkpoint_date,
        'Balance Adjustment (Checkpoint)',
        CASE
          WHEN v_is_credit_account THEN
            CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END
          ELSE
            CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END
        END,
        CASE
          WHEN v_is_credit_account THEN
            CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END
          ELSE
            CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END
        END,
        'auto_adjustment',
        p_checkpoint_id,
        true,
        true
      );

      RAISE NOTICE 'Created adjustment transaction for checkpoint %', p_checkpoint_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- STEP 2: Recreate function to recalculate all checkpoints for an account
-- ==============================================================================

CREATE OR REPLACE FUNCTION recalculate_all_checkpoints_for_account(p_account_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_checkpoint_id INTEGER;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Recalculating all checkpoints for account %', p_account_id;

  -- Loop through all checkpoints for this account, ordered by date
  FOR v_checkpoint_id IN
    SELECT checkpoint_id
    FROM balance_checkpoints
    WHERE account_id = p_account_id
    ORDER BY checkpoint_date ASC, checkpoint_id ASC
  LOOP
    PERFORM recalculate_checkpoint(v_checkpoint_id);
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Recalculated % checkpoint(s) for account %', v_count, p_account_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- STEP 3: Recreate the trigger function (without account_balances sync)
-- ==============================================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_checkpoints()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id INTEGER;
BEGIN
  -- Determine which account_id to use
  IF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
  ELSE
    v_account_id := NEW.account_id;
  END IF;

  -- Only recalculate if it's not a balance adjustment transaction
  -- (to avoid infinite loops)
  IF (TG_OP = 'DELETE' AND OLD.is_balance_adjustment = false) OR
     (TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_balance_adjustment = false) THEN

    RAISE NOTICE 'Transaction change detected for account %, triggering recalculation', v_account_id;

    -- Actually recalculate all checkpoints for this account
    PERFORM recalculate_all_checkpoints_for_account(v_account_id);

    RAISE NOTICE 'Checkpoint recalculation complete for account %', v_account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- STEP 4: Recreate the trigger on original_transaction
-- ==============================================================================

-- Drop trigger if it exists (shouldn't, but just in case)
DROP TRIGGER IF EXISTS transaction_checkpoint_recalc ON original_transaction;

-- Create trigger for INSERT, UPDATE, DELETE
CREATE TRIGGER transaction_checkpoint_recalc
AFTER INSERT OR UPDATE OR DELETE ON original_transaction
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_checkpoints();

-- ==============================================================================
-- STEP 5: Verification
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Migration 094 Complete!';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Restored:';
  RAISE NOTICE '  ✅ recalculate_checkpoint() function';
  RAISE NOTICE '  ✅ recalculate_all_checkpoints_for_account() function';
  RAISE NOTICE '  ✅ trigger_recalculate_checkpoints() function';
  RAISE NOTICE '  ✅ transaction_checkpoint_recalc trigger on original_transaction';
  RAISE NOTICE '';
  RAISE NOTICE 'What this fixes:';
  RAISE NOTICE '  ✅ Adding a manual transaction now automatically recalculates checkpoints';
  RAISE NOTICE '  ✅ Editing a transaction recalculates checkpoints';
  RAISE NOTICE '  ✅ Deleting a transaction recalculates checkpoints';
  RAISE NOTICE '  ✅ Balance adjustment transactions are updated correctly';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
END $$;
