/**
 * Migration 046: Add CC_PAY Transaction Type for Credit Card Payments
 *
 * Purpose: Add CC_PAY transaction type for receiving credit card payments
 *
 * Why CC_PAY is needed:
 * - Credit cards use CC_CHARGE for expenses (affects_cashflow=false)
 * - Credit cards need CC_PAY for payments (affects_cashflow=true)
 * - Keeps credit card mechanics separate from DEBT_PAY (used for credit lines/term loans)
 * - Clean separation: CC_CHARGE/CC_PAY vs DEBT_TAKE/DEBT_PAY
 *
 * Payment flow:
 * - Bank Account: TRF_OUT (debit, money leaving)
 * - Credit Card: CC_PAY (credit, reducing debt)
 * - Match: TRF_OUT ↔ CC_PAY
 *
 * See CREDIT_CARD_MECHANICS.md for full explanation
 */

-- Add CC_PAY transaction type
INSERT INTO transaction_types (
  type_code,
  type_name,
  type_display_name,
  affects_cashflow,
  display_order,
  description
)
VALUES (
  'CC_PAY',
  'credit_card_payment',
  'Credit Card Payment',
  true,  -- DOES affect cashflow (cash actually moved from bank)
  11,
  'Payment received on credit card - reduces debt with cashflow impact'
)
ON CONFLICT (type_code) DO NOTHING;

-- Verify the transaction type was created
DO $$
DECLARE
  v_type_id INTEGER;
BEGIN
  SELECT transaction_type_id INTO v_type_id
  FROM transaction_types
  WHERE type_code = 'CC_PAY';

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create CC_PAY transaction type';
  ELSE
    RAISE NOTICE 'CC_PAY transaction type created with ID: %', v_type_id;
  END IF;
END $$;

-- Note: No categories needed for CC_PAY (it's a payment, not an expense)

COMMENT ON TABLE transaction_types IS 'Transaction type definitions including CC_PAY for credit card payments (affects_cashflow=true)';
