-- ============================================================================
-- MIGRATION 019: Add transfer_matched_transaction_id to main_transaction_details view
-- Purpose: Include matching information in the view for debt and transfer matching
-- ============================================================================

DROP VIEW IF EXISTS main_transaction_details;

CREATE VIEW main_transaction_details AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transaction_subtype,
  mt.drawdown_id,
  mt.transfer_matched_transaction_id,
  a.account_name,
  a.bank_name,
  a.account_type,
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,
  tt.transaction_type_id,
  tt.type_code as transaction_type_code,
  tt.type_display_name as transaction_type,
  tt.affects_cashflow,
  c.category_id,
  c.category_name,
  c.category_code,
  b.branch_id,
  b.branch_name,
  b.branch_code,
  dd.drawdown_reference,
  dd.drawdown_date,
  dd.original_amount as drawdown_original_amount,
  dd.remaining_balance as drawdown_remaining_balance,
  dd.due_date as drawdown_due_date,
  dd.status as drawdown_status,
  mt.created_at,
  mt.updated_at
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN debt_drawdown dd ON mt.drawdown_id = dd.drawdown_id
ORDER BY mt.transaction_date DESC, mt.main_transaction_id;

COMMENT ON VIEW main_transaction_details IS 'Complete view of main transactions with all related information including drawdown details and matching information';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification:
-- SELECT transfer_matched_transaction_id FROM main_transaction_details LIMIT 5;
