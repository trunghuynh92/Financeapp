# Finance SaaS v4.5.0

A comprehensive multi-user financial management system for businesses and individuals, built with Next.js, TypeScript, and Supabase. Features role-based access control, team collaboration, advanced transaction processing, credit card mechanics, debt management, loan receivables, business partners, intelligent transaction type filtering, balance checkpointing, and detailed financial reporting with complete entity isolation.

## Version 4.5.0 - Enhanced UX & Transaction Management

### What's New in v4.5.0

#### 🎨 User-Friendly Transaction Dialog
- **Streamlined Add Transaction**: New intuitive dialog for creating transactions from Main Transactions page
- **Smart Field Ordering**: Account → Date/Time → Direction → Type → Amount → Category → Branch → Description
- **Real-Time Defaults**: Date/Time defaults to current time for quick entry
- **Visual Direction Toggle**: Clear red "(Money Out)" / green "(Money In)" indicators
- **Smart Category Filtering**: Automatically shows only relevant categories based on transaction type
- **Optional vs Required**: Clear visual indicators for required fields with asterisks
- **Performance Optimized**: Single API call for instant transaction creation

#### 🗑️ Advanced Delete Functionality
- **Individual Transaction Delete**: Delete button in actions column with confirmation
- **Bulk Delete**: Select multiple transactions and delete in one operation
- **Split Transaction Protection**: Special warning dialog for split transactions
  - Shows all related splits before deletion
  - Displays split details (sequence, type, category, amount)
  - Total amount calculation
  - Prevents accidental partial deletion
  - Bulk delete protection for splits
- **Balance Adjustment Protection**: Cannot delete system-generated adjustments
- **Confirmation Dialogs**: Clear warnings before permanent deletion

#### 📊 Main Transactions as Primary Workspace
- **All-in-One Interface**: Add, edit, split, and delete transactions without leaving the page
- **Add Transaction Button**: Prominent button when no items selected
- **Smart Button Switching**: Shows bulk actions when items selected, add button otherwise
- **Complete Transaction Lifecycle**: Create → Categorize → Match → Delete all in one place

## Version 4.4.0 - Credit Card Payment System

### What's New in v4.4.0

#### 💳 Comprehensive Credit Card Mechanics
- **CC_CHARGE Transaction Type**: Credit card purchases that don't immediately affect cashflow
  - `affects_cashflow: false` - Prevents double-counting in cashflow reports
  - Uses same categories as EXP for unified expense reporting
  - Creates debt without immediate cash impact
- **CC_PAY Transaction Type**: Credit card payments with cashflow impact
  - `affects_cashflow: true` - Records actual cash movement
  - Same-type matching: CC_PAY ↔ CC_PAY between bank and credit card
- **QuickPayCreditCardDialog**: Streamlined payment workflow
  - Shows all credit cards with current balances and limits
  - Auto-creates and matches CC_PAY transactions
  - One-click payment from bank to credit card
- **Optional Credit Limits**: Track credit limits and utilization for credit cards
- **Match Badges**: Visual indicators for matched/unmatched CC_PAY transactions

#### 📖 Cash Basis Accounting Documentation
- **CREDIT_CARD_MECHANICS.md**: Comprehensive guide explaining:
  - Why CC_CHARGE vs EXP matters for cashflow accuracy
  - How CC_PAY matching works
  - Reporting examples (expense, cashflow, debt reports)
  - Comparison with other account types

## Version 4.3.0 - Transaction Type Intelligence & Simplification

### What's New in v4.3.0

#### 🎯 Intelligent Transaction Type Filtering
- **Context-Aware Type Selection**: Transaction type dropdowns now intelligently filter based on account type and direction
- **Business Logic Enforcement**: Prevent illogical transaction types (e.g., LOAN_DISBURSE on credit cards)
- **Inline Editing Support**: Real-time filtering in both edit dialog and inline table editing
- **Account-Specific Rules**: Different allowed types for bank, credit card, loan receivable, and other account types
- **Direction-Based Filtering**: Separate rules for debit (money out) vs credit (money in) transactions
- **User-Friendly Messages**: Clear explanations of filtering logic with type counts

**Transaction Type Rules by Account:**
- **Bank/Cash Accounts**:
  - Debit: EXP, TRF_OUT, DEBT_PAY, CC_PAY, INV, LOAN_DISBURSE
  - Credit: INC, TRF_IN, DEBT_TAKE, LOAN_COLLECT
- **Credit Card Accounts** *(See [CREDIT_CARD_MECHANICS.md](./CREDIT_CARD_MECHANICS.md))*:
  - Debit: CC_CHARGE, TRF_OUT (purchases with CC_CHARGE for proper cashflow tracking, balance transfers out)
  - Credit: CC_PAY, TRF_IN (payments with CC_PAY, balance transfers in, refunds)
- **Credit Line Accounts**:
  - Debit: DEBT_TAKE (drawing from line)
  - Credit: DEBT_PAY (repaying line)
- **Term Loan Accounts**:
  - Debit: DEBT_TAKE (initial drawdown)
  - Credit: DEBT_PAY (loan payments)
- **Loan Receivable Accounts**:
  - Debit: LOAN_DISBURSE (lending money)
  - Credit: LOAN_COLLECT (receiving repayment)
- **Investment Accounts**:
  - Debit: INV, EXP (purchases, fees)
  - Credit: INC (returns, sales)

#### 🔄 Transaction Type Simplification (Migration 042)
- **Reduced Complexity**: Simplified from 13 to 9 transaction types
- **Consolidated Types**: Merged redundant transaction types:
  - DEBT_DRAW, DEBT_ACQ → DEBT_TAKE (borrowing money)
  - DEBT_SETTLE, DEBT_PAYBACK → DEBT_PAY (paying back debt)
  - LOAN_COLLECT, LOAN_REPAY → LOAN_COLLECT (receiving loan repayment)
