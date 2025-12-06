-- Migration: Fix calculate_balance_up_to_date to include balance adjustments
-- Date: 2025-12-06
-- Issue: Cash flow dashboard showing incorrect balance because opening balances were excluded

-- The original function excluded balance adjustments (is_balance_adjustment = false)
-- But balance adjustments represent the account's opening balance when transactions are imported
-- They SHOULD be included in the balance calculation

CREATE OR REPLACE FUNCTION public.calculate_balance_up_to_date(p_account_id integer, p_up_to_date date)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance DECIMAL(15,2);
BEGIN
  -- Calculate balance from all transactions up to the specified date
  -- INCLUDES balance adjustments (opening balances)
  SELECT COALESCE(
    SUM(COALESCE(credit_amount, 0)) - SUM(COALESCE(debit_amount, 0)),
    0
  )
  INTO v_balance
  FROM original_transaction
  WHERE account_id = p_account_id
    AND transaction_date <= p_up_to_date;

  RETURN v_balance;
END;
$function$;

COMMENT ON FUNCTION public.calculate_balance_up_to_date IS
'Calculates account balance up to a specific date, including balance adjustments (opening balances).
Used by cash flow projection to get current account balance.';
