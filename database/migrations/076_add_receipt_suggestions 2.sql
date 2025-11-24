/**
 * Migration 076: Add suggested description and category to receipts
 *
 * Purpose: Add AI-detected transaction description and category suggestions
 *
 * Safety: Additive migration - no existing columns modified
 */

-- ============================================================================
-- 1. Add new columns for suggestions
-- ============================================================================

ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS suggested_description TEXT,
ADD COLUMN IF NOT EXISTS suggested_category_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS suggested_category_name VARCHAR(100);

-- ============================================================================
-- 2. Add comments
-- ============================================================================

COMMENT ON COLUMN receipts.suggested_description IS 'AI-suggested transaction description based on merchant name';
COMMENT ON COLUMN receipts.suggested_category_code IS 'AI-suggested category code (e.g., FOOD, TRANSPORT)';
COMMENT ON COLUMN receipts.suggested_category_name IS 'AI-suggested category name (e.g., Food & Dining)';

-- ============================================================================
-- Migration complete
-- ============================================================================
