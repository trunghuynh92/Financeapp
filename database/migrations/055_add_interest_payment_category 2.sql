-- Migration 055: Add Interest Payment Category
-- Purpose: Add template category for interest payments on loans and credit facilities
-- Date: 2025-01-17

-- Add Interest Payment category for business entities
INSERT INTO categories (
  category_name,
  category_code,
  transaction_type_id,
  entity_type,
  display_order,
  description,
  is_active
) VALUES (
  'Interest Payment',
  'INTEREST_PAY',
  (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'),
  'business',
  13,
  'Interest paid on loans, credit lines, and other debt facilities',
  true
);

-- Add Interest Payment category for personal entities
INSERT INTO categories (
  category_name,
  category_code,
  transaction_type_id,
  entity_type,
  display_order,
  description,
  is_active
) VALUES (
  'Interest Payment',
  'INTEREST_PAY',
  (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'),
  'personal',
  30,
  'Interest paid on loans, credit lines, and other debt facilities',
  true
);

-- Verify the categories were created
DO $$
DECLARE
  business_count INTEGER;
  personal_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO business_count
  FROM categories
  WHERE category_code = 'INTEREST_PAY' AND entity_type = 'business';

  SELECT COUNT(*) INTO personal_count
  FROM categories
  WHERE category_code = 'INTEREST_PAY' AND entity_type = 'personal';

  IF business_count = 0 OR personal_count = 0 THEN
    RAISE EXCEPTION 'Failed to create Interest Payment categories';
  END IF;

  RAISE NOTICE 'Successfully created Interest Payment categories (business: %, personal: %)',
    business_count, personal_count;
END $$;
