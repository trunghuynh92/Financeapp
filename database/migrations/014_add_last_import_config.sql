-- Migration: Add last_import_config to accounts table
-- Purpose: Store the last successful import configuration for each account
-- This improves UX by pre-filling column mappings on subsequent imports

-- Add last_import_config column to accounts table
ALTER TABLE accounts
ADD COLUMN last_import_config JSONB DEFAULT NULL;

COMMENT ON COLUMN accounts.last_import_config IS
'Stores the last successful import configuration including column mappings, date format, and other settings. This allows the system to pre-fill the import dialog with the last used configuration for better UX.';

-- Example structure of last_import_config:
-- {
--   "columnMappings": [
--     {"csvColumn": "Transaction Date", "mappedTo": "transaction_date", "dateFormat": "dd/mm/yyyy"},
--     {"csvColumn": "Description", "mappedTo": "description"},
--     {"csvColumn": "Debit", "mappedTo": "debit_amount"},
--     {"csvColumn": "Credit", "mappedTo": "credit_amount"}
--   ],
--   "dateFormat": "dd/mm/yyyy",
--   "hasNegativeDebits": false,
--   "lastImportDate": "2024-11-08T10:30:00Z"
-- }
