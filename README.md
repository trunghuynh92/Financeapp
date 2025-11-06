# Finance SaaS

A comprehensive financial management system for businesses and individuals, built with Next.js, TypeScript, and Supabase.

## Features

### 🏢 Entity & Account Management
- Multi-entity support (Business and Personal)
- Bank account tracking with balance checkpoints
- Import bank statements from CSV files
- Automatic balance calculation and reconciliation
- Balance checkpoint system for accurate historical tracking

### 💰 Transaction Management
- **Original Transactions**: Raw imported bank transactions
- **Main Transactions**: Categorized and analyzed transactions layer
  - Inline spreadsheet-style editing for fast data entry
  - Searchable dropdown filters (type to search)
  - Split transaction support
  - Transfer matching between accounts
  - Branch/store assignment

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

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **UI Components**: shadcn/ui, Tailwind CSS
- **Icons**: Lucide React

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

### Key Features
- Automatic trigger-based balance calculations
- Checkpoint recalculation on historical imports
- Orphaned adjustment cleanup
- Transaction type and category validation

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
- Or import them via Supabase SQL Editor

5. Start the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

### Importing Bank Statements
1. Navigate to **Transactions** page
2. Click **Import CSV**
3. Select your bank account
4. Choose CSV file with columns: date, description, debit, credit
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
    /branches         # Branch CRUD
    /categories       # Category CRUD
    /main-transactions # Main transaction operations
    /transaction-types # Transaction type management
  /dashboard          # Main application pages
    /accounts         # Account management UI
    /entities         # Entity management UI
    /main-transactions # Categorized transactions UI
    /settings         # Settings with tabs
    /transactions     # Raw transactions & import
/components
  /main-transactions  # Transaction components
  /settings          # Settings page components
  /ui               # Reusable UI components
/lib                # Utilities and helpers
/migrations         # Database migration files
/types              # TypeScript type definitions
```

## Key Migrations

- `001`: Add missing transaction features
- `002`: Migrate account balances (optional)
- `003`: Add balance checkpoint system
- `004-005`: Fix checkpoint recalculation
- `006`: Main transaction system
- `007-009`: Auto-create main transactions
- `010`: Fix main_transaction_details view

## Contributing

This is a private project. For issues or feature requests, please contact the development team.

## License

Proprietary - All rights reserved
