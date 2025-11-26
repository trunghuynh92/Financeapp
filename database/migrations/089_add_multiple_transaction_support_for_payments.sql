-- Migration 089: Add Multiple Transaction Support for Scheduled Payment Instances
-- Purpose: Allow one payment instance to be paid by multiple transactions (e.g., part cash + part bank)
-- Date: 2025-01-18

-- ==============================================================================
-- Create junction table for many-to-many relationship
-- ==============================================================================

CREATE TABLE IF NOT EXISTS scheduled_payment_instance_transactions (
  link_id SERIAL PRIMARY KEY,
  instance_id INTEGER NOT NULL REFERENCES scheduled_payment_instances(instance_id) ON DELETE CASCADE,
  transaction_id INTEGER NOT NULL REFERENCES main_transaction(main_transaction_id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate links
  UNIQUE(instance_id, transaction_id)
);

-- ==============================================================================
-- Indexes
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_instance_transactions_instance ON scheduled_payment_instance_transactions(instance_id);
CREATE INDEX IF NOT EXISTS idx_payment_instance_transactions_transaction ON scheduled_payment_instance_transactions(transaction_id);

-- ==============================================================================
-- Add new column to track total paid amount across all transactions
-- ==============================================================================

-- This will store the cumulative sum of all linked transaction amounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_payment_instances'
    AND column_name = 'total_paid_amount'
  ) THEN
    ALTER TABLE scheduled_payment_instances
    ADD COLUMN total_paid_amount DECIMAL(15,2) DEFAULT 0;
  END IF;
END $$;

-- Calculate initial values from existing paid_amount
UPDATE scheduled_payment_instances
SET total_paid_amount = COALESCE(paid_amount, 0)
WHERE paid_amount IS NOT NULL
  AND (total_paid_amount IS NULL OR total_paid_amount = 0);

-- ==============================================================================
-- Migrate existing data from transaction_id column to junction table
-- ==============================================================================

-- Copy existing transaction_id links to junction table (only if not already migrated)
INSERT INTO scheduled_payment_instance_transactions (instance_id, transaction_id, amount)
SELECT
  instance_id,
  transaction_id,
  COALESCE(paid_amount, amount) as amount
FROM scheduled_payment_instances
WHERE transaction_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_payment_instance_transactions spit
    WHERE spit.instance_id = scheduled_payment_instances.instance_id
      AND spit.transaction_id = scheduled_payment_instances.transaction_id
  )
ON CONFLICT (instance_id, transaction_id) DO NOTHING;

-- ==============================================================================
-- Update constraints to allow partial payments
-- ==============================================================================

-- Drop old constraint
ALTER TABLE scheduled_payment_instances
DROP CONSTRAINT IF EXISTS valid_paid_status;

-- Add 'partial' to the status enum first
ALTER TABLE scheduled_payment_instances
DROP CONSTRAINT IF EXISTS scheduled_payment_instances_status_check;

ALTER TABLE scheduled_payment_instances
ADD CONSTRAINT scheduled_payment_instances_status_check
CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled'));

-- Update any instances that should be 'partial'
UPDATE scheduled_payment_instances
SET status = 'partial'
WHERE status = 'paid'
  AND total_paid_amount > 0
  AND total_paid_amount < amount;

-- Add new constraint:
-- - 'paid' status requires total_paid_amount >= amount (fully paid)
-- - 'partial' status requires 0 < total_paid_amount < amount
-- - Other statuses don't have requirements
ALTER TABLE scheduled_payment_instances
ADD CONSTRAINT valid_paid_status CHECK (
  (status = 'paid' AND total_paid_amount >= amount AND paid_date IS NOT NULL) OR
  (status = 'partial' AND total_paid_amount > 0 AND total_paid_amount < amount) OR
  (status IN ('pending', 'overdue', 'cancelled'))
);

-- ==============================================================================
-- Create function to calculate total paid amount
-- ==============================================================================

CREATE OR REPLACE FUNCTION calculate_total_paid_amount(p_instance_id INTEGER)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_total DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM scheduled_payment_instance_transactions
  WHERE instance_id = p_instance_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Create trigger to auto-update total_paid_amount and status
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_payment_instance_total()
RETURNS TRIGGER AS $$
DECLARE
  v_total DECIMAL(15,2);
  v_due_amount DECIMAL(15,2);
  v_new_status VARCHAR(20);
  v_target_instance_id INTEGER;
