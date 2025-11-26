# Database Schema Documentation

**Last Updated**: 2025-11-26
**Database**: PostgreSQL 15+ via Supabase
**Current Migration**: 093_add_cashflow_scenarios.sql

---

## Quick Reference

**Tables**: 26 total
**Views**: 8+ views
**Functions**: 25+ RPC functions
**Triggers**: 20+ active triggers
**ENUMs**: 7 custom types

---

## ENUM Types

| Type Name | Values | Usage |
|-----------|--------|-------|
| `user_role` | 'owner', 'admin', 'editor', 'data_entry', 'viewer' | User roles in entity_users |
| `partner_type` | 'customer', 'vendor', 'employee', 'owner', 'partner', 'lender', 'other' | Business partner types |
| `loan_category` | 'short_term', 'long_term', 'advance', 'other' | Loan classification |
| `loan_status` | 'active', 'overdue', 'repaid', 'partially_written_off', 'written_off' | Loan disbursement status |
| `scenario_adjustment_type` | 'one_time_income', 'one_time_expense', 'recurring_income', 'recurring_expense', 'debt_drawdown', 'modify_predicted', 'modify_income', 'exclude_scheduled' | Cash flow scenario adjustments |

---

## Core Tables

### 1. `users` (Authentication & Profiles)
User profiles for multi-user authentication and team management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, FOREIGN KEY → auth.users(id) ON DELETE CASCADE | User identifier from Supabase auth |
| `email` | TEXT | NOT NULL, UNIQUE | User email address |
| `full_name` | TEXT | NULLABLE | User's full name |
| `avatar_url` | TEXT | NULLABLE | Profile picture URL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last profile update timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `email` (idx_users_email)

**RLS Policies**:
- Users can read their own profile
- Users can update their own profile
- Authenticated users can look up other users by email (for entity invites) - Added in Migration 029

**Triggers**:
- `on_auth_user_created`: Automatically creates user profile when auth user is created (references auth.users)
- Auto-updates `updated_at` on profile changes

**Created in**: Migration 022
**Updated in**: Migration 029 (added user lookup policy)

---

### 2. `entity_users` (Team Management)
Junction table managing user access to entities with role-based permissions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity being accessed |
| `user_id` | UUID | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE | User with access |
| `role` | user_role | NOT NULL, DEFAULT 'viewer' | User's role (owner, admin, editor, viewer) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When user was added |
| `created_by_user_id` | UUID | NULLABLE, FOREIGN KEY → users(id) | User who invited this member |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `entity_id` (idx_entity_users_entity_id)
- INDEX on `user_id` (idx_entity_users_user_id)
- UNIQUE constraint on `(entity_id, user_id)` - user can only have one role per entity

**RLS Policies**:
- Users can read their own entity memberships
- Owners can invite users to entities
- Triggers can create initial owner records (fixed in Migration 027 to allow entity creation)
- Service role operations use SECURITY DEFINER to bypass RLS when needed

**Role Hierarchy**:
- `owner` (4): Full access including deletion and member management
- `admin` (3): Can manage members and all data
- `editor` (2): Can create and edit data
- `viewer` (1): Read-only access

**Triggers**:
- `auto_assign_owner_on_entity_create`: Automatically assigns entity creator as owner

**Created in**: Migration 022, Fixed in Migration 026

---

### 3. `entities`
Multi-entity support for businesses and personal finances

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique entity identifier |
| `name` | VARCHAR | NOT NULL | Entity name |
| `type` | VARCHAR | NOT NULL | 'company' or 'personal' |
| `description` | TEXT | NULLABLE | Optional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `owner_user_id` | UUID | NULLABLE, FOREIGN KEY → users(id) | Entity owner (added in migration 022) |

**Indexes**:
- PRIMARY KEY on `id`
- Possible index on `type`
- FOREIGN KEY on `owner_user_id`

---

### 4. `accounts`
Financial accounts linked to entities

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `account_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | FOREIGN KEY → entities(id) | Owner entity |
| `account_name` | VARCHAR | NOT NULL | Display name |
| `account_type` | VARCHAR | NOT NULL | 'bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan', 'loan_receivable' |
| `account_number` | VARCHAR | NULLABLE | Optional account number |
| `bank_name` | VARCHAR | NULLABLE | Bank institution name |
| `currency` | VARCHAR | DEFAULT 'VND' | 'VND', 'USD', 'EUR' |
| `credit_limit` | DECIMAL(15,2) | NULLABLE | For credit accounts |
| `loan_reference` | VARCHAR | NULLABLE | For loan accounts |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `account_id`
- FOREIGN KEY on `entity_id`
- Possible index on `account_type`, `is_active`

---

### 5. `balance_checkpoints`
Historical balance snapshots for reconciliation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `checkpoint_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Related account |
| `checkpoint_date` | DATE | NOT NULL | Date of snapshot |
| `balance` | DECIMAL(15,2) | NOT NULL | Balance amount |
| `notes` | TEXT | NULLABLE | Optional description |
| `import_batch_id` | INTEGER | NULLABLE | Link to import batch |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `created_by_user_id` | INTEGER | NULLABLE | User who created (future use) |

**Indexes**:
- PRIMARY KEY on `checkpoint_id`
- FOREIGN KEY on `account_id`
- Possible composite index on `(account_id, checkpoint_date)`

**Triggers**:
- May have triggers for recalculating balances after checkpoint creation/update

---

### 6. `original_transaction`
Raw transaction layer (immutable source of truth)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `raw_transaction_id` | VARCHAR | PRIMARY KEY | Unique transaction ID (can be user-generated) |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Related account |
| `transaction_date` | DATE | NOT NULL | Transaction date |
| `description` | TEXT | NULLABLE | Transaction description |
| `debit_amount` | DECIMAL(15,2) | NULLABLE | Debit amount |
| `credit_amount` | DECIMAL(15,2) | NULLABLE | Credit amount |
| `balance` | DECIMAL(15,2) | NULLABLE | Running balance |
| `bank_reference` | VARCHAR | NULLABLE | Bank reference number |
| `transaction_source` | VARCHAR | NOT NULL | 'imported_bank', 'user_manual', 'system_opening', 'auto_adjustment' |
| `import_batch_id` | INTEGER | NULLABLE | Import batch tracking |
| `imported_at` | TIMESTAMP | NULLABLE | Import timestamp |
| `import_file_name` | VARCHAR | NULLABLE | Source file name |
| `is_balance_adjustment` | BOOLEAN | DEFAULT FALSE | Flag for adjustment transactions |
| `checkpoint_id` | INTEGER | NULLABLE | Link to checkpoint |
| `created_by_user_id` | INTEGER | NULLABLE | User who created |
| `updated_at` | TIMESTAMP | NULLABLE | Last update |
| `updated_by_user_id` | INTEGER | NULLABLE | User who updated |

**Indexes**:
- PRIMARY KEY on `raw_transaction_id`
- FOREIGN KEY on `account_id`
- Possible indexes on `transaction_date`, `import_batch_id`, `checkpoint_id`

**Triggers**:
- `auto_create_main_transaction`: Creates corresponding main_transaction on INSERT

**Constraints**:
- CHECK: Either `debit_amount` OR `credit_amount` must be NOT NULL (mutually exclusive)

---

