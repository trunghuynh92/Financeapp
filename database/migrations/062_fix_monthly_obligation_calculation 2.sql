-- Migration 062: Fix Monthly Obligation Calculation
-- Purpose: Only count payment schedules that are currently active (within date range)
-- Date: 2025-01-17
-- Dependencies: 060_create_contracts_and_amendments.sql

-- ==============================================================================
-- Update contract_overview view to only count current period schedules
-- ==============================================================================

CREATE OR REPLACE VIEW contract_overview AS
SELECT
  c.contract_id,
  c.entity_id,
  c.contract_number,
  c.contract_name,
  c.contract_type,
  c.counterparty,
  c.counterparty_contact,
  c.signing_date,
  c.effective_date,
  c.expiration_date,
  c.total_contract_value,
  c.status,
  c.renewal_count,
  c.is_active,
  c.created_at,
  c.updated_at,

  -- Payment schedules count (all schedules)
  COUNT(DISTINCT sp.scheduled_payment_id) as payment_schedules_count,

  -- Total monthly obligation (ONLY current period schedules)
  COALESCE(SUM(
    CASE
      WHEN sp.frequency = 'monthly'
        AND sp.start_date <= CURRENT_DATE
        AND (sp.end_date IS NULL OR sp.end_date >= CURRENT_DATE)
      THEN sp.payment_amount
      ELSE 0
    END
  ), 0) as total_monthly_obligation,

  -- Amendment count
  (SELECT COUNT(*) FROM contract_amendments ca WHERE ca.contract_id = c.contract_id) as amendments_count,

  -- Active amendments count
  (SELECT COUNT(*)
   FROM contract_amendments ca
   WHERE ca.contract_id = c.contract_id
     AND ca.status = 'approved'
     AND ca.effective_start_date <= CURRENT_DATE
     AND (ca.effective_end_date IS NULL OR ca.effective_end_date >= CURRENT_DATE)
  ) as active_amendments_count,

  -- Days until expiration
  CASE
    WHEN c.expiration_date IS NOT NULL THEN
      (c.expiration_date - CURRENT_DATE)
    ELSE NULL
  END as days_until_expiration,

  -- Contract status indicators
  CASE
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE THEN 'expired'
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE c.status
  END as derived_status

FROM contracts c
LEFT JOIN scheduled_payments sp ON sp.contract_id = c.contract_id AND sp.is_active = TRUE
GROUP BY c.contract_id;

COMMENT ON VIEW contract_overview IS 'Complete contract overview with payment schedules and amendments summary. Monthly obligation only includes schedules currently in effect.';

-- ==============================================================================
-- Migration Complete
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 062 completed successfully!';
  RAISE NOTICE '  - Updated contract_overview view';
  RAISE NOTICE '  - Monthly obligation now only counts current period schedules';
  RAISE NOTICE '  - Schedules must have: start_date <= TODAY AND (end_date IS NULL OR end_date >= TODAY)';
END $$;
