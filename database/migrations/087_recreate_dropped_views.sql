-- ============================================================================
-- MIGRATION 087: Recreate Views Dropped by Migration 079
-- Purpose: Restore views that were dropped during DATE type conversion
-- Date: 2025-11-25
-- Dependencies: 079_convert_timestamps_to_dates.sql
-- ============================================================================

-- Background:
-- Migration 079 converted TIMESTAMPTZ to DATE for business dates.
-- It dropped several views but only recreated main_transaction_details,
-- unmatched_transfers, and debt_summary.
-- The following views were dropped but never recreated:
--   - contract_overview
--   - scheduled_payment_overview
--   - amendment_history
--   - budget_overview
--
-- This migration recreates them with DATE types.

DO $$
BEGIN
  RAISE NOTICE 'Recreating views that were dropped by migration 079...';
END $$;

-- ============================================================================
-- Recreate contract_overview view
-- ============================================================================

CREATE OR REPLACE VIEW contract_overview AS
SELECT
  c.contract_id,
  c.entity_id,
  c.contract_number,
  c.contract_name,
  c.contract_type,
  c.counterparty,
  c.counterparty_contact,
  c.signing_date,
  c.effective_date,
  c.expiration_date,
  c.total_contract_value,
  c.status,
  c.renewal_count,
  c.is_active,
  c.created_at,
  c.updated_at,

  -- Payment schedules count
  COUNT(DISTINCT sp.scheduled_payment_id) as payment_schedules_count,

  -- Total monthly obligation (sum of all monthly payment schedules)
  COALESCE(SUM(
    CASE
      WHEN sp.frequency = 'monthly' THEN sp.payment_amount
      ELSE 0
    END
  ), 0) as total_monthly_obligation,

  -- Amendment count
  (SELECT COUNT(*) FROM contract_amendments ca WHERE ca.contract_id = c.contract_id) as amendments_count,

  -- Active amendments count
  (SELECT COUNT(*)
   FROM contract_amendments ca
   WHERE ca.contract_id = c.contract_id
     AND ca.status = 'approved'
     AND ca.effective_start_date <= CURRENT_DATE
     AND (ca.effective_end_date IS NULL OR ca.effective_end_date >= CURRENT_DATE)
  ) as active_amendments_count,

  -- Days until expiration
  CASE
    WHEN c.expiration_date IS NOT NULL THEN
      (c.expiration_date - CURRENT_DATE)
    ELSE NULL
  END as days_until_expiration,

  -- Contract status indicators
  CASE
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE THEN 'expired'
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE c.status
  END as derived_status

FROM contracts c
LEFT JOIN scheduled_payments sp ON sp.contract_id = c.contract_id AND sp.is_active = TRUE
GROUP BY c.contract_id;

COMMENT ON VIEW contract_overview IS 'Complete contract overview with payment schedules and amendments summary';

-- ============================================================================
-- Recreate scheduled_payment_overview view
-- ============================================================================

CREATE OR REPLACE VIEW scheduled_payment_overview AS
SELECT
  sp.scheduled_payment_id,
  sp.entity_id,
  sp.category_id,
  c.category_name,
  sp.contract_name,
  sp.contract_type,
  sp.payee_name,
  sp.contract_number,
  sp.payment_amount,
  sp.schedule_type,
  sp.frequency,
  sp.payment_day,
  sp.start_date,
  sp.end_date,
  sp.custom_schedule,
  sp.status,
  sp.is_active,
  sp.notes,
  sp.created_at,
  sp.updated_at,

  -- Instance summaries
  COUNT(spi.instance_id) as total_instances,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'pending') as pending_count,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'paid') as paid_count,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'overdue') as overdue_count,

  -- Next due date
  MIN(spi.due_date) FILTER (WHERE spi.status = 'pending') as next_due_date,

  -- Payment totals
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'paid'), 0) as total_paid,
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'pending'), 0) as total_pending,
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'overdue'), 0) as total_overdue