### 7. `main_transaction`
Processed transaction layer with categorization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `main_transaction_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `raw_transaction_id` | VARCHAR | FOREIGN KEY → original_transaction(raw_transaction_id) | Link to source |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Related account |
| `transaction_type_id` | INTEGER | FOREIGN KEY → transaction_types(transaction_type_id) | Transaction type |
| `category_id` | INTEGER | FOREIGN KEY → categories(category_id) | Category |
| `branch_id` | INTEGER | FOREIGN KEY → branches(branch_id) | Branch/location |
| `amount` | DECIMAL(15,2) | NOT NULL | Transaction amount |
| `transaction_direction` | VARCHAR | NOT NULL | 'debit' or 'credit' |
| `transaction_date` | DATE | NOT NULL | Transaction date |
| `description` | TEXT | NULLABLE | Transaction description |
| `notes` | TEXT | NULLABLE | Additional notes |
| `is_split` | BOOLEAN | DEFAULT FALSE | Split transaction flag |
| `split_sequence` | INTEGER | NULLABLE | Order in split group |
| `transaction_subtype` | VARCHAR | NULLABLE | Additional classification |
| `drawdown_id` | INTEGER | FOREIGN KEY → debt_drawdown(drawdown_id) | Link to debt drawdown |
| `loan_disbursement_id` | INTEGER | FOREIGN KEY → loan_disbursement(loan_disbursement_id) | Link to loan disbursement (Migration 037) |
| `transfer_matched_transaction_id` | INTEGER | FOREIGN KEY → main_transaction(main_transaction_id) | Bidirectional matching |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `main_transaction_id`
- FOREIGN KEY on `raw_transaction_id` (UNIQUE - one-to-one relationship)
- FOREIGN KEY on `account_id`, `transaction_type_id`, `category_id`, `branch_id`, `drawdown_id`
- Possible index on `transfer_matched_transaction_id`

**Triggers**:
- `validate_transfer_match`: Validates matching transaction pairs on INSERT/UPDATE

**Constraints**:
- CHECK: `transaction_direction` IN ('debit', 'credit')
- Validation: For split transactions, sum of splits must equal original amount

---

### 8. `transaction_types`
Transaction type definitions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `transaction_type_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `type_code` | VARCHAR | UNIQUE NOT NULL | Unique code (INC, EXP, TRF_OUT, TRF_IN, DEBT_DRAW, DEBT_ACQ, DEBT_PAY, DEBT_SETTLE, etc.) |
| `type_name` | VARCHAR | NOT NULL | Internal name |
| `type_display_name` | VARCHAR | NOT NULL | User-facing name |
| `affects_cashflow` | BOOLEAN | DEFAULT TRUE | Whether affects cashflow calculations |
| `display_order` | INTEGER | DEFAULT 0 | Sort order in UI |
| `description` | TEXT | NULLABLE | Type description |

**Indexes**:
- PRIMARY KEY on `transaction_type_id`
- UNIQUE index on `type_code`

**Key Type Codes** (After Migration 042 Simplification):
- `INC`: Income
- `EXP`: Expense
- `TRF_OUT`: Transfer Out
- `TRF_IN`: Transfer In
- `DEBT_TAKE`: Debt Taken (consolidated from DEBT_ACQ + DEBT_DRAW) - used on both sides
- `DEBT_PAY`: Debt Payment - used on both sides
- `LOAN_DISBURSE`: Loan Disbursement (renamed from LOAN_GIVE) - used on both sides
- `LOAN_COLLECT`: Loan Collection (consolidated from LOAN_RECEIVE + LOAN_SETTLE) - used on both sides
- `INV`: Investment

**Deprecated/Removed Type Codes** (Migration 042):
- ~~`DEBT_ACQ`~~ → Consolidated into DEBT_TAKE
- ~~`DEBT_DRAW`~~ → Consolidated into DEBT_TAKE
- ~~`DEBT_SETTLE`~~ → Consolidated into DEBT_PAY
- ~~`LOAN_GIVE`~~ → Renamed to LOAN_DISBURSE
- ~~`LOAN_RECEIVE`~~ → Consolidated into LOAN_COLLECT
- ~~`LOAN_SETTLE`~~ → Consolidated into LOAN_COLLECT
- ~~`LOAN_WRITEOFF`~~ → Removed (use write-off field in loan_disbursement table)

---

### 9. `categories`
Hierarchical transaction categories

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `category_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `category_name` | VARCHAR | NOT NULL | Display name |
| `category_code` | VARCHAR | UNIQUE NOT NULL | Unique code |
| `transaction_type_id` | INTEGER | FOREIGN KEY → transaction_types(transaction_type_id) | Applicable type |
| `entity_type` | VARCHAR | NOT NULL | 'business', 'personal', 'both' |
| `parent_category_id` | INTEGER | FOREIGN KEY → categories(category_id) | Parent category (hierarchical) |
| `description` | TEXT | NULLABLE | Category description |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `category_id`
- UNIQUE index on `category_code`
- FOREIGN KEY on `transaction_type_id`, `parent_category_id`

**Constraints**:
- CHECK: `entity_type` IN ('business', 'personal', 'both')

---

### 10. `branches`
Store/location tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `branch_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `branch_name` | VARCHAR | NOT NULL | Display name |
| `branch_code` | VARCHAR | UNIQUE NOT NULL | Unique code |
| `address` | TEXT | NULLABLE | Physical address |
| `phone` | VARCHAR | NULLABLE | Contact phone |
| `email` | VARCHAR | NULLABLE | Contact email |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active flag |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `branch_id`
- UNIQUE index on `branch_code`

---

### 11. `debt_drawdown`
Debt drawdown tracking for credit lines and term loans

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `drawdown_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Credit line/term loan account |
| `drawdown_reference` | VARCHAR | NOT NULL | Reference number |
| `drawdown_date` | DATE | NOT NULL | Drawdown date |
| `original_amount` | DECIMAL(15,2) | NOT NULL | Initial drawdown amount |
| `remaining_balance` | DECIMAL(15,2) | NOT NULL | Current balance (updated by triggers) |
| `due_date` | DATE | NULLABLE | Optional payment due date |
| `interest_rate` | DECIMAL(5,2) | NULLABLE | Annual percentage rate |
| `status` | VARCHAR | DEFAULT 'active' | 'active', 'overdue', 'settled', 'written_off' |
| `notes` | TEXT | NULLABLE | Additional information |
| `overpayment_amount` | DECIMAL(15,2) | DEFAULT 0 | Overpaid amount |
| `is_overpaid` | BOOLEAN | DEFAULT FALSE | Overpayment flag (Migration 021) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `drawdown_id`
- FOREIGN KEY on `account_id`
- Possible composite index on `(account_id, status)`

**Triggers**:
- `trigger_update_drawdown_on_settlement`: Updates balance when DEBT_SETTLE transactions are created/updated/deleted
- `check_drawdown_status`: Auto-updates status based on balance and due date
- `update_debt_drawdown_updated_at`: Updates updated_at timestamp

**Constraints**:
- CHECK: `status` IN ('active', 'overdue', 'settled', 'written_off')
- CHECK: `remaining_balance` >= 0

**Payment Tracking**:
Payments for drawdowns are NOT stored in a separate table. Instead, they are tracked using `main_transaction` with:
- `drawdown_id` column linking to this table
- `transaction_subtype` indicating payment type:
  - `'principal'` - Principal payment (reduces remaining_balance)
  - `'interest'` - Interest payment
  - `'fee'` - Fee payment
  - `'penalty'` - Penalty payment
- Use `get_drawdown_payment_history(drawdown_id)` function to view all payments

---

**NOTE**: There is NO separate `drawdown_payment` table.

Payments for drawdowns are tracked using `main_transaction` table with:
- `drawdown_id` (links to debt_drawdown)
- `transaction_subtype` ('principal', 'interest', 'fee', 'penalty')
- `transaction_direction` ('debit' for payments out)

See `main_transaction` table (#5) for full schema.

---

### 12. `debt_payback`
Debt payback tracking for matched transfers (Migration 020)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `payback_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `credit_account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Account being paid back |
| `debit_account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Account paying |
| `transfer_pair_id` | INTEGER | FOREIGN KEY → transfer_pairs(transfer_pair_id) | Linked transfer |
| `amount` | DECIMAL(15,2) | NOT NULL | Payback amount |
| `payback_date` | DATE | NOT NULL | Payment date |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes**:
- PRIMARY KEY on `payback_id`
- FOREIGN KEY on `credit_account_id`, `debit_account_id`, `transfer_pair_id`