- **Double-Entry Consistency**: Both sides of debt/loan transactions now use same type code
- **Preserved Data**: Existing transactions maintained with type mapping
- **Updated Functions**: All database functions updated to use new type codes

**Current Transaction Types:**
1. `INC` - Income
2. `EXP` - Expense
3. `TRF_OUT` - Transfer Out
4. `TRF_IN` - Transfer In
5. `DEBT_TAKE` - Debt Taken (borrowing, for credit lines/term loans)
6. `DEBT_PAY` - Debt Payment (repaying, for credit lines/term loans)
7. `CC_CHARGE` - Credit Card Charge (affects_cashflow=false, expenses on credit)
8. `CC_PAY` - Credit Card Payment (affects_cashflow=true, receiving payment)
9. `LOAN_DISBURSE` - Loan Disbursement (lending)
10. `LOAN_COLLECT` - Loan Collection (receiving repayment)
11. `INV` - Investment

#### 🗄️ Database Migrations (v4.3.0)
- **Migration 041**: Fix validate_transfer_match function with new type codes
- **Migration 042**: Simplify transaction types system (13→9 types)
- **Migration 043**: Recalculate drawdown balances for consistency
- **Migration 044**: Add CC_CHARGE transaction type for credit card purchases (cash basis accounting)
- **Migration 045**: Add categories for CC_CHARGE (duplicated from EXP categories)
- **Migration 046**: Add CC_PAY transaction type for credit card payments

#### 📚 Enhanced Documentation
- **Transaction Type Rules Library**: New `/lib/transaction-type-rules.ts` with comprehensive filtering logic
- **SCHEMA.md Updates**: Complete documentation of simplified transaction type system
- **Credit Card Mechanics**: New `CREDIT_CARD_MECHANICS.md` explaining CC_CHARGE and cash basis accounting
- **Type Safety**: Full TypeScript support for account types and directions

---

## Version 4.2.0 - Loan Receivables & Business Partners

### What's New in v4.2.0

#### 💰 Loan Receivable System
- **Loan Disbursements**: Track loans given to owners, employees, partners, and customers
- **Loan Account Type**: New `loan_receivable` account type for managing loans as assets
- **Payment Tracking**: Record loan payments with automatic balance updates
- **Interest Tracking**: Store interest rates for reference (not auto-calculated)
- **Loan Status Management**: Active, Overdue, Repaid, Partially Written Off, Written Off
- **Due Date Alerts**: Visual indicators for overdue and upcoming due loans
- **Payment Progress**: Visual progress bars showing repayment completion
- **Loan Statistics**: Dashboard showing total outstanding, active loans, and next due date
- **Write-off Support**: Track partially or fully written-off loans

#### 👥 Business Partners Management
- **Centralized Contacts**: Single source of truth for all business relationships
- **Partner Types**: Customer, Vendor, Employee, Owner, Partner, Lender, Other
- **Comprehensive Information**: Store contact details, addresses, bank accounts, tax IDs
- **Inline Creation**: Create partners directly from loan disbursement form
- **Banking Details**: Track bank account information for partners
- **Address Management**: Store complete address information
- **Contact Information**: Email, phone, mobile, fax, website
- **Integration**: Referenced by loan disbursements (extensible to other features)

#### 🗄️ Database Migrations (v4.2.0)
- **Migration 037**: Add loan_receivable system with loan_disbursement table
- **Migration 038**: Fix account_type CHECK constraint to include loan_receivable
- **Migration 039**: Create business_partners table with comprehensive fields
- **Migration 040**: Remove redundant borrower_type from loan_disbursement

---

## Version 4.1.0 - Team Collaboration & Permission Refinements

### What's New in v4.1.0

#### 👥 Team Management
- **Team Member Invitations**: Invite users to entities with specific roles
- **Role Assignment**: Assign Owner, Admin, Editor, or Viewer roles to team members
- **Member Management UI**: View, edit roles, and remove team members from settings page
- **SECURITY DEFINER Functions**: Bypass RLS for team operations while maintaining security
- **Team Member Display**: View all team members with their roles and details

#### 🔒 Enhanced Permission System
- **Application-Level Permissions**: Added permission checks to all write operations
- **Role-Based Write Access**: Owner/Admin/Editor can modify data, Viewer is read-only
- **Editor Delete Permissions**: Editors can now delete transactions and splits (Migrations 035, 036)
- **Transaction Split Permissions**: Fixed RLS blocking for editor split operations
- **Data Isolation Fixes**: Resolved main_transactions entity filtering issues

#### 🐛 Critical Bug Fixes
- **RLS Infinite Recursion**: Fixed entity_users SELECT policy causing system-wide failures (Migration 034)
- **Split Transaction Doubling**: Resolved issue where splits were duplicated for editors
- **Import Authentication**: Fixed transaction import using wrong Supabase client
- **Transaction Dates Display**: Fixed account detail page showing missing transaction dates
- **Rollback Authentication**: Fixed checkpoint rollback authentication issues

#### 🗄️ Database Migrations (v4.1.0)
- **Migration 029**: Allow user lookup by email for entity invites
- **Migration 030-033**: Team member management with SECURITY DEFINER functions
- **Migration 034**: Fixed entity_users RLS infinite recursion
- **Migration 035**: Allow editors to delete main_transaction records
- **Migration 036**: Allow editors to delete original_transaction records

---

## Version 4.0.0 - Multi-User Authentication & Security Hardening

### What's New in v4.0.0

