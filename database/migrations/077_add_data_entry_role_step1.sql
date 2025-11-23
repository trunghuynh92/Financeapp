-- Migration 077 Step 1: Add Data Entry Role to Enum
-- IMPORTANT: This must be run in a separate transaction before step 2

-- Add 'data_entry' to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'data_entry';

-- That's it! Commit this transaction before running step 2.