**Created in**: Migration 020

---

### 13. `import_batch`
Track import batches for rollback support

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `import_batch_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) | Related account |
| `file_name` | VARCHAR | NOT NULL | Source file name |
| `imported_at` | TIMESTAMP | DEFAULT NOW() | Import timestamp |
| `imported_by_user_id` | INTEGER | NULLABLE | User who imported |
| `transaction_count` | INTEGER | DEFAULT 0 | Number of transactions |
| `status` | VARCHAR | DEFAULT 'completed' | 'completed', 'rolled_back' |

**Indexes**:
- PRIMARY KEY on `import_batch_id`
- FOREIGN KEY on `account_id`

**Created in**: Early migrations

---

### 14. `transfer_pairs`
Tracks matched transfer transactions between accounts (Migration 019)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `transfer_pair_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `transfer_out_id` | INTEGER | FOREIGN KEY → main_transaction(main_transaction_id) | Source transaction |
| `transfer_in_id` | INTEGER | FOREIGN KEY → main_transaction(main_transaction_id) | Destination transaction |
| `amount` | DECIMAL(15,2) | NOT NULL | Transfer amount |
| `transfer_date` | DATE | NOT NULL | Transfer date |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes**:
- PRIMARY KEY on `transfer_pair_id`
- FOREIGN KEY on `transfer_out_id`, `transfer_in_id`

**Constraints**:
- Both transactions must be transfer types (TRF_OUT, TRF_IN)
- Amount must match between paired transactions

**Created in**: Migration 019

---

### 15. `business_partners`
Centralized contact management for all business relationships (Migration 039)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `partner_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this partner belongs to |
| `partner_type` | partner_type | NOT NULL, DEFAULT 'other' | 'customer', 'vendor', 'employee', 'owner', 'partner', 'lender', 'other' |
| `partner_name` | TEXT | NOT NULL | Primary name |
| `legal_name` | TEXT | NULLABLE | Official/legal name |
| `display_name` | TEXT | NULLABLE | Preferred display name |
| `tax_id` | TEXT | NULLABLE | Tax ID or business registration |
| `contact_person` | TEXT | NULLABLE | Main contact person |
| `email` | TEXT | NULLABLE | Email address |
| `phone` | TEXT | NULLABLE | Phone number |
| `mobile` | TEXT | NULLABLE | Mobile phone |
| `fax` | TEXT | NULLABLE | Fax number |
| `website` | TEXT | NULLABLE | Website URL |
| `address_line1` | TEXT | NULLABLE | Street address |
| `address_line2` | TEXT | NULLABLE | Additional address |
| `city` | TEXT | NULLABLE | City |
| `state_province` | TEXT | NULLABLE | State/Province |
| `postal_code` | TEXT | NULLABLE | Postal/ZIP code |
| `country` | TEXT | NULLABLE | Country |
| `bank_account_number` | TEXT | NULLABLE | Bank account number |
| `bank_name` | TEXT | NULLABLE | Bank name |
| `bank_branch` | TEXT | NULLABLE | Bank branch |
| `bank_swift_code` | TEXT | NULLABLE | SWIFT/BIC code |
| `payment_terms` | TEXT | NULLABLE | Payment terms |
| `credit_limit` | DECIMAL(15,2) | NULLABLE | Credit limit (for customers) |
| `notes` | TEXT | NULLABLE | Additional notes |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by_user_id` | UUID | FOREIGN KEY → users(id) | User who created |

**Indexes**:
- PRIMARY KEY on `partner_id`
- INDEX on `entity_id` (idx_business_partners_entity)
- INDEX on `partner_type` (idx_business_partners_type)
- INDEX on `partner_name` (idx_business_partners_name)
- INDEX on `email` (idx_business_partners_email)
- FOREIGN KEY on `entity_id`

**RLS Policies**:
- Users can view partners for their entities
- Editor+ can create/update partners
- Admin+ can delete partners (with cascade checks)

**Constraints**:
- UNIQUE constraint on `(entity_id, partner_name)` - partner names must be unique within entity

**Usage**:
- Referenced by `loan_disbursement` via `partner_id`
- Can be extended to reference from transactions, invoices, etc.
- Provides centralized contact and banking information

**Created in**: Migration 039

---

### 16. `loan_disbursement`
Tracks individual loans disbursed to borrowers (Migration 037, Updated in 039-040)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `loan_disbursement_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `account_id` | INTEGER | FOREIGN KEY → accounts(account_id) ON DELETE CASCADE | Loan receivable account |
| `partner_id` | INTEGER | NULLABLE, FOREIGN KEY → business_partners(partner_id) ON DELETE RESTRICT | Borrower (business partner) |
| `borrower_name` | TEXT | NULLABLE (deprecated) | Name of borrower (deprecated, use partner instead) |
| `loan_category` | loan_category | NOT NULL, DEFAULT 'short_term' | 'short_term', 'long_term', 'advance', 'other' |
| `principal_amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Original loan amount |
| `remaining_balance` | DECIMAL(15,2) | NOT NULL, DEFAULT 0, CHECK >= 0 | Current outstanding balance |
| `disbursement_date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | Date loan was given |
| `due_date` | DATE | NULLABLE | Optional payment due date |
| `term_months` | INTEGER | NULLABLE | Loan duration in months |
| `interest_rate` | DECIMAL(5,2) | NULLABLE | Annual interest rate (for reference only) |
| `status` | loan_status | NOT NULL, DEFAULT 'active' | 'active', 'overdue', 'repaid', 'partially_written_off', 'written_off' |
| `is_overpaid` | BOOLEAN | NOT NULL, DEFAULT false | True if borrower overpaid |
| `written_off_amount` | DECIMAL(15,2) | DEFAULT 0, CHECK >= 0 | Total written off amount |
| `written_off_date` | DATE | NULLABLE | Date of write-off |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by_user_id` | UUID | FOREIGN KEY → users(id) | User who created |

**Indexes**:
- PRIMARY KEY on `loan_disbursement_id`
- INDEX on `account_id` (idx_loan_disbursement_account)
- INDEX on `partner_id` (idx_loan_disbursement_partner)
- INDEX on `status` (idx_loan_disbursement_status)
- INDEX on `disbursement_date` (idx_loan_disbursement_disbursement_date)
- INDEX on `due_date` WHERE due_date IS NOT NULL (idx_loan_disbursement_due_date)
- FOREIGN KEY on `account_id`
- FOREIGN KEY on `partner_id`

**RLS Policies**:
- Users can view loan disbursements for their entities' accounts
- Editor+ can create/update loan disbursements
- Admin+ can delete loan disbursements

**Triggers**:
- `trigger_create_loan_disbursement_on_loan_give`: Auto-creates loan_disbursement when LOAN_GIVE transaction is created
- `trigger_update_loan_disbursement_after_settlement`: Updates balance and status when LOAN_SETTLE transactions change

**Constraints**:
- CHECK: `principal_amount` > 0
- CHECK: `remaining_balance` >= 0
- CHECK: `written_off_amount` >= 0

**Payment Tracking**:
Payments for loans are tracked using `main_transaction` with:
- `loan_disbursement_id` column linking to this table
- Transaction types: LOAN_RECEIVE (bank account), LOAN_SETTLE (loan_receivable account, auto-created)
- Balance automatically updated by triggers

**Borrower Information**:
- Migration 037: Initially used `borrower_name` and `borrower_type` fields
- Migration 039: Added `partner_id` to reference `business_partners` table
- Migration 040: Removed redundant `borrower_type` field
- Current: Use `partner_id` for new loans; `borrower_name` is deprecated

