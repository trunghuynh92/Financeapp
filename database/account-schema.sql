-- Week 2: Account Management Schema
-- Run this SQL in your Supabase SQL Editor

-- Create Account table
CREATE TABLE IF NOT EXISTS accounts (
    account_id SERIAL PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan')),
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'VND' NOT NULL,
    credit_limit DECIMAL(15, 2),
    loan_reference VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Account_Balance table
CREATE TABLE IF NOT EXISTS account_balances (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
    current_balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    last_transaction_id BIGINT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_accounts_entity_id ON accounts(entity_id);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at_trigger
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_updated_at();

-- Create trigger to automatically create account_balance entry when account is created
CREATE OR REPLACE FUNCTION create_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO account_balances (account_id, current_balance, last_updated)
    VALUES (NEW.account_id, 0, CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_account_balance_trigger
    AFTER INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION create_account_balance();

-- Create trigger to update account_balance last_updated timestamp
CREATE OR REPLACE FUNCTION update_account_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_balances_updated_trigger
    BEFORE UPDATE ON account_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for accounts (for now, allow all operations - adjust based on your auth setup)
CREATE POLICY "Enable all operations for accounts" ON accounts
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for account_balances" ON account_balances
    FOR ALL USING (true);

-- Add some helpful comments
COMMENT ON TABLE accounts IS 'Stores all financial accounts (bank, cash, credit cards, investments, loans)';
COMMENT ON TABLE account_balances IS 'Stores current balance for each account';
COMMENT ON COLUMN accounts.account_type IS 'Type of account: bank, cash, credit_card, investment, credit_line, term_loan';
COMMENT ON COLUMN accounts.credit_limit IS 'Credit limit for credit_line and term_loan accounts';
COMMENT ON COLUMN accounts.loan_reference IS 'Reference number for debt accounts';
