-- Migration 063: Fix Schema Issues
-- Purpose: Fix missing columns, constraints, and view definitions
-- Date: 2025-01-18
-- Dependencies: 060_create_contracts_and_amendments.sql

-- ==============================================================================
-- 1. Update scheduled_payment_overview view to include contract_id
-- ==============================================================================

-- Drop existing view first (can't change column order with CREATE OR REPLACE)
DROP VIEW IF EXISTS scheduled_payment_overview;

CREATE VIEW scheduled_payment_overview AS
SELECT
  sp.scheduled_payment_id,
  sp.entity_id,
  sp.category_id,
  sp.contract_id,  -- ← Added
  c.category_name,
  sp.contract_name,
  sp.contract_type,
  sp.payee_name,
  sp.contract_number,
  sp.payment_amount,
  sp.schedule_type,
  sp.frequency,
  sp.payment_day,
  sp.start_date,
  sp.end_date,
  sp.custom_schedule,
  sp.status,
  sp.is_active,
  sp.notes,
  sp.created_at,
  sp.updated_at,

  -- Instance summaries
  COUNT(spi.instance_id) as total_instances,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'pending') as pending_count,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'paid') as paid_count,
  COUNT(spi.instance_id) FILTER (WHERE spi.status = 'overdue') as overdue_count,

  -- Next due date
  MIN(spi.due_date) FILTER (WHERE spi.status = 'pending') as next_due_date,

  -- Payment totals
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'paid'), 0) as total_paid,
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'pending'), 0) as total_pending,
  COALESCE(SUM(spi.amount) FILTER (WHERE spi.status = 'overdue'), 0) as total_overdue

FROM scheduled_payments sp
LEFT JOIN scheduled_payment_instances spi ON sp.scheduled_payment_id = spi.scheduled_payment_id
LEFT JOIN categories c ON sp.category_id = c.category_id
GROUP BY
  sp.scheduled_payment_id,
  sp.entity_id,
  sp.category_id,
  sp.contract_id,  -- ← Added
  c.category_name,
  sp.contract_name,
  sp.contract_type,
  sp.payee_name,
  sp.contract_number,
  sp.payment_amount,
  sp.schedule_type,
  sp.frequency,
  sp.payment_day,
  sp.start_date,
  sp.end_date,
  sp.custom_schedule,
  sp.status,
  sp.is_active,
  sp.notes,
  sp.created_at,
  sp.updated_at;

-- ==============================================================================
-- 2. Remove payment_type constraint (it's now used as free-form text)
-- ==============================================================================

-- Drop existing constraint if it exists
-- payment_type is now used as a free-form "Schedule Name" field (e.g., "Year 1", "Year 2")
-- not as an enum of predefined types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_payments_payment_type_check'
  ) THEN
    ALTER TABLE scheduled_payments DROP CONSTRAINT scheduled_payments_payment_type_check;
    RAISE NOTICE 'Dropped scheduled_payments_payment_type_check constraint';
  END IF;
END $$;

-- ==============================================================================
-- 3. Note: accounts.current_balance is calculated, not stored
-- ==============================================================================
-- The "current_balance" error occurs when code tries to select it from accounts table.
-- Current balance should be calculated from transactions, not stored as a column.
-- This is already correctly implemented with calculated balance functions.
-- No migration needed - update client code to use calculated balance functions instead.

-- ==============================================================================
-- 4. Note: loan_disbursement_instances table
-- ==============================================================================
-- This table may have been planned but not yet implemented in migrations.
-- The error occurs when code references a non-existent table.
-- For now, this will be tracked as a future enhancement.
-- Client code should check table existence before querying.

-- ==============================================================================
-- 5. Note: get_income_expense_report function
-- ==============================================================================
-- This function may have been planned but not yet implemented.
-- The error occurs when client code calls a non-existent function.
-- A fallback query is used when the RPC call fails.
-- For now, this will be tracked as a future enhancement.
