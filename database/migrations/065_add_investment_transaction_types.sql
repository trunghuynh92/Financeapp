-- Migration 065: Add investment transaction types
-- Description: Add investment_contribution and investment_withdrawal transaction types
-- Date: 2025-01-19

-- =============================================================================
-- 1. Add investment_contribution transaction type
-- =============================================================================

INSERT INTO transaction_types (
  type_name,
  type_display_name,
  type_code,
  description,
  affects_cashflow,
  display_order,
  is_active
) VALUES (
  'investment_contribution',
  'Investment Contribution',
  'INV_CONTRIB',
  'Money contributed from bank/cash account to investment account',
  true,
  60,
  true
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. Add investment_withdrawal transaction type
-- =============================================================================

INSERT INTO transaction_types (
  type_name,
  type_display_name,
  type_code,
  description,
  affects_cashflow,
  display_order,
  is_active
) VALUES (
  'investment_withdrawal',
  'Investment Withdrawal',
  'INV_WITHDRAW',
  'Money withdrawn from investment account back to bank/cash account',
  true,
  61,
  true
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Migration complete
-- =============================================================================

COMMENT ON TABLE transaction_types IS 'Defines all transaction types in the system';
