# Help Documentation Outline

## Overview

A right-side sliding panel help system with contextual documentation. Users can access via:
1. Help button in header/sidebar
2. `?` icons next to complex features (links to specific section)

---

## Documentation Structure

```
/help
├── getting-started/
│   ├── welcome
│   ├── first-entity
│   ├── first-account
│   └── first-import
├── accounts/
│   ├── overview
│   ├── account-types
│   ├── create-account
│   ├── import-transactions
│   └── balance-checkpoints
├── transactions/
│   ├── overview
│   ├── transaction-types
│   ├── add-transaction
│   ├── categorize
│   ├── split-transactions
│   └── receipts
├── transfers/
│   ├── overview
│   ├── why-match-transfers
│   └── how-to-match
├── debt-management/
│   ├── overview
│   ├── credit-cards
│   ├── credit-lines
│   ├── term-loans
│   └── tracking-payments
├── loans-receivable/
│   ├── overview
│   ├── recording-loans
│   └── tracking-collections
├── budgets/
│   ├── overview
│   ├── create-budget
│   └── tracking-spending
├── scheduled-payments/
│   ├── overview
│   ├── contracts
│   └── payment-tracking
├── cash-flow/
│   ├── overview
│   ├── understanding-projections
│   └── scenarios
├── reports/
│   ├── overview
│   ├── income-expense
│   ├── debt-position
│   └── category-breakdown
├── team/
│   ├── roles-permissions
│   └── inviting-members
└── faq/
    └── common-questions
```

---

## Content Outline by Section

### 1. Getting Started

#### 1.1 Welcome
- What is Finance SaaS?
- Key features overview
- Quick navigation guide

#### 1.2 Creating Your First Entity
- What is an entity? (Company vs Personal)
- Step-by-step: Create entity
- When to use multiple entities

#### 1.3 Setting Up Your First Account
- Account types explained (Bank, Cash, Credit Card, etc.)
- Step-by-step: Create account
- Setting initial balance

#### 1.4 Importing Bank Transactions
- Supported file formats (CSV, Excel)
- Step-by-step: Import process
- Column mapping explained
- Handling import errors

---

### 2. Accounts

#### 2.1 Overview
- Account list view
- Account groups (Banks & Cash, Assets, Liabilities)
- Account balance display

#### 2.2 Account Types Explained
| Type | Purpose | Example |
|------|---------|---------|
| Bank | Checking/savings accounts | VCB, ACB |
| Cash | Physical cash | Petty cash |
| Credit Card | Credit cards | Visa, Mastercard |
| Credit Line | Revolving credit | Business credit line |
| Term Loan | Fixed loans | Bank loan |
| Loan Receivable | Money you lent | Employee loan |
| Investment | Investment accounts | Stocks, bonds |

#### 2.3 Creating an Account
- Required fields
- Currency selection
- Initial balance vs opening transaction

#### 2.4 Importing Transactions
- Preparing your bank statement
- Auto-detection features
- Date format handling
- Debit/Credit column detection
- Review before import

#### 2.5 Balance Checkpoints (Reconciliation)
- What is reconciliation?
- Creating a checkpoint
- Handling discrepancies
- Automatic adjustment transactions

---

### 3. Transactions

#### 3.1 Overview
- Transaction list view
- Filtering and search
- Simple vs Advanced mode

#### 3.2 Transaction Types Explained
| Type | Code | Description | Affects Cash? |
|------|------|-------------|---------------|
| Income | INC | Money received | Yes |
| Expense | EXP | Money spent | Yes |
| Transfer Out | TRF_OUT | Money to another account | Yes |
| Transfer In | TRF_IN | Money from another account | Yes |
| Debt Take | DEBT_TAKE | Borrowing money | Yes |
| Debt Pay | DEBT_PAY | Repaying debt | Yes |
| CC Charge | CC_CHARGE | Credit card purchase | No* |
| CC Pay | CC_PAY | Credit card payment | Yes |
| Loan Disburse | LOAN_DISBURSE | Lending money | Yes |
| Loan Collect | LOAN_COLLECT | Receiving repayment | Yes |
| Investment | INV | Investment transaction | Yes |

*CC_CHARGE doesn't affect cash flow (cash basis accounting)

#### 3.3 Adding a Transaction
- Selecting account
- Choosing direction (Money In/Out)
- Available transaction types per account
- Category selection
- Adding notes and references

#### 3.4 Categorizing Transactions
- Why categories matter
- Creating custom categories
- Bulk categorization

#### 3.5 Splitting Transactions
- When to split (mixed expenses)
- How to split step-by-step
- Managing split parts

#### 3.6 Attaching Receipts
- Supported file types
- Uploading receipts
- Viewing attachments

---

### 4. Transfer Matching

#### 4.1 Overview
- What is transfer matching?
- Why it matters for accurate reporting

#### 4.2 Why Match Transfers?
- **Problem**: Transfer from Account A to Account B creates 2 transactions
- **Without matching**: Reports show double the money movement
- **With matching**: System knows they're the same money

#### 4.3 How to Match Transfers
1. Go to Transfers page
2. View unmatched "Transfers Out" and "Transfers In"
3. Select one Transfer Out (money leaving)
4. Select one Transfer In (money arriving)
5. Click "Match Selected Transfers"
6. Verify in Matched Transfers section

**Rules:**
- Amounts must match
- Must be different accounts
- Can unmatch if needed

---

### 5. Debt Management

