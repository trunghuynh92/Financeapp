-- Check contracts
SELECT
  contract_id,
  contract_number,
  contract_name,
  entity_id,
  is_active
FROM contracts
WHERE contract_number = 'LEASE-1414'
OR contract_name LIKE '%413%'
ORDER BY created_at DESC;

-- Check scheduled_payments
SELECT
  scheduled_payment_id,
  contract_id,
  payment_type,
  payee_name,
  payment_amount,
  entity_id,
  is_active,
  start_date,
  end_date
FROM scheduled_payments
ORDER BY created_at DESC
LIMIT 10;

-- Check if there's a link
SELECT
  c.contract_id,
  c.contract_number,
  c.contract_name,
  sp.scheduled_payment_id,
  sp.payment_type,
  sp.payment_amount,
  sp.is_active as schedule_is_active
FROM contracts c
LEFT JOIN scheduled_payments sp ON c.contract_id = sp.contract_id
WHERE c.contract_number = 'LEASE-1414'
OR c.contract_name LIKE '%413%';
