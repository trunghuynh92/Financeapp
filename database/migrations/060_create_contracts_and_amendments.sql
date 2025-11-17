-- Migration 060: Create Contracts and Amendments System
-- Purpose: Separate contract management from payment schedules, enable amendment tracking
-- Date: 2025-01-17
-- Dependencies: 059_create_scheduled_payments.sql

-- ==============================================================================
-- Create contracts table (master agreements)
-- ==============================================================================

CREATE TABLE contracts (
  contract_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Contract Identification
  contract_number VARCHAR(100) NOT NULL,
  contract_name VARCHAR(255) NOT NULL,
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN (
    'lease', 'service', 'construction', 'subscription', 'purchase', 'supply', 'other'
  )),

  -- Parties
  counterparty VARCHAR(255) NOT NULL,  -- Main party (landlord, vendor, contractor)
  counterparty_contact TEXT,           -- Contact details (email, phone)
  counterparty_address TEXT,           -- Business address

  -- Contract Terms
  signing_date DATE,
  effective_date DATE NOT NULL,
  expiration_date DATE,

  -- Total Contract Value (optional, for fixed-price contracts)
  total_contract_value DECIMAL(15,2),

  -- Terms & Conditions
  payment_terms TEXT,                  -- "Net 30", "Monthly in advance", etc.
  renewal_terms TEXT,                  -- "Auto-renew for 1 year unless 90 days notice"
  termination_terms TEXT,              -- "Either party can terminate with 60 days notice"
  special_terms TEXT,                  -- Other important terms

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Being prepared
    'pending_signature',  -- Sent for signing
    'active',            -- Currently in effect
    'expired',           -- Past expiration date
    'terminated',        -- Ended early
    'renewed'            -- Replaced by renewal
  )),

  -- Renewal Tracking
  renewed_from_contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE SET NULL,
  renewal_count INTEGER DEFAULT 0,

  -- Documentation
  document_url TEXT,                   -- Link to signed contract PDF
  attachments JSONB,                   -- Array of additional documents

  -- Notes
  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_contract_dates CHECK (
    expiration_date IS NULL OR expiration_date >= effective_date
  ),
  CONSTRAINT valid_contract_value CHECK (
    total_contract_value IS NULL OR total_contract_value > 0
  ),
  CONSTRAINT unique_contract_number_per_entity UNIQUE (entity_id, contract_number)
);

-- ==============================================================================
-- Create contract_amendments table
-- ==============================================================================

CREATE TABLE contract_amendments (
  amendment_id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,

  -- Amendment Identification
  amendment_number INTEGER NOT NULL,  -- 1, 2, 3... (sequential per contract)
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Effective Period
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,

  -- Amendment Type & Details
  amendment_type VARCHAR(50) NOT NULL CHECK (amendment_type IN (
    'amount_change',           -- Change payment amount
    'payment_schedule_change', -- Change frequency or dates
    'term_extension',          -- Extend contract period
    'term_reduction',          -- Shorten contract period
    'scope_change',            -- Change deliverables/services
    'party_change',            -- Change counterparty details
    'other'
  )),

  -- New Values (depending on amendment_type)
  new_payment_amount DECIMAL(15,2),     -- For amount_change
  new_frequency VARCHAR(20),            -- For payment_schedule_change
  new_expiration_date DATE,             -- For term_extension/reduction

  -- Description
  title VARCHAR(255) NOT NULL,          -- "Rent Reduction - COVID Relief"
  description TEXT NOT NULL,            -- Detailed explanation
  reason TEXT,                          -- Business reason

  -- Financial Impact
  estimated_impact DECIMAL(15,2),       -- Estimated cost/saving
  impact_direction VARCHAR(10) CHECK (impact_direction IN ('increase', 'decrease', 'neutral')),

  -- Documentation
  amendment_document_url TEXT,          -- Link to signed amendment PDF

  -- Approval Workflow
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Being prepared
    'pending_approval',   -- Waiting for approval
    'approved',          -- Approved and active
    'rejected',          -- Not approved
    'superseded'         -- Replaced by newer amendment
  )),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_amendment_dates CHECK (
    effective_end_date IS NULL OR effective_end_date >= effective_start_date
  ),
  CONSTRAINT valid_amendment_amount CHECK (
    new_payment_amount IS NULL OR new_payment_amount > 0
  ),
  CONSTRAINT unique_amendment_number_per_contract UNIQUE (contract_id, amendment_number)
);