**Created in**: Migration 037
**Updated in**: Migration 039 (added partner_id), Migration 040 (removed borrower_type)

---

### 17. `category_budgets` (Budget Management)
Budget tracking per category with date ranges and recurring support (Migration 057)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `budget_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this budget belongs to |
| `category_id` | INTEGER | NOT NULL, FOREIGN KEY → categories(category_id) ON DELETE CASCADE | Category being budgeted |
| `budget_name` | VARCHAR(255) | NULLABLE | Optional name (e.g., "Q1 2024 Marketing Budget") |
| `budget_amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Budget amount |
| `start_date` | DATE | NOT NULL | Budget period start |
| `end_date` | DATE | NOT NULL | Budget period end |
| `recurring_period` | VARCHAR(20) | CHECK IN ('one-time', 'monthly', 'quarterly', 'yearly') | Recurrence type |
| `auto_renew` | BOOLEAN | DEFAULT FALSE | Auto-renew when period ends |
| `status` | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'completed', 'paused', 'cancelled') | Budget status |
| `alert_threshold` | DECIMAL(5,2) | DEFAULT 80.00 | Alert at this percentage |
| `notes` | TEXT | NULLABLE | Additional notes |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Indexes**:
- `idx_category_budgets_entity` on `entity_id`
- `idx_category_budgets_category` on `category_id`
- `idx_category_budgets_dates` on `(start_date, end_date)`
- `idx_category_budgets_status` on `(status, is_active)`
- `idx_category_budgets_active_period` partial index

**Functions**:
- `get_budget_spending(p_budget_id)` - Calculate spending vs budget
- `auto_renew_budgets()` - Renew expired recurring budgets

**Created in**: Migration 057

---

### 18. `scheduled_payments` (Scheduled Payment Contracts)
Track contractual payment obligations (leases, service contracts, construction milestones) (Migration 059)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scheduled_payment_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this belongs to |
| `category_id` | INTEGER | NOT NULL, FOREIGN KEY → categories(category_id) ON DELETE RESTRICT | Payment category |
| `contract_name` | VARCHAR(255) | NOT NULL | Contract/agreement name |
| `contract_type` | VARCHAR(50) | NOT NULL, CHECK IN ('lease', 'service', 'construction', 'subscription', 'other') | Type of contract |
| `payee_name` | VARCHAR(255) | NOT NULL | Who to pay |
| `contract_number` | VARCHAR(100) | NULLABLE | Contract reference number |
| `payment_amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Payment amount |
| `schedule_type` | VARCHAR(20) | NOT NULL, CHECK IN ('recurring', 'one_time', 'custom_dates') | Schedule type |
| `frequency` | VARCHAR(20) | CHECK IN ('monthly', 'quarterly', 'yearly', 'custom') | Payment frequency |
| `payment_day` | INTEGER | CHECK 1-31 | Day of month for recurring |
| `start_date` | DATE | NOT NULL | Contract start date |
| `end_date` | DATE | NULLABLE | Contract end date |
| `custom_schedule` | JSONB | NULLABLE | Array of custom dates |
| `status` | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'completed', 'cancelled') | Contract status |
| `contract_id` | INTEGER | FOREIGN KEY → contracts(contract_id) ON DELETE CASCADE | Link to master contract |
| `payment_type` | VARCHAR(50) | DEFAULT 'primary' | Payment component type |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Functions**:
- `generate_payment_instances(scheduled_payment_id, months_ahead)` - Generate payment instances
- `mark_payment_as_paid(instance_id, transaction_id, amount, date)` - Mark payment as paid
- `get_overdue_payment_count(entity_id)` - Count overdue payments
- `get_upcoming_payments(entity_id, days_ahead)` - Get upcoming payments

**Created in**: Migration 059
**Updated in**: Migration 060 (added contract_id, payment_type)

---

### 19. `scheduled_payment_instances` (Individual Payment Due Dates)
Individual due dates for scheduled payments (Migration 059)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `instance_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `scheduled_payment_id` | INTEGER | NOT NULL, FOREIGN KEY → scheduled_payments ON DELETE CASCADE | Parent schedule |
| `due_date` | DATE | NOT NULL | Payment due date |
| `amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Payment amount |
| `status` | VARCHAR(20) | DEFAULT 'pending', CHECK IN ('pending', 'paid', 'overdue', 'cancelled', 'partial') | Payment status |
| `paid_date` | DATE | NULLABLE | Actual payment date |
| `paid_amount` | DECIMAL(15,2) | NULLABLE | Actual amount paid |
| `transaction_id` | INTEGER | FOREIGN KEY → main_transaction ON DELETE SET NULL | Linked transaction |
| `amendment_id` | INTEGER | FOREIGN KEY → contract_amendments ON DELETE SET NULL | Amendment that modified this |
| `is_amended` | BOOLEAN | DEFAULT FALSE | Was amount amended |
| `original_amount` | DECIMAL(15,2) | NULLABLE | Original amount before amendment |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Created in**: Migration 059
**Updated in**: Migration 060 (added amendment_id, is_amended, original_amount), Migration 089 (added partial status)

---

### 20. `contracts` (Master Contract Agreements)
Master contracts/agreements table (Migration 060)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `contract_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this belongs to |
| `contract_number` | VARCHAR(100) | NOT NULL, UNIQUE per entity | Contract reference number |
| `contract_name` | VARCHAR(255) | NOT NULL | Contract name |
| `contract_type` | VARCHAR(50) | NOT NULL, CHECK IN ('lease', 'service', 'construction', 'subscription', 'purchase', 'supply', 'other') | Contract type |
| `counterparty` | VARCHAR(255) | NOT NULL | Other party (landlord, vendor, etc.) |
| `counterparty_contact` | TEXT | NULLABLE | Contact details |
| `counterparty_address` | TEXT | NULLABLE | Business address |
| `signing_date` | DATE | NULLABLE | When contract was signed |
| `effective_date` | DATE | NOT NULL | When contract takes effect |
| `expiration_date` | DATE | NULLABLE | When contract expires |
| `total_contract_value` | DECIMAL(15,2) | NULLABLE, CHECK > 0 | Total value for fixed-price |
| `payment_terms` | TEXT | NULLABLE | Payment terms description |
| `renewal_terms` | TEXT | NULLABLE | Renewal terms |
| `termination_terms` | TEXT | NULLABLE | Termination terms |
| `special_terms` | TEXT | NULLABLE | Other important terms |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Contract status |
| `renewed_from_contract_id` | INTEGER | FOREIGN KEY → contracts ON DELETE SET NULL | Previous contract (if renewed) |
| `renewal_count` | INTEGER | DEFAULT 0 | Number of renewals |
| `document_url` | TEXT | NULLABLE | Link to signed PDF |
| `attachments` | JSONB | NULLABLE | Additional documents |
| `notes` | TEXT | NULLABLE | Additional notes |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Status Values**: 'draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewed'

**Created in**: Migration 060

---

