-- Migration 057: Create Category Budgets System
-- Purpose: Enable budgeting per category with date ranges and recurring support
-- Date: 2025-01-17

-- ==============================================================================
-- Create category_budgets table
-- ==============================================================================

CREATE TABLE category_budgets (
  budget_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,

  -- Budget Details
  budget_name VARCHAR(255),  -- Optional: e.g., "Q1 2024 Marketing Budget"
  budget_amount DECIMAL(15,2) NOT NULL CHECK (budget_amount > 0),

  -- Time Period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Recurring Budget Settings
  recurring_period VARCHAR(20) CHECK (recurring_period IN ('one-time', 'monthly', 'quarterly', 'yearly')),
  auto_renew BOOLEAN DEFAULT FALSE,

  -- Status & Alerts
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  alert_threshold DECIMAL(5,2) DEFAULT 80.00,  -- Alert at 80% of budget

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_threshold CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
  CONSTRAINT valid_recurring CHECK (
    (recurring_period = 'one-time' AND auto_renew = FALSE) OR
    (recurring_period != 'one-time')
  )
);

-- ==============================================================================
-- Indexes for performance
-- ==============================================================================

CREATE INDEX idx_category_budgets_entity ON category_budgets(entity_id);
CREATE INDEX idx_category_budgets_category ON category_budgets(category_id);
CREATE INDEX idx_category_budgets_dates ON category_budgets(start_date, end_date);
CREATE INDEX idx_category_budgets_status ON category_budgets(status, is_active);
CREATE INDEX idx_category_budgets_active_period ON category_budgets(entity_id, category_id, start_date, end_date)
  WHERE is_active = TRUE AND status = 'active';

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view budgets for their entities
CREATE POLICY "Users can view budgets for their entities" ON category_budgets
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users with write permissions can insert budgets
CREATE POLICY "Users can insert budgets for their entities" ON category_budgets
  FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- Policy: Users with write permissions can update budgets
