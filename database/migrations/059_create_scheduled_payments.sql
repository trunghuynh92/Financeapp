-- Migration 059: Create Scheduled Payments System
-- Purpose: Track contractual payment obligations (leases, service contracts, construction milestones)
-- Date: 2025-01-17

-- ==============================================================================
-- Create scheduled_payments table (contracts/agreements)
-- ==============================================================================

CREATE TABLE scheduled_payments (
  scheduled_payment_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,

  -- Contract Details
  contract_name VARCHAR(255) NOT NULL,  -- "Office Lease 2025", "Construction Phase 1"
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('lease', 'service', 'construction', 'subscription', 'other')),
  payee_name VARCHAR(255) NOT NULL,  -- Who to pay
  contract_number VARCHAR(100),

  -- Payment Amount
  payment_amount DECIMAL(15,2) NOT NULL CHECK (payment_amount > 0),

  -- Schedule Configuration
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('recurring', 'one_time', 'custom_dates')),
  frequency VARCHAR(20) CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'custom')),
  payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31),  -- Day of month for recurring payments

  -- Time Period
  start_date DATE NOT NULL,
  end_date DATE,  -- Optional, for fixed-term contracts

  -- Custom Schedule (for construction contracts with specific dates)
  custom_schedule JSONB,  -- Array of ISO date strings: ["2025-01-05", "2025-01-25", "2025-02-15"]

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  is_active BOOLEAN DEFAULT TRUE,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT valid_recurring_config CHECK (
    (schedule_type = 'recurring' AND frequency IS NOT NULL AND payment_day IS NOT NULL) OR
    (schedule_type = 'one_time' AND frequency IS NULL) OR
    (schedule_type = 'custom_dates' AND custom_schedule IS NOT NULL)
  )
);

-- ==============================================================================
-- Create scheduled_payment_instances table (individual due dates)
-- ==============================================================================

CREATE TABLE scheduled_payment_instances (
  instance_id SERIAL PRIMARY KEY,
  scheduled_payment_id INTEGER NOT NULL REFERENCES scheduled_payments(scheduled_payment_id) ON DELETE CASCADE,

  -- Due Date & Amount
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),

  -- Payment Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),

  -- Payment Details (when marked as paid)
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  transaction_id INTEGER REFERENCES main_transaction(main_transaction_id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_paid_status CHECK (
    (status = 'paid' AND paid_date IS NOT NULL AND paid_amount IS NOT NULL) OR
    (status != 'paid' AND paid_date IS NULL AND paid_amount IS NULL)
  ),
  CONSTRAINT valid_paid_amount CHECK (paid_amount IS NULL OR paid_amount > 0)
);

-- ==============================================================================
-- Indexes for performance
-- ==============================================================================

-- Scheduled payments indexes
CREATE INDEX idx_scheduled_payments_entity ON scheduled_payments(entity_id);
CREATE INDEX idx_scheduled_payments_category ON scheduled_payments(category_id);
CREATE INDEX idx_scheduled_payments_status ON scheduled_payments(status, is_active);
CREATE INDEX idx_scheduled_payments_payee ON scheduled_payments(payee_name);
CREATE INDEX idx_scheduled_payments_contract_type ON scheduled_payments(contract_type);
CREATE INDEX idx_scheduled_payments_dates ON scheduled_payments(start_date, end_date);

-- Payment instances indexes
CREATE INDEX idx_payment_instances_scheduled_payment ON scheduled_payment_instances(scheduled_payment_id);
CREATE INDEX idx_payment_instances_due_date ON scheduled_payment_instances(due_date);
CREATE INDEX idx_payment_instances_status ON scheduled_payment_instances(status);
CREATE INDEX idx_payment_instances_transaction ON scheduled_payment_instances(transaction_id);
CREATE INDEX idx_payment_instances_overdue ON scheduled_payment_instances(due_date, status)
  WHERE status = 'pending';

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_payment_instances ENABLE ROW LEVEL SECURITY;

-- Scheduled Payments Policies
CREATE POLICY "Users can view scheduled payments for their entities" ON scheduled_payments
  FOR SELECT
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scheduled payments for their entities" ON scheduled_payments
  FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can update scheduled payments for their entities" ON scheduled_payments
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

CREATE POLICY "Users can delete scheduled payments for their entities" ON scheduled_payments
  FOR DELETE
  USING (
    entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  );