#### 🔐 Multi-User Authentication System
- **User Profiles**: Extended Supabase auth with custom user profiles
- **Entity-Based Access Control**: Users can belong to multiple entities with different roles
- **Role Hierarchy**: Owner → Admin → Editor → Viewer with granular permissions
- **Automatic Owner Assignment**: Entity creators automatically become owners
- **Entity Switcher**: Quick switching between entities with role-based visibility

#### 🛡️ Security & Data Isolation
- **Row-Level Security (RLS)**: Complete database-level security enforcement
- **Entity Isolation**: Users can only access data for entities they're members of
- **Fixed Infinite Recursion Bug**: Resolved critical RLS policy issue (Migration 026)
- **Removed Permissive Policies**: Eliminated "Enable all access" policies (Migration 025)
- **Authenticated API Routes**: All API endpoints use server-side authentication
- **Cross-Entity Transfer Prevention**: Transfers only allowed within same entity (Migration 024)

####  💻 Frontend Enhancements
- **Entity Context**: Global entity management with React Context
- **Auto-Redirect on Entity Switch**: Navigates away from invalid pages when switching entities
- **Filtered Data Views**: All pages respect current entity selection
- **Account Balance Display**: Fixed balance calculation with proper authentication
- **Transaction Filtering**: Entity-aware transaction queries with "All accounts" support

#### 🔧 API & Backend Improvements
- **Server Client Migration**: Converted 20+ API routes to use authenticated Supabase client
- **Entity-Aware APIs**: Added entity_id filtering to transactions, accounts, and reports
- **Balance Calculation Fix**: Proper RLS-compliant balance calculations
- **Transaction Creation**: Fixed supabase client initialization issues
- **Split Transactions**: Corrected authentication for split operations

#### 🗄️ Database Migrations
- **Migration 022**: Multi-user auth system with `users` and `entity_users` tables
- **Migration 023**: Additional RLS enhancements
- **Migration 024**: Cross-entity transfer prevention
- **Migration 025**: Removed permissive RLS policies
- **Migration 026**: Fixed entity_users infinite recursion bug

---

### Previous Version: v2.2.0 - Debt Payback System

#### 💸 Complete Debt Payback System
- **DEBT_PAY ↔ DEBT_SETTLE Matching**: Match debt payments with drawdowns and auto-create settlement transactions
- **Auto-Settlement Creation**: System automatically creates DEBT_SETTLE transactions on the credit line when matching DEBT_PAY
- **Overpayment Handling**: Automatically creates credit memos when payments exceed remaining balance
- **Drawdown Balance Updates**: Triggers automatically update drawdown balances and status (active/settled/overdue)
- **Smart Unmatch Logic**: Unmatching DEBT_PAY transactions properly deletes auto-created settlements, credit memos, and recalculates drawdown balances
- **Select Drawdown Dialog**: Intuitive UI to match DEBT_PAY transactions with specific drawdowns

#### 🎨 UI/UX Improvements
- **Status Filter for Drawdowns**: Filter drawdowns by All/Active/Overdue/Settled status
- **Blue Split Icon**: Split transaction icons now turn blue for easy identification of split transactions
- **Server-Side Filtering**: Optimized drawdown filtering for better performance

#### 🐛 Bug Fixes
- Fixed drawdown list to show all statuses instead of only active
- Fixed drawdown balance recalculation on DEBT_SETTLE deletion
- Updated validation to allow DEBT_PAY ↔ DEBT_SETTLE matching
- Fixed auto-create trigger interference with settlement creation

#### 🔧 Technical Improvements
- Migration 021: Added DEBT_SETTLE transaction type and payback system infrastructure
- Updated `validate_transfer_match()` to support DEBT_PAY ↔ DEBT_SETTLE pairs
- Enhanced `update_drawdown_after_settlement()` trigger to handle INSERT/UPDATE/DELETE
- Added `is_overpaid` flag to debt_drawdown table
- Updated `main_transaction_details` view with drawdown matching information
- Refactored drawdowns API to support status filtering

---

## Core Features

### 🏢 Multi-Entity Management
- **Business & Personal Entities**: Separate financial tracking for companies and personal finances
- **Entity Switching**: Quick switching between different entities
- **Entity-Specific Views**: Filtered accounts, transactions, and reports per entity
- **Hierarchical Organization**: Manage multiple businesses and personal entities in one system

### 💼 Comprehensive Account Types

#### 1. **Bank Accounts**
- Track checking and savings accounts
- Multi-currency support (VND, USD, EUR)
- Account number and bank name tracking
- Automatic balance calculations

#### 2. **Cash Accounts**
- Physical cash tracking
- Multi-location cash management
- Simple balance tracking without bank details

#### 3. **Credit Cards**
- Credit card balance monitoring
- Payment tracking and matching
- Credit limit management

#### 4. **Investment Accounts**
- Investment portfolio tracking
- Capital gains/losses recording
- Asset value monitoring

#### 5. **Credit Lines**
- Revolving credit facilities
- Available credit calculations
- Drawdown and repayment tracking
- Multiple concurrent drawdowns
- Interest and fee management

#### 6. **Term Loans**
- Fixed-term loan management
- Loan reference tracking
- Payment schedules
- Principal and interest breakdown

#### 7. **Loan Receivables** (NEW in v4.2.0)
- Track loans given to others (assets)
- Loan disbursement to owners, employees, partners, customers
- Payment tracking with automatic balance updates
- Interest rate tracking (for reference)
- Due date management and alerts
- Status tracking (Active, Overdue, Repaid, Written Off)
- Payment progress visualization
- Write-off support for bad debts

