-- ============================================================================
-- MIGRATION 077: Add receipt info to main_transaction_details view
-- Purpose: Include receipt_id and receipt_url in the view for display
-- ============================================================================

DROP VIEW IF EXISTS main_transaction_details;

CREATE VIEW main_transaction_details AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.transaction_type_id,
  mt.category_id,
  mt.branch_id,
  mt.project_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transfer_matched_transaction_id,
  mt.drawdown_id,
  mt.loan_disbursement_id,
  mt.investment_contribution_id,
  mt.is_flagged,
  mt.flagged_at,
  mt.flagged_by,
  mt.flag_note,
  mt.created_at,
  mt.updated_at,
  mt.created_by_user_id,
  mt.updated_by_user_id,

  -- Account details
  a.account_name,
  a.bank_name,
  a.account_type,
  a.currency,

  -- Entity details
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,

  -- Transaction type details
  tt.type_code as transaction_type_code,
  tt.type_display_name as transaction_type,
  tt.affects_cashflow,

  -- Category details
  c.category_name,
  c.category_code,

  -- Branch details
  b.branch_name,
  b.branch_code,

  -- Project details
  p.project_name,
  p.project_code,
  p.status as project_status,

  -- Original transaction fields
  ot.is_balance_adjustment,
  ot.checkpoint_id,
  ot.transaction_sequence,
  ot.import_batch_id,

  -- Receipt fields (NEW)
  r.receipt_id,
  r.file_url as receipt_url

FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN projects p ON mt.project_id = p.project_id
LEFT JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
LEFT JOIN receipts r ON mt.raw_transaction_id = r.raw_transaction_id
ORDER BY mt.transaction_date DESC, mt.main_transaction_id;

COMMENT ON VIEW main_transaction_details IS 'Complete view of main transactions with all related information including receipts, investment contributions, flag status, projects, and original transaction metadata';
