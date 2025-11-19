-- Migration 039: Create business_partners table
-- Purpose: Centralized contact management for all business relationships
-- Created: 2025-11-10

-- ==============================================================================
-- Step 1: Create partner_type enum
-- ==============================================================================

CREATE TYPE partner_type AS ENUM (
    'customer',      -- People/companies who buy from you
    'vendor',        -- People/companies you buy from
    'employee',      -- Employees (for payroll, advances)
    'owner',         -- Business owners
    'partner',       -- Business partners
    'lender',        -- Financial institutions, people you borrow from
    'other'          -- Other relationships
);

-- ==============================================================================
-- Step 2: Create business_partners table
-- ==============================================================================

CREATE TABLE business_partners (
    partner_id SERIAL PRIMARY KEY,

    -- Entity relationship
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Partner classification
    partner_type partner_type NOT NULL DEFAULT 'other',

    -- Basic information
    partner_name TEXT NOT NULL,
    legal_name TEXT,  -- For companies: official registered name
    display_name TEXT,  -- Short name for display

    -- Identification
    tax_id TEXT,  -- Tax ID / Business registration number
    registration_number TEXT,  -- Additional registration number

    -- Contact information
    contact_person TEXT,  -- For companies: primary contact person
    email TEXT,
    phone TEXT,
    mobile TEXT,
    website TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,

    -- Banking information
    bank_account_number TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    bank_swift_code TEXT,

    -- Additional details
    notes TEXT,
    tags TEXT[],  -- Array of tags for categorization

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id)
);

-- ==============================================================================
-- Step 3: Create indexes
-- ==============================================================================

CREATE INDEX idx_business_partners_entity_id ON business_partners(entity_id);
CREATE INDEX idx_business_partners_partner_type ON business_partners(partner_type);
CREATE INDEX idx_business_partners_partner_name ON business_partners(partner_name);
CREATE INDEX idx_business_partners_is_active ON business_partners(is_active);
CREATE INDEX idx_business_partners_email ON business_partners(email) WHERE email IS NOT NULL;
CREATE INDEX idx_business_partners_tax_id ON business_partners(tax_id) WHERE tax_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_business_partners_entity_type_active ON business_partners(entity_id, partner_type, is_active);

-- ==============================================================================
-- Step 4: Add comments
-- ==============================================================================

COMMENT ON TABLE business_partners IS 'Centralized contact management for all business relationships';
COMMENT ON COLUMN business_partners.partner_type IS 'Type of business relationship';
COMMENT ON COLUMN business_partners.legal_name IS 'Official registered name for companies';
COMMENT ON COLUMN business_partners.display_name IS 'Short name for UI display';
COMMENT ON COLUMN business_partners.tags IS 'Array of tags for flexible categorization';

-- ==============================================================================
-- Step 5: Create updated_at trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_business_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_partners_updated_at
    BEFORE UPDATE ON business_partners
    FOR EACH ROW
    EXECUTE FUNCTION update_business_partners_updated_at();

-- ==============================================================================
-- Step 6: RLS Policies
-- ==============================================================================

ALTER TABLE business_partners ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view partners for their entities
CREATE POLICY "Users can view business partners for their entities"
    ON business_partners FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = business_partners.entity_id
            AND eu.user_id = auth.uid()
        )
    );

-- INSERT: Editor+ can create partners
CREATE POLICY "Editor and above can create business partners"
    ON business_partners FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = business_partners.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- UPDATE: Editor+ can update partners
CREATE POLICY "Editor and above can update business partners"
    ON business_partners FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = business_partners.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = business_partners.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor')
        )
    );

-- DELETE: Admin+ can delete partners
CREATE POLICY "Admin and above can delete business partners"
    ON business_partners FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM entity_users eu
            WHERE eu.entity_id = business_partners.entity_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );

-- ==============================================================================
-- Step 7: Update loan_disbursement to reference business_partners
-- ==============================================================================

-- Add partner_id column
ALTER TABLE loan_disbursement
ADD COLUMN partner_id INTEGER REFERENCES business_partners(partner_id) ON DELETE RESTRICT;

-- Create index
CREATE INDEX idx_loan_disbursement_partner_id ON loan_disbursement(partner_id);

-- Make borrower_name nullable (we'll use partner reference instead)
ALTER TABLE loan_disbursement
ALTER COLUMN borrower_name DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN loan_disbursement.partner_id IS 'Reference to business partner (borrower)';

-- ==============================================================================
-- Migration Complete
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 039 completed successfully!';
    RAISE NOTICE 'Created business_partners table with RLS policies';
    RAISE NOTICE 'Updated loan_disbursement to reference business_partners';
    RAISE NOTICE 'Next: Update debt_drawdown and other tables to use business_partners';
END $$;
