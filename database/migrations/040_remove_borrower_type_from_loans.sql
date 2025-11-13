-- Migration 040: Remove borrower_type from loan_disbursement
-- Purpose: Remove redundant borrower_type since we now have partner_type in business_partners
-- Created: 2025-11-10

-- Drop the borrower_type column from loan_disbursement
ALTER TABLE loan_disbursement
DROP COLUMN IF EXISTS borrower_type;

-- Verify the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 040 completed successfully!';
    RAISE NOTICE 'Removed borrower_type column from loan_disbursement';
    RAISE NOTICE 'Use partner.partner_type instead';
END $$;
