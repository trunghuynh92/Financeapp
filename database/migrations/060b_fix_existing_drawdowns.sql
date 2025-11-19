-- ============================================================================
-- MIGRATION 060b: Fix Existing Broken Drawdowns
-- Purpose: Recalculate drawdowns that were broken by unmatch/delete before migration 060
-- ============================================================================

-- This script manually recalculates all drawdowns by checking actual DEBT_SETTLE transactions
-- Run this AFTER migration 060 has been applied

DO $$
DECLARE
  drawdown_record RECORD;
  v_total_settled DECIMAL(15,2);
  v_new_balance DECIMAL(15,2);
  v_count INTEGER := 0;
BEGIN
  -- Loop through all drawdowns
  FOR drawdown_record IN
    SELECT
      dd.drawdown_id,
      dd.drawdown_reference,
      dd.original_amount,
      dd.remaining_balance,
      dd.status,
      dd.due_date
    FROM debt_drawdown dd
    ORDER BY dd.drawdown_id
  LOOP
    -- Calculate actual settled amount using the helper function
    v_total_settled := get_drawdown_settled_amount(drawdown_record.drawdown_id);

    -- Calculate new balance
    v_new_balance := drawdown_record.original_amount - v_total_settled;

    -- Update drawdown with correct values
    UPDATE debt_drawdown
    SET
      remaining_balance = GREATEST(0, v_new_balance),
      is_overpaid = (v_total_settled > drawdown_record.original_amount),
      status = CASE
        WHEN v_new_balance <= 0 THEN 'settled'
        WHEN drawdown_record.due_date IS NOT NULL AND drawdown_record.due_date < CURRENT_DATE AND v_new_balance > 0 THEN 'overdue'
        ELSE 'active'
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE drawdown_id = drawdown_record.drawdown_id
      AND (
        -- Only update if values changed
        remaining_balance != GREATEST(0, v_new_balance)
        OR is_overpaid != (v_total_settled > drawdown_record.original_amount)
        OR status != CASE
          WHEN v_new_balance <= 0 THEN 'settled'
          WHEN drawdown_record.due_date IS NOT NULL AND drawdown_record.due_date < CURRENT_DATE AND v_new_balance > 0 THEN 'overdue'
          ELSE 'active'
        END
      );

    -- Count updated records
    IF FOUND THEN
      v_count := v_count + 1;
      RAISE NOTICE 'Fixed drawdown % (%) - New balance: %, New status: %',
        drawdown_record.drawdown_reference,
        drawdown_record.drawdown_id,
        GREATEST(0, v_new_balance),
        CASE
          WHEN v_new_balance <= 0 THEN 'settled'
          WHEN drawdown_record.due_date IS NOT NULL AND drawdown_record.due_date < CURRENT_DATE AND v_new_balance > 0 THEN 'overdue'
          ELSE 'active'
        END;
    END IF;
  END LOOP;

  RAISE NOTICE 'Recalculation complete: % drawdown(s) updated', v_count;
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify the fix worked
SELECT
  dd.drawdown_reference,
  dd.original_amount,
  dd.remaining_balance,
  dd.status,
  dd.is_overpaid,
  dd.due_date,
  COUNT(mt.main_transaction_id) as debt_settle_count,
  COALESCE(SUM(CASE
    WHEN mt.transfer_matched_transaction_id IS NOT NULL THEN mt.amount
    ELSE 0
  END), 0) as total_matched_settlements
FROM debt_drawdown dd
LEFT JOIN main_transaction mt ON dd.drawdown_id = mt.drawdown_id
LEFT JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id AND tt.type_code = 'DEBT_SETTLE'
GROUP BY dd.drawdown_id, dd.drawdown_reference, dd.original_amount, dd.remaining_balance, dd.status, dd.is_overpaid, dd.due_date
ORDER BY dd.drawdown_date DESC;
