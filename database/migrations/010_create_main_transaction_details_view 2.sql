-- Migration 010: Create main_transaction_details view
-- This view joins main_transaction with related tables for easy querying

DROP VIEW IF EXISTS main_transaction_details;

CREATE VIEW main_transaction_details AS
SELECT
  -- Main transaction fields (explicitly listed to avoid conflicts)
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.transaction_type_id,  -- IMPORTANT: Include the ID
  mt.category_id,
  mt.branch_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  mt.transfer_matched_transaction_id,
  mt.loan_id,
  mt.created_at,
  mt.updated_at,
  mt.created_by_user_id,
  mt.updated_by_user_id,

  -- Account info
  a.account_name,
  a.bank_name,
  a.account_type,

  -- Entity info (entities table uses id, name, type columns)
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,

  -- Transaction type info
  tt.type_code AS transaction_type_code,
  tt.type_display_name AS transaction_type,
  tt.affects_cashflow,

  -- Category info (optional)
  c.category_name,
  c.category_code,

  -- Branch info (optional)
  b.branch_name,
  b.branch_code

FROM main_transaction mt
INNER JOIN accounts a ON mt.account_id = a.account_id
INNER JOIN entities e ON a.entity_id = e.id
INNER JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id;