-- ==============================================================================
-- Alter scheduled_payments to link to contracts
-- ==============================================================================

-- Add contract reference and payment type
ALTER TABLE scheduled_payments
ADD COLUMN contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE CASCADE,
ADD COLUMN payment_type VARCHAR(50) DEFAULT 'primary' CHECK (payment_type IN (
  'primary',      -- Main payment (e.g., base rent)
  'rent',         -- Rent component
  'service_charge', -- Service/maintenance charges
  'utilities',    -- Utility charges
  'parking',      -- Parking fees
  'deposit',      -- Security deposit
  'milestone',    -- Construction milestones
  'retainer',     -- Service retainer
  'subscription', -- Subscription fee
  'other'
));

-- Add index for contract_id
CREATE INDEX idx_scheduled_payments_contract ON scheduled_payments(contract_id);

-- Update RLS policies to work with or without contract_id
DROP POLICY IF EXISTS "Users can view scheduled payments for their entities" ON scheduled_payments;
CREATE POLICY "Users can view scheduled payments for their entities" ON scheduled_payments
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- Alter scheduled_payment_instances to link to amendments
-- ==============================================================================

-- Add amendment reference
ALTER TABLE scheduled_payment_instances
ADD COLUMN amendment_id INTEGER REFERENCES contract_amendments(amendment_id) ON DELETE SET NULL,
ADD COLUMN is_amended BOOLEAN DEFAULT FALSE,
ADD COLUMN original_amount DECIMAL(15,2);  -- Store original amount before amendment

-- Add index for amendment_id
CREATE INDEX idx_payment_instances_amendment ON scheduled_payment_instances(amendment_id);

-- Add comment
COMMENT ON COLUMN scheduled_payment_instances.amendment_id IS 'Links to amendment that modified this instance';
COMMENT ON COLUMN scheduled_payment_instances.original_amount IS 'Original amount before any amendments';

-- ==============================================================================
-- Indexes for performance
-- ==============================================================================

-- Contracts indexes
CREATE INDEX idx_contracts_entity ON contracts(entity_id);
CREATE INDEX idx_contracts_status ON contracts(status, is_active);
CREATE INDEX idx_contracts_counterparty ON contracts(counterparty);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_dates ON contracts(effective_date, expiration_date);
CREATE INDEX idx_contracts_active ON contracts(entity_id, status)
  WHERE is_active = TRUE AND status = 'active';

-- Amendments indexes
CREATE INDEX idx_amendments_contract ON contract_amendments(contract_id);
CREATE INDEX idx_amendments_status ON contract_amendments(status);
CREATE INDEX idx_amendments_dates ON contract_amendments(effective_start_date, effective_end_date);
CREATE INDEX idx_amendments_type ON contract_amendments(amendment_type);

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;