### 👥 Business Partners (NEW in v4.2.0)
- **Centralized Contact Management**: Single source for all business relationships
- **Partner Types**: Customers, Vendors, Employees, Owners, Partners, Lenders, Others
- **Complete Information**: Contact details, addresses, banking info, tax IDs
- **Integration**: Used by loan disbursements, extensible to invoices and transactions
- **Inline Creation**: Create partners without leaving forms
- **Banking Details**: Track bank accounts for payments and transfers
- **Multi-Tab Form**: Organized data entry (Basic, Contact, Address, Banking)

### 💰 Dual-Layer Transaction System

#### **Original Transactions Layer**
The raw transaction layer that maintains the source of truth:
- **Bank Statement Imports**: CSV and XLSX file support
- **Manual Entry**: Direct transaction creation
- **System Transactions**: Auto-generated opening balances and adjustments
- **Import Batching**: Track which file each transaction came from
- **Rollback Support**: Undo entire import batches
- **Balance Reconciliation**: Automatic balance adjustment system
- **Checkpoint Integration**: Historical balance snapshots

Features:
- Pagination (50/100/200 items per page)
- Filter by account, source type, and date range
- Search across descriptions and references
- Grouped view by import batch
- View checkpoint details for balance adjustments

#### **Main Transactions Layer**
The processed and categorized transaction layer:

**Core Features:**
- **Inline Editing**: Spreadsheet-style cell editing with auto-save
- **Type-Ahead Search**: Searchable dropdowns for all categorization fields
- **Split Transactions**: Divide single transactions across multiple categories
  - Visual indicators (blue split icon)
  - Maintain original amount integrity
  - Track split sequence
- **Bulk Operations**: Multi-select and bulk edit functionality
  - Shift-click range selection
  - Ctrl/Cmd-click individual selection
  - Bulk category assignment
  - Bulk branch assignment

**Transaction Categorization:**
- **Transaction Types**: Income, Expense, Transfer, Debt, Investment, Other
- **Categories**: Hierarchical category system filtered by transaction type
- **Branches**: Store/location assignment
- **Direction**: Debit or Credit
- **Notes**: Additional context and documentation

**Transaction Matching:**
- **Transfer Matching**: TRF_OUT ↔ TRF_IN
  - Match outgoing and incoming transfers between accounts
  - Bidirectional validation
  - Amount verification
  - Quick match dialog with smart filtering
- **Debt Acquisition Matching**: DEBT_DRAW ↔ DEBT_ACQ
  - Match debt drawdowns with acquisitions
  - Automatic validation
- **Debt Payback Matching**: DEBT_PAY ↔ DEBT_SETTLE
  - Match payments with specific drawdowns
  - Auto-create settlement transactions
  - Overpayment handling
  - Balance updates via triggers

**Advanced Features:**
- Real-time filters (account, type, category, branch, direction, date)
- Unmatched transaction highlighting
- Balance adjustment indicators
- Drawdown linkage
- Import batch tracking

### 💳 Advanced Debt Management System

#### Drawdown Management
- **Create Drawdowns**: Reference number, date, amount, interest rate
- **Due Date Management**:
  - Optional due dates
  - Quick selection buttons (1, 3, 6, 12 months)
  - Overdue tracking with status updates
- **Payment Recording**:
  - Principal, interest, and fee breakdown
  - Multiple payments per drawdown
  - Overpayment detection and handling
  - Automatic credit memo generation
- **Status Tracking**: Active, Overdue, Settled, Written Off
- **Receiving Account Assignment**: Link drawdowns to specific accounts for debt acquisition tracking

#### Debt Analytics & Reporting
- **Total Outstanding**: Includes all active and overdue drawdowns
- **Available Credit**: Real-time calculation accounting for all drawdowns
- **Payment Progress**: Visual progress indicators per drawdown
- **Average Interest Rate**: Weighted by balance
- **Next Due Date Alerts**: 7-day warning system
- **Overpayment Tracking**: Automatic credit memo creation and tracking
- **Status Filtering**: View drawdowns by any status

#### Debt Transaction Workflow
1. **Debt Acquisition**:
   - Create drawdown on credit line/term loan → Creates DEBT_DRAW transaction
   - Record corresponding acquisition → Creates DEBT_ACQ transaction
   - Match DEBT_DRAW ↔ DEBT_ACQ

2. **Debt Repayment**:
   - Record payment from bank account → Creates DEBT_PAY transaction
   - Match DEBT_PAY with specific drawdown → Auto-creates DEBT_SETTLE on credit line
   - System automatically:
     - Creates DEBT_SETTLE transaction
     - Updates drawdown balance
     - Changes status (active → settled if fully paid)
     - Creates credit memo if overpaid
     - Links both transactions bidirectionally

3. **Unmatch Handling**:
   - Unmatching DEBT_PAY deletes auto-created DEBT_SETTLE
   - Removes credit memos
   - Recalculates drawdown balance
   - Reverts status changes

### 📊 Balance Checkpoint System
A sophisticated system for maintaining accurate historical balances:

#### Features
- **Automatic Checkpoints**: Created on every import
- **Manual Checkpoints**: Set balance at any point in time
- **Historical Recalculation**: Auto-recalculates future balances when historical transactions change
- **Balance Adjustments**: Auto-generated balancing transactions
- **Checkpoint Editing**: Modify checkpoint balances and notes
- **Checkpoint History**: Complete audit trail with timestamps
- **Orphaned Adjustment Cleanup**: Automatic removal of obsolete adjustments
- **Balance Validation**: Ensures consistency across the system

#### How It Works
1. Import creates checkpoint at import date
2. System calculates running balance forward
3. Next checkpoint validates the calculation
4. If mismatch, creates balance adjustment transaction
5. All future balances recalculated
6. Old adjustments automatically cleaned up

### 📈 Reports & Analytics

#### Balance Reports
- **Current Balances**: Real-time balance for all accounts
- **Balance Change Tracking**: Period-over-period comparisons
- **Percentage Changes**: Growth/decline indicators
- **Entity Grouping**: Balances organized by entity

