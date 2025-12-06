-- ============================================================================
-- Add Equity/Capital Transaction Types
-- Migration: 095_add_equity_transaction_types.sql
--
-- Adds transaction types for shareholder/owner equity transactions:
-- - CAPITAL_IN: Capital contribution from shareholders/owners
-- - CAPITAL_OUT: Owner's drawings/withdrawal
-- - DIVIDEND: Dividend/profit distribution to shareholders
--
-- Also removes redundant INV type (migrates categories to INV_CONTRIB)
-- ============================================================================

-- ============================================================================
-- Step 1: Add new equity transaction types
-- ============================================================================

INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description)
VALUES
  ('capital_contribution', 'Capital Contribution', 'CAPITAL_IN', true, 15, 'Investment/contribution from shareholders or owners into the business'),
  ('owner_drawings', 'Owner''s Drawings', 'CAPITAL_OUT', true, 16, 'Owner/shareholder withdrawal from the business (not salary)'),
  ('dividend_distribution', 'Dividend Distribution', 'DIVIDEND', true, 17, 'Profit distribution to shareholders/owners')
ON CONFLICT (type_code) DO NOTHING;

-- ============================================================================
-- Step 2: Add default categories for the new types
-- ============================================================================

-- Categories for CAPITAL_IN
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Shareholder Investment',
  'SHAREHOLDER_INV',
  transaction_type_id,
  'business',
  70,
  'Direct investment from shareholders'
FROM transaction_types WHERE type_code = 'CAPITAL_IN'
ON CONFLICT DO NOTHING;

INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Owner Contribution',
  'OWNER_CONTRIB',
  transaction_type_id,
  'both',
  71,
  'Personal funds contributed by owner'
FROM transaction_types WHERE type_code = 'CAPITAL_IN'
ON CONFLICT DO NOTHING;

-- Categories for CAPITAL_OUT
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Owner''s Draw',
  'OWNER_DRAW',
  transaction_type_id,
  'both',
  72,
  'Personal withdrawal by owner'
FROM transaction_types WHERE type_code = 'CAPITAL_OUT'
ON CONFLICT DO NOTHING;

INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Partner Withdrawal',
  'PARTNER_DRAW',
  transaction_type_id,
  'business',
  73,
  'Withdrawal by business partner'
FROM transaction_types WHERE type_code = 'CAPITAL_OUT'
ON CONFLICT DO NOTHING;

-- Categories for DIVIDEND
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Cash Dividend',
  'CASH_DIV',
  transaction_type_id,
  'business',
  74,
  'Cash dividend payment to shareholders'
FROM transaction_types WHERE type_code = 'DIVIDEND'
ON CONFLICT DO NOTHING;

INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description)
SELECT
  'Interim Dividend',
  'INTERIM_DIV',
  transaction_type_id,
  'business',
  75,
  'Interim dividend before year-end'
FROM transaction_types WHERE type_code = 'DIVIDEND'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 3: Migrate categories from INV to INV_CONTRIB
-- ============================================================================

UPDATE categories
SET transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV_CONTRIB')
WHERE transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV');

-- ============================================================================
-- Step 4: Deactivate INV type (soft delete - keep for historical reference)
-- ============================================================================

UPDATE transaction_types
SET is_active = false,
    description = 'DEPRECATED: Use INV_CONTRIB for investment contributions. Deactivated in migration 095.'
WHERE type_code = 'INV';

-- ============================================================================
-- Verify the changes
-- ============================================================================

-- Show new types
SELECT type_code, type_display_name, affects_cashflow, is_active
FROM transaction_types
WHERE type_code IN ('CAPITAL_IN', 'CAPITAL_OUT', 'DIVIDEND', 'INV')
ORDER BY display_order;
