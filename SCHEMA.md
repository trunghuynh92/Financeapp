# Database Schema Documentation

**Last Updated**: 2025-11-10
**Database**: PostgreSQL 15+ via Supabase
**Current Migration**: 042_simplify_transaction_types.sql

---

## Quick Reference

**Tables**: 16 total (12 original + users + entity_users + loan_disbursement + business_partners)
**Views**: 2 main views
**Functions**: 14+ RPC functions (+ 3 new auth functions in migration 022)
**Triggers**: 8+ active triggers (+ 3 new auth triggers in migration 022)

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

| Trigger Name | Table | Events | Function | Purpose |
|-------------|-------|--------|----------|---------|
| `auto_create_main_transaction` | original_transaction | AFTER INSERT | auto_create_main_transaction() | Auto-create main_transaction |
| `trigger_update_drawdown_on_settlement` | main_transaction | AFTER INSERT/UPDATE/DELETE | update_drawdown_after_settlement() | Update drawdown balance |
| `trigger_update_loan_disbursement_after_settlement` | main_transaction | AFTER INSERT/UPDATE/DELETE | update_loan_disbursement_after_settlement() | Update loan disbursement balance (037) |
| `trigger_create_loan_disbursement_on_loan_give` | main_transaction | AFTER INSERT | create_loan_disbursement_on_loan_give() | Auto-create loan disbursement (037) |
| `trigger_auto_create_loan_settle_on_match` | main_transaction | AFTER UPDATE OF loan_disbursement_id | auto_create_loan_settle_on_match() | Auto-create LOAN_SETTLE (037) |
| `trigger_validate_transfer_match` | main_transaction | BEFORE INSERT/UPDATE | validate_transfer_match() | Validate matching pairs |
| `trigger_recalculate_balances` | balance_checkpoints | AFTER INSERT/UPDATE | recalculate_balances_after_checkpoint() | Recalculate balances |
| `on_auth_user_created` (022) | auth.users | AFTER INSERT | handle_new_user() | Auto-create user profile |
| `on_entity_created_set_owner` (022) | entities | BEFORE INSERT | handle_new_entity() | Set entity owner_user_id |
| `on_entity_created_add_owner` (022) | entities | AFTER INSERT | add_entity_owner() | Add owner to entity_users |
| Various | Various | Various | cleanup_orphaned_adjustments() | Called manually or via other triggers |

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

Last applied migration: **042_simplify_transaction_types.sql**

Key changes in recent migrations:
- Migration 042 (current): Simplified Transaction Types
  - **LOAN System**: LOAN_GIVE → LOAN_DISBURSE, LOAN_RECEIVE → LOAN_COLLECT, removed LOAN_SETTLE
  - **DEBT System**: Consolidated DEBT_ACQ + DEBT_DRAW → DEBT_TAKE, removed DEBT_SETTLE
  - Both sides of debt/loan transactions now use the same type code (simpler matching logic)
  - Updated all triggers and functions to use new type codes
  - Updated `validate_transfer_match()` function for new pairs
  - Result: 9 transaction types instead of 13
- Migration 037: Added Loan Receivable System
  - Created `loan_disbursement` table for tracking loans given out
  - Added loan-related enums: `borrower_type`, `loan_category`, `loan_status`
  - Added loan transaction types: LOAN_GIVE, LOAN_RECEIVE, LOAN_SETTLE, LOAN_WRITEOFF
  - Added `loan_disbursement_id` column to main_transaction
  - Created triggers for auto-creation and balance updates
  - Added RLS policies for entity-based access control
  - Added 'loan_receivable' to allowed account_type values
- Migration 034-036 (applied): Permission system enhancements
  - Fixed entity_users RLS infinite recursion (034)
  - Allowed editors to delete main_transaction records (035)
  - Allowed editors to delete original_transaction records (036)
- Migration 026 (applied): Fixed infinite recursion in entity_users RLS policies
  - Removed recursive policies that queried entity_users from within entity_users policies
  - Simplified to non-recursive policies for SELECT operations
  - Users can only read their own entity memberships
- Migration 025 (applied): Removed permissive "Enable all access" RLS policies
  - Dropped old policies that bypassed entity isolation on accounts, entities, and transactions
  - Ensured proper entity-level data isolation
- Migration 024 (applied): Cross-entity transfer prevention
  - Added validation to prevent transfers between different entities
- Migration 023 (applied): Additional checkpoint and RLS enhancements
- Migration 022 (applied): Multi-user authentication with role-based access control
  - Added `users` and `entity_users` tables
  - Added `user_role` ENUM type
  - Added auth helper functions (get_user_role, user_has_entity_access, user_has_permission)
  - Added auth triggers (on_auth_user_created, on_entity_created_set_owner, on_entity_created_add_owner)
  - Updated all RLS policies for entity-level access control
  - Added `owner_user_id` column to entities table
- Migration 021: Added DEBT_SETTLE type, is_overpaid flag, payback system

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
