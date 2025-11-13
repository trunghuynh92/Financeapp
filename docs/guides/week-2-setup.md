# Week 2: Account Management Setup Guide

This guide will help you set up and use the Account Management features for your Finance SaaS application.

## Overview

Week 2 adds comprehensive account management functionality:
- Multiple account types (Bank, Cash, Credit Card, Investment, Credit Line, Term Loan)
- Full CRUD operations for accounts
- Account filtering and search
- Account balances tracking
- Account detail pages
- Integration with Entity management from Week 1

## Prerequisites

Before starting, ensure you have:
1. Completed Week 1 (Entity Management)
2. Supabase project set up and connected
3. At least one entity created in your database
4. Node.js and npm installed

## Database Setup

### Step 1: Run Database Migrations

Open your Supabase SQL Editor and run the following SQL script:

```bash
database/account-schema.sql
```

This will create:
- `accounts` table with all required fields
- `account_balances` table for tracking balances
- Indexes for performance
- Triggers for automatic timestamp updates
- Row Level Security policies

### Step 2: Verify Tables

After running the migration, verify the tables were created:

```sql
SELECT * FROM accounts LIMIT 1;
SELECT * FROM account_balances LIMIT 1;
```

### Step 3 (Optional): Add Sample Data

If you want to test with sample data, update the entity_id values in:
```bash
database/account-seed-data.sql
```

Then run the seed script in Supabase SQL Editor.

## Features Implemented

### 1. Account Types

The system supports 6 account types:

- **Bank Account**: Standard bank accounts
- **Cash**: Physical cash holdings
- **Credit Card**: Credit card accounts
- **Investment**: Investment portfolios
- **Credit Line**: Lines of credit with limits
- **Term Loan**: Term loans with tracking

Each type has:
- Unique icon and color scheme
- Specific fields (e.g., credit limit for loans)
- Appropriate balance display

### 2. Account List Page

**Location**: `/dashboard/accounts`

Features:
- Summary cards showing total balance, active accounts, and entities
- Advanced filtering:
  - By entity
  - By account type
  - By status (active/inactive)
  - Search by account name or bank name
- Clean table view with:
  - Account type icons
  - Masked account numbers (shows last 4 digits)
  - Current balances
  - Status badges
  - Quick edit/delete actions
- Click account name to view details

### 3. Add/Edit Account Form

**Access**: Click "Add Account" button or "Edit" icon

Features:
- **Step 1**: Basic Information
  - Select entity
  - Account name
  - Account type (visual radio buttons)
  - Currency (VND, USD, EUR)

- **Step 2**: Account Details (conditional)
  - Bank accounts: Bank name, account number
  - Cash: Location field
  - Credit/Loan accounts: Credit limit, loan reference

- **Step 3**: Initial Balance (for new accounts only)
  - Optional starting balance

Validation:
- Required fields checked
- Account number format validation
- Duplicate detection (same name + type + entity)
- Credit limit must be positive

### 4. Account Detail Page

**Location**: `/dashboard/accounts/[id]`

Features:
- Large account overview with icon
- All account information displayed
- Current balance prominently shown
- For credit accounts:
  - Credit utilization bar (color-coded)
  - Available credit calculation
  - Credit limit display
- Quick actions: Edit, Delete
- Placeholder for transactions (Week 3)

### 5. Delete Account

**Access**: Click "Delete" button

Features:
- Confirmation dialog with warnings
- Prevents accidental deletion
- Cascade deletes associated balance record
- Note: Will check for transactions in Week 3

## API Endpoints

All endpoints are RESTful and return JSON:

### GET /api/accounts
List all accounts with optional filters
- Query params: entity_id, account_type, is_active, search, page, limit
- Returns: Array of accounts with balances and entity info

### POST /api/accounts
Create a new account
- Body: CreateAccountInput
- Returns: Created account with balance

### GET /api/accounts/[id]
Get single account details
- Returns: Account with balance and entity info

### PATCH /api/accounts/[id]
Update account
- Body: UpdateAccountInput
- Returns: Updated account

### DELETE /api/accounts/[id]
Delete account
- Returns: Success message

### GET /api/accounts/[id]/balance
Get account balance
- Returns: Current balance info

### PATCH /api/accounts/[id]/balance
Update account balance
- Body: { balance: number }
- Returns: Updated balance

## Utility Functions

Located in `lib/account-utils.ts`:

### Currency Functions
- `formatCurrency(amount, currency)`: Format numbers as currency
- `parseCurrency(value)`: Parse formatted currency back to number
- `formatCurrencyInput(amount, currency)`: Format for input fields

### Account Functions
- `maskAccountNumber(number)`: Show only last 4 digits
- `getAccountTypeConfig(type)`: Get icon, color, label for type
- `calculateAvailableCredit(limit, balance)`: Calculate available credit
- `calculateCreditUtilization(limit, balance)`: Calculate usage percentage

### Validation Functions
- `validateAccountNumber(number)`: Basic account number validation
- `requiresBankInfo(type)`: Check if type needs bank details
- `requiresCreditLimit(type)`: Check if type needs credit limit
- `isCreditAccount(type)`: Check if account is credit type