### 21. `contract_amendments` (Contract Modifications)
Contract amendments and modifications tracking (Migration 060)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `amendment_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `contract_id` | INTEGER | NOT NULL, FOREIGN KEY → contracts ON DELETE CASCADE | Parent contract |
| `amendment_number` | INTEGER | NOT NULL, UNIQUE per contract | Sequential number |
| `amendment_date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | When amendment was made |
| `effective_start_date` | DATE | NOT NULL | When amendment takes effect |
| `effective_end_date` | DATE | NULLABLE | When amendment expires |
| `amendment_type` | VARCHAR(50) | NOT NULL, CHECK IN (...) | Type of amendment |
| `new_payment_amount` | DECIMAL(15,2) | NULLABLE | New payment amount |
| `new_frequency` | VARCHAR(20) | NULLABLE | New payment frequency |
| `new_expiration_date` | DATE | NULLABLE | New contract end date |
| `title` | VARCHAR(255) | NOT NULL | Amendment title |
| `description` | TEXT | NOT NULL | Detailed description |
| `reason` | TEXT | NULLABLE | Business reason |
| `estimated_impact` | DECIMAL(15,2) | NULLABLE | Estimated cost/saving |
| `impact_direction` | VARCHAR(10) | CHECK IN ('increase', 'decrease', 'neutral') | Impact direction |
| `amendment_document_url` | TEXT | NULLABLE | Link to signed amendment |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Amendment status |
| `approved_by` | UUID | FOREIGN KEY → auth.users(id) | Approver |
| `approved_at` | TIMESTAMPTZ | NULLABLE | Approval timestamp |
| `rejection_reason` | TEXT | NULLABLE | Rejection reason |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Amendment Types**: 'amount_change', 'payment_schedule_change', 'term_extension', 'term_reduction', 'scope_change', 'party_change', 'other'

**Status Values**: 'draft', 'pending_approval', 'approved', 'rejected', 'superseded'

**Functions**:
- `apply_amendment_to_instances(amendment_id)` - Apply amendment to payment instances
- `revert_amendment_from_instances(amendment_id)` - Revert amendment changes

**Created in**: Migration 060

---

### 22. `investment_contribution` (Investment Tracking)
Tracks investments made from bank/cash accounts into investment accounts (Migration 064)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `contribution_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity that owns the investment |
| `investment_account_id` | INTEGER | NOT NULL, FOREIGN KEY → accounts ON DELETE CASCADE | Investment account receiving funds |
| `source_account_id` | INTEGER | NOT NULL, FOREIGN KEY → accounts ON DELETE RESTRICT | Bank/cash account providing funds |
| `contribution_amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Amount invested |
| `contribution_date` | DATE | NOT NULL | Date of investment |
| `main_transaction_id` | INTEGER | NULLABLE | Link to transaction |
| `status` | TEXT | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'partial_withdrawal', 'fully_withdrawn') | Contribution status |
| `notes` | TEXT | NULLABLE | Additional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Created in**: Migration 064

---

### 23. `receipts` (Receipt Management with OCR)
Stores receipt images/PDFs with OCR extraction results (Migration 075)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `receipt_id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique receipt identifier |
| `main_transaction_id` | INTEGER | FOREIGN KEY → main_transaction ON DELETE CASCADE | Linked transaction |
| `raw_transaction_id` | VARCHAR | FOREIGN KEY → original_transaction ON DELETE CASCADE | Linked raw transaction |
| `account_id` | INTEGER | FOREIGN KEY → accounts ON DELETE CASCADE | Related account |
| `entity_id` | UUID | NOT NULL | Entity this belongs to |
| `file_url` | TEXT | NOT NULL | Full URL to receipt file |
| `file_path` | TEXT | NOT NULL | Storage path (entity_id/receipt_id/filename) |
| `file_name` | TEXT | NOT NULL | Original filename |
| `file_size` | INTEGER | NULLABLE | File size in bytes |
| `file_type` | TEXT | NULLABLE | MIME type |
| `ocr_raw_text` | TEXT | NULLABLE | Full extracted text |
| `ocr_merchant_name` | TEXT | NULLABLE | Extracted merchant name |
| `ocr_transaction_date` | DATE | NULLABLE | Extracted date |
| `ocr_total_amount` | DECIMAL(15,2) | NULLABLE | Extracted amount |
| `ocr_currency` | TEXT | DEFAULT 'VND' | Extracted currency |
| `ocr_items` | JSONB | NULLABLE | Line items array |
| `ocr_confidence` | DECIMAL(3,2) | NULLABLE | Confidence score (0-1) |
| `ocr_processed_at` | TIMESTAMPTZ | NULLABLE | OCR completion time |
| `ocr_service` | TEXT | NULLABLE | OCR service used |
| `processing_status` | TEXT | DEFAULT 'pending', CHECK IN ('pending', 'processing', 'completed', 'failed') | Processing status |
| `processing_error` | TEXT | NULLABLE | Error message if failed |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Storage**: Uses Supabase Storage bucket 'receipts' with entity-based folder structure

**Created in**: Migration 075
**Updated in**: Migration 076 (changed to raw_transaction_id)

---

### 24. `role_permissions` (Custom Role Permissions)
Stores custom permission overrides for roles per entity (Migration 091)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `permission_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this applies to |
| `role` | user_role | NOT NULL | Role being customized |
| `can_view_transactions` | BOOLEAN | DEFAULT NULL | Override: view transactions |
| `can_create_transactions` | BOOLEAN | DEFAULT NULL | Override: create transactions |
| `can_edit_transactions` | BOOLEAN | DEFAULT NULL | Override: edit transactions |
| `can_delete_transactions` | BOOLEAN | DEFAULT NULL | Override: delete transactions |
| `can_categorize_transactions` | BOOLEAN | DEFAULT NULL | Override: categorize |
| `can_split_transactions` | BOOLEAN | DEFAULT NULL | Override: split transactions |
| `can_add_notes` | BOOLEAN | DEFAULT NULL | Override: add notes |
| `can_import_transactions` | BOOLEAN | DEFAULT NULL | Override: import |
| `can_view_reports` | BOOLEAN | DEFAULT NULL | Override: view reports |
| `can_view_cash_flow` | BOOLEAN | DEFAULT NULL | Override: view cash flow |
| `can_view_analytics` | BOOLEAN | DEFAULT NULL | Override: view analytics |
| `can_export_data` | BOOLEAN | DEFAULT NULL | Override: export data |
| `can_view_accounts` | BOOLEAN | DEFAULT NULL | Override: view accounts |
| `can_create_accounts` | BOOLEAN | DEFAULT NULL | Override: create accounts |
| `can_edit_accounts` | BOOLEAN | DEFAULT NULL | Override: edit accounts |
| `can_delete_accounts` | BOOLEAN | DEFAULT NULL | Override: delete accounts |
| `can_view_team` | BOOLEAN | DEFAULT NULL | Override: view team |
| `can_invite_users` | BOOLEAN | DEFAULT NULL | Override: invite users |
| `can_remove_users` | BOOLEAN | DEFAULT NULL | Override: remove users |
| `can_change_roles` | BOOLEAN | DEFAULT NULL | Override: change roles |
| `can_manage_categories` | BOOLEAN | DEFAULT NULL | Override: manage categories |
| `can_manage_settings` | BOOLEAN | DEFAULT NULL | Override: manage settings |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |
| `updated_by` | UUID | FOREIGN KEY → auth.users(id) | User who updated |

**Note**: NULL values mean use default permission from code. TRUE/FALSE override defaults.

**Constraints**: UNIQUE(entity_id, role) - one override per role per entity

**RLS**: Only owners can view/modify role permissions

**Created in**: Migration 091

---