-- Payment Instances Policies (access through parent scheduled_payment)
CREATE POLICY "Users can view payment instances for their entities" ON scheduled_payment_instances
  FOR SELECT
  USING (
    scheduled_payment_id IN (
      SELECT sp.scheduled_payment_id
      FROM scheduled_payments sp
      WHERE sp.entity_id IN (
        SELECT entity_id
        FROM entity_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert payment instances for their entities" ON scheduled_payment_instances
  FOR INSERT
  WITH CHECK (
    scheduled_payment_id IN (
      SELECT sp.scheduled_payment_id
      FROM scheduled_payments sp
      WHERE sp.entity_id IN (
        SELECT eu.entity_id
        FROM entity_users eu
        WHERE eu.user_id = auth.uid()
          AND eu.role IN ('owner', 'admin', 'editor')
      )
    )
  );

CREATE POLICY "Users can update payment instances for their entities" ON scheduled_payment_instances
  FOR UPDATE
  USING (
    scheduled_payment_id IN (
      SELECT sp.scheduled_payment_id
      FROM scheduled_payments sp
      WHERE sp.entity_id IN (
        SELECT eu.entity_id
        FROM entity_users eu
        WHERE eu.user_id = auth.uid()
          AND eu.role IN ('owner', 'admin', 'editor')
      )
    )
  )
  WITH CHECK (
    scheduled_payment_id IN (
      SELECT sp.scheduled_payment_id
      FROM scheduled_payments sp
      WHERE sp.entity_id IN (
        SELECT eu.entity_id
        FROM entity_users eu
        WHERE eu.user_id = auth.uid()
          AND eu.role IN ('owner', 'admin', 'editor')
      )
    )
  );

CREATE POLICY "Users can delete payment instances for their entities" ON scheduled_payment_instances
  FOR DELETE
  USING (
    scheduled_payment_id IN (
      SELECT sp.scheduled_payment_id
      FROM scheduled_payments sp
      WHERE sp.entity_id IN (
        SELECT eu.entity_id
        FROM entity_users eu
        WHERE eu.user_id = auth.uid()
          AND eu.role IN ('owner', 'admin', 'editor')
      )
    )
  );

-- ==============================================================================
-- Function: Generate payment instances for recurring schedules
-- ==============================================================================

CREATE OR REPLACE FUNCTION generate_payment_instances(
  p_scheduled_payment_id INTEGER,
  p_months_ahead INTEGER DEFAULT 12
)
RETURNS INTEGER AS $$
DECLARE
  v_payment RECORD;
  v_current_date DATE;
  v_end_limit DATE;
  v_instance_count INTEGER := 0;
  v_custom_date TEXT;
BEGIN
  -- Get the scheduled payment details
  SELECT * INTO v_payment
  FROM scheduled_payments
  WHERE scheduled_payment_id = p_scheduled_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled payment not found: %', p_scheduled_payment_id;
  END IF;

  -- Calculate end limit (earlier of: end_date or N months from start)
  v_end_limit := v_payment.start_date + (p_months_ahead || ' months')::INTERVAL;
  IF v_payment.end_date IS NOT NULL AND v_payment.end_date < v_end_limit THEN
    v_end_limit := v_payment.end_date;
  END IF;

  -- Handle different schedule types
  IF v_payment.schedule_type = 'one_time' THEN
    -- Single payment on start_date
    INSERT INTO scheduled_payment_instances (
      scheduled_payment_id, due_date, amount, status
    ) VALUES (
      p_scheduled_payment_id, v_payment.start_date, v_payment.payment_amount, 'pending'
    )
    ON CONFLICT DO NOTHING;

    v_instance_count := 1;

  ELSIF v_payment.schedule_type = 'custom_dates' THEN
    -- Insert each custom date
    FOR v_custom_date IN SELECT jsonb_array_elements_text(v_payment.custom_schedule)
    LOOP
      INSERT INTO scheduled_payment_instances (
        scheduled_payment_id, due_date, amount, status
      ) VALUES (
        p_scheduled_payment_id,
        v_custom_date::DATE,
        v_payment.payment_amount,
        CASE WHEN v_custom_date::DATE < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
      )
      ON CONFLICT DO NOTHING;

      v_instance_count := v_instance_count + 1;
    END LOOP;

  ELSIF v_payment.schedule_type = 'recurring' THEN
    -- Generate recurring instances
    v_current_date := v_payment.start_date;

    WHILE v_current_date <= v_end_limit LOOP
      -- Ensure payment day doesn't exceed month's days
      DECLARE
        v_actual_day INTEGER;
        v_days_in_month INTEGER;
      BEGIN
        v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month' - INTERVAL '1 day'));
        v_actual_day := LEAST(v_payment.payment_day, v_days_in_month);

        -- Set to specific day of month
        v_current_date := DATE_TRUNC('month', v_current_date) + (v_actual_day - 1 || ' days')::INTERVAL;
      END;

      -- Insert instance if it doesn't already exist
      INSERT INTO scheduled_payment_instances (
        scheduled_payment_id, due_date, amount, status
      ) VALUES (
        p_scheduled_payment_id,
        v_current_date,
        v_payment.payment_amount,
        CASE WHEN v_current_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
      )
      ON CONFLICT DO NOTHING;

      v_instance_count := v_instance_count + 1;

      -- Move to next period
      CASE v_payment.frequency
        WHEN 'monthly' THEN
          v_current_date := v_current_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
          v_current_date := v_current_date + INTERVAL '3 months';
        WHEN 'yearly' THEN
          v_current_date := v_current_date + INTERVAL '1 year';
        ELSE
          EXIT; -- Unknown frequency, stop
      END CASE;
    END LOOP;
  END IF;

  RETURN v_instance_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_payment_instances IS 'Generate payment instances based on schedule type (one_time, recurring, custom_dates)';

-- ==============================================================================
-- Function: Mark payment instance as paid
-- ==============================================================================

CREATE OR REPLACE FUNCTION mark_payment_as_paid(
  p_instance_id INTEGER,
  p_transaction_id INTEGER,
  p_paid_amount DECIMAL(15,2),
  p_paid_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE scheduled_payment_instances
  SET
    status = 'paid',
    paid_date = p_paid_date,
    paid_amount = p_paid_amount,
    transaction_id = p_transaction_id,
    updated_at = NOW()
  WHERE instance_id = p_instance_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_payment_as_paid IS 'Mark a payment instance as paid and link to transaction';

-- ==============================================================================
-- Function: Get overdue payment count for an entity
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_overdue_payment_count(p_entity_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM scheduled_payment_instances spi
  JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
  WHERE sp.entity_id = p_entity_id
    AND sp.is_active = TRUE
    AND sp.status = 'active'
    AND spi.status = 'pending'
    AND spi.due_date < CURRENT_DATE;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_overdue_payment_count IS 'Count overdue payment instances for an entity';

-- ==============================================================================
-- Function: Get upcoming payments (next N days)
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_upcoming_payments(
  p_entity_id UUID,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE (
  instance_id INTEGER,
  scheduled_payment_id INTEGER,
  contract_name VARCHAR(255),
  payee_name VARCHAR(255),
  due_date DATE,
  amount DECIMAL(15,2),
  days_until_due INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    spi.instance_id,
    spi.scheduled_payment_id,
    sp.contract_name,
    sp.payee_name,
    spi.due_date,
    spi.amount,
    (spi.due_date - CURRENT_DATE)::INTEGER as days_until_due
  FROM scheduled_payment_instances spi
  JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
  WHERE sp.entity_id = p_entity_id
    AND sp.is_active = TRUE
    AND sp.status = 'active'
    AND spi.status = 'pending'
    AND spi.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead)
  ORDER BY spi.due_date ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_upcoming_payments IS 'Get upcoming payment instances for an entity within N days';

-- ==============================================================================
-- View: Scheduled payment overview with instance summaries
-- ==============================================================================

CREATE OR REPLACE VIEW scheduled_payment_overview AS
SELECT
  sp.scheduled_payment_id,
  sp.entity_id,
  sp.category_id,
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

COMMENT ON VIEW scheduled_payment_overview IS 'Complete overview of scheduled payments with instance summaries';

-- ==============================================================================
-- Trigger: Update overdue status automatically
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_overdue_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark pending instances as overdue if past due date
  UPDATE scheduled_payment_instances
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would run on a schedule via pg_cron or external job
-- For now, we'll handle status updates in the application layer

-- ==============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_scheduled_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_payments_timestamp
  BEFORE UPDATE ON scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_payment_timestamp();

CREATE TRIGGER update_payment_instances_timestamp
  BEFORE UPDATE ON scheduled_payment_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_payment_timestamp();

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 059 completed successfully';
  RAISE NOTICE 'Created scheduled_payments table';
  RAISE NOTICE 'Created scheduled_payment_instances table';
  RAISE NOTICE 'Created RLS policies for both tables';
  RAISE NOTICE 'Created scheduled_payment_overview view';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - generate_payment_instances()';
  RAISE NOTICE '  - mark_payment_as_paid()';
  RAISE NOTICE '  - get_overdue_payment_count()';
  RAISE NOTICE '  - get_upcoming_payments()';
  RAISE NOTICE 'System ready for scheduled payment tracking!';
END $$;
