-- Migration 058: Add Budget Priority System
-- Purpose: Prevent double-counting transactions in overlapping budgets
-- Date: 2025-01-17

-- ==============================================================================
-- Add priority field to category_budgets
-- ==============================================================================

-- Add priority column (lower number = higher priority)
ALTER TABLE category_budgets
ADD COLUMN priority INTEGER DEFAULT 1;

-- Create index for priority queries
CREATE INDEX idx_category_budgets_priority ON category_budgets(category_id, priority, start_date, end_date);

-- Set initial priorities based on specificity (shorter duration = higher priority)
-- This ensures existing budgets get appropriate priorities
-- Date subtraction in PostgreSQL returns integer (number of days)
UPDATE category_budgets
SET priority = (end_date - start_date) + 1;

COMMENT ON COLUMN category_budgets.priority IS 'Budget priority - lower number means higher priority. Transactions are allocated to highest priority budget first.';

-- ==============================================================================
-- Drop old view and recreate with priority-aware spending calculation
-- ==============================================================================

DROP VIEW IF EXISTS budget_overview;

-- Create improved view with priority-based spending
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

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 058 completed successfully';
  RAISE NOTICE 'Added priority field to category_budgets';
  RAISE NOTICE 'Updated budget_overview view with priority-aware spending calculation';
  RAISE NOTICE 'Priority rules: Lower number = higher priority, then earlier end date, then earlier start date';
END $$;