### 25. `cashflow_scenarios` (Cash Flow Scenario Planning)
Cash flow scenario definitions for what-if analysis (Migration 093)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `scenario_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `entity_id` | UUID | NOT NULL, FOREIGN KEY → entities(id) ON DELETE CASCADE | Entity this belongs to |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE per entity | Scenario name |
| `description` | TEXT | NULLABLE | Scenario description |
| `color` | VARCHAR(7) | DEFAULT '#6366f1' | Hex color for chart display |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| `created_by` | UUID | FOREIGN KEY → auth.users(id) | User who created |

**Created in**: Migration 093

---

### 26. `scenario_adjustments` (Scenario What-If Adjustments)
Individual adjustments within a cash flow scenario (Migration 093)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `adjustment_id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `scenario_id` | INTEGER | NOT NULL, FOREIGN KEY → cashflow_scenarios ON DELETE CASCADE | Parent scenario |
| `adjustment_type` | scenario_adjustment_type | NOT NULL | Type of adjustment |
| `name` | VARCHAR(200) | NOT NULL | Display name |
| `amount` | DECIMAL(15,2) | NULLABLE | For income/expense/debt amounts |
| `percentage` | DECIMAL(5,2) | NULLABLE | For modify_predicted/modify_income |
| `start_month` | DATE | NULLABLE | First month this applies (YYYY-MM-01) |
| `end_month` | DATE | NULLABLE | Last month (null = ongoing) |
| `category_id` | INTEGER | FOREIGN KEY → categories | For targeting specific category |
| `scheduled_payment_id` | INTEGER | FOREIGN KEY → scheduled_payments | For exclude_scheduled |
| `account_id` | INTEGER | FOREIGN KEY → accounts | For debt_drawdown account |
| `metadata` | JSONB | DEFAULT '{}' | Additional data (e.g., repayment_month) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Adjustment Types** (ENUM `scenario_adjustment_type`):
- `one_time_income` - Single income event
- `one_time_expense` - Single expense event
- `recurring_income` - Monthly recurring income
- `recurring_expense` - Monthly recurring expense
- `debt_drawdown` - New debt/loan (adds as income in drawdown month, expense in repayment month)
- `modify_predicted` - Percentage adjustment to predicted expenses
- `modify_income` - Percentage adjustment to predicted income
- `exclude_scheduled` - Remove a scheduled payment from projection

**Created in**: Migration 093

---

## Views

### 1. `main_transaction_details`
Comprehensive transaction view joining all related tables

**Purpose**: Provides all transaction information with related entity, account, type, category, branch, and drawdown details in a single query

**Columns Include**:
- All `main_transaction` fields
- Account: `account_name`, `bank_name`, `account_type`
- Entity: `entity_id`, `entity_name`, `entity_type`
- Transaction Type: `transaction_type_code`, `transaction_type`, `affects_cashflow`
- Category: `category_id`, `category_name`, `category_code`
- Branch: `branch_id`, `branch_name`, `branch_code`
- Drawdown: `drawdown_reference`, `drawdown_date`, `drawdown_original_amount`, `drawdown_remaining_balance`, `drawdown_due_date`, `drawdown_status`, `drawdown_is_overpaid`
- Calculated: `needs_drawdown_match`, `is_unmatched`

**Definition** (simplified):
```sql
CREATE VIEW main_transaction_details AS
SELECT
  mt.*,
  a.account_name, a.bank_name, a.account_type,
  e.id as entity_id, e.name as entity_name, e.type as entity_type,
  tt.type_code as transaction_type_code, tt.type_display_name as transaction_type,
  c.category_name, c.category_code,
  b.branch_name, b.branch_code,
  dd.drawdown_reference, dd.drawdown_date, dd.original_amount as drawdown_original_amount,
  dd.remaining_balance as drawdown_remaining_balance, dd.due_date as drawdown_due_date,
  dd.status as drawdown_status, dd.is_overpaid as drawdown_is_overpaid,
  CASE
    WHEN tt.type_code = 'DEBT_PAY' AND mt.drawdown_id IS NULL THEN TRUE
    ELSE FALSE
  END as needs_drawdown_match,
  CASE
    WHEN tt.type_code IN ('TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ', 'DEBT_PAY', 'DEBT_SETTLE')
      AND mt.transfer_matched_transaction_id IS NULL THEN TRUE
    ELSE FALSE
  END as is_unmatched
FROM main_transaction mt
JOIN accounts a ON mt.account_id = a.account_id
JOIN entities e ON a.entity_id = e.id
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
LEFT JOIN categories c ON mt.category_id = c.category_id
LEFT JOIN branches b ON mt.branch_id = b.branch_id
LEFT JOIN debt_drawdown dd ON mt.drawdown_id = dd.drawdown_id;
```

---

### 2. `debt_summary`
Aggregated debt statistics per account

**Purpose**: Provides summary statistics for credit line and term loan accounts

**Columns Include**:
- Account information
- `total_drawdowns`: Total number of drawdowns
- `active_drawdowns`: Number of active drawdowns
- `overdue_drawdowns`: Number of overdue drawdowns
- `settled_drawdowns`: Number of settled drawdowns
- `total_outstanding`: Total outstanding balance (active + overdue)
- `available_credit`: Remaining available credit
- `average_interest_rate`: Weighted average interest rate

---

### 3. `budget_overview` (Migration 057)
Complete budget overview with real-time spending calculations

**Purpose**: Shows budget vs actual spending with status indicators

**Columns Include**:
- All `category_budgets` fields
- `category_name`, `category_code`
- `transaction_type` (display name)
- `spent_amount`: Sum of expenses in period
- `remaining_amount`: Budget minus spent
- `percentage_used`: Percentage of budget used
- `transaction_count`: Number of transactions
- `budget_status`: 'upcoming', 'expired', 'exceeded', 'warning', 'on_track'

---

### 4. `scheduled_payment_overview` (Migration 059)
Complete overview of scheduled payments with instance summaries

**Purpose**: Shows payment schedules with aggregated instance data

**Columns Include**:
- All `scheduled_payments` fields
- `category_name`
- `total_instances`, `pending_count`, `paid_count`, `overdue_count`
- `next_due_date`: Earliest pending due date
- `total_paid`, `total_pending`, `total_overdue`

---

### 5. `contract_overview` (Migration 060)
Contract summary with payment schedules and amendments

**Purpose**: Shows contract details with related payment and amendment info

**Columns Include**:
- All `contracts` fields
- `payment_schedules_count`
- `total_monthly_obligation`
- `amendments_count`, `active_amendments_count`
- `days_until_expiration`
- `derived_status`: 'expired', 'expiring_soon', or actual status

---

### 6. `amendment_history` (Migration 060)
Amendment history with financial impact calculations

**Purpose**: Shows all amendments with their effects

**Columns Include**:
- All `contract_amendments` fields
- `contract_name`, `contract_number`
- `affected_instances_count`
- `total_financial_impact`: Sum of amount changes

---

### 7. `scenario_overview` (Migration 093)
Summary view of scenarios with adjustment counts and totals

**Purpose**: Quick overview of all scenarios for an entity

**Columns Include**:
- All `cashflow_scenarios` fields
- `adjustment_count`: Number of adjustments
- `total_income_adjustments`: Sum of income adjustments
- `total_expense_adjustments`: Sum of expense/debt adjustments

---

## Functions (RPC)

### 1. `get_active_drawdowns(p_account_id INTEGER)`
**Returns**: SETOF custom type with drawdown details
**Purpose**: Returns active and overdue drawdowns with calculated fields

**Returns**:
- All drawdown fields
- `paid_amount`: Amount paid so far
- `days_until_due`: Days until due date (negative if overdue)
- `total_interest_paid`: Total interest paid
- `total_fees_paid`: Total fees paid

---

### 2. `get_available_credit(p_account_id INTEGER)`
**Returns**: TABLE(available_credit DECIMAL)
**Purpose**: Calculates available credit for credit line accounts

**Logic**:
```
available_credit = credit_limit - SUM(remaining_balance WHERE status IN ('active', 'overdue'))
```

---

### 3. `get_drawdown_settled_amount(p_drawdown_id INTEGER)`
**Returns**: DECIMAL(15,2)
**Purpose**: Calculate total settled amount from matched DEBT_PAY transactions (Migration 042: changed from DEBT_SETTLE)

**Logic**:
```sql
SELECT SUM(mt.amount)
FROM main_transaction mt
JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
WHERE mt.drawdown_id = p_drawdown_id
  AND tt.type_code = 'DEBT_PAY'  -- Changed from DEBT_SETTLE in Migration 042
  AND mt.transfer_matched_transaction_id IS NOT NULL;
```

---

### 4. `auto_update_drawdown_balance()` (Migration 042: renamed and updated)
**Returns**: TRIGGER
**Purpose**: Automatically update drawdown balance when DEBT_PAY transactions are created/updated/deleted