BEGIN
  -- Get the instance_id from either NEW or OLD
  v_target_instance_id := COALESCE(NEW.instance_id, OLD.instance_id);

  -- Calculate total paid amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM scheduled_payment_instance_transactions
  WHERE instance_id = v_target_instance_id;

  -- Get due amount
  SELECT amount INTO v_due_amount
  FROM scheduled_payment_instances
  WHERE instance_id = v_target_instance_id;

  -- Determine new status
  IF v_total = 0 THEN
    -- Check if overdue
    SELECT CASE
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END INTO v_new_status
    FROM scheduled_payment_instances
    WHERE instance_id = v_target_instance_id;
  ELSIF v_total >= v_due_amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update instance
  UPDATE scheduled_payment_instances
  SET
    total_paid_amount = v_total,
    status = v_new_status,
    paid_date = CASE
      WHEN v_new_status = 'paid' AND paid_date IS NULL THEN CURRENT_DATE
      WHEN v_new_status IN ('pending', 'overdue', 'partial') THEN NULL
      ELSE paid_date
    END,
    paid_amount = v_total, -- Keep paid_amount in sync for backwards compatibility
    updated_at = NOW()
  WHERE instance_id = v_target_instance_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_instance_total ON scheduled_payment_instance_transactions;

CREATE TRIGGER trigger_update_payment_instance_total
AFTER INSERT OR UPDATE OR DELETE ON scheduled_payment_instance_transactions
FOR EACH ROW
EXECUTE FUNCTION update_payment_instance_total();

-- ==============================================================================
-- Update mark_payment_as_paid function to use junction table
-- ==============================================================================

-- Drop the old function first
DROP FUNCTION IF EXISTS mark_payment_as_paid(INTEGER, INTEGER, NUMERIC, DATE);

-- Create new function
CREATE OR REPLACE FUNCTION mark_payment_as_paid(
  p_instance_id INTEGER,
  p_transaction_id INTEGER,
  p_paid_amount DECIMAL,
  p_paid_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_link_id INTEGER;
BEGIN
  -- Insert into junction table (trigger will auto-update total and status)
  INSERT INTO scheduled_payment_instance_transactions (instance_id, transaction_id, amount, created_by)
  VALUES (p_instance_id, p_transaction_id, p_paid_amount, auth.uid())
  RETURNING link_id INTO v_link_id;

  -- The trigger will automatically update total_paid_amount and status

  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Create function to unlink a transaction from a payment instance
-- ==============================================================================

CREATE OR REPLACE FUNCTION unlink_payment_transaction(
  p_link_id INTEGER
) RETURNS void AS $$
BEGIN
  DELETE FROM scheduled_payment_instance_transactions
  WHERE link_id = p_link_id;

  -- The trigger will automatically update total_paid_amount and status
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- Row Level Security for junction table
-- ==============================================================================

ALTER TABLE scheduled_payment_instance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_payment_instance_txns" ON scheduled_payment_instance_transactions;
DROP POLICY IF EXISTS "insert_payment_instance_txns" ON scheduled_payment_instance_transactions;
DROP POLICY IF EXISTS "delete_payment_instance_txns" ON scheduled_payment_instance_transactions;

CREATE POLICY "view_payment_instance_txns"
ON scheduled_payment_instance_transactions
FOR SELECT
USING (
  instance_id IN (
    SELECT spi.instance_id
    FROM scheduled_payment_instances spi
    JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
    WHERE sp.entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "insert_payment_instance_txns"
ON scheduled_payment_instance_transactions
FOR INSERT
WITH CHECK (
  instance_id IN (
    SELECT spi.instance_id
    FROM scheduled_payment_instances spi
    JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
    WHERE sp.entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
    )
  )
);

CREATE POLICY "delete_payment_instance_txns"
ON scheduled_payment_instance_transactions
FOR DELETE
USING (
  instance_id IN (
    SELECT spi.instance_id
    FROM scheduled_payment_instances spi
    JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
    WHERE sp.entity_id IN (
      SELECT eu.entity_id
      FROM entity_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.role IN ('owner', 'admin', 'editor')
    )
  )
);

-- ==============================================================================
-- Create view for easy querying of payment instance details with transactions
-- ==============================================================================

CREATE OR REPLACE VIEW scheduled_payment_instance_details AS
SELECT
  spi.*,
  sp.contract_name,
  sp.payee_name,
  sp.category_id,
  c.category_name,
  (
    SELECT json_agg(json_build_object(
      'link_id', spit.link_id,
      'transaction_id', spit.transaction_id,
      'amount', spit.amount,
      'transaction_date', mt.transaction_date,
      'account_name', a.account_name,
      'description', mt.description
    ) ORDER BY spit.created_at)
    FROM scheduled_payment_instance_transactions spit
    JOIN main_transaction mt ON spit.transaction_id = mt.main_transaction_id
    JOIN accounts a ON mt.account_id = a.account_id
    WHERE spit.instance_id = spi.instance_id
  ) AS linked_transactions
FROM scheduled_payment_instances spi
JOIN scheduled_payments sp ON spi.scheduled_payment_id = sp.scheduled_payment_id
JOIN categories c ON sp.category_id = c.category_id;

COMMENT ON VIEW scheduled_payment_instance_details IS
'Shows payment instances with all linked transactions in a JSON array';
