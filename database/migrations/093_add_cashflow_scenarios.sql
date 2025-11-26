-- ============================================================================
-- MIGRATION 093: Add Cash Flow Scenarios
-- Purpose: Enable "what-if" scenario planning for cash flow projections
-- ============================================================================

-- ============================================================================
-- STEP 1: Create scenarios table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cashflow_scenarios (
  scenario_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Scenario metadata
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for chart display
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(entity_id, name)
);

COMMENT ON TABLE cashflow_scenarios IS 'Cash flow scenario definitions for what-if analysis';

-- ============================================================================
-- STEP 2: Create scenario adjustments table
-- ============================================================================

-- Adjustment types:
-- 'one_time_income' - Single income event
-- 'one_time_expense' - Single expense event
-- 'recurring_income' - Monthly recurring income
-- 'recurring_expense' - Monthly recurring expense
-- 'debt_drawdown' - New debt/loan
-- 'modify_predicted' - Percentage adjustment to predicted expenses
-- 'modify_income' - Percentage adjustment to predicted income
-- 'exclude_scheduled' - Remove a scheduled payment

CREATE TYPE scenario_adjustment_type AS ENUM (
  'one_time_income',
  'one_time_expense',
  'recurring_income',
  'recurring_expense',
  'debt_drawdown',
  'modify_predicted',
  'modify_income',
  'exclude_scheduled'
);

CREATE TABLE IF NOT EXISTS scenario_adjustments (
  adjustment_id SERIAL PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES cashflow_scenarios(scenario_id) ON DELETE CASCADE,

  -- Adjustment details
  adjustment_type scenario_adjustment_type NOT NULL,
  name VARCHAR(200) NOT NULL, -- Display name (e.g., "New office rent", "Sell equipment")

  -- Amount handling
  amount DECIMAL(15,2), -- For income/expense/debt amounts
  percentage DECIMAL(5,2), -- For modify_predicted/modify_income (e.g., -20 for 20% cut)

  -- Timing
  start_month DATE, -- First month this applies (YYYY-MM-01 format)
  end_month DATE, -- Last month (null = ongoing for recurring)

  -- For specific targeting
  category_id INTEGER REFERENCES categories(category_id), -- For modify_predicted on specific category
  scheduled_payment_id INTEGER REFERENCES scheduled_payments(scheduled_payment_id), -- For exclude_scheduled
  account_id INTEGER REFERENCES accounts(account_id), -- For debt_drawdown

  -- Additional metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scenario_adjustments IS 'Individual adjustments within a cash flow scenario';

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_scenarios_entity ON cashflow_scenarios(entity_id);
CREATE INDEX idx_scenarios_active ON cashflow_scenarios(entity_id, is_active);
CREATE INDEX idx_adjustments_scenario ON scenario_adjustments(scenario_id);
CREATE INDEX idx_adjustments_type ON scenario_adjustments(adjustment_type);
CREATE INDEX idx_adjustments_timing ON scenario_adjustments(start_month, end_month);

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE cashflow_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cashflow_scenarios
CREATE POLICY "Users can view scenarios for their entities"
  ON cashflow_scenarios FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scenarios for their entities"
  ON cashflow_scenarios FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenarios for their entities"
  ON cashflow_scenarios FOR UPDATE
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenarios for their entities"
  ON cashflow_scenarios FOR DELETE
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for scenario_adjustments (access through scenario)
CREATE POLICY "Users can view adjustments for their scenarios"
  ON scenario_adjustments FOR SELECT
  USING (
    scenario_id IN (
      SELECT scenario_id FROM cashflow_scenarios
      WHERE entity_id IN (
        SELECT entity_id FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create adjustments for their scenarios"
  ON scenario_adjustments FOR INSERT
  WITH CHECK (
    scenario_id IN (
      SELECT scenario_id FROM cashflow_scenarios
      WHERE entity_id IN (
        SELECT entity_id FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update adjustments for their scenarios"
  ON scenario_adjustments FOR UPDATE
  USING (
    scenario_id IN (
      SELECT scenario_id FROM cashflow_scenarios
      WHERE entity_id IN (
        SELECT entity_id FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete adjustments for their scenarios"
  ON scenario_adjustments FOR DELETE
  USING (
    scenario_id IN (
      SELECT scenario_id FROM cashflow_scenarios
      WHERE entity_id IN (
        SELECT entity_id FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 5: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_scenario_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scenarios_timestamp
  BEFORE UPDATE ON cashflow_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_scenario_timestamp();

CREATE TRIGGER update_adjustments_timestamp
  BEFORE UPDATE ON scenario_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_scenario_timestamp();

-- ============================================================================
-- STEP 6: Create helper view
-- ============================================================================

CREATE VIEW scenario_overview AS
SELECT
  s.scenario_id,
  s.entity_id,
  s.name,
  s.description,
  s.color,
  s.is_active,
  s.created_at,
  s.updated_at,
  COUNT(a.adjustment_id) as adjustment_count,
  COALESCE(SUM(CASE
    WHEN a.adjustment_type IN ('one_time_income', 'recurring_income') THEN a.amount
    ELSE 0
  END), 0) as total_income_adjustments,
  COALESCE(SUM(CASE
    WHEN a.adjustment_type IN ('one_time_expense', 'recurring_expense', 'debt_drawdown') THEN a.amount
    ELSE 0
  END), 0) as total_expense_adjustments
FROM cashflow_scenarios s
LEFT JOIN scenario_adjustments a ON s.scenario_id = a.scenario_id
GROUP BY s.scenario_id;

COMMENT ON VIEW scenario_overview IS 'Summary view of scenarios with adjustment counts and totals';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashflow_scenarios') THEN
    RAISE NOTICE 'SUCCESS: cashflow_scenarios table created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenario_adjustments') THEN
    RAISE NOTICE 'SUCCESS: scenario_adjustments table created';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scenario_adjustment_type') THEN
    RAISE NOTICE 'SUCCESS: scenario_adjustment_type enum created';
  END IF;
END $$;