**Trigger Events**: AFTER INSERT OR UPDATE OR DELETE ON main_transaction

**Logic** (Migration 042):
1. Detects DEBT_PAY transactions (changed from DEBT_SETTLE)
2. Calculates total settled amount using `get_drawdown_settled_amount()`
3. Updates `remaining_balance` = `original_amount` - `total_settled`
4. Sets `is_overpaid` flag if overpaid
5. Updates `status`:
   - 'settled' if balance <= 0
   - 'overdue' if due_date < today AND balance > 0
   - 'active' otherwise

---

### 5. `validate_transfer_match()`
**Returns**: TRIGGER
**Purpose**: Validates transaction pair matching

**Trigger Events**: BEFORE INSERT OR UPDATE ON main_transaction

**Validates** (After Migration 042):
- Both transactions are matchable types (TRF_OUT, TRF_IN, DEBT_TAKE, DEBT_PAY, LOAN_DISBURSE, LOAN_COLLECT)
- Correct pairs:
  - TRF_OUT ↔ TRF_IN
  - DEBT_TAKE ↔ DEBT_TAKE
  - DEBT_PAY ↔ DEBT_PAY
  - LOAN_DISBURSE ↔ LOAN_DISBURSE
  - LOAN_COLLECT ↔ LOAN_COLLECT
- Different accounts
- Same entity (cross-entity transfers prevented)

---

### 6. `recalculate_balances_after_checkpoint()`
**Returns**: TRIGGER or FUNCTION
**Purpose**: Recalculates running balances after checkpoint creation/update

**Logic**:
1. Find all transactions after checkpoint date
2. Recalculate running balance forward
3. Create balance adjustment if needed at next checkpoint
4. Update transaction balances

---

### 7. `cleanup_orphaned_adjustments()`
**Returns**: VOID
**Purpose**: Removes obsolete balance adjustment transactions

**Logic**:
1. Find balance adjustment transactions
2. Check if they're still needed
3. Delete orphaned adjustments
4. Keep only latest adjustment per checkpoint pair

---

### 8. `auto_create_main_transaction()`
**Returns**: TRIGGER
**Purpose**: Automatically creates main_transaction when original_transaction is inserted

**Trigger Events**: AFTER INSERT ON original_transaction

**Logic**:
1. Creates corresponding main_transaction
2. Sets default transaction type based on debit/credit
3. Copies amount and direction
4. Links via raw_transaction_id

---

### 9. `handle_new_user()` (Migration 022)
**Returns**: TRIGGER
**Purpose**: Automatically creates user profile in public.users when Supabase auth user is created

**Trigger Events**: AFTER INSERT ON auth.users

**Logic**:
1. Extracts user info from auth.users
2. Creates corresponding public.users record
3. Copies email, full_name, avatar_url from metadata

---

### 10. `handle_new_entity()` (Migration 022)
**Returns**: TRIGGER
**Purpose**: Sets owner_user_id when entity is created

**Trigger Events**: BEFORE INSERT ON entities

**Logic**:
1. Sets NEW.owner_user_id to current auth.uid()
2. Returns modified NEW record

---

### 11. `add_entity_owner()` (Migration 022)
**Returns**: TRIGGER
**Purpose**: Automatically adds creator as owner in entity_users junction table

**Trigger Events**: AFTER INSERT ON entities

**Logic**:
1. Inserts record into entity_users
2. Sets entity_id, user_id (auth.uid()), role ('owner')

---

### 12. `get_user_role(p_entity_id UUID, p_user_id UUID)` (Migration 022)
**Returns**: user_role ENUM
**Purpose**: Get user's role for a specific entity

**Example**:
```sql
SELECT get_user_role('entity-uuid', 'user-uuid');
-- Returns: 'owner', 'admin', 'editor', 'viewer', or NULL
```

---

### 13. `user_has_entity_access(p_entity_id UUID, p_user_id UUID)` (Migration 022)
**Returns**: BOOLEAN
**Purpose**: Check if user has any access to an entity

**Example**:
```sql
SELECT user_has_entity_access('entity-uuid', 'user-uuid');
-- Returns: TRUE or FALSE
```

---

### 14. `user_has_permission(p_entity_id UUID, p_user_id UUID, p_required_role user_role)` (Migration 022)
**Returns**: BOOLEAN
**Purpose**: Check if user has at least the required role level for an entity

**Logic**:
- Uses role hierarchy: owner (4) > admin (3) > editor (2) > viewer (1)
- Returns TRUE if user's role >= required role

**Example**:
```sql
SELECT user_has_permission('entity-uuid', 'user-uuid', 'admin');
-- Returns: TRUE if user is admin or owner, FALSE otherwise
```

---

## Triggers Summary

### Transaction Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `auto_create_main_transaction` | original_transaction | AFTER INSERT | auto_create_main_transaction() | Auto-create main_transaction |
| `sync_main_transaction_amount_trigger` | original_transaction | AFTER UPDATE | sync_main_transaction_amount() | Sync amounts to main_transaction |
| `trigger_validate_transfer_match` | main_transaction | BEFORE INSERT/UPDATE | validate_transfer_match() | Validate matching pairs |
| `check_split_amounts` | main_transaction | AFTER INSERT/UPDATE | check_split_amounts() | Validate split transaction totals |

### Debt & Loan Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `trigger_update_drawdown_on_settlement` | main_transaction | AFTER INSERT/UPDATE/DELETE | update_drawdown_after_settlement() | Update drawdown balance |
| `trigger_auto_delete_debt_drawdown_on_unmatch` | main_transaction | AFTER UPDATE | auto_delete_debt_drawdown_on_unmatch() | Cleanup unmatched drawdowns |
| `trigger_update_loan_disbursement_after_settlement` | main_transaction | AFTER INSERT/UPDATE/DELETE | update_loan_disbursement_after_settlement() | Update loan disbursement balance |
| `trigger_create_loan_disbursement_on_loan_give` | main_transaction | AFTER INSERT | create_loan_disbursement_on_loan_give() | Auto-create loan disbursement |
| `trigger_auto_create_loan_settle_on_match` | main_transaction | AFTER UPDATE | auto_create_loan_settle_on_match() | Auto-create LOAN_SETTLE |
| `trigger_auto_delete_loan_disbursement_on_unmatch` | main_transaction | AFTER UPDATE | auto_delete_loan_disbursement_on_unmatch() | Cleanup unmatched loans |

### Investment Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `trigger_update_investment_balance` | main_transaction | AFTER INSERT/UPDATE/DELETE | update_investment_balance() | Update investment account balance |
| `trigger_auto_delete_investment_on_unmatch` | main_transaction | AFTER UPDATE | auto_delete_investment_on_unmatch() | Cleanup unmatched investments |
| `update_investment_contribution_updated_at` | investment_contribution | BEFORE UPDATE | update_updated_at_column() | Update timestamp |

### Auth & Entity Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `on_auth_user_created` | auth.users | AFTER INSERT | handle_new_user() | Auto-create user profile |
| `on_entity_created_set_owner` | entities | BEFORE INSERT | handle_new_entity() | Set entity owner_user_id |
| `on_entity_created_add_owner` | entities | AFTER INSERT | add_entity_owner() | Add owner to entity_users |

### Scheduled Payment Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `update_scheduled_payments_timestamp` | scheduled_payments | BEFORE UPDATE | update_scheduled_payment_timestamp() | Update timestamp |
| `update_payment_instances_timestamp` | scheduled_payment_instances | BEFORE UPDATE | update_scheduled_payment_timestamp() | Update timestamp |

### Scenario Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `update_scenarios_timestamp` | cashflow_scenarios | BEFORE UPDATE | update_scenario_timestamp() | Update timestamp |
| `update_adjustments_timestamp` | scenario_adjustments | BEFORE UPDATE | update_scenario_timestamp() | Update timestamp |

