-- Migration 071: Add balance tracking to investment contributions
-- Description: Add columns to track remaining balance and withdrawals, making system consistent with loan/debt
-- Date: 2025-01-20
-- Related: Enables proper tracking of investment withdrawals and balances

-- =============================================================================
-- 1. Add balance tracking columns
-- =============================================================================

ALTER TABLE investment_contribution
  ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_overdrawn BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- 2. Backfill existing records
-- =============================================================================

-- Set remaining_amount = contribution_amount for existing records
-- These are all active contributions with no withdrawals yet
UPDATE investment_contribution
SET remaining_amount = contribution_amount,
    withdrawn_amount = 0,
    is_overdrawn = FALSE
WHERE remaining_amount IS NULL;

-- =============================================================================
-- 3. Add constraints
-- =============================================================================

-- Withdrawn amount must be non-negative
ALTER TABLE investment_contribution
  ADD CONSTRAINT check_withdrawn_amount_non_negative
  CHECK (withdrawn_amount >= 0);

-- Remaining amount validity check
-- Either non-negative (normal) or negative if overdrawn (withdrew gains)
ALTER TABLE investment_contribution
  ADD CONSTRAINT check_remaining_amount_valid
  CHECK (
    (remaining_amount >= 0 AND is_overdrawn = FALSE)
    OR
    (remaining_amount < 0 AND is_overdrawn = TRUE)
  );

-- Make remaining_amount NOT NULL after backfill
ALTER TABLE investment_contribution
  ALTER COLUMN remaining_amount SET NOT NULL;

-- Set default for new records
ALTER TABLE investment_contribution
  ALTER COLUMN remaining_amount SET DEFAULT 0;

-- =============================================================================
-- 4. Update status logic for existing records
-- =============================================================================

-- Update existing statuses based on remaining amount
-- This makes the status field meaningful and consistent
UPDATE investment_contribution
SET status = CASE
  WHEN remaining_amount = contribution_amount THEN 'active'
  WHEN remaining_amount > 0 AND remaining_amount < contribution_amount THEN 'partial_withdrawal'
  WHEN remaining_amount = 0 THEN 'fully_withdrawn'
  WHEN remaining_amount < 0 THEN 'fully_withdrawn'  -- Overdrawn counts as fully withdrawn
  ELSE 'active'
END
WHERE status IS NOT NULL;

-- =============================================================================
-- 5. Add comments
-- =============================================================================

COMMENT ON COLUMN investment_contribution.remaining_amount IS
  'Current remaining balance of the investment. '
  'Calculated as: contribution_amount - withdrawn_amount. '
  'Can be negative if overdrawn (withdrew more than contributed, e.g., gains withdrawal).';

COMMENT ON COLUMN investment_contribution.withdrawn_amount IS
  'Total amount withdrawn from this contribution. '
  'Automatically calculated by summing all INV_WITHDRAW transactions. '
  'Can exceed contribution_amount if investment gains are withdrawn.';

COMMENT ON COLUMN investment_contribution.is_overdrawn IS
  'True if total withdrawals exceed the original contribution amount. '
  'This indicates that investment gains (not just principal) have been withdrawn. '
  'When true, remaining_amount will be negative.';

-- =============================================================================
-- 6. Create index for balance queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_investment_contribution_remaining_amount
  ON investment_contribution(remaining_amount DESC)
  WHERE remaining_amount > 0;

COMMENT ON INDEX idx_investment_contribution_remaining_amount IS
  'Optimizes queries for active contributions with remaining balance (for withdrawal matching).';

-- =============================================================================
-- Migration complete
-- =============================================================================

-- Verification query (comment out in production):
-- SELECT
--   contribution_id,
--   contribution_amount,
--   remaining_amount,
--   withdrawn_amount,
--   is_overdrawn,
--   status
-- FROM investment_contribution
-- ORDER BY contribution_id;
