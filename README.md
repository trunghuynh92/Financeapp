# Finance SaaS v2.2.0

A comprehensive financial management system for businesses and individuals, built with Next.js, TypeScript, and Supabase.

## Version 2.2.0 - Debt Payback System & UI Enhancements

### What's New in v2.2.0

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

## Features

### 🏢 Entity & Account Management
- Multi-entity support (Business and Personal)
- Bank account tracking with balance checkpoints
- Import bank statements from CSV and XLSX files
- Automatic balance calculation and reconciliation
- Balance checkpoint system for accurate historical tracking
- **Credit Line & Term Loan accounts** with drawdown tracking

### 💰 Transaction Management
- **Original Transactions**: Raw imported bank transactions
- **Main Transactions**: Categorized and analyzed transactions layer
  - Inline spreadsheet-style editing for fast data entry
  - Searchable dropdown filters (type to search)
  - Split transaction support with visual indicators
  - Transfer matching between accounts
  - Branch/store assignment
  - **Debt transaction matching** (DEBT_DRAW ↔ DEBT_ACQ, DEBT_PAY ↔ DEBT_SETTLE)

### 💳 Debt Drawdown System
- **Credit Line Management**: Track drawdowns from credit lines with available credit monitoring
- **Term Loan Tracking**: Manage term loans with payment schedules
- **Drawdown Features**:
  - Create drawdowns with reference numbers, dates, and amounts
  - Optional due dates with quick selection (1, 3, 6, 12 months)
  - Interest rate tracking
  - Payment recording with principal, interest, and fee breakdown
  - **Debt payback matching**: Match DEBT_PAY transactions with drawdowns
  - Overpayment handling with automatic credit memos
  - Assign receiving accounts for debt acquisition tracking
  - **Status tracking**: Active, Overdue, Settled, Written Off
  - **Status filtering**: Filter drawdowns by any status (All/Active/Overdue/Settled)
- **Debt Analytics**:
  - Total outstanding balance (includes overdue)
  - Available credit calculations
  - Average interest rates (weighted by balance)
  - Payment progress indicators
  - Next due date alerts

### 📊 Categorization System
- Transaction type classification (Income, Expense, Transfer, Investment, Debt)
- Hierarchical category system
- Entity-type filtering (Business, Personal, Both)
- Branch/store location tracking
- Customizable categories and branches

### 🔍 Advanced Filtering & Search
- Filter by: Account, Transaction Type, Category, Branch, Direction, Date Range
- Real-time search across descriptions and notes
- Pagination with configurable page sizes (50/100/200)
- Smart category filtering based on transaction type

### ⚙️ Settings Management
- **Categories Manager**: Create and edit transaction categories
- **Branches Manager**: Manage store/branch locations
- **Transaction Types Manager**: Configure core transaction types
- All with inline editing and quick add dialogs

### 🎨 Modern UI/UX
- Clean, responsive design with shadcn/ui components
- Dark mode support
- Inline editing with auto-save
- Type-ahead search in dropdowns
- Real-time updates without page refresh
- **Quick action buttons** for common tasks

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **UI Components**: shadcn/ui, Tailwind CSS
- **Icons**: Lucide React
- **File Processing**: XLSX import support

## Database Schema

### Core Tables
- `entities`: Business and personal entities
- `accounts`: Bank accounts linked to entities
- `balance_checkpoints`: Historical balance snapshots
- `original_transaction`: Raw imported transactions
- `main_transaction`: Categorized transaction layer
- `transaction_types`: Transaction type definitions
- `categories`: Hierarchical transaction categories
- `branches`: Store/branch locations
- **`debt_drawdown`**: Debt drawdown tracking
- **`drawdown_payment`**: Payment records for drawdowns

### Key Features
- Automatic trigger-based balance calculations
- Checkpoint recalculation on historical imports
- Orphaned adjustment cleanup
- Transaction type and category validation
- **Debt drawdown lifecycle management**
- **Available credit calculation with overdue handling**

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Financeapp
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

Add your Supabase credentials to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run database migrations
- Execute migration files in the `/migrations` folder in order
- Latest migration: `021_add_debt_payback_system.sql`
- Or import them via Supabase SQL Editor

5. Start the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

### Importing Bank Statements
1. Navigate to **Transactions** page
2. Click **Import CSV** or **Import XLSX**
3. Select your bank account
4. Map columns (date, description, debit, credit)
5. Review and import transactions
6. System automatically creates balance checkpoint

### Categorizing Transactions
1. Navigate to **Main Transactions** page
2. Use filters to find transactions
3. Click on any dropdown to categorize:
   - Type to search for categories
   - Select transaction type, category, and branch
   - Changes save automatically
4. Or use the Edit dialog for bulk edits

### Managing Debt Drawdowns
1. Navigate to **Accounts** page
2. View a Credit Line or Term Loan account
3. Click **New Drawdown** to create a drawdown:
   - Enter reference number and amount
   - Select drawdown date
   - Optionally set due date (use quick buttons for common terms)
   - Add interest rate and notes if needed