### Other Triggers
| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `update_receipts_updated_at` | receipts | BEFORE UPDATE | update_updated_at_column() | Update timestamp |
| `update_role_permissions_updated_at` | role_permissions | BEFORE UPDATE | update_updated_at_column() | Update timestamp |

---

## Relationships Diagram

```
auth.users (1) ─── (1) users ──< (M) entity_users >── (M) entities (1) ──< (M) accounts
                                          │                    │
                                          └──(owner_user_id)───┘
                                                                     │
                                                                     ├──< (M) original_transaction (1) ─── (1) main_transaction
                                                                     │                                            │
                                                                     ├──< (M) balance_checkpoints                 ├──< transaction_types (M) ──< (M) categories
                                                                     │                                            ├──< branches (M)
                                                                     │                                            ├──< debt_drawdown (M) (via drawdown_id)
                                                                     │                                            └──< import_batch (M)
                                                                     └──< (M) debt_drawdown

main_transaction ──< transfer_matched_transaction_id >── main_transaction (self-referential)
```

**Legend**:
- `(1) ── (M)`: One-to-Many relationship
- `──<`: Foreign key pointing direction
- `>──`: Junction table connecting entities

---

## Key Constraints & Business Rules

### Transaction Matching Pairs (After Migration 042 Simplification)
- **TRF_OUT** ↔ **TRF_IN**: Inter-account transfers
- **DEBT_TAKE** ↔ **DEBT_TAKE**: Debt drawdown (both credit line and bank account use same type)
- **DEBT_PAY** ↔ **DEBT_PAY**: Debt repayment (both bank account and credit line use same type)
- **LOAN_DISBURSE** ↔ **LOAN_DISBURSE**: Loan disbursement (both bank account and loan_receivable use same type)
- **LOAN_COLLECT** ↔ **LOAN_COLLECT**: Loan collection (both loan_receivable and bank account use same type)

### Cross-Entity Transfer Prevention 🔒 (Migration 024)
**CRITICAL SECURITY RULE**: Transfers can ONLY occur between accounts within the SAME entity.

This prevents:
- Accountants managing multiple entities from accidentally transferring between different companies
- Malicious cross-entity fund movement
- Data leakage between tenants

**Enforced by**: `validate_transfer_match()` trigger (BEFORE INSERT/UPDATE on main_transaction)

**Example**:
```sql
-- ❌ BLOCKED: Cannot transfer from Company A to Company B
Account 1 (Entity: Company A) → TRF_OUT
Account 2 (Entity: Company B) → TRF_IN
-- Raises: "Cross-entity transfers are not allowed"

-- ✅ ALLOWED: Transfer within same entity
Account 1 (Entity: Company A) → TRF_OUT
Account 3 (Entity: Company A) → TRF_IN
-- Success
```

**Helper Function**: Use `can_transfer_between_accounts(from_id, to_id)` in UI to show only valid transfer destinations

### Split Transactions
- `is_split` = TRUE on all splits
- `split_sequence` determines order
- Sum of split amounts must equal original transaction amount
- Each split can have different category/branch

### Balance Checkpoints
- Created automatically on import
- Can be created manually
- Trigger recalculation of all future balances
- Create adjustment transactions if mismatch with next checkpoint

### Drawdown Status
- **active**: Normal state
- **overdue**: due_date < today AND remaining_balance > 0
- **settled**: remaining_balance <= 0
- **written_off**: Manual write-off

---

## Data Validation Rules

1. **original_transaction**: Either debit_amount OR credit_amount must be non-null (not both)
2. **main_transaction**: Amount must match original_transaction debit/credit
3. **drawdown_payment**: total_amount = principal + interest + fees
4. **matched transactions**: Must be opposite types and different accounts
5. **categories**: Must belong to compatible transaction type
6. **split transactions**: Sum of splits = original amount

---

## Migration Status

Last applied migration: **093_add_cashflow_scenarios.sql**

### Recent Migrations (043-093)

#### Cash Flow & Scenario Planning
- **Migration 093**: Cash Flow Scenarios
  - Created `cashflow_scenarios` and `scenario_adjustments` tables
  - Added `scenario_adjustment_type` ENUM
  - Created `scenario_overview` view
  - Enables "what-if" analysis for cash flow projections

#### Role & Permission Management
- **Migration 091-092**: Custom Role Permissions
  - Created `role_permissions` table for per-entity role customization
  - Fixed RLS policies for role permissions

#### Manual Transaction Support
- **Migration 089-090**: Multiple Transaction Support
  - Added `partial` status to payment instances
  - Enhanced sync between original and main transactions

#### Views & Reporting
- **Migration 087**: Recreated Dropped Views
  - Recreated views that were accidentally dropped

#### Data Integrity
- **Migration 079-086**: Date Type Conversion & Cascade Fixes
  - Converted `transaction_date` from TIMESTAMPTZ to DATE (eliminates timezone bugs)
  - Fixed CASCADE delete chains throughout the schema
  - Dropped obsolete `account_balances` table
  - Fixed duplicate constraints on `debt_drawdown`
  - See `docs/SCHEMA_AUDIT_2025-11-25.md` for complete details

#### Data Entry Role
- **Migration 077-078**: Data Entry Role
  - Added `data_entry` to `user_role` ENUM
  - Updated RLS policies for data entry permissions

#### Receipt Management
- **Migration 075-076**: Receipt System
  - Created `receipts` table with OCR support
  - Created Supabase Storage bucket for receipt files
  - Added entity-based folder structure for files

#### Investment Tracking
- **Migration 064-074**: Investment System
  - Created `investment_contribution` table
  - Added investment transaction types (INV_CONTRIBUTE, INV_WITHDRAW)
  - Added `investment_contribution_id` to main_transaction
  - Created investment balance tracking triggers

#### Contract & Scheduled Payment System
- **Migration 059-063**: Contracts & Scheduled Payments
  - Created `contracts` table for master agreements
  - Created `contract_amendments` table for modification tracking
  - Created `scheduled_payments` and `scheduled_payment_instances` tables
  - Added contract views: `contract_overview`, `amendment_history`, `scheduled_payment_overview`
  - Created payment instance generation and tracking functions

#### Budget System
- **Migration 057-058**: Category Budgets
  - Created `category_budgets` table with recurring support
  - Created `budget_overview` view
  - Added budget priority system

### Earlier Migrations (001-042)

- **Migration 042**: Simplified Transaction Types
  - **LOAN System**: LOAN_GIVE → LOAN_DISBURSE, LOAN_RECEIVE → LOAN_COLLECT
  - **DEBT System**: DEBT_ACQ + DEBT_DRAW → DEBT_TAKE
  - Result: 9 transaction types instead of 13
- **Migration 037-040**: Loan Receivable System & Business Partners
  - Created `loan_disbursement` and `business_partners` tables
- **Migration 022-036**: Multi-user Authentication & RLS
  - Added users, entity_users, role-based access control
  - Fixed various RLS policy issues

---

## How to Update This Document

1. **After running a migration**, update the schema sections affected
2. **Run this SQL** in Supabase to verify current structure:

```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Get columns for a specific table
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'YOUR_TABLE_NAME'
ORDER BY ordinal_position;

-- List all views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- List all functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- List all triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

3. **Generate ERD** using Supabase Table Editor or tools like dbdiagram.io
4. **Document breaking changes** in migration notes

---

## Notes

- Some table details marked as "Possible - needs verification" require database query to confirm
- Trigger implementations may vary from documented logic - check migration files for exact SQL
- View definitions may include additional computed columns not listed here
- Functions may have additional parameters or return types not fully documented

**To get 100% accurate schema**: Run the SQL queries provided in "How to Update This Document" section in your Supabase SQL Editor.
