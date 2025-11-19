-- ============================================================================
-- MIGRATION 061: Fix Double-Counting Bug in Drawdown Balance Calculation
-- Purpose: Recalculate all drawdown balances correctly (only count credit side)
-- ============================================================================

-- Recalculate all drawdown balances based on DEBT_PAY CREDIT transactions only
UPDATE debt_drawdown dd
SET
  remaining_balance = GREATEST(
    dd.original_amount - COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.drawdown_id = dd.drawdown_id
        AND tt.type_code = 'DEBT_PAY'
        AND mt.transaction_direction = 'credit' -- Only count credits to credit line
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
      AND mt.transaction_direction = 'credit'
      AND mt.transfer_matched_transaction_id IS NOT NULL
  ), 0) > dd.original_amount,
  status = CASE
    WHEN COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.drawdown_id = dd.drawdown_id
        AND tt.type_code = 'DEBT_PAY'
        AND mt.transaction_direction = 'credit'
        AND mt.transfer_matched_transaction_id IS NOT NULL
    ), 0) >= dd.original_amount THEN 'settled'
    WHEN CURRENT_DATE > dd.due_date AND dd.due_date IS NOT NULL THEN 'overdue'
    ELSE 'active'
  END,
  updated_at = CURRENT_TIMESTAMP;

-- Verify the migration
DO $$
DECLARE
  total_drawdowns INTEGER;
  settled_drawdowns INTEGER;
  active_drawdowns INTEGER;
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_drawdowns FROM debt_drawdown;
  SELECT COUNT(*) INTO settled_drawdowns FROM debt_drawdown WHERE status = 'settled';
  SELECT COUNT(*) INTO active_drawdowns FROM debt_drawdown WHERE status = 'active';

  RAISE NOTICE 'Migration 061 completed successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total drawdowns: %', total_drawdowns;
  RAISE NOTICE 'Settled drawdowns: %', settled_drawdowns;
  RAISE NOTICE 'Active drawdowns: %', active_drawdowns;
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed double-counting bug - now only counts CREDIT side of DEBT_PAY transactions';
END $$;
