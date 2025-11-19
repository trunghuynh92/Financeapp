-- Migration 066: Add investment_contribution_id to main_transaction
-- Description: Link main transactions to investment contributions
-- Date: 2025-01-19

-- =============================================================================
-- 1. Add investment_contribution_id column to main_transaction
-- =============================================================================

ALTER TABLE main_transaction
ADD COLUMN IF NOT EXISTS investment_contribution_id INTEGER
REFERENCES investment_contribution(contribution_id) ON DELETE SET NULL;

-- =============================================================================
-- 2. Create index for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_main_transaction_investment_contribution
  ON main_transaction(investment_contribution_id);

-- =============================================================================
-- Migration complete
-- =============================================================================

COMMENT ON COLUMN main_transaction.investment_contribution_id IS 'Links transaction to investment contribution';