FROM scheduled_payments sp
LEFT JOIN scheduled_payment_instances spi ON sp.scheduled_payment_id = spi.scheduled_payment_id
LEFT JOIN categories c ON sp.category_id = c.category_id
GROUP BY
  sp.scheduled_payment_id,
  sp.entity_id,
  sp.category_id,
  c.category_name,
  sp.contract_name,
  sp.contract_type,
  sp.payee_name,
  sp.contract_number,
  sp.payment_amount,
  sp.schedule_type,
  sp.frequency,
  sp.payment_day,
  sp.start_date,
  sp.end_date,
  sp.custom_schedule,
  sp.status,
  sp.is_active,
  sp.notes,
  sp.created_at,
  sp.updated_at;

COMMENT ON VIEW scheduled_payment_overview IS 'Complete overview of scheduled payments with instance summaries';

-- ============================================================================
-- Recreate amendment_history view
-- ============================================================================

CREATE OR REPLACE VIEW amendment_history AS
SELECT
  ca.amendment_id,
  ca.contract_id,
  c.contract_name,
  c.contract_number,
  ca.amendment_number,
  ca.amendment_date,
  ca.amendment_type,
  ca.title,
  ca.description,
  ca.effective_start_date,
  ca.effective_end_date,
  ca.new_payment_amount,
  ca.status,
  ca.created_at,
  ca.created_by,

  -- Count affected instances
  (SELECT COUNT(*)
   FROM scheduled_payment_instances spi
   WHERE spi.amendment_id = ca.amendment_id
  ) as affected_instances_count,

  -- Calculate total impact
  (SELECT COALESCE(SUM(spi.amount - COALESCE(spi.original_amount, spi.amount)), 0)
   FROM scheduled_payment_instances spi
   WHERE spi.amendment_id = ca.amendment_id
  ) as total_financial_impact

FROM contract_amendments ca
JOIN contracts c ON c.contract_id = ca.contract_id
ORDER BY ca.contract_id, ca.amendment_number DESC;

COMMENT ON VIEW amendment_history IS 'Amendment history with financial impact calculations';

-- ============================================================================
-- Recreate budget_overview view
-- ============================================================================