4. Track drawdowns in the Debt Drawdowns card
5. Click **Pay** to record payments
6. Click the link icon to assign receiving accounts

### Matching Debt Transactions

#### Matching Debt Acquisition (DEBT_DRAW ↔ DEBT_ACQ)
1. Navigate to **Main Transactions** page
2. Find unmatched DEBT_DRAW and DEBT_ACQ transactions
3. Click the **Unmatched** badge on either transaction
4. Select the corresponding transaction to match
5. System validates amounts and creates the match

#### Matching Debt Payback (DEBT_PAY ↔ DEBT_SETTLE)
1. Navigate to **Main Transactions** page
2. Find DEBT_PAY transactions that need drawdown matching
3. Click the badge or use the matching dialog
4. Select the drawdown to match with
5. System automatically:
   - Creates DEBT_SETTLE transaction on credit line
   - Updates drawdown balance and status
   - Creates credit memo if overpayment occurs
6. To unmatch: Click the matched badge - system will delete auto-created settlements and recalculate

### Managing Categories
1. Navigate to **Settings** > **Categories** tab
2. Click **Add Category** to create new categories
3. Click any field to edit inline
4. Categories are automatically filtered by transaction type

### Managing Branches
1. Navigate to **Settings** > **Branches** tab
2. Click **Add Branch** to create new locations
3. Edit branch details inline
4. Assign branches to transactions for location tracking

## Project Structure

```
/app
  /api                 # API routes
    /accounts         # Account management
      /[id]/drawdowns # Drawdown management
      /[id]/available-credit # Credit calculations
    /branches         # Branch CRUD
    /categories       # Category CRUD
    /main-transactions # Main transaction operations
    /transaction-types # Transaction type management
    /transfers        # Transfer and debt matching
  /dashboard          # Main application pages
    /accounts         # Account management UI
      /[id]          # Individual account with drawdowns
    /entities         # Entity management UI
    /main-transactions # Categorized transactions UI
    /settings         # Settings with tabs
    /transactions     # Raw transactions & import
/components
  /main-transactions  # Transaction components
    /QuickMatchDebtDialog.tsx # Debt matching UI
  /settings          # Settings page components
  /ui               # Reusable UI components
  create-drawdown-dialog.tsx # Drawdown creation
  drawdown-list-card.tsx     # Drawdown display
  record-payment-dialog.tsx  # Payment recording
  assign-receiving-account-dialog.tsx # Account assignment
/lib                # Utilities and helpers
/migrations         # Database migration files
/types              # TypeScript type definitions
  debt.ts           # Debt system types
  main-transaction.ts # Transaction types
```

## Key Migrations

### Balance & Checkpoint System
- `001`: Add missing transaction features
- `002`: Migrate account balances (optional)
- `003`: Add balance checkpoint system
- `004-005`: Fix checkpoint recalculation

### Main Transaction System
- `006`: Main transaction system
- `007-009`: Auto-create main transactions
- `010`: Fix main_transaction_details view
- `011-013`: Transaction import and rollback

### Debt Management System
- `014`: Debt drawdown system foundation
- `015`: Drawdown payment tracking
- `016`: Fix debt type filtering
- `017`: Overpayment handling
- `018`: Debt transaction matching support
- `019`: Fix checkpoint logic for credit accounts
- `020`: Fix overdue drawdowns visibility and calculations
- **`021`: Add debt payback system (DEBT_PAY ↔ DEBT_SETTLE)** ⭐ NEW

## Migration 021 Details

This migration adds the complete debt payback system:

1. **New Transaction Type**:
   - Added `DEBT_SETTLE` type for settlement transactions auto-created when matching debt payments

2. **Database Schema Updates**:
   - Added `is_overpaid` boolean flag to `debt_drawdown` table
   - Enhanced `main_transaction_details` view with drawdown matching information

3. **Functions & Triggers**:
   - `get_drawdown_settled_amount()`: Calculate total settled amount for a drawdown
   - `update_drawdown_after_settlement()`: Automatically update drawdown balance on INSERT/UPDATE/DELETE
   - Updated `validate_transfer_match()`: Allow DEBT_PAY ↔ DEBT_SETTLE matching
   - Trigger on DELETE: Properly recalculates drawdown when settlements are deleted

4. **Matching Logic**:
   - DEBT_PAY (from paying account) ↔ DEBT_SETTLE (on credit line account)
   - Auto-creates DEBT_SETTLE when matching DEBT_PAY with drawdown
   - Bidirectional matching with validation
   - Overpayment detection and credit memo creation

**To apply**: Run `migrations/021_add_debt_payback_system.sql` in Supabase SQL Editor

## Version History

- **v2.2.0** (Current) - Debt payback system and UI enhancements
- **v2.1.0** - Debt management enhancements and overdue handling
- **v2.0.0** - Main transaction system with inline editing
- **v1.0.0** - Initial release with basic account and transaction management

## Contributing

This is a private project. For issues or feature requests, please contact the development team.

## License

Proprietary - All rights reserved
