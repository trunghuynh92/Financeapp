export interface HelpSection {
  id: string;
  title: string;
  content: string;
  children?: HelpSection[];
}

export interface HelpNavItem {
  id: string;
  title: string;
  icon?: string;
  children?: HelpNavItem[];
}

export const helpNavigation: HelpNavItem[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    children: [
      { id: 'getting-started/welcome', title: 'Welcome' },
      { id: 'getting-started/first-entity', title: 'Create Your First Entity' },
      { id: 'getting-started/first-account', title: 'Set Up Your First Account' },
      { id: 'getting-started/first-import', title: 'Import Bank Transactions' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts',
    children: [
      { id: 'accounts/overview', title: 'Overview' },
      { id: 'accounts/account-types', title: 'Account Types' },
      { id: 'accounts/create-account', title: 'Creating an Account' },
      { id: 'accounts/import-transactions', title: 'Importing Transactions' },
      { id: 'accounts/balance-checkpoints', title: 'Balance Checkpoints' },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    children: [
      { id: 'transactions/overview', title: 'Overview' },
      { id: 'transactions/transaction-types', title: 'Transaction Types' },
      { id: 'transactions/add-transaction', title: 'Adding Transactions' },
      { id: 'transactions/categorize', title: 'Categorizing' },
      { id: 'transactions/split-transactions', title: 'Split Transactions' },
    ],
  },
  {
    id: 'transfers',
    title: 'Transfer Matching',
    children: [
      { id: 'transfers/overview', title: 'Overview' },
      { id: 'transfers/why-match', title: 'Why Match Transfers?' },
      { id: 'transfers/how-to-match', title: 'How to Match' },
    ],
  },
  {
    id: 'debt',
    title: 'Debt Management',
    children: [
      { id: 'debt/overview', title: 'Overview' },
      { id: 'debt/credit-cards', title: 'Credit Cards' },
      { id: 'debt/credit-lines', title: 'Credit Lines' },
      { id: 'debt/term-loans', title: 'Term Loans' },
    ],
  },
  {
    id: 'budgets',
    title: 'Budgets',
    children: [
      { id: 'budgets/overview', title: 'Overview' },
      { id: 'budgets/create-budget', title: 'Creating a Budget' },
      { id: 'budgets/tracking', title: 'Tracking Spending' },
    ],
  },
  {
    id: 'contracts',
    title: 'Contracts',
    children: [
      { id: 'contracts/overview', title: 'Overview' },
      { id: 'contracts/create-contract', title: 'Creating a Contract' },
      { id: 'contracts/contract-types', title: 'Contract Types' },
      { id: 'contracts/managing-contracts', title: 'Managing Contracts' },
    ],
  },
  {
    id: 'scheduled-payments',
    title: 'Scheduled Payments',
    children: [
      { id: 'scheduled-payments/overview', title: 'Overview' },
      { id: 'scheduled-payments/create-schedule', title: 'Creating a Schedule' },
      { id: 'scheduled-payments/payment-frequencies', title: 'Payment Frequencies' },
      { id: 'scheduled-payments/managing-schedules', title: 'Managing Schedules' },
    ],
  },
  {
    id: 'cash-flow',
    title: 'Cash Flow',
    children: [
      { id: 'cash-flow/overview', title: 'Overview' },
      { id: 'cash-flow/projections', title: 'Understanding Projections' },
      { id: 'cash-flow/scenarios', title: 'Scenarios' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    children: [
      { id: 'reports/overview', title: 'Overview' },
      { id: 'reports/income-expense', title: 'Income & Expense' },
      { id: 'reports/debt-position', title: 'Debt Position' },
    ],
  },
  {
    id: 'team',
    title: 'Team Management',
    children: [
      { id: 'team/roles', title: 'Roles & Permissions' },
      { id: 'team/inviting', title: 'Inviting Members' },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    children: [
      { id: 'faq/common-questions', title: 'Common Questions' },
    ],
  },
];

// Help content - can be moved to separate files or i18n later
export const helpContent: Record<string, { title: string; content: string }> = {
  'getting-started/welcome': {
    title: 'Welcome to Finance SaaS',
    content: `
## Welcome!

Finance SaaS is a comprehensive financial management system designed to help you track your finances across multiple entities, accounts, and transactions.

### Key Features

- **Multi-Entity Support**: Manage multiple companies or personal finances separately
- **Account Management**: Track bank accounts, credit cards, loans, and investments
- **Transaction Tracking**: Record and categorize all financial transactions
- **Transfer Matching**: Link internal transfers to prevent double-counting
- **Budget Planning**: Set and track budgets by category
- **Cash Flow Projections**: Forecast your financial future with scenario analysis
- **Team Collaboration**: Invite team members with role-based access

### Quick Navigation

- **Dashboard**: Overview of your current entity's finances
- **Accounts**: Manage your bank accounts and other financial accounts
- **Transactions**: View and manage all transactions
- **Budgets**: Set spending limits by category
- **Cash Flow**: View projections and create scenarios
- **Reports**: Analyze your financial data

### Getting Started

1. **Create an Entity** - Start by setting up your first company or personal entity
2. **Add Accounts** - Create accounts for your banks, credit cards, etc.
3. **Import Transactions** - Upload your bank statements to get started quickly
4. **Categorize** - Organize your transactions into categories
5. **Explore** - Use budgets, cash flow, and reports to manage your finances
    `,
  },

  'getting-started/first-entity': {
    title: 'Create Your First Entity',
    content: `
## What is an Entity?

An entity represents a financial unit - either a **Company** or **Personal** finances. Each entity has its own:
- Accounts
- Transactions
- Categories
- Budgets
- Team members

### When to Use Multiple Entities

- Separate business and personal finances
- Manage multiple companies
- Track different investment portfolios

### Creating an Entity

1. Click **Entities** in the sidebar
2. Click **Add Entity**
3. Enter the entity name (e.g., "My Company" or "Personal")
4. Select the type: **Company** or **Personal**
5. Add an optional description
6. Click **Create**

### Switching Between Entities

Use the **Entity Switcher** at the top of the sidebar to switch between your entities. All data shown will be for the selected entity.

### Entity Roles

When you create an entity, you become the **Owner**. You can invite others with different roles:
- **Owner**: Full control, can manage team
- **Admin**: Full access to data
- **Editor**: Can create/edit transactions
- **Viewer**: Read-only access
    `,
  },

  'getting-started/first-account': {
    title: 'Set Up Your First Account',
    content: `
## Account Types

Finance SaaS supports various account types:

| Type | Description | Examples |
|------|-------------|----------|
| **Bank** | Checking/savings accounts | VCB, ACB, BIDV |
| **Cash** | Physical cash | Petty cash, wallet |
| **Credit Card** | Credit cards | Visa, Mastercard |
| **Credit Line** | Revolving credit | Business credit line |
| **Term Loan** | Fixed loans | Bank loan, mortgage |
| **Loan Receivable** | Money you lent | Employee loan |
| **Investment** | Investment accounts | Stocks, bonds |

### Creating an Account

1. Go to **Accounts** in the sidebar
2. Click **Add Account**
3. Fill in the details:
   - **Name**: A recognizable name (e.g., "ACB Business Account")
   - **Type**: Select the account type
   - **Currency**: Usually VND
   - **Initial Balance**: Starting balance (optional)
4. Click **Create**

### Account Groups

Accounts are automatically organized into groups:
- **Banks & Cash**: Bank accounts and cash
- **Assets**: Loan receivables, investments
- **Liabilities**: Credit cards, credit lines, term loans

### Tips

- Start with your main bank accounts
- Add credit cards you use regularly
- Don't forget cash accounts if you handle cash
- Add loan accounts to track debt properly
    `,
  },

  'getting-started/first-import': {
    title: 'Import Bank Transactions',
    content: `
## Importing Transactions

The fastest way to get started is importing your bank statements.

### Supported Formats

- CSV files
- Excel files (.xlsx, .xls)

### Step-by-Step Import

1. Go to **Accounts**
2. Click on the account you want to import into
3. Click **Import Transactions**
4. Select your bank statement file
5. The system will auto-detect:
   - Header row
   - Date column and format
   - Amount columns (debit/credit or single)
   - Description column
6. Review the column mapping
7. Click **Import**

### Column Mapping

The system tries to automatically detect columns:
- **Date**: Transaction date
- **Description**: Transaction description
- **Debit**: Money out (or negative amounts)
- **Credit**: Money in (or positive amounts)
- **Balance**: Running balance (optional)

### After Import

- Review imported transactions in the account
- Categorize transactions
- Match any transfers between accounts

### Tips

- Download statements in CSV format when possible
- Include at least 3 months of history for better projections
- Check for duplicate imports
    `,
  },

  'accounts/account-types': {
    title: 'Account Types Explained',
    content: `
## Account Types

### Bank Account
Regular checking or savings accounts at banks.
- Records income, expenses, transfers
- Main accounts for daily operations

### Cash Account
Physical cash holdings.
- Petty cash, cash registers
- Track cash in hand

### Credit Card
Credit cards with spending limits.
- **CC_CHARGE**: Records purchases (doesn't affect cash flow)
- **CC_PAY**: Records payments (affects cash flow)
- Tracks available credit

### Credit Line
Revolving credit facilities from banks.
- Draw money when needed (DEBT_TAKE)
- Repay over time (DEBT_PAY)
- Track available credit vs used

### Term Loan
Fixed loans with set repayment schedules.
- Initial disbursement
- Regular payments
- Track principal and interest

### Loan Receivable
Money you've lent to others.
- Employee advances
- Partner loans
- Track repayments

### Investment
Investment and trading accounts.
- Stocks, bonds, funds
- Track investment performance
    `,
  },

  'accounts/balance-checkpoints': {
    title: 'Balance Checkpoints (Reconciliation)',
    content: `
## What is Reconciliation?

Reconciliation ensures your recorded transactions match your actual bank balance. It implements the "No money without origin" principle.

### Creating a Checkpoint

1. Go to the account details
2. Click **Add Checkpoint**
3. Enter:
   - **Date**: The statement date
   - **Actual Balance**: The balance shown on your bank statement
4. Click **Create**

### What Happens

The system compares:
- **Calculated Balance**: Sum of all transactions
- **Declared Balance**: What you entered

If they differ, an **adjustment transaction** is created automatically to reconcile.

### Resolving Checkpoints

After creating a checkpoint:
1. Review any adjustment transactions
2. Investigate discrepancies
3. Mark the checkpoint as **Reconciled**

### Why Use Checkpoints?

- Catch missing transactions
- Identify errors early
- Ensure data accuracy
- Required for financial audits

### Tips

- Reconcile monthly with bank statements
- Investigate any adjustments
- Don't ignore small discrepancies
    `,
  },

  'transactions/transaction-types': {
    title: 'Transaction Types',
    content: `
## Transaction Types Explained

| Type | Code | Description | Affects Cash? |
|------|------|-------------|---------------|
| Income | INC | Money received | ✅ Yes |
| Expense | EXP | Money spent | ✅ Yes |
| Transfer Out | TRF_OUT | Money to another account | ✅ Yes |
| Transfer In | TRF_IN | Money from another account | ✅ Yes |
| Debt Take | DEBT_TAKE | Borrowing money | ✅ Yes |
| Debt Pay | DEBT_PAY | Repaying debt | ✅ Yes |
| CC Charge | CC_CHARGE | Credit card purchase | ❌ No* |
| CC Pay | CC_PAY | Credit card payment | ✅ Yes |
| Loan Disburse | LOAN_DISBURSE | Lending money | ✅ Yes |
| Loan Collect | LOAN_COLLECT | Receiving repayment | ✅ Yes |
| Investment | INV | Investment transaction | ✅ Yes |

### Why CC_CHARGE Doesn't Affect Cash

We use **cash basis accounting**. When you swipe your credit card:
- The purchase is recorded (CC_CHARGE)
- But your cash hasn't changed yet
- Cash only changes when you pay the bill (CC_PAY)

This gives accurate cash flow projections.

### Which Types for Which Accounts?

- **Bank/Cash**: Most types (INC, EXP, TRF, DEBT_PAY, etc.)
- **Credit Card**: CC_CHARGE, CC_PAY, TRF
- **Credit Line**: DEBT_TAKE, DEBT_PAY only
- **Term Loan**: DEBT_TAKE, DEBT_PAY only
- **Loan Receivable**: LOAN_DISBURSE, LOAN_COLLECT only
    `,
  },

  'transactions/split-transactions': {
    title: 'Split Transactions',
    content: `
## What is Splitting?

Split a single transaction into multiple parts with different categories.

### When to Split

- Receipt with multiple expense types
- Mixed business/personal expense
- Partially refunded transactions

### How to Split

1. Select the transaction
2. Click **Split**
3. Add split rows:
   - Category for each part
   - Amount for each part
4. Ensure total equals original amount
5. Click **Save**

### Example

Original: Office supplies $100

Split into:
- Stationery (Office Supplies): $60
- Printer Ink (Equipment): $40

### Managing Splits

- Each split appears as a sub-transaction
- Original transaction shows as "Split"
- Can unsplit to restore original
- Deleting warns about all related parts
    `,
  },

  'transfers/why-match': {
    title: 'Why Match Transfers?',
    content: `
## The Problem

When you transfer $1,000 from Account A to Account B:

**Without Matching:**
- Account A shows: -$1,000 (Transfer Out)
- Account B shows: +$1,000 (Transfer In)
- Reports might count this as $2,000 in money movement!

**With Matching:**
- System knows both transactions are the same money
- Reports correctly show $1,000 internal transfer
- No double-counting

## Why It Matters

1. **Accurate Reports**: Cash flow shows real income/expenses
2. **Clear Audit Trail**: See exactly where money went
3. **Better Projections**: Future forecasts are more accurate

## When to Match

Match transfers when:
- Moving money between your own accounts
- Paying credit cards from bank accounts
- Transferring between entities

Don't match:
- Payments to external parties (use Expense)
- Income from external sources (use Income)
    `,
  },

  'transfers/how-to-match': {
    title: 'How to Match Transfers',
    content: `
## Step-by-Step Guide

### 1. Go to Transfers Page
Click **Transfers** in the sidebar.

### 2. View Unmatched Transfers
You'll see two columns:
- **Transfers Out**: Money leaving accounts
- **Transfers In**: Money entering accounts

### 3. Select Matching Pair
1. Click on one Transfer Out transaction
2. Click on the corresponding Transfer In transaction
3. Amounts should match

### 4. Match Them
Click **Match Selected Transfers**

### 5. Verify
Check the **Matched Transfers** section to confirm.

## Rules

- Amounts must be equal
- Must be from different accounts
- One must be TRF_OUT, one must be TRF_IN

## Unmatching

Made a mistake? You can unmatch:
1. Find the matched pair
2. Click **Unmatch**
3. Both return to unmatched lists
    `,
  },

  'debt/credit-cards': {
    title: 'Credit Card Management',
    content: `
## How Credit Cards Work

### Recording Purchases (CC_CHARGE)

When you buy something with a credit card:
1. Create transaction on the credit card account
2. Type: **CC_CHARGE**
3. This records the purchase but **doesn't affect cash flow**

### Recording Payments (CC_PAY)

When you pay your credit card bill:
1. Create transaction on your **bank account**
2. Type: **CC_PAY**
3. Select the credit card as destination
4. This **does affect cash flow**

### Why Separate?

**Cash Basis Accounting**: Your cash only changes when you actually pay, not when you swipe.

This gives you:
- Accurate cash flow projections
- Clear view of upcoming payments
- Proper credit card balance tracking

### Quick Payment

Use the Quick Payment feature:
1. Go to the credit card account
2. Click **Quick Payment**
3. Select source bank account
4. Enter amount
5. Done - both sides recorded automatically

### Credit Limit

Track your credit utilization:
- Set credit limit when creating account
- View available credit on account page
- Get warnings when approaching limit
    `,
  },

  // Contracts section
  'contracts/overview': {
    title: 'Contracts Overview',
    content: `
## What are Contracts?

Contracts represent recurring financial agreements that generate scheduled payments. They help you track:

- **Service Contracts**: Rent, utilities, subscriptions
- **Revenue Contracts**: Client retainers, recurring sales
- **Loan Contracts**: Term loans with repayment schedules

### Why Use Contracts?

1. **Automatic Scheduling**: Generate payment schedules automatically
2. **Cash Flow Integration**: Projected payments appear in cash flow forecasts
3. **Payment Tracking**: Track paid vs pending payments
4. **Renewal Alerts**: Get notified before contracts expire

### Contract vs Manual Transactions

| Manual Transactions | Contracts |
|---------------------|-----------|
| One-time entry | Recurring schedule |
| No future visibility | Shows in projections |
| No tracking | Payment status tracking |
| No alerts | Expiry notifications |

### Where to Find

Go to **Contracts** in the sidebar to view, create, and manage your contracts.
    `,
  },

  'contracts/create-contract': {
    title: 'Creating a Contract',
    content: `
## Creating a New Contract

### Step 1: Basic Information

1. Go to **Contracts** in the sidebar
2. Click **Add Contract**
3. Fill in the details:
   - **Name**: Descriptive name (e.g., "Office Rent - 123 Main St")
   - **Type**: Select contract type
   - **Counterparty**: The other party (landlord, vendor, client)
   - **Description**: Optional notes

### Step 2: Financial Terms

- **Amount**: Payment amount per period
- **Currency**: Payment currency
- **Payment Frequency**: How often (monthly, quarterly, etc.)
- **Account**: Which account payments come from/go to

### Step 3: Duration

- **Start Date**: When the contract begins
- **End Date**: When it expires (or leave blank for ongoing)
- **First Payment Date**: When first payment is due

### Step 4: Review & Create

1. Review the payment schedule preview
2. Click **Create Contract**
3. The system generates scheduled payments automatically

### Tips

- Use clear, descriptive names
- Set accurate start dates for proper projections
- Link to the correct account for tracking
    `,
  },

  'contracts/contract-types': {
    title: 'Contract Types',
    content: `
## Types of Contracts

### Expense Contracts (Money Out)

Recurring payments you make to others.

| Type | Examples |
|------|----------|
| **Rent** | Office rent, warehouse lease |
| **Utilities** | Electricity, water, internet |
| **Subscriptions** | Software, services |
| **Insurance** | Business insurance premiums |
| **Maintenance** | Equipment, vehicle maintenance |
| **Professional Services** | Accounting, legal retainers |

### Income Contracts (Money In)

Recurring payments you receive from others.

| Type | Examples |
|------|----------|
| **Client Retainer** | Monthly service fees |
| **Rental Income** | Property rentals |
| **Subscription Revenue** | SaaS subscriptions |
| **Licensing** | IP licensing fees |

### Loan Contracts

Debt agreements with repayment schedules.

| Type | Examples |
|------|----------|
| **Term Loan** | Bank loan with fixed payments |
| **Installment** | Equipment financing |
| **Mortgage** | Property loans |

### Choosing the Right Type

- Determines transaction type (INC, EXP, DEBT_PAY)
- Affects which accounts can be linked
- Controls how it appears in cash flow
    `,
  },

  'contracts/managing-contracts': {
    title: 'Managing Contracts',
    content: `
## Managing Your Contracts

### Viewing Contracts

Go to **Contracts** to see:
- Active contracts
- Upcoming payments
- Payment history
- Contract status

### Contract Status

| Status | Description |
|--------|-------------|
| **Active** | Currently running, payments scheduled |
| **Pending** | Starts in the future |
| **Paused** | Temporarily suspended |
| **Expired** | Past end date |
| **Cancelled** | Terminated early |

### Editing a Contract

1. Click on the contract
2. Click **Edit**
3. Modify the details
4. Future payments are updated automatically

**Note**: Past payments are not affected by edits.

### Pausing a Contract

Temporarily stop scheduled payments:
1. Select the contract
2. Click **Pause**
3. Payments stop generating
4. Resume anytime with **Activate**

### Cancelling a Contract

End a contract early:
1. Select the contract
2. Click **Cancel**
3. Choose cancellation date
4. Remaining payments are removed

### Renewing a Contract

When a contract expires:
1. Click **Renew**
2. Update terms if needed
3. Set new end date
4. New payments are scheduled

### Deleting a Contract

**Warning**: Deleting removes the contract and all scheduled payments. Consider cancelling instead to preserve history.
    `,
  },

  // Scheduled Payments section
  'scheduled-payments/overview': {
    title: 'Scheduled Payments Overview',
    content: `
## What are Scheduled Payments?

Scheduled payments are future payments that appear in your cash flow projections. They come from:

1. **Contracts**: Automatically generated from active contracts
2. **Manual Schedules**: One-off scheduled payments you create
3. **Loan Schedules**: From term loans and credit facilities

### Why Schedule Payments?

- **Accurate Projections**: Cash flow shows what's actually coming
- **Payment Reminders**: Don't miss important payments
- **Budget Planning**: Plan ahead for known expenses
- **What-If Analysis**: See impact before committing

### Scheduled vs Actual

| Scheduled | Actual |
|-----------|--------|
| Future payment plan | Real transaction recorded |
| Appears in projections | Affects account balance |
| Can be modified | Historical record |
| No accounting impact | Part of financial records |

### Finding Scheduled Payments

- **Cash Flow**: See scheduled payments by month
- **Contracts**: View payments per contract
- **Scheduled Payments Page**: All scheduled payments in one place
    `,
  },

  'scheduled-payments/create-schedule': {
    title: 'Creating a Scheduled Payment',
    content: `
## Creating Manual Scheduled Payments

For one-off or irregular future payments not tied to contracts.

### Step 1: Go to Scheduled Payments

Click **Scheduled Payments** in the sidebar.

### Step 2: Click Add Payment

Click **Add Scheduled Payment**.

### Step 3: Enter Details

- **Name**: Description of the payment
- **Type**: Expense, Income, or Transfer
- **Amount**: Payment amount
- **Category**: Expense/income category
- **Account**: Source or destination account

### Step 4: Set Schedule

Choose one of:

**One-Time Payment**
- Set the exact date
- Payment appears only once

**Recurring Payment**
- Frequency: Daily, Weekly, Monthly, etc.
- Start date
- End date (or number of occurrences)

### Step 5: Additional Options

- **Notes**: Add context or reminders
- **Auto-Record**: Automatically create transaction when due
- **Notification**: Get reminded before due date

### Example Use Cases

- Annual insurance premium (yearly, manual)
- Quarterly tax payment (quarterly)
- One-time equipment purchase (one-time)
- Employee bonus (yearly)
    `,
  },

  'scheduled-payments/payment-frequencies': {
    title: 'Payment Frequencies',
    content: `
## Available Frequencies

### One-Time
A single payment on a specific date.
- Equipment purchases
- One-off consulting fees
- Initial deposits

### Daily
Payment every day.
- Daily cash receipts
- Daily operational costs

### Weekly
Payment every week on a specific day.
- Weekly payroll
- Weekly supplier payments

### Bi-Weekly
Payment every two weeks.
- Bi-weekly payroll
- Fortnightly rent

### Monthly
Payment once a month.
- Rent
- Subscriptions
- Loan payments
- Utilities

### Quarterly
Payment every three months.
- Quarterly taxes
- Quarterly bonuses
- Insurance premiums

### Semi-Annually
Payment twice a year.
- Semi-annual reviews
- Bi-annual fees

### Annually
Payment once a year.
- Annual licenses
- Yearly insurance
- Annual bonuses

### Custom
Specific dates you define.
- Irregular payment schedules
- Contract milestones

### Tips

- Match frequency to actual payment terms
- Use quarterly for VAT/tax payments
- Monthly is most common for subscriptions
    `,
  },

  'scheduled-payments/managing-schedules': {
    title: 'Managing Scheduled Payments',
    content: `
## Managing Your Scheduled Payments

### Viewing Schedules

The Scheduled Payments page shows:
- Upcoming payments (next 30/60/90 days)
- Overdue payments
- Payment calendar
- Source (contract or manual)

### Payment Status

| Status | Description |
|--------|-------------|
| **Scheduled** | Future payment, not yet due |
| **Due** | Payment date reached |
| **Overdue** | Past due date, not paid |
| **Paid** | Payment recorded |
| **Skipped** | Intentionally skipped |

### Recording a Payment

When a scheduled payment is due:
1. Click on the payment
2. Click **Record Payment**
3. Confirm the details
4. Transaction is created automatically

### Skipping a Payment

If a payment won't happen:
1. Select the payment
2. Click **Skip**
3. Add reason (optional)
4. Payment marked as skipped

### Editing a Schedule

For manual schedules:
1. Click on the schedule
2. Click **Edit**
3. Modify details
4. Future payments update

**Note**: Contract-linked schedules must be edited via the contract.

### Deleting a Schedule

For manual schedules only:
1. Select the schedule
2. Click **Delete**
3. Confirm deletion

**Tip**: Historical paid/skipped records are preserved.

### Bulk Actions

Select multiple payments to:
- Record all as paid
- Skip selected
- Change dates (for manual schedules)
    `,
  },

  'cash-flow/projections': {
    title: 'Understanding Cash Flow Projections',
    content: `
## Reading the Projection Table

Each month shows:

| Row | Description |
|-----|-------------|
| **Opening Balance** | Balance at start of month |
| **Projected Income** | Expected income based on history |
| **Projected Expenses** | Expected expenses based on history |
| **Scheduled Payments** | Payments from contracts |
| **Debt Payments** | Loan repayments due |
| **Closing Balance** | Expected balance at end of month |

## Health Status

- 🟢 **Surplus**: Positive cash flow, healthy
- 🟡 **Tight**: Positive but low buffer
- 🔴 **Deficit**: Negative - action needed

## How Projections are Calculated

1. **Income**: Based on historical income patterns
2. **Expenses**: Based on historical expense patterns
3. **Scheduled**: From your contracts/scheduled payments
4. **Debt**: From loan repayment schedules

## Improving Accuracy

- Import more historical data
- Categorize all transactions
- Set up scheduled payments
- Record all debt properly
    `,
  },

  'cash-flow/scenarios': {
    title: 'Cash Flow Scenarios',
    content: `
## What-If Analysis

Scenarios let you test financial decisions before making them.

## Creating a Scenario

1. Go to **Cash Flow**
2. Click **Create Scenario**
3. Name your scenario
4. Add adjustments

## Adjustment Types

### One-Time Income/Expense
A single event in one month.
- Example: "Equipment purchase in March: -$5,000"

### Recurring Income/Expense
Regular monthly changes.
- Example: "New subscription: -$100/month"

### Debt Drawdown
Borrowing from credit line or loan.
- Amount borrowed
- Repayment terms

### Modify Predicted Expenses
Percentage change to all predicted expenses.
- Example: "Cut costs by 20%"

### Modify Income
Percentage change to all predicted income.
- Example: "Revenue growth 10%"

### Exclude Scheduled Payments
Remove specific scheduled payments from projection.

## Comparing Scenarios

View multiple scenarios side by side to compare outcomes.

## Use Cases

- "What if we take a loan?"
- "What if revenue drops 30%?"
- "What if we cut expenses 20%?"
- "Can we afford this purchase?"
    `,
  },

  'team/roles': {
    title: 'Roles & Permissions',
    content: `
## Role Hierarchy

### Owner
- Full control of the entity
- Can manage team members
- Can delete the entity
- Can do everything

### Admin
- Full access to all data
- Can create/edit/delete everything
- Cannot manage team members
- Cannot delete entity

### Editor
- Can view all data
- Can create transactions
- Can edit transactions
- Can delete transactions
- Cannot manage settings

### Data Entry
- Can view data
- Can create transactions
- Can edit own transactions
- Limited delete access

### Viewer
- Read-only access
- Can view all data
- Cannot create or modify anything

## Permission Matrix

| Action | Owner | Admin | Editor | Data Entry | Viewer |
|--------|-------|-------|--------|------------|--------|
| View data | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create transactions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit transactions | ✅ | ✅ | ✅ | Own only | ❌ |
| Delete transactions | ✅ | ✅ | ✅ | Limited | ❌ |
| Manage accounts | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite members | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete entity | ✅ | ❌ | ❌ | ❌ | ❌ |
    `,
  },

  'faq/common-questions': {
    title: 'Frequently Asked Questions',
    content: `
## Common Questions

### Why doesn't my credit card purchase affect cash flow?

We use **cash basis accounting**. Credit card purchases (CC_CHARGE) don't affect your cash until you pay the bill (CC_PAY). This gives more accurate cash flow projections.

### What's the difference between Transfer and Expense?

- **Transfer**: Money moving between YOUR accounts
- **Expense**: Money leaving your control entirely

Use Transfer for internal movements, Expense for payments to others.

### Why do I need to match transfers?

Without matching, a transfer from Account A to Account B looks like both an expense AND income. Matching tells the system "this is the same money" to prevent double-counting.

### What is a balance checkpoint?

A reconciliation point where you declare the actual balance (from your bank statement). If it differs from calculated balance, the system creates an adjustment. This catches missing transactions.

### Can I have multiple entities?

Yes! Create separate entities for:
- Different businesses
- Personal vs business finances
- Different investment portfolios

### What happens if I delete a transaction?

- If part of a split: You'll be warned about related splits
- If matched transfer: Match will be broken
- If checkpointed: May require checkpoint rollback

### How far back should I import?

At least 3-6 months of history gives better projections. More history = more accurate predictions.

### Can I undo an import?

You can delete imported transactions, but it's tedious. Better to review carefully before confirming import.
    `,
  },
};

// Helper function to get content by section ID
export function getHelpContent(sectionId: string): { title: string; content: string } | null {
  return helpContent[sectionId] || null;
}

// Helper function to get parent section
export function getParentSection(sectionId: string): string | null {
  const parts = sectionId.split('/');
  if (parts.length > 1) {
    return parts[0];
  }
  return null;
}

// Helper to find section in navigation
export function findNavItem(sectionId: string): HelpNavItem | null {
  for (const section of helpNavigation) {
    if (section.id === sectionId) return section;
    if (section.children) {
      const child = section.children.find(c => c.id === sectionId);
      if (child) return child;
    }
  }
  return null;
}
