/**
 * Migration 045: Add Categories for CC_CHARGE Transaction Type
 *
 * Purpose: Duplicate all EXP categories for CC_CHARGE type
 *
 * Why: CC_CHARGE is essentially an expense (just like EXP) but with different
 * cashflow treatment. Users should be able to categorize credit card charges
 * with the same categories as cash expenses (Groceries, Gas, etc.)
 *
 * This migration creates matching categories for CC_CHARGE based on existing EXP categories.
 */

-- Get the CC_CHARGE transaction type ID
DO $$
DECLARE
  v_cc_charge_type_id INTEGER;
  v_exp_type_id INTEGER;
BEGIN
  -- Get CC_CHARGE type ID
  SELECT transaction_type_id INTO v_cc_charge_type_id
  FROM transaction_types
  WHERE type_code = 'CC_CHARGE';

  IF v_cc_charge_type_id IS NULL THEN
    RAISE EXCEPTION 'CC_CHARGE transaction type not found. Please run migration 044 first.';
  END IF;

  -- Get EXP type ID
  SELECT transaction_type_id INTO v_exp_type_id
  FROM transaction_types
  WHERE type_code = 'EXP';

  IF v_exp_type_id IS NULL THEN
    RAISE EXCEPTION 'EXP transaction type not found.';
  END IF;

  RAISE NOTICE 'CC_CHARGE type ID: %, EXP type ID: %', v_cc_charge_type_id, v_exp_type_id;
END $$;

-- Duplicate all EXP categories for CC_CHARGE
-- We'll append '_CC' to the category_code to make them unique
INSERT INTO categories (
  category_name,
  category_code,
  transaction_type_id,
  entity_type,
  parent_category_id,
  description,
  display_order,
  is_active
)
SELECT
  category_name,  -- Same name (e.g., "Groceries")
  category_code || '_CC',  -- Unique code (e.g., "FOOD_CC")
  (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'CC_CHARGE'),  -- CC_CHARGE type
  entity_type,  -- Same entity type
  NULL,  -- No parent for now (could be enhanced later)
  description,  -- Same description
  display_order + 100,  -- Offset display order to group them
  is_active
FROM categories
WHERE transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP')
  AND NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.category_code = categories.category_code || '_CC'
  );

-- Verify categories were created
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM categories
  WHERE transaction_type_id = (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'CC_CHARGE');

  RAISE NOTICE 'Created % categories for CC_CHARGE transaction type', v_count;
END $$;

-- Create index on transaction_type_id if it doesn't exist (should already exist from migration 006)
CREATE INDEX IF NOT EXISTS idx_categories_transaction_type ON categories(transaction_type_id);

COMMENT ON TABLE categories IS 'Transaction categories including duplicates for CC_CHARGE (credit card expenses)';
