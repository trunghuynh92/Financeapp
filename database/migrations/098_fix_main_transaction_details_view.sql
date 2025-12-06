-- ============================================================================
-- MIGRATION 098: Fix main_transaction_details view
-- Purpose: Restore missing columns (loan_disbursement_id, project, flag, receipt)
--          that were lost when the view was recreated in migration 079
-- Date: 2025-12-06
-- ============================================================================

-- The view in migration 079 was created with an older column list.
-- This migration recreates it with all the columns from migration 077
-- while keeping DATE types for transaction_date.

DROP VIEW IF EXISTS main_transaction_details CASCADE;

CREATE VIEW main_transaction_details AS
SELECT
  -- Main transaction fields
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.transaction_type_id,
  mt.category_id,
  mt.branch_id,
  mt.project_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,  -- DATE type from migration 079
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transfer_matched_transaction_id,
  mt.drawdown_id,
  mt.loan_disbursement_id,  -- Was missing (used loan_id instead)
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

  -- Receipt fields
  r.receipt_id,
  r.file_url as receipt_url,

  -- Transfer match status (computed)
  CASE
    WHEN mt.transfer_matched_transaction_id IS NOT NULL THEN true
    ELSE false
  END as is_transfer_matched

FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN projects p ON mt.project_id = p.project_id
LEFT JOIN original_transaction ot ON mt.raw_transaction_id = ot.raw_transaction_id
LEFT JOIN receipts r ON mt.raw_transaction_id = r.raw_transaction_id;

COMMENT ON VIEW main_transaction_details IS 'Complete view of main transactions with all related information including loan_disbursement_id, receipts, investment contributions, flag status, projects, and original transaction metadata. DATE type for transaction_date.';

-- Also recreate unmatched_transfers view to ensure consistency
DROP VIEW IF EXISTS unmatched_transfers CASCADE;

CREATE VIEW unmatched_transfers AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  a.account_name,
  a.bank_name,
  e.name AS entity_name,
  tt.type_code,
  tt.type_display_name AS transaction_type
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code IN ('TRF_OUT', 'TRF_IN')
  AND mt.transfer_matched_transaction_id IS NULL
ORDER BY mt.transaction_date DESC;

COMMENT ON VIEW unmatched_transfers IS 'View of unmatched transfer transactions for quick matching UI';

-- Success notice
DO $$
BEGIN
  RAISE NOTICE 'Migration 098: Fixed main_transaction_details view';
  RAISE NOTICE '  - Restored loan_disbursement_id column (was incorrectly using loan_id)';
  RAISE NOTICE '  - Restored project fields (project_name, project_code, project_status)';
  RAISE NOTICE '  - Restored flag fields (is_flagged, flagged_at, flagged_by, flag_note)';
  RAISE NOTICE '  - Restored receipt fields (receipt_id, receipt_url)';
  RAISE NOTICE '  - Restored investment_contribution_id';
  RAISE NOTICE '  - Added currency field';
  RAISE NOTICE '  - Maintained DATE type for transaction_date';
END $$;