CREATE POLICY "Users can update budgets for their entities" ON category_budgets
  FOR UPDATE
  USING (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- Policy: Users with write permissions can delete budgets
CREATE POLICY "Users can delete budgets for their entities" ON category_budgets
  FOR DELETE
  USING (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- ==============================================================================
-- Function: Get budget spending for a period
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_budget_spending(p_budget_id INTEGER)
RETURNS TABLE (
  budget_id INTEGER,
  budget_amount DECIMAL(15,2),
  spent_amount DECIMAL(15,2),
  remaining_amount DECIMAL(15,2),
  percentage_used DECIMAL(5,2),
  transaction_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.budget_id,
    cb.budget_amount,
    COALESCE(SUM(mt.amount), 0) as spent_amount,
    cb.budget_amount - COALESCE(SUM(mt.amount), 0) as remaining_amount,
    CASE
      WHEN cb.budget_amount > 0 THEN
        ROUND((COALESCE(SUM(mt.amount), 0) / cb.budget_amount * 100)::NUMERIC, 2)
      ELSE 0
    END as percentage_used,
    COUNT(mt.main_transaction_id)::INTEGER as transaction_count
  FROM category_budgets cb
  LEFT JOIN main_transaction mt ON
    mt.category_id = cb.category_id
    AND mt.transaction_date >= cb.start_date
    AND mt.transaction_date <= cb.end_date
    AND mt.transaction_direction = 'debit'  -- Only count expenses
  WHERE cb.budget_id = p_budget_id
  GROUP BY cb.budget_id, cb.budget_amount;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_budget_spending IS 'Calculate spending for a budget period';

-- ==============================================================================
-- View: Budget overview with spending data
-- ==============================================================================

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
  cb.created_at,
  cb.updated_at,
  -- Calculate spending
  COALESCE(SUM(mt.amount), 0) as spent_amount,
  cb.budget_amount - COALESCE(SUM(mt.amount), 0) as remaining_amount,
  CASE
    WHEN cb.budget_amount > 0 THEN
      ROUND((COALESCE(SUM(mt.amount), 0) / cb.budget_amount * 100)::NUMERIC, 2)
    ELSE 0
  END as percentage_used,
  COUNT(mt.main_transaction_id) as transaction_count,
  -- Status indicators
  CASE
    WHEN CURRENT_DATE < cb.start_date THEN 'upcoming'
    WHEN CURRENT_DATE > cb.end_date THEN 'expired'
    WHEN COALESCE(SUM(mt.amount), 0) >= cb.budget_amount THEN 'exceeded'
    WHEN cb.budget_amount > 0 AND (COALESCE(SUM(mt.amount), 0) / cb.budget_amount * 100) >= cb.alert_threshold THEN 'warning'
    ELSE 'on_track'
  END as budget_status
FROM category_budgets cb
JOIN categories c ON cb.category_id = c.category_id
JOIN transaction_types tt ON c.transaction_type_id = tt.transaction_type_id
LEFT JOIN main_transaction mt ON
  mt.category_id = cb.category_id
  AND mt.transaction_date >= cb.start_date
  AND mt.transaction_date <= cb.end_date
  AND mt.transaction_direction = 'debit'  -- Only count expenses
GROUP BY
  cb.budget_id,
  cb.entity_id,
  cb.category_id,
  c.category_name,
  c.category_code,
  tt.type_display_name,
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
  cb.created_at,
  cb.updated_at;

COMMENT ON VIEW budget_overview IS 'Complete budget overview with real-time spending calculations';

-- ==============================================================================
-- Function: Auto-renew recurring budgets
-- ==============================================================================

CREATE OR REPLACE FUNCTION auto_renew_budgets()
RETURNS INTEGER AS $$
DECLARE
  renewed_count INTEGER := 0;
  budget_record RECORD;
  new_start_date DATE;
  new_end_date DATE;
BEGIN
  -- Find budgets that need renewal
  FOR budget_record IN
    SELECT *
    FROM category_budgets
    WHERE auto_renew = TRUE
      AND status = 'active'
      AND is_active = TRUE
      AND end_date < CURRENT_DATE
      AND recurring_period != 'one-time'
  LOOP
    -- Calculate new dates based on recurring period
    CASE budget_record.recurring_period
      WHEN 'monthly' THEN
        new_start_date := budget_record.end_date + INTERVAL '1 day';
        new_end_date := new_start_date + INTERVAL '1 month' - INTERVAL '1 day';
      WHEN 'quarterly' THEN
        new_start_date := budget_record.end_date + INTERVAL '1 day';
        new_end_date := new_start_date + INTERVAL '3 months' - INTERVAL '1 day';
      WHEN 'yearly' THEN
        new_start_date := budget_record.end_date + INTERVAL '1 day';
        new_end_date := new_start_date + INTERVAL '1 year' - INTERVAL '1 day';
      ELSE
        CONTINUE;
    END CASE;

    -- Mark old budget as completed
    UPDATE category_budgets
    SET status = 'completed',
        updated_at = NOW()
    WHERE budget_id = budget_record.budget_id;

    -- Create new budget for next period
    INSERT INTO category_budgets (
      entity_id,
      category_id,
      budget_name,
      budget_amount,
      start_date,
      end_date,
      recurring_period,
      auto_renew,
      status,
      alert_threshold,
      notes,
      created_by
    ) VALUES (
      budget_record.entity_id,
      budget_record.category_id,
      budget_record.budget_name,
      budget_record.budget_amount,
      new_start_date,
      new_end_date,
      budget_record.recurring_period,
      budget_record.auto_renew,
      'active',
      budget_record.alert_threshold,
      budget_record.notes,
      budget_record.created_by
    );

    renewed_count := renewed_count + 1;
  END LOOP;

  RETURN renewed_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_renew_budgets IS 'Automatically renew expired recurring budgets (run via cron/scheduler)';

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 057 completed successfully';
  RAISE NOTICE 'Created category_budgets table with RLS policies';
  RAISE NOTICE 'Created budget_overview view';
  RAISE NOTICE 'Created get_budget_spending() function';
  RAISE NOTICE 'Created auto_renew_budgets() function';
END $$;