### Display Functions
- `getBalanceColor(type, balance)`: Get appropriate color for balance
- `formatBalanceDisplay(type, balance, currency)`: Format balance with sign
- `getStatusColor(isActive)`: Get color for status badge
- `formatDate(dateString)`: Format date for display
- `formatDateTime(dateString)`: Format datetime for display

## Testing Checklist

### Database
- [ ] Tables created successfully
- [ ] Foreign key to entities table working
- [ ] Triggers firing correctly
- [ ] Balance record auto-created with new account

### Account List Page
- [ ] Summary cards show correct totals
- [ ] Entity filter works
- [ ] Status filter works
- [ ] Search functionality works
- [ ] Table displays all account types correctly
- [ ] Icons and colors match account types
- [ ] Account numbers are masked
- [ ] Balances formatted correctly
- [ ] Click account name navigates to detail page

### Add Account
- [ ] All entity options show in dropdown
- [ ] All 6 account types selectable
- [ ] Required field validation works
- [ ] Bank info shown for appropriate types
- [ ] Credit limit required for credit types
- [ ] Step navigation works
- [ ] Can skip initial balance
- [ ] Success creates account and balance record
- [ ] Duplicate detection works
- [ ] Error messages clear and helpful

### Edit Account
- [ ] Form pre-fills with current values
- [ ] Entity field disabled (can't change)
- [ ] No initial balance step (editing mode)
- [ ] Can update all editable fields
- [ ] Validation still applies
- [ ] Success updates account
- [ ] Changes reflect immediately

### Account Detail Page
- [ ] All account info displayed
- [ ] Balance shows correctly
- [ ] Credit accounts show utilization bar
- [ ] Credit bar color changes based on usage
- [ ] Available credit calculated correctly
- [ ] Edit button opens form with data
- [ ] Delete button shows confirmation
- [ ] Back button returns to list

### Delete Account
- [ ] Confirmation dialog appears
- [ ] Shows account name in warning
- [ ] Cancel button works
- [ ] Delete button removes account
- [ ] Balance record also deleted
- [ ] Redirects to account list after delete

### Navigation
- [ ] "Accounts" link added to sidebar
- [ ] Accounts link highlighted when on accounts pages
- [ ] Accounts link highlighted when on detail page

### Responsive Design
- [ ] Layout works on mobile (< 768px)
- [ ] Layout works on tablet (768px - 1024px)
- [ ] Layout works on desktop (> 1024px)
- [ ] Filters stack properly on mobile
- [ ] Table scrolls horizontally on mobile if needed
- [ ] Dialogs fit on mobile screens

## Common Issues and Solutions

### Issue: Tables not created
**Solution**: Ensure you have proper permissions in Supabase. Try creating tables manually if the script fails.

### Issue: Foreign key error when creating account
**Solution**: Make sure the entity_id exists in the entities table. Check with: `SELECT id FROM entities;`

### Issue: Account balance not showing
**Solution**: The trigger should auto-create balance records. If not, manually insert:
```sql
INSERT INTO account_balances (account_id, current_balance) VALUES (YOUR_ACCOUNT_ID, 0);
```

### Issue: API routes returning 500 errors
**Solution**: Check browser console and server logs. Common causes:
- Supabase credentials not set in .env.local
- Table names don't match (case-sensitive)
- Missing required fields in request

### Issue: Duplicate account error when shouldn't be duplicate
**Solution**: The check is case-sensitive and includes entity_id, account_name, and account_type. Verify all three match exactly.

## Next Steps

After completing Week 2:
1. Test all functionality thoroughly
2. Create at least one account of each type
3. Familiarize yourself with the account detail page
4. Week 3 will add transaction management
5. Week 4 will add reporting and analytics

## File Structure

```
/app
  /api
    /accounts
      route.ts                    # List & create accounts
      /[id]
        route.ts                  # Get, update, delete account
        /balance
          route.ts                # Get & update balance
  /dashboard
    /accounts
      page.tsx                    # Account list page
      /[id]
        page.tsx                  # Account detail page

/components
  sidebar.tsx                     # Updated with Accounts link
  account-form-dialog.tsx         # Add/edit account form
  account-delete-dialog.tsx       # Delete confirmation dialog
  /ui
    badge.tsx                     # New component
    alert-dialog.tsx              # New component
    radio-group.tsx               # New component

/types
  account.ts                      # All account types and interfaces

/lib
  account-utils.ts                # Utility functions for accounts
  supabase.ts                     # Updated with account types

/database
  account-schema.sql              # Database migration script
  account-seed-data.sql           # Optional seed data
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Verify all environment variables are set
4. Ensure Week 1 entities are working
5. Review this guide's troubleshooting section

## Summary

You now have a fully functional Account Management system with:
- ✅ 6 different account types
- ✅ Full CRUD operations
- ✅ Advanced filtering and search
- ✅ Balance tracking
- ✅ Credit utilization monitoring
- ✅ Responsive design
- ✅ Type-safe TypeScript code
- ✅ Clean, professional UI

Ready for Week 3: Transaction Management! 🚀
