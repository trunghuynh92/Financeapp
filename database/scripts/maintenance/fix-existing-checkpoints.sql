-- ============================================================================
-- QUICK FIX: Recalculate Your Existing Checkpoint RIGHT NOW
-- ============================================================================
-- Run this AFTER running migration 004_fix_automatic_checkpoint_recalculation.sql
--
-- This will fix your existing checkpoint (Nov 5, 2020 with 45mil)
-- After this, future transactions will auto-recalculate automatically!
-- ============================================================================

DO $$
DECLARE
  v_account_id INTEGER;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Recalculating ALL existing checkpoints...';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';

  -- Loop through all accounts that have checkpoints
  FOR v_account_id IN
    SELECT DISTINCT account_id FROM balance_checkpoints ORDER BY account_id
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '--- Account ID: % ---', v_account_id;

    -- Recalculate all checkpoints for this account
    PERFORM recalculate_all_checkpoints_for_account(v_account_id);

    -- Sync the account balance
    PERFORM sync_account_balance_from_checkpoints(v_account_id);

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Done! Recalculated checkpoints for % account(s)', v_count;
  RAISE NOTICE '==============================================================';
END $$;

-- Verify the results
SELECT
  c.checkpoint_id,
  c.account_id,
  a.account_name,
  c.checkpoint_date,
  c.declared_balance,
  c.calculated_balance,
  c.adjustment_amount,
  c.is_reconciled,
  c.updated_at
FROM balance_checkpoints c
JOIN accounts a ON c.account_id = a.account_id
ORDER BY c.account_id, c.checkpoint_date;

-- Check balance adjustment transactions
SELECT
  t.raw_transaction_id,
  t.account_id,
  a.account_name,
  t.transaction_date,
  t.description,
  t.credit_amount,
  t.debit_amount,
  t.checkpoint_id,
  t.is_flagged
FROM original_transaction t
JOIN accounts a ON t.account_id = a.account_id
WHERE t.is_balance_adjustment = true
ORDER BY t.account_id, t.transaction_date;

-- Check account balances
SELECT
  ab.account_id,
  a.account_name,
  ab.current_balance,
  ab.last_updated
FROM account_balances ab
JOIN accounts a ON ab.account_id = a.account_id
ORDER BY ab.account_id;
