/**
 * Migration 044: Add Credit Card Charge Transaction Type
 *
 * Purpose: Add CC_CHARGE transaction type for credit card purchases
 *
 * Why CC_CHARGE is needed:
 * - Credit card swipes are expenses (need to show in expense reports)
 * - But they don't affect cashflow until paid (cash basis accounting)
 * - Using EXP would double-count cashflow (once on swipe, once on payment)
 * - CC_CHARGE has affects_cashflow=false to prevent double counting
 *
 * See CREDIT_CARD_MECHANICS.md for full explanation
 */

-- Add CC_CHARGE transaction type
INSERT INTO transaction_types (
  type_code,
  type_name,
  type_display_name,
  affects_cashflow,
  display_order,
  description
)
VALUES (
  'CC_CHARGE',
  'credit_card_charge',
  'Credit Card Charge',
  false,  -- Does NOT affect cashflow (cash moves when you pay, not when you swipe)
  10,
  'Expense charged to credit card - increases debt without immediate cashflow impact'
)
ON CONFLICT (type_code) DO NOTHING;

-- Verify the transaction type was created
DO $$
DECLARE
  v_type_id INTEGER;
BEGIN
  SELECT transaction_type_id INTO v_type_id
  FROM transaction_types
  WHERE type_code = 'CC_CHARGE';

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create CC_CHARGE transaction type';
  ELSE
    RAISE NOTICE 'CC_CHARGE transaction type created with ID: %', v_type_id;
  END IF;
END $$;

-- Note: No existing data migration needed as this is a new transaction type
-- Credit cards previously used EXP or TRF_IN/TRF_OUT which remain valid
-- Users can start using CC_CHARGE for new transactions

COMMENT ON TABLE transaction_types IS 'Transaction type definitions including CC_CHARGE for credit card purchases (affects_cashflow=false)';