#### Balance History Charts
- **Time Series Visualization**: Interactive line charts using Recharts
- **Multi-Account Overlay**: Compare multiple accounts on one chart
- **Flexible Granularity**:
  - Daily aggregation
  - Weekly aggregation
  - Monthly aggregation
  - Yearly aggregation
- **Date Range Selection**: 1M, 3M, 6M, 1Y, All Time
- **Color-Coded Lines**: Up to 8 accounts with distinct colors
- **Interactive Tooltips**: Hover for exact values

### 🔄 Transfer Management Page
Dedicated interface for managing inter-account transfers:

- **Unmatched Transfers View**:
  - Separate columns for Transfer Out and Transfer In
  - Quick identification of unmatched transfers
  - Amount and account filtering
- **Matching Interface**:
  - Select from both columns to match
  - Amount validation
  - Account verification
  - One-click matching
- **Matched Transfers View**:
  - Toggle to view all matched transfers
  - Unmatch capability
  - Full transaction details
- **Account Filtering**: Filter by specific accounts
- **Real-time Updates**: Automatic refresh after operations

### ⚙️ Settings & Configuration

#### Categories Manager
- **Inline Editing**: Click any field to edit directly
- **Quick Add Dialog**: Add categories without leaving the page
- **Transaction Type Filtering**: Categories filtered by applicable type
- **Entity Type Support**: Business-only, Personal-only, or Both
- **Hierarchical Support**: Parent-child category relationships
- **Bulk Management**: Edit multiple categories efficiently

#### Branches Manager
- **Store/Location Tracking**: Manage all business locations
- **Branch Codes**: Unique identifiers for each location
- **Inline Editing**: Direct field editing
- **Quick Add**: Fast branch creation
- **Transaction Assignment**: Link transactions to specific branches

#### Transaction Types Manager
- **Core Types**: Income, Expense, Transfer, Debt, Investment, Other
- **Display Customization**: Control how types appear in UI
- **Cashflow Impact**: Define whether type affects cashflow
- **Display Order**: Control sort order in dropdowns
- **Affects Cashflow Flag**: Mark types that impact cashflow calculations

### 🔍 Advanced Filtering & Search

#### Global Search
- **Description Search**: Fuzzy matching across transaction descriptions
- **Reference Search**: Bank references and transaction IDs
- **Real-time Results**: Instant search as you type

#### Filter Combinations
- **Account Filter**: Single or multiple accounts
- **Transaction Type**: Filter by any type
- **Category Filter**: Filtered by selected transaction type
- **Branch Filter**: Location-based filtering
- **Direction**: Debit or Credit
- **Date Range**: Custom start and end dates
- **Status**: Matched/Unmatched, Active/Settled
- **Source**: Imported, Manual, System, Adjustment

#### Smart Filtering
- **Dependent Filters**: Categories auto-filter based on transaction type
- **Preserved State**: Filters persist across page refreshes
- **Clear All**: One-click filter reset
- **URL State**: Filters encoded in URL for sharing

### 🎨 Modern UI/UX

#### Design System
- **shadcn/ui Components**: Modern, accessible component library
- **Tailwind CSS**: Utility-first styling
- **Lucide Icons**: Consistent iconography
- **Dark Mode Support**: System-preference aware
- **Responsive Design**: Mobile, tablet, and desktop optimized

#### User Experience
- **Inline Editing**: Edit without opening dialogs
- **Auto-Save**: Changes saved automatically
- **Loading States**: Clear feedback during operations
- **Error Handling**: User-friendly error messages
- **Optimistic Updates**: Instant UI updates
- **Toast Notifications**: Non-intrusive success/error messages

#### Keyboard Shortcuts
- **Enter**: Save inline edit
- **Escape**: Cancel inline edit
- **Shift+Click**: Range selection
- **Ctrl/Cmd+Click**: Multi-selection
- **Tab**: Navigate between editable cells

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts
- **Forms**: React Hook Form (planned)
- **State**: React Hooks (useState, useEffect)

### Backend
- **API**: Next.js API Routes
- **Database**: PostgreSQL via Supabase
- **ORM**: Supabase Client
- **Authentication**: Supabase Auth (planned)
- **File Storage**: Supabase Storage (planned)

### Database Features
- **PostgreSQL 15+**: Advanced SQL features
- **Triggers**: Auto-calculations and validations
- **Views**: Complex query optimization
- **RPC Functions**: Custom business logic
- **Row Level Security**: Data isolation (planned)
- **Materialized Views**: Performance optimization (planned)

### File Processing
- **CSV Import**: Papa Parse
- **XLSX Import**: XLSX library
- **Column Mapping**: Dynamic field matching
- **Batch Processing**: Large file handling

---

## Database Schema

### Core Tables

#### entities
Multi-entity support table
- `id`: UUID primary key
- `name`: Entity name
- `type`: 'company' or 'personal'
- `description`: Optional notes
- `created_at`, `updated_at`: Timestamps

#### accounts
Financial accounts table
- `account_id`: Serial primary key
- `entity_id`: Foreign key to entities
- `account_name`: Display name
- `account_type`: 'bank', 'cash', 'credit_card', 'investment', 'credit_line', 'term_loan'
- `account_number`: Optional account number
- `bank_name`: Bank institution name
- `currency`: 'VND', 'USD', 'EUR'
- `credit_limit`: For credit accounts
- `loan_reference`: For loan accounts
- `is_active`: Soft delete flag
- `created_at`, `updated_at`: Timestamps

#### balance_checkpoints
Historical balance snapshots
- `checkpoint_id`: Serial primary key
- `account_id`: Foreign key to accounts
- `checkpoint_date`: Date of snapshot
- `balance`: Balance amount
- `notes`: Optional description
- `import_batch_id`: Link to import batch
- `created_at`, `created_by_user_id`: Audit fields