CREATE OR REPLACE VIEW budget_overview AS
SELECT
  cb.budget_id,
  cb.entity_id,
  cb.category_id,
  c.category_name,
  c.category_code,
  tt.type_display_name as transaction_type,
  cb.budget_name,
  cb.budget_amount,
  cb.start_date,
  cb.end_date,
  cb.recurring_period,
  cb.auto_renew,
  cb.status,
  cb.alert_threshold,
  cb.notes,
  cb.is_active,
  cb.priority,
  cb.created_at,
  cb.updated_at,
  -- Calculate spending with priority awareness
  COALESCE((
    SELECT SUM(mt.amount)
    FROM main_transaction mt
    WHERE mt.category_id = cb.category_id
      AND mt.transaction_date >= cb.start_date
      AND mt.transaction_date <= cb.end_date
      AND mt.transaction_direction = 'debit'
      -- Only count transaction if this is the highest priority budget for this transaction
      AND NOT EXISTS (
        SELECT 1
        FROM category_budgets cb2
        WHERE cb2.category_id = cb.category_id
          AND cb2.budget_id != cb.budget_id
          AND cb2.is_active = true
          AND mt.transaction_date >= cb2.start_date
          AND mt.transaction_date <= cb2.end_date
          -- Higher priority = lower priority number, or earlier end date, or earlier start date
          AND (
            cb2.priority < cb.priority
            OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
          )
      )
  ), 0) as spent_amount,
  -- Calculate remaining
  cb.budget_amount - COALESCE((
    SELECT SUM(mt.amount)
    FROM main_transaction mt
    WHERE mt.category_id = cb.category_id
      AND mt.transaction_date >= cb.start_date
      AND mt.transaction_date <= cb.end_date
      AND mt.transaction_direction = 'debit'
      AND NOT EXISTS (
        SELECT 1
        FROM category_budgets cb2
        WHERE cb2.category_id = cb.category_id
          AND cb2.budget_id != cb.budget_id
          AND cb2.is_active = true
          AND mt.transaction_date >= cb2.start_date
          AND mt.transaction_date <= cb2.end_date
          AND (
            cb2.priority < cb.priority
            OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
          )
      )
  ), 0) as remaining_amount,
  -- Calculate percentage
  CASE
    WHEN cb.budget_amount > 0 THEN
      ROUND((COALESCE((
        SELECT SUM(mt.amount)
        FROM main_transaction mt
        WHERE mt.category_id = cb.category_id
          AND mt.transaction_date >= cb.start_date
          AND mt.transaction_date <= cb.end_date
          AND mt.transaction_direction = 'debit'
          AND NOT EXISTS (
            SELECT 1
            FROM category_budgets cb2
            WHERE cb2.category_id = cb.category_id
              AND cb2.budget_id != cb.budget_id
              AND cb2.is_active = true
              AND mt.transaction_date >= cb2.start_date
              AND mt.transaction_date <= cb2.end_date
              AND (
                cb2.priority < cb.priority
                OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
                OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
                OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
              )
          )
      ), 0) / cb.budget_amount * 100)::NUMERIC, 2)
    ELSE 0
  END as percentage_used,
  -- Count transactions
  (
    SELECT COUNT(*)
    FROM main_transaction mt
    WHERE mt.category_id = cb.category_id
      AND mt.transaction_date >= cb.start_date
      AND mt.transaction_date <= cb.end_date
      AND mt.transaction_direction = 'debit'
      AND NOT EXISTS (
        SELECT 1
        FROM category_budgets cb2
        WHERE cb2.category_id = cb.category_id
          AND cb2.budget_id != cb.budget_id
          AND cb2.is_active = true
          AND mt.transaction_date >= cb2.start_date
          AND mt.transaction_date <= cb2.end_date
          AND (
            cb2.priority < cb.priority
            OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
            OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
          )
      )
  ) as transaction_count,
  -- Status indicators
  CASE
    WHEN CURRENT_DATE < cb.start_date THEN 'upcoming'
    WHEN CURRENT_DATE > cb.end_date THEN 'expired'
    WHEN COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      WHERE mt.category_id = cb.category_id
        AND mt.transaction_date >= cb.start_date
        AND mt.transaction_date <= cb.end_date
        AND mt.transaction_direction = 'debit'
        AND NOT EXISTS (
          SELECT 1
          FROM category_budgets cb2
          WHERE cb2.category_id = cb.category_id
            AND cb2.budget_id != cb.budget_id
            AND cb2.is_active = true
            AND mt.transaction_date >= cb2.start_date
            AND mt.transaction_date <= cb2.end_date
            AND (
              cb2.priority < cb.priority
              OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
              OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
              OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
            )
        )
    ), 0) >= cb.budget_amount THEN 'exceeded'
    WHEN cb.budget_amount > 0 AND (COALESCE((
      SELECT SUM(mt.amount)
      FROM main_transaction mt
      WHERE mt.category_id = cb.category_id
        AND mt.transaction_date >= cb.start_date
        AND mt.transaction_date <= cb.end_date
        AND mt.transaction_direction = 'debit'
        AND NOT EXISTS (
          SELECT 1
          FROM category_budgets cb2
          WHERE cb2.category_id = cb.category_id
            AND cb2.budget_id != cb.budget_id
            AND cb2.is_active = true
            AND mt.transaction_date >= cb2.start_date
            AND mt.transaction_date <= cb2.end_date
            AND (
              cb2.priority < cb.priority
              OR (cb2.priority = cb.priority AND cb2.end_date < cb.end_date)
              OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date < cb.start_date)
              OR (cb2.priority = cb.priority AND cb2.end_date = cb.end_date AND cb2.start_date = cb.start_date AND cb2.created_at < cb.created_at)
            )
        )
    ), 0) / cb.budget_amount * 100) >= cb.alert_threshold THEN 'warning'
    ELSE 'on_track'
  END as budget_status
FROM category_budgets cb
JOIN categories c ON cb.category_id = c.category_id
JOIN transaction_types tt ON c.transaction_type_id = tt.transaction_type_id;

COMMENT ON VIEW budget_overview IS 'Budget overview with priority-aware spending calculations - transactions only count toward highest priority budget';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration 087: Recreate Dropped Views';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Recreated views:';
  RAISE NOTICE '  - contract_overview';
  RAISE NOTICE '  - scheduled_payment_overview';
  RAISE NOTICE '  - amendment_history';
  RAISE NOTICE '  - budget_overview';
  RAISE NOTICE '';
  RAISE NOTICE 'All views now use DATE type for date fields';
  RAISE NOTICE '=================================================================';
END $$;