-- Contracts Policies
CREATE POLICY "Users can view contracts for their entities" ON contracts
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contracts for their entities" ON contracts
  FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can update contracts for their entities" ON contracts
  FOR UPDATE
  USING (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can delete contracts for their entities" ON contracts
  FOR DELETE
  USING (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- Amendments Policies
CREATE POLICY "Users can view amendments for their contracts" ON contract_amendments
  FOR SELECT
  USING (
    contract_id IN (
      SELECT contract_id
      FROM contracts
      WHERE entity_id IN (
        SELECT entity_id
        FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert amendments for their contracts" ON contract_amendments
  FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT c.contract_id
      FROM contracts c
      JOIN entity_users eu ON c.entity_id = eu.entity_id
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can update amendments for their contracts" ON contract_amendments
  FOR UPDATE
  USING (
    contract_id IN (
      SELECT c.contract_id
      FROM contracts c
      JOIN entity_users eu ON c.entity_id = eu.entity_id
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    contract_id IN (
      SELECT c.contract_id
      FROM contracts c
      JOIN entity_users eu ON c.entity_id = eu.entity_id
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can delete amendments for their contracts" ON contract_amendments
  FOR DELETE
  USING (
    contract_id IN (
      SELECT c.contract_id
      FROM contracts c
      JOIN entity_users eu ON c.entity_id = eu.entity_id
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- ==============================================================================
-- Function: Apply amendment to payment instances
-- ==============================================================================

CREATE OR REPLACE FUNCTION apply_amendment_to_instances(
  p_amendment_id INTEGER
)
RETURNS TABLE (
  instances_updated INTEGER,
  old_total DECIMAL(15,2),
  new_total DECIMAL(15,2)
) AS $$
DECLARE
  v_amendment RECORD;
  v_schedule RECORD;
  v_instances_updated INTEGER := 0;
  v_old_total DECIMAL(15,2) := 0;
  v_new_total DECIMAL(15,2) := 0;
BEGIN
  -- Get amendment details
  SELECT * INTO v_amendment
  FROM contract_amendments
  WHERE amendment_id = p_amendment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amendment not found: %', p_amendment_id;
  END IF;

  IF v_amendment.status != 'approved' THEN
    RAISE EXCEPTION 'Amendment must be approved before applying';
  END IF;

  -- Get all payment schedules for this contract
  FOR v_schedule IN
    SELECT scheduled_payment_id
    FROM scheduled_payments
    WHERE contract_id = v_amendment.contract_id
      AND is_active = TRUE
  LOOP
    -- Handle amount change amendments
    IF v_amendment.amendment_type = 'amount_change' AND v_amendment.new_payment_amount IS NOT NULL THEN
      -- Calculate old total
      SELECT COALESCE(SUM(amount), 0) INTO v_old_total
      FROM scheduled_payment_instances
      WHERE scheduled_payment_id = v_schedule.scheduled_payment_id
        AND due_date >= v_amendment.effective_start_date
        AND (v_amendment.effective_end_date IS NULL OR due_date <= v_amendment.effective_end_date)
        AND status NOT IN ('paid', 'cancelled');

      -- Update instances
      UPDATE scheduled_payment_instances
      SET
        original_amount = COALESCE(original_amount, amount),  -- Store original if not already stored
        amount = v_amendment.new_payment_amount,
        amendment_id = p_amendment_id,
        is_amended = TRUE,
        updated_at = NOW()
      WHERE scheduled_payment_id = v_schedule.scheduled_payment_id
        AND due_date >= v_amendment.effective_start_date
        AND (v_amendment.effective_end_date IS NULL OR due_date <= v_amendment.effective_end_date)
        AND status NOT IN ('paid', 'cancelled');  -- Don't modify paid instances

      GET DIAGNOSTICS v_instances_updated = ROW_COUNT;

      -- Calculate new total
      SELECT COALESCE(SUM(amount), 0) INTO v_new_total
      FROM scheduled_payment_instances
      WHERE scheduled_payment_id = v_schedule.scheduled_payment_id
        AND due_date >= v_amendment.effective_start_date
        AND (v_amendment.effective_end_date IS NULL OR due_date <= v_amendment.effective_end_date)
        AND status NOT IN ('paid', 'cancelled');
    END IF;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_instances_updated, v_old_total, v_new_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_amendment_to_instances IS 'Apply approved amendment to payment instances (auto-update amounts)';

-- ==============================================================================
-- Function: Revert amendment from instances
-- ==============================================================================

CREATE OR REPLACE FUNCTION revert_amendment_from_instances(
  p_amendment_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_instances_reverted INTEGER := 0;
BEGIN
  -- Revert instances back to original amount
  UPDATE scheduled_payment_instances
  SET
    amount = COALESCE(original_amount, amount),  -- Restore original
    amendment_id = NULL,
    is_amended = FALSE,
    updated_at = NOW()
  WHERE amendment_id = p_amendment_id
    AND status NOT IN ('paid', 'cancelled');  -- Don't modify paid instances

  GET DIAGNOSTICS v_instances_reverted = ROW_COUNT;

  RETURN v_instances_reverted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revert_amendment_from_instances IS 'Revert amendment changes from instances (restore original amounts)';

-- ==============================================================================
-- View: Contract overview with payment schedules
-- ==============================================================================

CREATE OR REPLACE VIEW contract_overview AS
SELECT
  c.contract_id,
  c.entity_id,
  c.contract_number,
  c.contract_name,
  c.contract_type,
  c.counterparty,
  c.counterparty_contact,
  c.signing_date,
  c.effective_date,
  c.expiration_date,
  c.total_contract_value,
  c.status,
  c.renewal_count,
  c.is_active,
  c.created_at,
  c.updated_at,

  -- Payment schedules count
  COUNT(DISTINCT sp.scheduled_payment_id) as payment_schedules_count,

  -- Total monthly obligation (sum of all monthly payment schedules)
  COALESCE(SUM(
    CASE
      WHEN sp.frequency = 'monthly' THEN sp.payment_amount
      ELSE 0
    END
  ), 0) as total_monthly_obligation,

  -- Amendment count
  (SELECT COUNT(*) FROM contract_amendments ca WHERE ca.contract_id = c.contract_id) as amendments_count,

  -- Active amendments count
  (SELECT COUNT(*)
   FROM contract_amendments ca
   WHERE ca.contract_id = c.contract_id
     AND ca.status = 'approved'
     AND ca.effective_start_date <= CURRENT_DATE
     AND (ca.effective_end_date IS NULL OR ca.effective_end_date >= CURRENT_DATE)
  ) as active_amendments_count,

  -- Days until expiration
  CASE
    WHEN c.expiration_date IS NOT NULL THEN
      EXTRACT(DAY FROM (c.expiration_date - CURRENT_DATE))
    ELSE NULL
  END as days_until_expiration,

  -- Contract status indicators
  CASE
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE THEN 'expired'
    WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE c.status
  END as derived_status

FROM contracts c
LEFT JOIN scheduled_payments sp ON sp.contract_id = c.contract_id AND sp.is_active = TRUE
GROUP BY c.contract_id;

COMMENT ON VIEW contract_overview IS 'Complete contract overview with payment schedules and amendments summary';

-- ==============================================================================
-- View: Amendment history with impact
-- ==============================================================================

CREATE OR REPLACE VIEW amendment_history AS
SELECT
  ca.amendment_id,
  ca.contract_id,
  c.contract_name,
  c.contract_number,
  ca.amendment_number,
  ca.amendment_date,
  ca.amendment_type,
  ca.title,
  ca.description,
  ca.effective_start_date,
  ca.effective_end_date,
  ca.new_payment_amount,
  ca.status,
  ca.created_at,
  ca.created_by,

  -- Count affected instances
  (SELECT COUNT(*)
   FROM scheduled_payment_instances spi
   WHERE spi.amendment_id = ca.amendment_id
  ) as affected_instances_count,

  -- Calculate total impact
  (SELECT COALESCE(SUM(spi.amount - COALESCE(spi.original_amount, spi.amount)), 0)
   FROM scheduled_payment_instances spi
   WHERE spi.amendment_id = ca.amendment_id
  ) as total_financial_impact

FROM contract_amendments ca
JOIN contracts c ON c.contract_id = ca.contract_id
ORDER BY ca.contract_id, ca.amendment_number DESC;

COMMENT ON VIEW amendment_history IS 'Amendment history with financial impact calculations';

-- ==============================================================================
-- Comments for documentation
-- ==============================================================================

COMMENT ON TABLE contracts IS 'Master contracts/agreements table';
COMMENT ON TABLE contract_amendments IS 'Contract amendments and modifications';
COMMENT ON COLUMN scheduled_payments.contract_id IS 'Links payment schedule to parent contract';
COMMENT ON COLUMN scheduled_payments.payment_type IS 'Type of payment component (rent, utilities, etc.)';

-- ==============================================================================
-- Success message
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration 060: Contracts and Amendments System';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - contracts (master agreements)';
  RAISE NOTICE '  - contract_amendments (amendment tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated tables:';
  RAISE NOTICE '  - scheduled_payments (added contract_id, payment_type)';
  RAISE NOTICE '  - scheduled_payment_instances (added amendment_id, original_amount)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - apply_amendment_to_instances() - Auto-update instances';
  RAISE NOTICE '  - revert_amendment_from_instances() - Rollback amendments';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - contract_overview - Contract summary with schedules';
  RAISE NOTICE '  - amendment_history - Amendment impact tracking';
  RAISE NOTICE '=================================================================';
END $$;