#### original_transaction
Raw transaction layer (source of truth)
- `raw_transaction_id`: Text primary key
- `account_id`: Foreign key to accounts
- `transaction_date`: Transaction date
- `description`: Transaction description
- `debit_amount`, `credit_amount`: Transaction amounts
- `balance`: Running balance
- `bank_reference`: Bank reference number
- `transaction_source`: 'imported_bank', 'user_manual', 'system_opening', 'auto_adjustment'
- `import_batch_id`: Import batch tracking
- `imported_at`: Import timestamp
- `import_file_name`: Source file name
- `is_balance_adjustment`: Flag for adjustment transactions
- `checkpoint_id`: Link to checkpoint
- `created_by_user_id`, `updated_by_user_id`: Audit fields

#### main_transaction
Processed transaction layer with categorization
- `main_transaction_id`: Serial primary key
- `raw_transaction_id`: Foreign key to original_transaction
- `account_id`: Foreign key to accounts
- `transaction_type_id`: Foreign key to transaction_types
- `category_id`: Foreign key to categories
- `branch_id`: Foreign key to branches
- `amount`: Transaction amount
- `transaction_direction`: 'debit' or 'credit'
- `transaction_date`: Transaction date
- `description`: Transaction description
- `notes`: Additional notes
- `is_split`: Split transaction flag
- `split_sequence`: Order in split group
- `transaction_subtype`: Additional classification
- `drawdown_id`: Link to debt drawdown
- `transfer_matched_transaction_id`: Bidirectional transfer/debt matching
- `created_at`, `updated_at`: Timestamps

#### transaction_types
Transaction type definitions
- `transaction_type_id`: Serial primary key
- `type_code`: Unique code (INC, EXP, TRF_OUT, TRF_IN, DEBT_DRAW, etc.)
- `type_name`: Internal name
- `type_display_name`: User-facing name
- `affects_cashflow`: Boolean flag
- `display_order`: Sort order
- `description`: Type description

#### categories
Hierarchical transaction categories
- `category_id`: Serial primary key
- `category_name`: Display name
- `category_code`: Unique code
- `transaction_type_id`: Applicable type
- `entity_type`: 'business', 'personal', 'both'
- `parent_category_id`: Parent category (hierarchical)
- `description`: Category description
- `created_at`, `updated_at`: Timestamps

#### branches
Store/location tracking
- `branch_id`: Serial primary key
- `branch_name`: Display name
- `branch_code`: Unique code
- `address`, `phone`, `email`: Contact info
- `is_active`: Active flag
- `created_at`, `updated_at`: Timestamps

#### debt_drawdown
Debt drawdown tracking
- `drawdown_id`: Serial primary key
- `account_id`: Foreign key to credit_line/term_loan account
- `drawdown_reference`: Reference number
- `drawdown_date`: Drawdown date
- `original_amount`: Initial amount
- `remaining_balance`: Current balance (updated by triggers)
- `due_date`: Optional payment due date
- `interest_rate`: Annual percentage rate
- `status`: 'active', 'overdue', 'settled', 'written_off'
- `notes`: Additional information
- `overpayment_amount`: Overpaid amount
- `is_overpaid`: Overpayment flag
- `created_at`, `updated_at`: Timestamps

#### drawdown_payment
Payment records for drawdowns
- `payment_id`: Serial primary key
- `drawdown_id`: Foreign key to debt_drawdown
- `payment_date`: Payment date
- `principal_amount`: Principal portion
- `interest_amount`: Interest portion
- `fee_amount`: Fee portion
- `total_amount`: Total payment
- `notes`: Payment notes
- `created_at`: Timestamp

### Key Views

#### main_transaction_details
Comprehensive transaction view joining all related tables
- All main_transaction fields
- Account details (name, bank, type)
- Entity information
- Transaction type details
- Category information
- Branch details
- Drawdown information
- Calculated flags: `needs_drawdown_match`, `is_unmatched`

#### debt_summary
Aggregated debt statistics per account
- Account information
- Total/active/overdue/settled drawdown counts
- Total outstanding amounts
- Available credit calculations
- Average interest rates

### Database Functions & Triggers

#### Auto-Create Main Transactions
- Trigger: `auto_create_main_transaction`
- Fires on: INSERT to original_transaction
- Action: Automatically creates corresponding main_transaction

#### Balance Checkpoint Management
- `recalculate_balances_after_checkpoint()`: Recalculates future balances
- `cleanup_orphaned_adjustments()`: Removes obsolete adjustment transactions

#### Debt Management
- `get_active_drawdowns()`: Returns active and overdue drawdowns with details
- `get_available_credit()`: Calculates available credit considering all drawdowns
- `get_drawdown_settled_amount()`: Sums settled amount from matched DEBT_SETTLE transactions
- `update_drawdown_after_settlement()`: Trigger to update drawdown balance on DEBT_SETTLE INSERT/UPDATE/DELETE

#### Transfer & Debt Matching
- `validate_transfer_match()`: Validates transaction pair matching (TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, DEBT_PAY↔DEBT_SETTLE)

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Supabase account (free tier works)
- PostgreSQL database via Supabase

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Financeapp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. **Run database migrations**

Execute migration files in `/migrations` folder in numerical order via Supabase SQL Editor:
- Migrations 001-013: Core system and main transactions
- Migrations 014-021: Debt management system
- **Latest migration: 021_add_debt_payback_system.sql**

Or run all at once (ensure order is preserved):
```sql
-- In Supabase SQL Editor
-- Copy and paste each migration file content in order
```

5. **Start the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

