-- Optional: Sample data for testing Account Management
-- Run this after creating the schema and having at least one entity

-- Note: Replace the entity_id values with actual UUIDs from your entities table
-- You can get entity IDs by running: SELECT id, name FROM entities;

-- Example: If your first entity has id 'a1b2c3d4-...'
-- INSERT INTO accounts (entity_id, account_name, account_type, bank_name, account_number, currency)
-- VALUES ('a1b2c3d4-...', 'Main Business Account', 'bank', 'Vietcombank', '1234567890', 'VND');

-- Sample accounts (update entity_id before running)
-- INSERT INTO accounts (entity_id, account_name, account_type, bank_name, account_number, currency) VALUES
-- ('YOUR_ENTITY_ID_HERE', 'Main Business Account', 'bank', 'Vietcombank', '1234567890', 'VND'),
-- ('YOUR_ENTITY_ID_HERE', 'Petty Cash', 'cash', NULL, NULL, 'VND'),
-- ('YOUR_ENTITY_ID_HERE', 'Corporate Credit Card', 'credit_card', 'BIDV', '9876543210', 'VND'),
-- ('YOUR_ENTITY_ID_HERE', 'Investment Portfolio', 'investment', 'VPS Securities', 'INV-001', 'VND'),
-- ('YOUR_ENTITY_ID_HERE', 'Line of Credit', 'credit_line', 'Techcombank', 'LOC-2024-001', 'VND'),
-- ('YOUR_ENTITY_ID_HERE', 'Business Term Loan', 'term_loan', 'ACB Bank', 'LOAN-2024-456', 'VND');

-- Sample balance updates
-- UPDATE account_balances SET current_balance = 150000000 WHERE account_id = 1;
-- UPDATE account_balances SET current_balance = 5000000 WHERE account_id = 2;
-- UPDATE account_balances SET current_balance = -2500000 WHERE account_id = 3;
-- UPDATE account_balances SET current_balance = 75000000 WHERE account_id = 4;
