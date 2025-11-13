-- Migration 043: Recalculate Drawdown Balances After Migration 042
-- Purpose: Recalculate all drawdown balances to account for DEBT_PAY transactions
--          that were previously DEBT_SETTLE
-- Created: 2025-11-10

-- Recalculate all drawdown balances based on matched DEBT_PAY transactions
UPDATE debt_drawdown dd
SET
  remaining_balance = GREATEST(
    dd.original_amount - COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.drawdown_id = dd.drawdown_id
        AND tt.type_code = 'DEBT_PAY'
        AND mt.transfer_matched_transaction_id IS NOT NULL
    ), 0),
    0
  ),
  is_overpaid = COALESCE((
    SELECT SUM(mt.amount)
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    WHERE mt.drawdown_id = dd.drawdown_id
      AND tt.type_code = 'DEBT_PAY'
      AND mt.transfer_matched_transaction_id IS NOT NULL
  ), 0) > dd.original_amount,
  status = CASE
    WHEN COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.drawdown_id = dd.drawdown_id
        AND tt.type_code = 'DEBT_PAY'
        AND mt.transfer_matched_transaction_id IS NOT NULL
    ), 0) >= dd.original_amount THEN 'settled'
    WHEN CURRENT_DATE > dd.due_date AND dd.due_date IS NOT NULL THEN 'overdue'
    ELSE 'active'
  END;

-- Verify the migration
DO $$
DECLARE
  total_drawdowns INTEGER;
  settled_drawdowns INTEGER;
  active_drawdowns INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_drawdowns FROM debt_drawdown;
  SELECT COUNT(*) INTO settled_drawdowns FROM debt_drawdown WHERE status = 'settled';
  SELECT COUNT(*) INTO active_drawdowns FROM debt_drawdown WHERE status = 'active';

  RAISE NOTICE 'Migration 043 completed successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total drawdowns: %', total_drawdowns;
  RAISE NOTICE 'Settled drawdowns: %', settled_drawdowns;
  RAISE NOTICE 'Active drawdowns: %', active_drawdowns;
  RAISE NOTICE '';
  RAISE NOTICE 'All drawdown balances have been recalculated based on DEBT_PAY transactions';
END $$;