6. **Build for production**
```bash
npm run build
npm start
```

---

## Usage Guide

### Setting Up Your First Account

1. **Create an Entity**
   - Navigate to **Entities** page
   - Click **Add Entity**
   - Choose type (Company or Personal)
   - Enter name and description
   - Save

2. **Add a Bank Account**
   - Navigate to **Accounts** page
   - Click **Add Account**
   - Select your entity
   - Choose account type (Bank, Cash, Credit Card, etc.)
   - Enter account details
   - Set initial balance and date
   - Save (system creates opening checkpoint)

### Importing Bank Statements

1. **Prepare Your File**
   - CSV or XLSX format
   - Required columns: Date, Description, Amount (or Debit/Credit)
   - Optional: Balance, Reference

2. **Import Process**
   - Navigate to **Transactions** page
   - Click **Import CSV** or **Import XLSX**
   - Select account
   - Map columns to required fields
   - Preview first 5 rows
   - Click **Import**
   - System creates checkpoint and processes all transactions

3. **What Happens Behind the Scenes**
   - Creates balance checkpoint at first transaction date
   - Imports all original_transaction records
   - Auto-creates main_transaction records via trigger
   - Calculates running balance
   - Creates balance adjustment if needed
   - Cleans up old adjustments

### Categorizing Transactions

1. **Navigate to Main Transactions**
   - Go to **Main Transactions** page
   - Use filters to find uncategorized transactions

2. **Inline Editing**
   - Click any cell to edit
   - Type to search in dropdowns
   - Press Enter to save, Escape to cancel
   - Changes save automatically

3. **Bulk Editing**
   - Select multiple transactions (Shift+Click or Ctrl+Click)
   - Click **Bulk Edit**
   - Set transaction type, category, branch
   - Apply to all selected

4. **Splitting Transactions**
   - Click split icon (turns blue if already split)
   - Add split rows
   - Allocate amounts (must sum to original)
   - Set category for each split
   - Save

### Managing Debt

#### Creating a Drawdown

1. Navigate to account detail page (Credit Line or Term Loan)
2. Click **New Drawdown** in Debt Drawdowns card
3. Enter:
   - Reference number
   - Drawdown date
   - Amount
   - Due date (optional, use quick buttons for common terms)
   - Interest rate (optional)
   - Notes (optional)
4. Save
5. System creates DEBT_DRAW transaction

#### Recording a Payment

**Method 1: Direct Payment Recording**
1. In Debt Drawdowns card, click **Pay** button
2. Enter:
   - Payment date
   - Principal amount
   - Interest amount (optional)
   - Fee amount (optional)
3. Save
4. Creates payment record
5. Updates remaining balance
6. Changes status to settled if fully paid

**Method 2: Match Existing DEBT_PAY Transaction**
1. Record payment in bank account (creates DEBT_PAY transaction)
2. Navigate to **Main Transactions**
3. Find the DEBT_PAY transaction
4. Click the matching badge/button
5. Select target drawdown from list
6. System automatically:
   - Creates DEBT_SETTLE on credit line account
   - Links both transactions
   - Updates drawdown balance
   - Changes status if fully paid
   - Creates credit memo if overpaid

#### Assigning Receiving Account

1. Click link icon on drawdown
2. Select the account that received the funds
3. System tracks where drawdown funds went

### Matching Transfers

#### Automatic Matching (Recommended)
1. Navigate to **Main Transactions**
2. Find unmatched transfer badges (yellow)
3. Click badge on either TRF_OUT or TRF_IN
4. System shows matching candidates
5. Select correct match
6. Confirm

#### Manual Matching (Dedicated Page)
1. Navigate to **Transfers** page
2. View unmatched Transfer Out (left) and Transfer In (right)
3. Select one from each column
4. Click **Match**
5. System validates amounts and creates bidirectional link

### Viewing Reports

1. **Balance Reports**
   - Navigate to **Reports** page
   - View current balances for all accounts
   - See balance changes and percentages
   - Filter by entity

2. **Balance History Chart**
   - Select granularity (Day/Week/Month/Year)
   - Choose date range (1M/3M/6M/1Y/All)
   - Click accounts to toggle on chart
   - Hover for exact values
   - Multiple accounts shown with different colors

### Managing Settings

#### Categories
1. Navigate to **Settings** > **Categories** tab
2. Click **Add Category** for new entry
3. Click any field to edit inline
4. Categories auto-filter by transaction type
5. Set entity type (Business/Personal/Both)

#### Branches
1. Navigate to **Settings** > **Branches** tab
2. Add branches for different locations
3. Edit inline (name, code, contact info)
4. Assign to transactions for location tracking

#### Transaction Types
1. Navigate to **Settings** > **Transaction Types** tab
2. Configure core types (read-only codes)
3. Edit display names and descriptions
4. Set display order
5. Configure cashflow impact

---

## Project Structure

