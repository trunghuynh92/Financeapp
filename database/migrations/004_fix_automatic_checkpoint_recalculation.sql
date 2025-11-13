-- ============================================================================
-- Migration 004: Fix Automatic Checkpoint Recalculation
-- ============================================================================
-- Problem: The trigger only sends pg_notify but doesn't actually recalculate
-- Solution: Make the trigger directly recalculate checkpoints in the database
--
-- This fixes the issue where adding transactions doesn't update balance adjustments
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Migration 004: Fixing Automatic Checkpoint Recalculation';
  RAISE NOTICE '==============================================================';
END $$;

-- ==============================================================================
-- STEP 1: Create function to recalculate a single checkpoint
-- ==============================================================================

CREATE OR REPLACE FUNCTION recalculate_checkpoint(p_checkpoint_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_checkpoint RECORD;
  v_calculated_balance NUMERIC(15,2);
  v_new_adjustment NUMERIC(15,2);
  v_is_reconciled BOOLEAN;
BEGIN
  -- Get the checkpoint details
  SELECT * INTO v_checkpoint
  FROM balance_checkpoints
  WHERE checkpoint_id = p_checkpoint_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Checkpoint % not found', p_checkpoint_id;
    RETURN;
  END IF;

  -- Calculate balance up to checkpoint date (excluding balance adjustments)
  SELECT COALESCE(
    SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
    0
  ) INTO v_calculated_balance
  FROM original_transaction
  WHERE account_id = v_checkpoint.account_id
    AND transaction_date <= v_checkpoint.checkpoint_date
    AND is_balance_adjustment = false;

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
      UPDATE original_transaction
      SET
        credit_amount = CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END,
        debit_amount = CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END,
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
        CASE WHEN v_new_adjustment > 0 THEN v_new_adjustment ELSE NULL END,
        CASE WHEN v_new_adjustment < 0 THEN ABS(v_new_adjustment) ELSE NULL END,
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
-- STEP 2: Create function to recalculate all checkpoints for an account
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
    ORDER BY checkpoint_date ASC
  LOOP
    PERFORM recalculate_checkpoint(v_checkpoint_id);
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Recalculated % checkpoint(s) for account %', v_count, p_account_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- STEP 3: Create function to sync account_balances
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_account_balance_from_checkpoints(p_account_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_calculated_balance NUMERIC(15,2);
  v_latest_checkpoint RECORD;
BEGIN
  -- Get the most recent checkpoint
  SELECT * INTO v_latest_checkpoint
  FROM balance_checkpoints
  WHERE account_id = p_account_id
  ORDER BY checkpoint_date DESC, checkpoint_id DESC
  LIMIT 1;

  IF FOUND THEN
    -- Balance = calculated_balance + adjustment_amount
    v_calculated_balance := v_latest_checkpoint.calculated_balance + v_latest_checkpoint.adjustment_amount;

    RAISE NOTICE 'Syncing account % balance from checkpoint: %', p_account_id, v_calculated_balance;
  ELSE
    -- No checkpoint, calculate from all transactions
    SELECT COALESCE(
      SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
      0
    ) INTO v_calculated_balance
    FROM original_transaction
    WHERE account_id = p_account_id
      AND is_balance_adjustment = false;

    RAISE NOTICE 'Syncing account % balance from transactions: %', p_account_id, v_calculated_balance;
  END IF;

  -- Update account_balances
  UPDATE account_balances
  SET
    current_balance = v_calculated_balance,
    last_updated = NOW()
  WHERE account_id = p_account_id;

  IF NOT FOUND THEN
    -- Create account_balances record if it doesn't exist
    INSERT INTO account_balances (account_id, current_balance, last_updated)
    VALUES (p_account_id, v_calculated_balance, NOW());

    RAISE NOTICE 'Created account_balances record for account %', p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- STEP 4: Replace the trigger function with actual recalculation
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

    -- Sync account_balances table
    PERFORM sync_account_balance_from_checkpoints(v_account_id);

    RAISE NOTICE 'Checkpoint recalculation complete for account %', v_account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger is already created in migration 003, so we just need to replace the function
-- The existing trigger will automatically use the new function

-- ==============================================================================
-- STEP 5: Verification and Testing
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Migration 004 Complete!';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✅ Created recalculate_checkpoint() function';
  RAISE NOTICE '  ✅ Created recalculate_all_checkpoints_for_account() function';
  RAISE NOTICE '  ✅ Created sync_account_balance_from_checkpoints() function';
  RAISE NOTICE '  ✅ Replaced trigger_recalculate_checkpoints() function';
  RAISE NOTICE '';
  RAISE NOTICE 'What this fixes:';
  RAISE NOTICE '  ✅ Adding a transaction now automatically recalculates checkpoints';
  RAISE NOTICE '  ✅ Balance adjustment transactions are updated correctly';
  RAISE NOTICE '  ✅ account_balances table stays in sync';
  RAISE NOTICE '  ✅ No need for manual API calls or pg_notify listeners';
  RAISE NOTICE '';
  RAISE NOTICE 'Test the fix:';
  RAISE NOTICE '  1. Create a checkpoint for an account';
  RAISE NOTICE '  2. Add a transaction dated before the checkpoint';
  RAISE NOTICE '  3. Check that the checkpoint adjustment_amount is updated';
  RAISE NOTICE '  4. Check that the balance adjustment transaction is updated';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
END $$;

-- ==============================================================================
-- OPTIONAL: Manual recalculation for existing checkpoints
-- ==============================================================================

-- Uncomment and run this if you want to recalculate all existing checkpoints now:

/*
DO $$
DECLARE
  v_account_id INTEGER;
BEGIN
  RAISE NOTICE 'Recalculating all existing checkpoints...';

  FOR v_account_id IN
    SELECT DISTINCT account_id FROM balance_checkpoints
  LOOP
    PERFORM recalculate_all_checkpoints_for_account(v_account_id);
    PERFORM sync_account_balance_from_checkpoints(v_account_id);
  END LOOP;

  RAISE NOTICE 'All checkpoints recalculated!';
END $$;
*/
