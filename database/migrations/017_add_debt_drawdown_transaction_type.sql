-- ============================================================================
-- MIGRATION 017: Add DEBT_DRAW transaction type
-- Purpose: Add transaction type for debt drawdown on credit line accounts
--          to be matched with DEBT_ACQ on receiving accounts
-- ============================================================================

-- Add DEBT_DRAW transaction type if it doesn't exist
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES ('debt_drawdown', 'Debt Drawdown', 'DEBT_DRAW', true, 8, 'Drawdown from credit line or loan account')
ON CONFLICT (type_code) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification:
-- SELECT * FROM transaction_types WHERE type_code = 'DEBT_DRAW';