```
/app
  /api                          # API Routes
    /accounts                   # Account CRUD
      /[id]                     # Individual account operations
        /drawdowns              # Drawdown management
        /available-credit       # Credit calculations
        /payments               # Payment recording
    /branches                   # Branch CRUD
    /categories                 # Category CRUD
    /debt                       # Debt operations
      /match-payback            # DEBT_PAY ↔ DEBT_SETTLE matching
    /main-transactions          # Main transaction operations
      /bulk-update              # Bulk edit endpoint
    /transaction-types          # Transaction type management
    /transactions               # Original transaction operations
      /grouped                  # Grouped view
      /import                   # CSV/XLSX import
      /rollback                 # Batch rollback
    /transfers                  # Transfer and debt matching
      /match                    # Create matches
      /unmatch/[id]             # Remove matches
      /matched                  # List matched
      /unmatched                # List unmatched
    /reports                    # Reporting endpoints
      /balance-history          # Historical balance data
  /dashboard                    # Main application pages
    /accounts                   # Account management UI
      /[id]                     # Individual account detail
    /entities                   # Entity management UI
    /main-transactions          # Categorized transactions UI
    /reports                    # Financial reports UI
    /settings                   # Settings with tabs
    /transactions               # Raw transactions & import
    /transfers                  # Transfer matching UI
    /page.tsx                   # Dashboard home

/components
  /main-transactions            # Main transaction components
    /EditTransactionDialog.tsx  # Edit dialog
    /SplitTransactionDialog.tsx # Split interface
    /BulkEditDialog.tsx         # Bulk edit dialog
    /QuickMatchTransferDialog.tsx # Transfer matching UI
    /QuickMatchDebtDialog.tsx   # Debt acquisition matching UI
    /SelectDrawdownDialog.tsx   # Debt payback matching UI
    /InlineCombobox.tsx         # Searchable dropdown
  /settings                     # Settings page components
    /CategoriesManager.tsx      # Category management
    /BranchesManager.tsx        # Branch management
    /TransactionTypesManager.tsx # Type management
  /ui                          # Reusable shadcn/ui components
  account-form-dialog.tsx      # Account creation/editing
  bank-import-dialog.tsx       # CSV/XLSX import UI
  create-drawdown-dialog.tsx   # Drawdown creation
  drawdown-list-card.tsx       # Drawdown display with filtering
  record-payment-dialog.tsx    # Payment recording
  assign-receiving-account-dialog.tsx # Account assignment
  balance-edit-dialog.tsx      # Balance editing
  checkpoint-history-card.tsx  # Checkpoint history display
  edit-checkpoint-dialog.tsx   # Checkpoint editing
  view-checkpoint-dialog.tsx   # Checkpoint details
  sidebar.tsx                  # Navigation sidebar

/lib
  supabase.ts                  # Supabase client configuration
  account-utils.ts             # Account helper functions
  currency-utils.ts            # Currency formatting
  date-utils.ts                # Date formatting

/migrations                    # Database migration files
  001-013_*.sql                # Core system migrations
  014-021_*.sql                # Debt management migrations

/types                         # TypeScript type definitions
  account.ts                   # Account types and configs
  debt.ts                      # Debt system types
  main-transaction.ts          # Transaction types
  balance.ts                   # Balance and checkpoint types
```

---

## Key Migrations

### Balance & Checkpoint System
- **001**: Add missing transaction features
- **002**: Migrate account balances (optional)
- **003**: Add balance checkpoint system
- **004-005**: Fix checkpoint recalculation and orphaned adjustments

### Main Transaction System
- **006**: Main transaction system foundation
- **007-009**: Auto-create main transactions from original
- **010**: Fix main_transaction_details view
- **011-013**: Transaction import enhancements and rollback

### Debt Management System
- **014**: Debt drawdown system foundation
- **015**: Drawdown payment tracking
- **016**: Fix debt type filtering
- **017**: Overpayment handling with credit memos
- **018**: Debt transaction matching support (DEBT_DRAW ↔ DEBT_ACQ)
- **019**: Fix checkpoint logic for credit accounts
- **020**: Fix overdue drawdowns visibility and calculations
- **021**: Add debt payback system (DEBT_PAY ↔ DEBT_SETTLE) ⭐ **LATEST**

### Migration 021 Details

**Purpose**: Complete debt payback system with auto-settlement

**Changes**:
1. **New Transaction Type**: DEBT_SETTLE for auto-created settlement transactions
2. **Schema Updates**:
   - Added `is_overpaid` boolean to `debt_drawdown` table
   - Enhanced `main_transaction_details` view
3. **Functions**:
   - `get_drawdown_settled_amount()`: Calculate total settled from matched transactions
   - `update_drawdown_after_settlement()`: Auto-update drawdown on settlement INSERT/UPDATE/DELETE
   - Updated `validate_transfer_match()`: Allow DEBT_PAY ↔ DEBT_SETTLE pairs
4. **Triggers**:
   - `trigger_update_drawdown_on_settlement`: Fires on DEBT_SETTLE changes
   - Handles DELETE to recalculate on unmatch

**To Apply**: Run `migrations/021_add_debt_payback_system.sql` in Supabase SQL Editor

---

## Version History

- **v2.2.0** (Current) - Debt payback system and UI enhancements
- **v2.1.0** - Debt management enhancements and overdue handling
- **v2.0.0** - Main transaction system with inline editing
- **v1.0.0** - Initial release with basic account and transaction management

---

## Roadmap

### Planned Features
- [ ] User authentication and multi-user support
- [ ] Role-based access control
- [ ] Budgeting and forecasting
- [ ] Recurring transactions
- [ ] Advanced reporting (P&L, Balance Sheet, Cash Flow Statement)
- [ ] Export to Excel/PDF
- [ ] API documentation
- [ ] Mobile responsive improvements
- [ ] Real-time collaboration
- [ ] Automated bank feeds
- [ ] AI-powered categorization suggestions

### Under Consideration
- [ ] Multi-currency exchange rate handling
- [ ] Invoice management
- [ ] Expense claims
- [ ] Payroll integration
- [ ] Tax calculation and reporting
- [ ] Audit log
- [ ] Data backup and restore

---

## Contributing

This is a private project. For issues or feature requests, please contact the development team.

---

## License

Proprietary - All rights reserved

---

## Support

For questions, issues, or feature requests:
- Create an issue in the repository
- Contact the development team
- Refer to inline code documentation

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend platform
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide](https://lucide.dev/) - Icons
- [Recharts](https://recharts.org/) - Charts
- [XLSX](https://www.npmjs.com/package/xlsx) - Excel file processing
