-- Migration 061: Remove payment_type CHECK constraint
-- Purpose: Allow flexible payment type labels (e.g., "Year 1", "Year 2", "Q1 2025")
-- Date: 2025-01-17
-- Dependencies: 060_create_contracts_and_amendments.sql

-- ==============================================================================
-- Remove the CHECK constraint on payment_type
-- ==============================================================================

-- Drop the existing constraint
ALTER TABLE scheduled_payments
DROP CONSTRAINT IF EXISTS scheduled_payments_payment_type_check;

-- Update the comment to reflect the new flexibility
COMMENT ON COLUMN scheduled_payments.payment_type IS
'Flexible label for payment identification. Can be predefined types (rent, utilities) or custom labels (Year 1, Year 2, Q1 2025)';

-- ==============================================================================
-- Migration Complete
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 061 completed successfully!';
  RAISE NOTICE '  - Removed CHECK constraint on payment_type';
  RAISE NOTICE '  - payment_type now accepts any text value';
END $$;
