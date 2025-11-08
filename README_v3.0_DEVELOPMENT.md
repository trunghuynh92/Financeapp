# Finance Management System - v3.0 Development

**A comprehensive multi-entity finance tracking system with bank statement import, transaction categorization, and balance reconciliation.**

---

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Current Features (v3.0)](#current-features-v30)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [Getting Started](#getting-started)
7. [Key Concepts](#key-concepts)
8. [API Documentation](#api-documentation)
9. [UI Pages](#ui-pages)
10. [Development Status](#development-status)
11. [Common Workflows](#common-workflows)
12. [Known Issues & Limitations](#known-issues--limitations)
13. [Roadmap](#roadmap)
14. [Contributing](#contributing)

---

## 🎯 System Overview

This is a **production-ready** finance management system designed for:
- **Multi-entity tracking**: Manage multiple companies or personal accounts
- **Bank reconciliation**: Import bank statements and verify against actual balances
- **Transaction categorization**: Organize transactions by type, category, and branch
- **Transaction splitting**: Split single bank transactions across multiple categories/branches
- **Transfer matching**: Link money transfers between your own accounts

### Primary Use Cases
- Small business with multiple bank accounts and branches
- Personal finance tracking across multiple accounts
- Multi-company bookkeeping
- Bank statement reconciliation and discrepancy detection

---

## ✅ Current Features (v3.0)

### 🏗️ Core Foundation
- ✅ **Entity Management** - Companies, personal entities
- ✅ **Account Management** - Bank accounts, cash, credit cards, credit lines, term loans
- ✅ **Branch System** - Location/store tracking tied to entities
- ✅ **Multi-currency Support** - VND, USD, EUR, etc.

### 📊 Transaction Management
- ✅ **Original Transaction Layer** - Immutable bank records (audit trail)
- ✅ **Main Transaction Layer** - Working layer for categorization and splitting
- ✅ **Transaction Types** - Income, Expense, Transfer In/Out, Debt, Investment
- ✅ **Categories** - 50+ pre-seeded categories (business + personal)
- ✅ **Transaction Splitting** - Split one bank transaction into multiple categories/branches
- ✅ **Transfer Matching** - Link transfer-out to transfer-in between accounts

### 📥 Import System
- ✅ **CSV Import** - Parse bank statement CSV files
- ✅ **XLSX Import** - Parse Excel bank statements
- ✅ **Smart Column Detection** - Auto-detect date format and column types
- ✅ **Column Mapping Persistence** - Remember last mapping per account
- ✅ **Duplicate Detection** - Smart duplicate checking (±7 days, fuzzy matching)
- ✅ **Import Rollback** - Delete entire imports with cleanup
- ✅ **Free Tier Optimization** - Batch processing for Supabase free tier

### 🎯 Balance Reconciliation (Innovation!)
- ✅ **Checkpoint System** - Verify calculated balance vs bank statement balance
- ✅ **Discrepancy Detection** - Flag unreconciled differences
- ✅ **Adjustment Transactions** - Auto-create adjustments for discrepancies
- ✅ **Chronological Recalculation** - Handle out-of-order imports correctly
- ✅ **Protected System Transactions** - Prevent manual editing of adjustments

### 🚀 Performance Features
- ✅ **Pagination** - Handle >1000 transactions per account
- ✅ **SQL RPC Functions** - Server-side aggregation for speed
- ✅ **Efficient Queries** - Optimized for large datasets
- ✅ **Grouped Views** - Aggregate transactions by source/batch

### 🎨 User Interface
- ✅ **Dashboard** - Account overview with balances
- ✅ **Main Transactions Page** - View, edit, categorize, split transactions
- ✅ **Transfer Matching UI** - Match transfers between accounts
- ✅ **Import Dialog** - Multi-step wizard for bank imports
- ✅ **Inline Editing** - Edit descriptions, categories, branches in-place
- ✅ **Account Detail Pages** - Transaction history, checkpoints, settings

---

## 🏗️ Architecture

### System Design Philosophy

**Two-Layer Transaction System:**
```
┌─────────────────────────────┐
│  ORIGINAL_TRANSACTION       │  ← Bank's truth (immutable)
│  - Exact bank data          │  ← Never modified after import
│  - Audit trail              │  ← Source of reconciliation
└──────────┬──────────────────┘
           │ 1:N relationship
           │
┌──────────▼──────────────────┐
│  MAIN_TRANSACTION           │  ← Working layer
│  - Can split (1→N)          │  ← User categorizes here
│  - Can categorize           │  ← Can edit descriptions
│  - Can assign to branches   │  ← Business logic layer
└─────────────────────────────┘
```

**Why Two Tables?**
- **Original**: Immutable for audit compliance, reconciliation, and trust
- **Main**: Flexible for business operations, categorization, and analysis

### Balance Calculation Strategy

**Checkpoint-Based Approach (v3.0 Innovation):**
```
Bank Statement Balance (Declared)
         ↓
    Checkpoint
         ↓
Calculated Balance (SUM of transactions)
         ↓
   Discrepancy?
         ↓
   Adjustment Transaction (if needed)
```

**Benefits:**
- Forces reconciliation with bank statements
- Detects import errors automatically
- Provides full audit trail
- Handles out-of-order imports correctly

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Lucide Icons** - Icon set

### Backend
- **Next.js API Routes** - Serverless API
- **Supabase** - PostgreSQL database + auth
- **XLSX** - Excel file parsing
- **PapaParse** - CSV parsing

### Database
- **PostgreSQL** (via Supabase)
- **Row Level Security** - Data protection
- **Triggers & Functions** - Data validation
- **Views** - Simplified queries

---

## 📊 Database Schema

### Core Tables

#### 1. `entities`
Represents companies or personal entities.
```sql
- id: UUID (PK)
- name: VARCHAR
- type: ENUM('business', 'personal')
- created_at: TIMESTAMPTZ
```

#### 2. `accounts`
Bank accounts, cash, credit cards, etc.
```sql
- account_id: SERIAL (PK)
- entity_id: UUID (FK → entities)
- account_name: VARCHAR
- account_type: ENUM('bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan')
- account_number: VARCHAR
- bank_name: VARCHAR
- currency: VARCHAR(3)
- credit_limit: DECIMAL(15,2)  -- for credit lines/loans
- loan_reference: VARCHAR
- last_import_config: JSONB  -- v3.0: stores last column mapping
- is_active: BOOLEAN
```

#### 3. `branches`
Locations/stores within an entity.
```sql
- branch_id: SERIAL (PK)
- entity_id: UUID (FK → entities)
- branch_name: VARCHAR
- branch_code: VARCHAR
- address: TEXT
- phone: VARCHAR
- is_active: BOOLEAN
```

#### 4. `original_transaction`
Immutable bank records (READ ONLY).
```sql
- raw_transaction_id: VARCHAR(100) (PK)
- account_id: INTEGER (FK → accounts)
- transaction_date: TIMESTAMPTZ
- description: VARCHAR(500)
- debit_amount: DECIMAL(15,2)
- credit_amount: DECIMAL(15,2)
- balance: DECIMAL(15,2)
- bank_reference: VARCHAR
- import_batch_id: INTEGER (FK → import_batch)
- checkpoint_id: INTEGER (FK → balance_checkpoints)
- is_balance_adjustment: BOOLEAN  -- system-generated adjustment
- transaction_sequence: INTEGER  -- ordering within account
- imported_at: TIMESTAMPTZ
```

**IMPORTANT:** ⚠️ **NEVER** modify this table after import! It's your audit trail.

#### 5. `main_transaction`
Working layer for categorization and splitting.
```sql
- main_transaction_id: SERIAL (PK)
- raw_transaction_id: VARCHAR(100) (FK → original_transaction)
- account_id: INTEGER (FK → accounts)
- transaction_type_id: INTEGER (FK → transaction_types)
- category_id: INTEGER (FK → categories)
- branch_id: INTEGER (FK → branches)
- amount: DECIMAL(15,2)  -- always positive
- transaction_direction: ENUM('debit', 'credit')
- transaction_date: TIMESTAMPTZ  -- copied from original
- description: TEXT  -- editable
- notes: TEXT  -- user notes
- is_split: BOOLEAN
- split_sequence: INTEGER  -- 1, 2, 3... for ordering
- transfer_matched_transaction_id: INTEGER (FK → main_transaction)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**Key Constraint:** SUM(amount) for all splits with same `raw_transaction_id` MUST equal original amount.

#### 6. `transaction_types`
High-level transaction types.
```sql
- transaction_type_id: SERIAL (PK)
- type_name: VARCHAR  -- 'income', 'expense', 'transfer_out', 'transfer_in', etc.
- type_code: VARCHAR(20)  -- 'INC', 'EXP', 'TRF_OUT', 'TRF_IN', etc.
- affects_cashflow: BOOLEAN
- display_order: INTEGER
```

**Pre-seeded types:**
- Income (INC)
- Expense (EXP)
- Transfer Out (TRF_OUT)
- Transfer In (TRF_IN)
- Debt Acquired (DEBT_ACQ)
- Debt Payback (DEBT_PAY)
- Investment (INV)

#### 7. `categories`
Hierarchical categories for transactions.
```sql
- category_id: SERIAL (PK)
- category_name: VARCHAR
- category_code: VARCHAR
- parent_category_id: INTEGER (FK → categories)
- transaction_type_id: INTEGER (FK → transaction_types)
- entity_type: ENUM('business', 'personal', 'both')
- description: TEXT
- is_active: BOOLEAN
```

**Pre-seeded:** 50+ categories for business & personal use.

#### 8. `balance_checkpoints`
Balance verification points from bank statements.
```sql
- checkpoint_id: SERIAL (PK)
- account_id: INTEGER (FK → accounts)
- checkpoint_date: TIMESTAMPTZ
- declared_balance: DECIMAL(15,2)  -- from bank statement
- calculated_balance: DECIMAL(15,2)  -- from transactions
- adjustment_amount: DECIMAL(15,2)  -- difference
- is_reconciled: BOOLEAN  -- true if matches
- notes: TEXT
- import_batch_id: INTEGER (FK → import_batch)
- created_at: TIMESTAMPTZ
```

**Formula:**
- `calculated_balance` = SUM(credits) - SUM(debits) up to checkpoint_date
- `adjustment_amount` = declared_balance - calculated_balance
- `is_reconciled` = (adjustment_amount == 0)

#### 9. `import_batch`
Tracks each import operation.
```sql
- import_batch_id: SERIAL (PK)
- account_id: INTEGER (FK → accounts)
- file_name: VARCHAR
- import_date: TIMESTAMPTZ
- import_status: ENUM('completed', 'failed', 'rolled_back')
- successful_records: INTEGER
- failed_records: INTEGER
- error_log: JSONB
```

### Important Views

#### `main_transaction_details`
Joins main_transaction with all related tables for easy querying.
```sql
SELECT * FROM main_transaction_details
WHERE account_id = 14
ORDER BY transaction_date DESC;
```

Returns: transaction with account, entity, type, category, branch details.

#### `unmatched_transfers`
Shows transfers that haven't been matched yet.
```sql
SELECT * FROM unmatched_transfers
ORDER BY transaction_date DESC;
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (via Supabase)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <your-repo>
cd Financeapp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run migrations**
Execute SQL migrations in order in Supabase SQL Editor:
```
migrations/001_initial_schema.sql
migrations/002_account_balances.sql
migrations/003_balance_checkpoints.sql
migrations/004_import_batches.sql
migrations/005_import_enhancements.sql
migrations/006_main_transaction_system.sql
migrations/007_sync_main_transaction_amounts.sql
migrations/008_add_checkpoint_id_to_original.sql
migrations/009_add_is_balance_adjustment.sql
migrations/010_create_main_transaction_details_view.sql
migrations/011_add_is_balance_adjustment_to_view.sql
migrations/012_add_transaction_sequence.sql
migrations/013_add_calculate_balance_function.sql
migrations/014_add_last_import_config.sql
```

5. **Run the development server**
```bash
npm run dev
```

6. **Open in browser**
```
http://localhost:3000
```

### First-Time Setup

1. **Create an Entity**
   - Go to Settings → Entities
   - Create your first company or personal entity

2. **Create an Account**
   - Go to Accounts → Add Account
   - Link to your entity
   - Set initial balance (optional)

3. **Import Transactions**
   - Go to Account Detail page
   - Click "Import" button
   - Upload bank statement CSV/XLSX
   - Map columns (will be saved for next time!)
   - Review and import

4. **Categorize Transactions**
   - Go to Main Transactions page
   - Click on transactions to edit inline
   - Set category, branch, type
   - Split if needed

---

## 🎓 Key Concepts

### 1. Transaction Splitting

**Scenario:** One bank payment of $1,000 needs to be allocated to 3 branches.

**Process:**
1. Import creates 1 row in `original_transaction` (immutable)
2. Initially creates 1 row in `main_transaction`
3. User clicks "Split" → creates 3 new rows in `main_transaction`:
   - Branch A: $400
   - Branch B: $350
   - Branch C: $250
4. All 3 share same `raw_transaction_id`
5. Validation trigger ensures $400 + $350 + $250 = $1,000 ✓

### 2. Transfer Matching

**Scenario:** Transferred $500 from Bank A to Bank B.

**Process:**
1. Import Bank A statement → creates Transfer Out (-$500)
2. Import Bank B statement → creates Transfer In (+$500)
3. User goes to Transfers page
4. Clicks "Match" → links the two transactions
5. Both now have `transfer_matched_transaction_id` pointing to each other
6. Marked as transfers, excluded from income/expense reports

### 3. Balance Checkpoints

**Scenario:** Import bank statement with ending balance $100,000.

**Process:**
1. User enters statement ending balance: $100,000
2. System calculates balance from transactions: $98,500
3. Difference detected: $1,500 discrepancy
4. Creates checkpoint with `is_reconciled = false`
5. Optionally creates adjustment transaction to balance
6. User investigates: missing transaction, duplicate, or opening balance issue

### 4. Import with Column Mapping

**First Import (Techcombank):**
- User maps columns manually:
  - "Transaction Date" → transaction_date
  - "Description" → description
  - "Debit" → debit_amount
  - "Credit" → credit_amount
- Mapping saved to `accounts.last_import_config`

**Second Import (Same bank):**
- Opens dialog → auto-loads previous mapping
- Headers match → applies automatically
- Shows green banner: "Configuration from Nov 8 loaded"
- User can still adjust if needed

---

## 📡 API Documentation

### Accounts

#### `GET /api/accounts`
List all accounts with calculated balances.

**Query params:**
- `entity_id` - Filter by entity
- `account_type` - Filter by type
- `is_active` - Filter active/inactive
- `search` - Search by name
- `limit` - Results per page (default: 20)
- `page` - Page number

**Response:**
```json
{
  "data": [
    {
      "account_id": 14,
      "account_name": "Techcombank Business",
      "account_type": "bank",
      "balance": {
        "current_balance": -66151201.00,
        "last_updated": "2024-11-08T..."
      },
      "entity": {
        "id": "uuid",
        "name": "Company A"
      },
      "unresolved_checkpoints_count": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### `GET /api/accounts/[id]`
Get single account details.

#### `POST /api/accounts`
Create new account.

**Body:**
```json
{
  "entity_id": "uuid",
  "account_name": "Vietcombank",
  "account_type": "bank",
  "account_number": "1234567890",
  "bank_name": "Vietcombank",
  "currency": "VND",
  "initial_balance": 1000000,
  "opening_balance_date": "2024-01-01"
}
```

#### `PATCH /api/accounts/[id]`
Update account.

#### `DELETE /api/accounts/[id]`
Delete account (checks for transactions first).

### Transactions

#### `GET /api/transactions`
List original transactions.

**Query params:**
- `account_id` - Filter by account
- `transaction_source` - Filter by source
- `search` - Search description/reference
- `start_date`, `end_date` - Date range
- `limit`, `offset` - Pagination

#### `GET /api/transactions/grouped`
Get transactions aggregated by source/batch.

Uses RPC function `get_grouped_transactions()`.

### Main Transactions

#### `GET /api/main-transactions`
List categorized transactions.

**Query params:**
- `account_id`
- `transaction_type_id`
- `category_id`
- `branch_id`
- `start_date`, `end_date`
- `search`
- `is_split` - Filter split transactions
- `limit`, `offset`

#### `GET /api/main-transactions/[id]`
Get single main transaction with details.

#### `PATCH /api/main-transactions/[id]`
Update transaction (category, description, notes, branch).

**Body:**
```json
{
  "category_id": 5,
  "branch_id": 2,
  "description": "Updated description",
  "notes": "Additional notes"
}
```

#### `POST /api/main-transactions/split`
Split a transaction.

**Body:**
```json
{
  "raw_transaction_id": "TECH_001",
  "splits": [
    {
      "amount": 400.00,
      "transaction_type_id": 2,
      "category_id": 5,
      "branch_id": 1,
      "description": "Branch A portion"
    },
    {
      "amount": 350.00,
      "transaction_type_id": 2,
      "category_id": 5,
      "branch_id": 2,
      "description": "Branch B portion"
    }
  ]
}
```

**Validation:**
- Sum of split amounts must equal original
- Returns error if mismatch
- Cannot split balance adjustment transactions

### Transfers

#### `GET /api/transfers/unmatched`
Get unmatched transfers for matching UI.

#### `POST /api/transfers/match`
Match two transfer transactions.

**Body:**
```json
{
  "transfer_out_id": 123,
  "transfer_in_id": 456
}
```

**Validation:**
- Both must be transfers
- Must be opposite directions (OUT ↔ IN)
- Updates both records bidirectionally

#### `POST /api/transfers/unmatch/[id]`
Unmatch a transfer.

### Import

#### `POST /api/accounts/[id]/import`
Import bank statement.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` - CSV or XLSX file
- `accountId` - Account ID
- `statementStartDate` - Statement period start
- `statementEndDate` - Statement period end
- `statementEndingBalance` - Balance from bank statement
- `columnMappings` - JSON string of column mappings
- `dateFormat` - Date format (dd/mm/yyyy, etc.)
- `hasNegativeDebits` - Boolean

**Process:**
1. Parse file
2. Validate column mappings
3. Check for duplicates (±7 days)
4. Insert into `original_transaction`
5. Create initial `main_transaction` records
6. Create checkpoint with ending balance
7. Calculate discrepancy
8. Save column mappings to account
9. Recalculate affected checkpoints

**Response:**
```json
{
  "success": true,
  "data": {
    "importSummary": {
      "importBatchId": 10,
      "totalRows": 1111,
      "successfulImports": 1110,
      "failedImports": 1,
      "duplicatesDetected": 5,
      "errors": [...]
    },
    "checkpoint": {
      "checkpoint_id": 20,
      "declared_balance": -66151201,
      "calculated_balance": -66151201,
      "adjustment_amount": 0,
      "is_reconciled": true
    },
    "recalculationSummary": {
      "checkpointsRecalculated": 2,
      "message": "Recalculated 2 existing checkpoints"
    }
  }
}
```

### Checkpoints

#### `GET /api/accounts/[id]/checkpoints`
List checkpoints for account.

#### `POST /api/accounts/[id]/checkpoints`
Create checkpoint manually.

**Body:**
```json
{
  "checkpoint_date": "2024-11-08",
  "declared_balance": 1000000,
  "notes": "End of month reconciliation"
}
```

#### `PATCH /api/accounts/[id]/checkpoints/[checkpointId]`
Update checkpoint.

#### `DELETE /api/accounts/[id]/checkpoints/[checkpointId]`
Delete checkpoint (also deletes adjustment transaction).

#### `POST /api/accounts/[id]/checkpoints/[checkpointId]/rollback`
Rollback imported checkpoint.

**Process:**
1. Verify checkpoint has `import_batch_id`
2. Delete all transactions from that batch
3. Delete checkpoint
4. Mark batch as rolled_back
5. Recalculate affected checkpoints

---

## 🎨 UI Pages

### `/dashboard`
- Account cards with balances
- Summary statistics
- Quick actions

### `/dashboard/accounts`
- All accounts table
- Filters by entity, type, status
- Balance column (calculated from all transactions)
- Add/Edit/Delete accounts
- Click account → detail page

### `/dashboard/accounts/[id]`
- Account overview card
- Transaction statistics
- Transaction list (original_transaction)
- Checkpoints list
- Settings (edit, delete)
- Import button

### `/dashboard/main-transactions`
- Categorized transactions table
- Inline editing (description, category, branch, type)
- Split transaction dialog
- Filters by account, type, category, branch, dates
- Search by description
- Pagination

### `/dashboard/transfers`
- Unmatched transfers list
- Quick match dialog
- Matched transfers list
- Unmatch action

### `/dashboard/settings`
- Entity management
- Categories management (planned)
- Branches management (planned)
- System settings

---

## 📊 Development Status

### ✅ Completed (v3.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Entity Management | ✅ 100% | CRUD complete |
| Account Management | ✅ 100% | All types supported |
| Branch System | ✅ 100% | Entity linkage working |
| Original Transaction | ✅ 100% | Immutable layer |
| Main Transaction | ✅ 95% | Missing debt drawdown linkage |
| Transaction Types | ✅ 100% | 7 types seeded |
| Categories | ✅ 100% | 50+ categories seeded |
| Transaction Splitting | ✅ 100% | API + UI + validation |
| Transfer Matching | ✅ 100% | Bidirectional matching |
| CSV Import | ✅ 100% | Full workflow |
| XLSX Import | ✅ 100% | Full workflow |
| Duplicate Detection | ✅ 100% | Smart fuzzy matching |
| Column Mapping | ✅ 100% | Auto-save & load |
| Checkpoint System | ✅ 100% | Balance reconciliation |
| Import Rollback | ✅ 100% | Clean deletion |
| Inline Editing | ✅ 100% | Main transactions UI |
| Pagination | ✅ 100% | >1000 transactions |
| Performance Optimization | ✅ 100% | RPC functions, efficient queries |

### ⏳ In Progress / Planned

| Feature | Status | Priority |
|---------|--------|----------|
| Debt Drawdown System | ⏳ 30% | Medium |
| Entity Balance Aggregation | ⏳ 0% | Low |
| Advanced Reporting | ⏳ 40% | Medium |
| Running Balance Cache | ⏳ 0% | Low (optional) |
| Dashboard Charts | ⏳ 0% | Medium |
| Export to Excel | ⏳ 0% | Low |
| Multi-user Support | ⏳ 0% | Low |
| Audit Log | ⏳ 0% | Low |

---

## 🔄 Common Workflows

### Workflow 1: Import Bank Statement

```
1. Navigate to Account Detail page
2. Click "Import" button
3. Upload CSV/XLSX file
   → System auto-detects columns and date format
   → Loads previous column mappings if available
4. Review/adjust column mappings
5. Enter statement details:
   - Start date
   - End date (auto-detected if available)
   - Ending balance (auto-detected if available)
6. Preview first 10 transactions
7. Click "Import"
   → Creates transactions
   → Creates checkpoint
   → Detects discrepancies
   → Shows results
8. If discrepancy:
   - Review checkpoint
   - Investigate missing/duplicate transactions
   - Create adjustment or fix import
```

### Workflow 2: Categorize Transactions

```
1. Navigate to Main Transactions page
2. Click on a transaction row
   → Inline editor appears
3. Select:
   - Transaction Type (Income, Expense, etc.)
   - Category (from dropdown)
   - Branch (if applicable)
   - Edit description if needed
4. Click Save or press Enter
   → Updates immediately
```

### Workflow 3: Split Transaction

```
1. Find transaction in Main Transactions page
2. Click "Split" button
3. In dialog, add splits:
   - Amount (must sum to original)
   - Category
   - Branch
   - Description
4. Click "Split Transaction"
   → Deletes original single row
   → Creates multiple rows
   → Validates sum = original
5. Each split can be edited independently
```

### Workflow 4: Match Transfers

```
1. Navigate to Transfers page
2. See "Unmatched Transfers" section
3. Find matching pair:
   - Transfer Out from Account A
   - Transfer In to Account B
   - Same/similar amount
   - Similar dates
4. Click "Match" → Select both
5. System validates and links them
   → Both marked as matched
   → Removed from unmatched list
```

### Workflow 5: Reconcile Checkpoint

```
1. Navigate to Account Detail page
2. View Checkpoints section
3. If checkpoint shows "Unreconciled":
   - Click checkpoint to see details
   - Compare declared vs calculated
   - Check adjustment amount
4. Investigate discrepancy:
   - Missing transactions?
   - Duplicate imports?
   - Opening balance issue?
5. Fix issue:
   - Import missing transactions, or
   - Delete duplicates, or
   - Edit checkpoint
6. System auto-recalculates
   → Checkpoint turns green if resolved
```

### Workflow 6: Rollback Import

```
1. Navigate to Account Detail page
2. View Checkpoints section
3. Find checkpoint from import (has import badge)
4. Click "Rollback" button
5. Confirm deletion
   → Deletes all transactions from that batch
   → Deletes checkpoint
   → Marks import as rolled_back
   → Recalculates affected checkpoints
```

---

## ⚠️ Known Issues & Limitations

### Database
- ❌ **No debt drawdown tracking** - Fields exist but not used
- ❌ **No transaction subtypes** - Can't differentiate principal vs interest
- ❌ **No user tracking** - `created_by_user_id` not populated
- ❌ **No soft deletes** - All deletes are hard deletes

### Performance
- ⚠️ **1000-row Supabase limit** - Mitigated with pagination, but some queries may be slow
- ⚠️ **No caching** - Every page load fetches from database
- ⚠️ **No background jobs** - Import runs synchronously (can timeout on free tier)

### UI/UX
- ❌ **No bulk operations** - Can't select multiple transactions to categorize at once
- ❌ **No undo** - No way to undo edits or splits
- ❌ **No export** - Can't export transactions to Excel
- ❌ **No mobile optimization** - Desktop-first design

### Import
- ⚠️ **Date parsing** - Some date formats may not be detected correctly
- ⚠️ **Duplicate detection** - Uses ±7 days window, may miss some or flag false positives
- ⚠️ **Large files** - >5000 transactions may timeout on Supabase free tier
- ❌ **No import preview** - Can't review duplicates before import

### Data Integrity
- ⚠️ **Balance adjustment protection** - Can't manually edit, but can delete checkpoint (which deletes adjustment)
- ❌ **No audit log** - Can't track who changed what
- ❌ **No version history** - Can't see previous values

---

## 🗺️ Roadmap

### Short Term (v3.1)
- [ ] Bulk operations (categorize multiple transactions)
- [ ] Undo functionality
- [ ] Export to Excel
- [ ] Import preview with duplicate review
- [ ] Advanced filtering (amount range, etc.)

### Medium Term (v3.2)
- [ ] Debt drawdown system implementation
- [ ] Dashboard charts and graphs
- [ ] Category management UI
- [ ] Branch management UI
- [ ] Recurring transactions
- [ ] Budget tracking

### Long Term (v4.0)
- [ ] Multi-user support with permissions
- [ ] Mobile app
- [ ] Automated categorization (ML)
- [ ] Receipt scanning
- [ ] Tax reporting
- [ ] API for third-party integrations

---

## 🤝 Contributing

### Development Workflow

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes**
- Follow existing code patterns
- Add TypeScript types
- Update migrations if schema changes
- Test thoroughly

3. **Run tests** (when available)
```bash
npm test
```

4. **Commit with clear message**
```bash
git commit -m "feat: Add bulk transaction categorization"
```

5. **Push and create PR**
```bash
git push origin feature/your-feature-name
```

### Code Style
- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)
- **Naming**:
  - Components: PascalCase
  - Files: kebab-case
  - Functions: camelCase
  - Database: snake_case

### Database Migrations
- Create new migration file: `migrations/XXX_description.sql`
- Always provide rollback instructions in comments
- Test migration on development database first
- Never modify existing migrations that have been deployed

### Testing Guidelines
- Test all CRUD operations
- Test edge cases (empty data, >1000 rows, etc.)
- Test validation (split sums, transfer matching, etc.)
- Manual testing checklist in PR description

---

## 📞 Support

### Documentation
- **Original Design**: See `FINANCE_MANAGEMENT_SYSTEM_README.md` for initial draft
- **Migration Guide**: See individual migration files for schema changes
- **API Examples**: See test files and SQL examples

### Common Questions

**Q: Why two transaction tables?**
A: Original is immutable (bank's truth), Main is for categorization (your analysis). This separation ensures you can always reconcile with bank records.

**Q: What happens if I delete a checkpoint?**
A: The checkpoint and its adjustment transaction (if any) are deleted. Other transactions remain. Affected checkpoints are recalculated.

**Q: Can I edit an imported transaction?**
A: No! Imported transactions in `original_transaction` are immutable. Edit the corresponding `main_transaction` instead.

**Q: How do I fix a wrong import?**
A: Use the rollback feature on the checkpoint. This deletes all transactions from that import batch.

**Q: What's the difference between calculated and declared balance?**
A: Calculated = sum of your transactions. Declared = what the bank says. They should match!

**Q: Why is my account balance negative?**
A: Negative balance means you owe money (overdraft, credit card, loan). It's normal for credit accounts.

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with:
- Next.js
- Supabase
- shadcn/ui
- Claude Code (AI assistant)

**Version:** 3.0 Development
**Last Updated:** November 8, 2024
**Status:** Production-ready core features, active development

---

**Happy Coding! 💰📊**
