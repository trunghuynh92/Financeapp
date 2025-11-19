-- Migration 064: Create investment_contributions table
-- Description: Add support for tracking investments with contributions and withdrawals
-- Date: 2025-01-19

-- =============================================================================
-- 1. Verify 'investment' account type exists (should already be there from migration 037)
-- =============================================================================

-- Investment account type should already exist from migration 037
-- No action needed - just adding a comment for documentation

-- =============================================================================
-- 2. Create investment_contribution table
-- =============================================================================

CREATE TABLE IF NOT EXISTS investment_contribution (
  contribution_id SERIAL PRIMARY KEY,

  -- Entity and account relationships
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  investment_account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  source_account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,

  -- Contribution details
  contribution_amount DECIMAL(15, 2) NOT NULL CHECK (contribution_amount > 0),
  contribution_date DATE NOT NULL,

  -- Transaction linking (optional - may reference main_transactions if that table exists)
  main_transaction_id INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partial_withdrawal', 'fully_withdrawn')),

  -- Optional fields
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- 3. Create indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_investment_contribution_entity
  ON investment_contribution(entity_id);

CREATE INDEX IF NOT EXISTS idx_investment_contribution_investment_account
  ON investment_contribution(investment_account_id);

CREATE INDEX IF NOT EXISTS idx_investment_contribution_source_account
  ON investment_contribution(source_account_id);

CREATE INDEX IF NOT EXISTS idx_investment_contribution_date
  ON investment_contribution(contribution_date DESC);

CREATE INDEX IF NOT EXISTS idx_investment_contribution_status
  ON investment_contribution(status);

CREATE INDEX IF NOT EXISTS idx_investment_contribution_main_transaction
  ON investment_contribution(main_transaction_id);

-- =============================================================================
-- 4. Enable RLS (optional - can be configured later based on actual schema)
-- =============================================================================

-- RLS policies commented out for now - will be added later based on actual schema
-- ALTER TABLE investment_contribution ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. Create trigger for updated_at
-- =============================================================================

CREATE TRIGGER update_investment_contribution_updated_at
  BEFORE UPDATE ON investment_contribution
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. Add transaction types for investments
-- =============================================================================

-- Note: Transaction type structure may vary by schema
-- These types can be added manually if needed:
-- - investment_contribution
-- - investment_withdrawal

-- =============================================================================
-- Migration complete
-- =============================================================================

COMMENT ON TABLE investment_contribution IS 'Tracks investments made from bank/cash accounts into investment accounts';
COMMENT ON COLUMN investment_contribution.contribution_id IS 'Primary key';
COMMENT ON COLUMN investment_contribution.entity_id IS 'Entity that owns the investment';
COMMENT ON COLUMN investment_contribution.investment_account_id IS 'Investment account receiving the funds';
COMMENT ON COLUMN investment_contribution.source_account_id IS 'Bank/cash account providing the funds';
COMMENT ON COLUMN investment_contribution.contribution_amount IS 'Amount invested';
COMMENT ON COLUMN investment_contribution.contribution_date IS 'Date of investment';
COMMENT ON COLUMN investment_contribution.main_transaction_id IS 'Links to the main transaction containing paired debit/credit';
COMMENT ON COLUMN investment_contribution.status IS 'Status: active, partial_withdrawal, or fully_withdrawn';