#### 5.1 Overview
- Types of debt accounts
- Debt tracking workflow

#### 5.2 Credit Cards
- **Recording purchases**: Use CC_CHARGE (doesn't affect cash)
- **Recording payments**: Use CC_PAY (affects cash)
- **Why separate?**: Cash basis accounting - cash flow only changes when you pay
- Quick payment feature

#### 5.3 Credit Lines
- What is a credit line?
- Recording drawdowns (DEBT_TAKE)
- Recording repayments (DEBT_PAY)
- Tracking available credit

#### 5.4 Term Loans
- What is a term loan?
- Recording loan disbursement
- Tracking repayment schedule
- Interest tracking

#### 5.5 Matching Debt Transactions
- Linking drawdowns to repayments
- Viewing debt history
- Understanding debt position

---

### 6. Loans Receivable

#### 6.1 Overview
- What are loans receivable?
- When to use (employee loans, partner loans)

#### 6.2 Recording Loans Given
- Creating loan receivable account
- Recording disbursement (LOAN_DISBURSE)
- Setting loan terms (amount, due date, interest)
- Business partner setup

#### 6.3 Tracking Collections
- Recording payments received (LOAN_COLLECT)
- Partial payments
- Loan status (active, overdue, repaid, written off)

---

### 7. Budgets

#### 7.1 Overview
- What are budgets?
- Budget health indicators

#### 7.2 Creating a Budget
- Selecting category
- Setting amount
- Choosing period (monthly, quarterly, yearly)
- Start and end dates

#### 7.3 Tracking Spending
- Budget progress bar
- Health status meanings:
  - ✅ On Track: Under budget
  - ⚠️ Warning: 80-100% used
  - ❌ Exceeded: Over budget
- Timeline vs Cards view

---

### 8. Scheduled Payments

#### 8.1 Overview
- What are scheduled payments?
- Difference from budgets

#### 8.2 Contracts
- Contract types (Lease, Service, Construction, Subscription)
- Creating a contract
- Linking payments to contracts

#### 8.3 Payment Tracking
- Payment instances (upcoming, paid, overdue)
- Marking payments as paid
- Viewing payment timeline

---

### 9. Cash Flow Projection

#### 9.1 Overview
- What is cash flow projection?
- Reading the projection table

#### 9.2 Understanding Projections
- **Opening Balance**: Start of month
- **Projected Income**: Expected income
- **Projected Expenses**: Expected expenses
- **Scheduled Payments**: From contracts
- **Debt Payments**: Loan repayments due
- **Closing Balance**: End of month

**Health Status:**
- 🟢 Surplus: Positive cash flow
- 🟡 Tight: Low but positive
- 🔴 Deficit: Negative cash flow

#### 9.3 Scenarios (What-If Analysis)
- Creating a scenario
- Types of adjustments:
  - One-time income/expense
  - Recurring income/expense
  - Debt drawdown
  - Modify predicted expenses (%)
  - Modify income (%)
  - Exclude scheduled payments
- Comparing scenarios

---

### 10. Reports

#### 10.1 Overview
- Available reports
- Date range selection

#### 10.2 Income vs Expense
- Trend chart explanation
- Granularity options (week, month, year)

#### 10.3 Debt Position
- Total liabilities breakdown
- By account type

#### 10.4 Category Breakdown
- Expense distribution pie chart
- Category totals

---

### 11. Team Management

#### 11.1 Roles & Permissions
| Role | View | Create | Edit | Delete | Manage Team |
|------|------|--------|------|--------|-------------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editor | ✅ | ✅ | ✅ | ✅ | ❌ |
| Data Entry | ✅ | ✅ | ✅ | Limited | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |

#### 11.2 Inviting Team Members
- How to invite
- Role selection
- Managing existing members

---

### 12. FAQ

#### Common Questions

**Q: Why doesn't my credit card purchase affect my cash flow?**
A: We use cash basis accounting. CC_CHARGE records the purchase but doesn't affect cash until you pay (CC_PAY).

**Q: What's the difference between Transfer and Expense?**
A: Transfer moves money between YOUR accounts. Expense is money leaving your control entirely.

**Q: Why do I need to match transfers?**
A: To prevent double-counting. Without matching, a transfer shows as both expense (from) and income (to).

**Q: What is a balance checkpoint?**
A: A reconciliation point where you declare the actual balance. System creates adjustments if needed.

**Q: Can I have multiple entities?**
A: Yes! Create separate entities for different businesses or personal/business separation.

**Q: What happens if I delete a transaction?**
A: If it's part of a split or match, you'll be warned. Checkpointed transactions may require rollback.

---

## Implementation Notes

### Help Panel Component
- Slides in from right (400-500px width)
- Search bar at top
- Table of contents navigation
- Markdown content rendering
- Close button
- Breadcrumb for nested sections

### Contextual Help (`?` Icons)
- Place next to complex features
- Click opens help panel to specific section
- Examples:
  - Transfer matching page → `/help/transfers/why-match-transfers`
  - Cash flow projection → `/help/cash-flow/understanding-projections`
  - Transaction type dropdown → `/help/transactions/transaction-types`

### Content Storage
- Markdown files in `/content/help/` directory
- Or: JSON structure in `/messages/` for i18n support
- Load dynamically based on section

### Future Enhancements
- Search across all help content
- Video tutorials (embedded)
- Interactive walkthroughs
- "Was this helpful?" feedback
- Recently viewed sections
