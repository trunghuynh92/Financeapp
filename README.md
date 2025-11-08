# Finance SaaS v2.1.0

A comprehensive financial management system for businesses and individuals, built with Next.js, TypeScript, and Supabase.

## Version 2.1.0 - Debt Management & UX Improvements

### What's New in v2.1.0

#### 🏦 Enhanced Debt Management System
- **Overdue Drawdown Tracking**: Overdue drawdowns now properly display in the UI and count towards outstanding debt
- **Improved Debt Transaction Matching**: Support for matching DEBT_DRAW ↔ DEBT_ACQ transaction pairs alongside regular transfers
- **Quick Due Date Selection**: Added convenient 1, 3, 6, and 12-month quick buttons in drawdown creation dialog
- **Better Credit Calculations**: Available credit now correctly accounts for both active and overdue drawdowns

#### 🐛 Bug Fixes
- Fixed debt matching validation to support both transfer and debt transaction pairs
- Fixed Total Outstanding calculation to include overdue drawdowns
- Fixed PostgreSQL date arithmetic in drawdown queries
- Added missing X icon import in Create Drawdown Dialog

#### 🔧 Technical Improvements
- Updated `get_active_drawdowns` RPC function to include overdue status
- Updated `get_available_credit` RPC function to count overdue drawdowns
- Updated `debt_summary` view for comprehensive debt reporting
- Enhanced UI components to consistently treat active and overdue drawdowns

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
  - Split transaction support
  - Transfer matching between accounts
  - Branch/store assignment
  - **Debt transaction matching** (DEBT_DRAW ↔ DEBT_ACQ)

### 💳 Debt Drawdown System
- **Credit Line Management**: Track drawdowns from credit lines with available credit monitoring
- **Term Loan Tracking**: Manage term loans with payment schedules
- **Drawdown Features**:
  - Create drawdowns with reference numbers, dates, and amounts
  - Optional due dates with quick selection (1, 3, 6, 12 months)
  - Interest rate tracking
  - Payment recording with principal, interest, and fee breakdown
  - Overpayment handling with automatic credit memos
  - Assign receiving accounts for debt acquisition tracking
  - **Status tracking**: Active, Overdue, Settled, Written Off
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
- Latest migration: `020_fix_overdue_drawdowns.sql`
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
1. Navigate to **Main Transactions** page
2. Find unmatched DEBT_DRAW and DEBT_ACQ transactions
3. Click **Match** on either transaction
4. Select the corresponding transaction to match
5. System validates amounts and creates the match

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
- **`020`: Fix overdue drawdowns visibility and calculations** ⭐ NEW

## Migration 020 Details

This migration fixes several issues with overdue drawdown handling:

1. **Updated `get_active_drawdowns` function**:
   - Now returns both 'active' and 'overdue' drawdowns
   - Fixed date arithmetic for days_until_due calculation

2. **Updated `get_available_credit` function**:
   - Includes overdue drawdowns in total_drawn calculation
   - Properly reduces available credit for overdue amounts

3. **Updated `debt_summary` view**:
   - Counts overdue drawdowns separately
   - Includes overdue in total_outstanding
   - Deducts overdue from available_credit

**To apply**: Run `migrations/020_fix_overdue_drawdowns.sql` in Supabase SQL Editor

## Version History

- **v2.1.0** (Current) - Debt management enhancements and overdue handling
- **v2.0.0** - Main transaction system with inline editing
- **v1.0.0** - Initial release with basic account and transaction management

## Contributing

This is a private project. For issues or feature requests, please contact the development team.

## License

Proprietary - All rights reserved
