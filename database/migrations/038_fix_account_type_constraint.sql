-- Migration 038: Fix account_type CHECK constraint to include loan_receivable
-- Purpose: Add 'loan_receivable' to the allowed account types
-- Created: 2025-11-10

-- Drop the existing CHECK constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;

-- Add the new CHECK constraint with loan_receivable included
ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check
  CHECK (account_type IN ('bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan', 'loan_receivable'));

-- Verify the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 038 completed successfully!';
    RAISE NOTICE 'Updated account_type CHECK constraint to include loan_receivable';
END $$;
