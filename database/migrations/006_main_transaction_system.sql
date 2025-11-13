-- ============================================================================
-- MIGRATION 006: Main Transaction System
-- Purpose: Create the main_transaction layer for categorization, splitting,
--          and business logic on top of original_transaction
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRANSACTION TYPES TABLE
-- Purpose: Define transaction types (income, expense, transfer, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE transaction_types (
  transaction_type_id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE,
  type_display_name VARCHAR(100) NOT NULL,
  type_code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  affects_cashflow BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed transaction types
INSERT INTO transaction_types (type_name, type_display_name, type_code, affects_cashflow, display_order, description) VALUES
('income', 'Income', 'INC', true, 1, 'Money received from sales, services, or other sources'),
('expense', 'Expense', 'EXP', true, 2, 'Money spent on costs, purchases, or services'),
('transfer_out', 'Transfer Out', 'TRF_OUT', false, 3, 'Transfer money out to another account'),
('transfer_in', 'Transfer In', 'TRF_IN', false, 4, 'Transfer money in from another account'),
('debt_acquired', 'Debt Acquired', 'DEBT_ACQ', true, 5, 'Money borrowed or debt taken on'),
('debt_payback', 'Debt Payback', 'DEBT_PAY', true, 6, 'Payment towards existing debt'),
('investment', 'Investment', 'INV', true, 7, 'Money invested in assets or securities');

CREATE INDEX idx_transaction_types_code ON transaction_types(type_code);
CREATE INDEX idx_transaction_types_active ON transaction_types(is_active);

ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for transaction_types" ON transaction_types
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- Purpose: Hierarchical categories tied to transaction types and entity types
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  category_code VARCHAR(50),
  parent_category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  transaction_type_id INTEGER NOT NULL REFERENCES transaction_types(transaction_type_id),
  entity_type VARCHAR(20) CHECK (entity_type IN ('business', 'personal', 'both')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_parent_category FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
  CONSTRAINT fk_transaction_type FOREIGN KEY (transaction_type_id) REFERENCES transaction_types(transaction_type_id)
);

CREATE INDEX idx_categories_parent ON categories(parent_category_id);
CREATE INDEX idx_categories_type ON categories(transaction_type_id);
CREATE INDEX idx_categories_entity_type ON categories(entity_type);
CREATE INDEX idx_categories_active ON categories(is_active);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for categories" ON categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed categories - EXPENSE (Business)
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Cost of Goods Sold', 'COGS', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 1, 'Direct costs of producing goods sold'),
('Raw Materials', 'RAW_MAT', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 2, 'Materials used in production'),
('Operating Expenses', 'OPEX', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 3, 'Day-to-day business expenses'),
('Rent & Utilities', 'RENT', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 4, 'Rent, electricity, water, internet'),
('Salaries & Wages', 'SALARY', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 5, 'Employee salaries and wages'),
('Marketing & Advertising', 'MARKETING', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 6, 'Marketing campaigns and advertising'),
('Office Supplies', 'OFFICE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 7, 'Stationery, equipment, supplies'),
('Professional Services', 'PROF_SVC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 8, 'Legal, accounting, consulting fees'),
('Travel & Transportation', 'TRAVEL', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 9, 'Business travel and transport costs'),
('Insurance', 'INSURANCE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 10, 'Business insurance premiums'),
('Taxes & Fees', 'TAXES', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 11, 'Business taxes and government fees'),
('Maintenance & Repairs', 'MAINTENANCE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'business', 12, 'Equipment and facility maintenance');

-- Seed categories - EXPENSE (Personal)
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Food & Dining', 'FOOD', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 20, 'Groceries, restaurants, dining'),
('Transportation', 'TRANSPORT', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 21, 'Fuel, public transport, vehicle costs'),
('Housing', 'HOUSING', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 22, 'Rent, mortgage, home expenses'),
('Healthcare', 'HEALTH', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 23, 'Medical, dental, pharmacy'),
('Entertainment', 'ENTERTAINMENT', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 24, 'Movies, games, hobbies'),
('Education', 'EDUCATION', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 25, 'Tuition, courses, books'),
('Shopping', 'SHOPPING', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 26, 'Clothing, electronics, household items'),
('Personal Care', 'PERSONAL_CARE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 27, 'Haircuts, spa, beauty products'),
('Utilities', 'UTILITIES', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 28, 'Electricity, water, internet, phone'),
('Gifts & Donations', 'GIFTS', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'EXP'), 'personal', 29, 'Gifts and charitable donations');

-- Seed categories - INCOME (Business)
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Product Sales', 'SALES', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 40, 'Revenue from product sales'),
('Service Revenue', 'SERVICE_REV', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 41, 'Revenue from services provided'),
('Interest Income', 'INTEREST_INC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 42, 'Interest earned on deposits'),
('Rental Income', 'RENTAL_INC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 43, 'Income from property rentals'),
('Commission', 'COMMISSION', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 44, 'Commission earnings'),
('Other Revenue', 'OTHER_REV', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'business', 45, 'Other business income');

-- Seed categories - INCOME (Personal)
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Salary', 'SALARY_INC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 50, 'Employment salary'),
('Freelance Income', 'FREELANCE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 51, 'Freelance work payments'),
('Investment Returns', 'INVEST_INC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 52, 'Dividends and capital gains'),
('Gifts Received', 'GIFTS_REC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 53, 'Money gifts received'),
('Refunds', 'REFUNDS', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 54, 'Tax refunds, purchase refunds'),
('Other Income', 'OTHER_INC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INC'), 'personal', 55, 'Other personal income');

-- Seed categories - INVESTMENT
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Stock Purchase', 'STOCK', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV'), 'both', 60, 'Stock and equity purchases'),
('Real Estate', 'REAL_ESTATE', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV'), 'both', 61, 'Real estate investments'),
('Business Investment', 'BUS_INV', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV'), 'both', 62, 'Investments in businesses'),
('Savings & Deposits', 'SAVINGS', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'INV'), 'both', 63, 'Term deposits and savings');

-- Seed categories - DEBT
INSERT INTO categories (category_name, category_code, transaction_type_id, entity_type, display_order, description) VALUES
('Loan Received', 'LOAN_REC', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_ACQ'), 'both', 70, 'Loans received'),
('Credit Card Debt', 'CC_DEBT', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_ACQ'), 'both', 71, 'Credit card borrowing'),
('Loan Payment', 'LOAN_PAY', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_PAY'), 'both', 80, 'Loan repayments'),
('Credit Card Payment', 'CC_PAY', (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'DEBT_PAY'), 'both', 81, 'Credit card payments');

-- ----------------------------------------------------------------------------
-- 3. BRANCHES TABLE
-- Purpose: Store/location tracking tied to entities
-- ----------------------------------------------------------------------------
CREATE TABLE branches (
  branch_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  branch_name VARCHAR(100) NOT NULL,
  branch_code VARCHAR(50),
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_branches_entity ON branches(entity_id);
CREATE INDEX idx_branches_active ON branches(is_active);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for branches" ON branches
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. MAIN_TRANSACTION TABLE
-- Purpose: The working layer for categorization, splitting, and analysis
-- ----------------------------------------------------------------------------
CREATE TABLE main_transaction (
  main_transaction_id SERIAL PRIMARY KEY,

  -- Link back to original
  raw_transaction_id VARCHAR(100) NOT NULL REFERENCES original_transaction(raw_transaction_id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,

  -- Transaction classification
  transaction_type_id INTEGER NOT NULL REFERENCES transaction_types(transaction_type_id),
  category_id INTEGER REFERENCES categories(category_id),
  branch_id INTEGER REFERENCES branches(branch_id),

  -- Financial data (amount is always positive, direction preserved from original)
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  transaction_direction VARCHAR(10) NOT NULL CHECK (transaction_direction IN ('debit', 'credit')),
  transaction_date TIMESTAMPTZ NOT NULL, -- copied from original, immutable

  -- Editable descriptive fields
  description TEXT, -- copied from original but editable
  notes TEXT, -- user-added notes

  -- Split tracking
  is_split BOOLEAN DEFAULT FALSE,
  split_sequence INTEGER DEFAULT 1, -- 1, 2, 3 for ordering splits

  -- Transfer matching (for linking transfers between accounts)
  transfer_matched_transaction_id INTEGER REFERENCES main_transaction(main_transaction_id) ON DELETE SET NULL,

  -- Future extensions
  loan_id INTEGER, -- for loan tracking (future)

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,

  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT,
  CONSTRAINT fk_raw_transaction FOREIGN KEY (raw_transaction_id) REFERENCES original_transaction(raw_transaction_id) ON DELETE CASCADE,
  CONSTRAINT fk_transaction_type FOREIGN KEY (transaction_type_id) REFERENCES transaction_types(transaction_type_id),
  CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

-- Indexes for common queries
CREATE INDEX idx_main_transaction_date ON main_transaction(transaction_date DESC);
CREATE INDEX idx_main_transaction_raw_id ON main_transaction(raw_transaction_id);
CREATE INDEX idx_main_transaction_account ON main_transaction(account_id);
CREATE INDEX idx_main_transaction_account_date ON main_transaction(account_id, transaction_date DESC);
CREATE INDEX idx_main_transaction_category ON main_transaction(category_id);
CREATE INDEX idx_main_transaction_type ON main_transaction(transaction_type_id);
CREATE INDEX idx_main_transaction_branch ON main_transaction(branch_id);
CREATE INDEX idx_main_transaction_transfer_match ON main_transaction(transfer_matched_transaction_id);
CREATE INDEX idx_main_transaction_is_split ON main_transaction(is_split);
CREATE INDEX idx_main_transaction_direction ON main_transaction(transaction_direction);

ALTER TABLE main_transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for main_transaction" ON main_transaction
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_main_transaction_updated_at
  BEFORE UPDATE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. VALIDATION FUNCTIONS & TRIGGERS
-- Purpose: Ensure data integrity for splits and transfers
-- ----------------------------------------------------------------------------

-- Function to validate split amounts sum to original
CREATE OR REPLACE FUNCTION validate_split_amounts()
RETURNS TRIGGER AS $$
DECLARE
  original_amount DECIMAL(15,2);
  split_sum DECIMAL(15,2);
  split_count INTEGER;
BEGIN
  -- Get original transaction amount (debit or credit)
  SELECT COALESCE(debit_amount, credit_amount, 0)
  INTO original_amount
  FROM original_transaction
  WHERE raw_transaction_id = NEW.raw_transaction_id;

  -- Sum all main_transactions for this raw_transaction_id
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO split_sum, split_count
  FROM main_transaction
  WHERE raw_transaction_id = NEW.raw_transaction_id;

  -- Check if sum matches original (allow 1 cent tolerance for rounding)
  IF ABS(split_sum - original_amount) > 0.01 THEN
    RAISE EXCEPTION 'Split amounts (%) must sum to original transaction amount (%)', split_sum, original_amount;
  END IF;

  -- Update is_split flag based on count
  UPDATE main_transaction
  SET is_split = (split_count > 1)
  WHERE raw_transaction_id = NEW.raw_transaction_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_split_amounts
AFTER INSERT OR UPDATE ON main_transaction
FOR EACH ROW
EXECUTE FUNCTION validate_split_amounts();

-- Function to validate transfer matching (both sides must be transfers)
CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
  my_type_code VARCHAR(20);
  matched_type_code VARCHAR(20);
BEGIN
  IF NEW.transfer_matched_transaction_id IS NOT NULL THEN
    -- Get my transaction type
    SELECT tt.type_code
    INTO my_type_code
    FROM transaction_types tt
    WHERE tt.transaction_type_id = NEW.transaction_type_id;

    -- Get matched transaction type
    SELECT tt.type_code
    INTO matched_type_code
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

    -- Validate both are transfers
    IF my_type_code NOT IN ('TRF_OUT', 'TRF_IN') THEN
      RAISE EXCEPTION 'Cannot match non-transfer transaction';
    END IF;

    IF matched_type_code NOT IN ('TRF_OUT', 'TRF_IN') THEN
      RAISE EXCEPTION 'Cannot match with non-transfer transaction';
    END IF;

    -- Validate opposite types (OUT matches with IN, IN matches with OUT)
    IF (my_type_code = 'TRF_OUT' AND matched_type_code != 'TRF_IN') OR
       (my_type_code = 'TRF_IN' AND matched_type_code != 'TRF_OUT') THEN
      RAISE EXCEPTION 'Transfer Out must match with Transfer In and vice versa';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transfer_match
BEFORE INSERT OR UPDATE ON main_transaction
FOR EACH ROW
EXECUTE FUNCTION validate_transfer_match();

-- ----------------------------------------------------------------------------
-- 6. VIEWS FOR COMMON QUERIES
-- Purpose: Simplify common data access patterns
-- ----------------------------------------------------------------------------

-- View: Unmatched transfers (for matching UI)
CREATE VIEW unmatched_transfers AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  a.account_name,
  a.bank_name,
  e.name as entity_name,
  tt.type_code,
  tt.type_display_name as transaction_type
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code IN ('TRF_OUT', 'TRF_IN')
  AND mt.transfer_matched_transaction_id IS NULL
ORDER BY mt.transaction_date DESC;

-- View: Main transactions with full details (for reporting)
CREATE VIEW main_transaction_details AS
SELECT
  mt.main_transaction_id,
  mt.raw_transaction_id,
  mt.account_id,
  mt.amount,
  mt.transaction_direction,
  mt.transaction_date,
  mt.description,
  mt.notes,
  mt.is_split,
  mt.split_sequence,
  a.account_name,
  a.bank_name,
  a.account_type,
  e.id as entity_id,
  e.name as entity_name,
  e.type as entity_type,
  tt.type_code as transaction_type_code,
  tt.type_display_name as transaction_type,
  tt.affects_cashflow,
  c.category_id,
  c.category_name,
  c.category_code,
  b.branch_id,
  b.branch_name,
  b.branch_code,
  mt.created_at,
  mt.updated_at
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
ORDER BY mt.transaction_date DESC, mt.main_transaction_id;

-- ----------------------------------------------------------------------------
-- 7. HELPER FUNCTIONS
-- Purpose: Utility functions for common operations
-- ----------------------------------------------------------------------------

-- Function: Get original transactions without main_transactions
CREATE OR REPLACE FUNCTION get_unprocessed_originals()
RETURNS TABLE (
  raw_transaction_id VARCHAR(100),
  account_id INTEGER,
  transaction_date TIMESTAMPTZ,
  description VARCHAR(500),
  debit_amount DECIMAL(15,2),
  credit_amount DECIMAL(15,2),
  account_name VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.raw_transaction_id,
    ot.account_id,
    ot.transaction_date,
    ot.description,
    ot.debit_amount,
    ot.credit_amount,
    a.account_name
  FROM original_transaction ot
  JOIN accounts a ON ot.account_id = a.account_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM main_transaction mt
    WHERE mt.raw_transaction_id = ot.raw_transaction_id
  )
  ORDER BY ot.transaction_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- SELECT COUNT(*) FROM transaction_types;
-- SELECT COUNT(*) FROM categories;
-- SELECT * FROM get_unprocessed_originals();
