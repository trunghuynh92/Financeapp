# Scheduled Payments System - Implementation Plan
**Date**: January 17, 2025
**Feature**: Fixed/Scheduled Payment Tracking System
**Status**: Planning Phase

## Overview

Implement a comprehensive scheduled payments system to track contractual payment obligations (leases, service contracts, construction milestones, subscriptions). This system works alongside the existing budget system to provide a complete financial planning picture.

## System Architecture

### Three-Layer Financial Planning Hierarchy:
1. **Priority 1: Debt Payments** (Existing - loan_receivable system)
2. **Priority 2: Scheduled Payments** (NEW - This implementation)
3. **Priority 3: Budgets** (Existing - category_budgets system)

## Database Schema

### Tables to Create:

```sql
-- Main contract/agreement table
scheduled_payments
├── scheduled_payment_id (SERIAL PRIMARY KEY)
├── entity_id (UUID, FK to entities)
├── category_id (INTEGER, FK to categories)
├── contract_name (VARCHAR(255)) -- "Office Lease 2025"
├── contract_type (VARCHAR(50)) -- lease, service, construction, subscription
├── payee_name (VARCHAR(255)) -- Who to pay
├── payment_amount (DECIMAL(15,2))
├── schedule_type (VARCHAR(20)) -- recurring, one_time, custom_dates
├── frequency (VARCHAR(20)) -- monthly, quarterly, yearly, custom
├── payment_day (INTEGER) -- Day of month (1-31)
├── start_date (DATE)
├── end_date (DATE) -- Optional, for fixed-term contracts
├── custom_schedule (JSONB) -- Array of specific dates
├── status (VARCHAR(20)) -- active, completed, cancelled
├── contract_number (VARCHAR(100))
├── notes (TEXT)
├── is_active (BOOLEAN DEFAULT TRUE)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── created_by (UUID, FK to auth.users)

-- Individual payment instances (generated from schedule)
scheduled_payment_instances
├── instance_id (SERIAL PRIMARY KEY)
├── scheduled_payment_id (INTEGER, FK)
├── due_date (DATE)
├── amount (DECIMAL(15,2))
├── status (VARCHAR(20)) -- pending, paid, overdue, cancelled
├── paid_date (DATE)
├── paid_amount (DECIMAL(15,2))
├── transaction_id (INTEGER, FK to main_transaction)
├── notes (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

## Implementation Phases

### Phase 1: Database Layer
**Goal**: Create database schema with RLS policies

#### Tasks:
- [ ] Create migration 059: `059_create_scheduled_payments.sql`
  - [ ] Create `scheduled_payments` table with all fields
  - [ ] Create `scheduled_payment_instances` table
  - [ ] Add indexes for performance
  - [ ] Create RLS policies (entity-based access control)
  - [ ] Add constraints (valid dates, amounts > 0)
  - [ ] Create view: `scheduled_payment_overview` (with instance counts, next due date)
  - [ ] Create function: `generate_payment_instances()` to auto-generate instances from schedule
  - [ ] Create function: `mark_payment_as_paid()` to link instance to transaction
  - [ ] Add comments for documentation

#### RLS Policies Needed:
- Users can view scheduled payments for their entities
- Editors/Admins/Owners can insert/update/delete scheduled payments
- Viewers have read-only access

#### Functions Needed:
```sql
-- Generate instances for recurring payments
generate_payment_instances(p_scheduled_payment_id, p_months_ahead)

-- Mark instance as paid and link to transaction
mark_payment_as_paid(p_instance_id, p_transaction_id, p_paid_amount, p_paid_date)

-- Get overdue payment count
get_overdue_payment_count(p_entity_id)

-- Get upcoming payments (next N days)
get_upcoming_payments(p_entity_id, p_days_ahead)
```

### Phase 2: TypeScript Types
**Goal**: Define type-safe interfaces

#### Tasks:
- [ ] Create `/types/scheduled-payment.ts`
  - [ ] Define `ScheduleType` enum
  - [ ] Define `PaymentFrequency` enum
  - [ ] Define `ContractType` enum
  - [ ] Define `PaymentInstanceStatus` enum
  - [ ] Define `ScheduledPayment` interface
  - [ ] Define `ScheduledPaymentInstance` interface
  - [ ] Define `ScheduledPaymentOverview` interface (with instance data)
  - [ ] Define `CreateScheduledPaymentRequest` interface
  - [ ] Define `UpdateScheduledPaymentRequest` interface
  - [ ] Define `MarkAsPaidRequest` interface

#### Example Types:
```typescript
export type ScheduleType = 'recurring' | 'one_time' | 'custom_dates'
export type PaymentFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom'
export type ContractType = 'lease' | 'service' | 'construction' | 'subscription' | 'other'
export type PaymentInstanceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface ScheduledPayment {
  scheduled_payment_id: number
  entity_id: string
  category_id: number
  contract_name: string
  contract_type: ContractType
  payee_name: string
  payment_amount: number
  schedule_type: ScheduleType
  frequency: PaymentFrequency
  payment_day: number | null
  start_date: string
  end_date: string | null
  custom_schedule: string[] | null
  status: string
  contract_number: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}
```

### Phase 3: API Endpoints
**Goal**: Create REST API for scheduled payments

#### Endpoints to Create:

##### `/api/scheduled-payments` (GET, POST)
- [ ] **GET**: List all scheduled payments
  - Query params: entity_id, status, contract_type, active_only
  - Return: Array of scheduled payments with instance summaries
  - Include: next_due_date, overdue_count, total_paid, total_pending

- [ ] **POST**: Create new scheduled payment
  - Validate: Required fields, amount > 0, valid dates
  - Auto-generate instances if recurring
  - Return: Created scheduled payment with first N instances

##### `/api/scheduled-payments/[id]` (GET, PATCH, DELETE)
- [ ] **GET**: Get single scheduled payment with all instances
- [ ] **PATCH**: Update scheduled payment
  - If schedule changes, regenerate instances
- [ ] **DELETE**: Soft delete (set is_active=false, status='cancelled')

##### `/api/scheduled-payments/[id]/instances` (GET, POST)
- [ ] **GET**: List all instances for a scheduled payment
- [ ] **POST**: Generate more instances (extend schedule)

##### `/api/scheduled-payment-instances/[id]` (GET, PATCH)
- [ ] **GET**: Get single instance details
- [ ] **PATCH**: Update instance (mark as paid, change amount, etc.)

##### `/api/scheduled-payment-instances/[id]/mark-paid` (POST)
- [ ] **POST**: Mark instance as paid
  - Link to transaction_id
  - Update paid_date, paid_amount
  - Optionally create transaction if not exists

#### API Response Examples:
```typescript
// GET /api/scheduled-payments
{
  data: [
    {
      scheduled_payment_id: 1,
      contract_name: "Office Lease 2025",
      payment_amount: 50000000,
      payee_name: "ABC Properties",
      frequency: "monthly",
      next_due_date: "2025-02-05",
      overdue_count: 0,
      pending_count: 12,
      total_paid: 50000000,
      total_pending: 600000000
    }
  ]
}
```

### Phase 4: UI Components
**Goal**: Create user interface for managing scheduled payments

#### Main Pages:

##### `/app/dashboard/scheduled-payments/page.tsx`
- [ ] Create main scheduled payments page
- [ ] Summary cards:
  - [ ] Total active contracts
  - [ ] Total monthly obligation
  - [ ] Upcoming payments (next 30 days)
  - [ ] Overdue payments count
- [ ] Filters:
  - [ ] By contract type
  - [ ] By status
  - [ ] By payee
- [ ] List view:
  - [ ] Show contract name, payee, amount, frequency
  - [ ] Next due date indicator
  - [ ] Status badges
  - [ ] Quick actions (view, edit, mark as paid)
- [ ] Empty state with "Create First Contract" CTA

##### `/app/dashboard/scheduled-payments/[id]/page.tsx`
- [ ] Create detail page for single scheduled payment
- [ ] Contract information card
- [ ] Payment timeline/history
- [ ] List of all instances (past and future)
- [ ] Payment actions (mark as paid, skip, reschedule)

#### Dialogs/Components:

##### `/components/scheduled-payments/CreateScheduledPaymentDialog.tsx`
- [ ] Create/edit dialog for scheduled payments
- [ ] Form fields:
  - [ ] Contract name (required)
  - [ ] Payee name (required)
  - [ ] Category selection (expense categories)
  - [ ] Contract type selection
  - [ ] Payment amount (required)
  - [ ] Schedule type (recurring/one-time/custom dates)
  - [ ] Frequency (if recurring)
  - [ ] Payment day (if recurring)
  - [ ] Start date, End date (optional)
  - [ ] Custom schedule (if custom dates)
  - [ ] Contract number
  - [ ] Notes
- [ ] Smart defaults:
  - [ ] Start date: First day of next month
  - [ ] Payment day: 5th of month
- [ ] Validation:
  - [ ] Required fields
  - [ ] Amount > 0
  - [ ] Valid date ranges
  - [ ] Custom schedule dates in order
- [ ] Preview: Show next 3-6 payment dates before saving

##### `/components/scheduled-payments/ScheduledPaymentList.tsx`
- [ ] List component with card view
- [ ] Each card shows:
  - [ ] Contract name and type
  - [ ] Payee name
  - [ ] Payment amount
  - [ ] Frequency badge
  - [ ] Next due date
  - [ ] Status indicator
  - [ ] Edit/Delete buttons

##### `/components/scheduled-payments/PaymentInstanceList.tsx`
- [ ] Timeline of payment instances
- [ ] Group by month
- [ ] Color coding:
  - [ ] Green: Paid
  - [ ] Yellow: Pending (upcoming)
  - [ ] Red: Overdue
  - [ ] Gray: Cancelled
- [ ] Click to mark as paid
- [ ] Link to actual transaction if paid

##### `/components/scheduled-payments/MarkAsPaidDialog.tsx`
- [ ] Dialog to mark instance as paid
- [ ] Fields:
  - [ ] Paid date (default: today)
  - [ ] Paid amount (default: due amount, allow partial)
  - [ ] Link to existing transaction OR create new
  - [ ] Notes
- [ ] Validation: paid_amount <= due_amount + reasonable buffer

#### Navigation:
- [ ] Add "Scheduled Payments" to sidebar
  - [ ] Icon: Calendar or FileContract
  - [ ] Position: Between "Budgets" and "Reports"
  - [ ] Badge showing overdue count

### Phase 5: Cash Flow Projection (Integration)
**Goal**: Unified view combining debt, scheduled payments, and budgets

#### `/app/dashboard/cash-flow/page.tsx`
- [ ] Create new cash flow projection page
- [ ] Time period selector (3/6/12 months)
- [ ] Summary section:
  - [ ] Current cash balance
  - [ ] Total obligations (next N months)
  - [ ] Available for discretionary spending
  - [ ] Lowest projected balance (runway warning)

##### Monthly Breakdown View:
- [ ] For each month, show:
  - [ ] Opening balance
  - [ ] Projected income (from historical average or user input)
  - [ ] **Priority 1: Debt Payments**
    - [ ] List all debt payments due
    - [ ] Subtotal
  - [ ] **Priority 2: Scheduled Payments**
    - [ ] List all scheduled payments due
    - [ ] Subtotal
  - [ ] **Priority 3: Budgets**
    - [ ] List active budgets (estimated spend)
    - [ ] Subtotal
  - [ ] Closing balance
  - [ ] Health indicator (surplus/deficit)

##### Visualization:
- [ ] Waterfall chart showing cash flow
- [ ] Stacked bar chart (debt + scheduled + budget)
- [ ] Running balance line graph
- [ ] Warning indicators for negative balances

#### API Endpoint:
##### `/api/cash-flow-projection` (GET)
- [ ] Query params: entity_id, start_month, months_ahead
- [ ] Fetch debt payments (from loan_receivable)
- [ ] Fetch scheduled payment instances
- [ ] Fetch active budgets
- [ ] Calculate monthly projections
- [ ] Return structured data for visualization

```typescript
interface MonthlyProjection {
  month: string // "2025-02"
  opening_balance: number
  projected_income: number
  debt_payments: {
    type: 'interest' | 'principal'
    loan_name: string
    amount: number
    due_date: string
  }[]
  scheduled_payments: {
    contract_name: string
    amount: number
    due_date: string
    status: string
  }[]
  budgets: {
    category_name: string
    budget_amount: number
    estimated_spend: number
  }[]
  total_obligations: number
  total_budgets: number
  closing_balance: number
  health: 'surplus' | 'tight' | 'deficit'
}
```

### Phase 6: Advanced Features
**Goal**: Enhance user experience with smart features

#### Auto-linking Transactions:
- [ ] When creating a transaction near a due date, suggest scheduled payment
- [ ] Matching logic:
  - [ ] Same category
  - [ ] Amount within 10% of due amount
  - [ ] Transaction date within 7 days of due date
- [ ] Show suggestion dialog: "Link to scheduled payment?"

#### Alerts & Notifications:
- [ ] Dashboard widget showing:
  - [ ] Payments due this week
  - [ ] Overdue payments
  - [ ] Upcoming large payments
- [ ] (Future) Email notifications:
  - [ ] 7 days before due date
  - [ ] 1 day before due date
  - [ ] On due date if not paid

#### Reporting:
- [ ] **Contract Summary Report**
  - [ ] Total active contracts
  - [ ] Total monthly obligation
  - [ ] Contract expiry calendar
- [ ] **Payment History Report**
  - [ ] All payments in date range
  - [ ] Filter by payee, contract type, status
  - [ ] Export to CSV
- [ ] **Cash Commitment Report**
  - [ ] Total committed for next 3/6/12 months
  - [ ] By category breakdown

#### Smart Features:
- [ ] **Escalation Support**:
  - [ ] Add escalation_rate and escalation_frequency
  - [ ] Auto-adjust amounts over time (e.g., 5% annual increase)
- [ ] **Partial Payments**:
  - [ ] Allow marking instance as partially paid
  - [ ] Track remaining balance
  - [ ] Generate reminder for remaining amount
- [ ] **Contract Templates**:
  - [ ] Save common contract setups as templates
  - [ ] Quick create from template

### Phase 7: Testing & Documentation
**Goal**: Ensure quality and provide user guidance

#### Testing Checklist:
- [ ] Database:
  - [ ] Run migration 059
  - [ ] Verify tables, indexes, RLS policies
  - [ ] Test generate_payment_instances() function
  - [ ] Test mark_payment_as_paid() function
  - [ ] Test with multiple entities (RLS isolation)
- [ ] API:
  - [ ] Test all CRUD operations
  - [ ] Test with invalid data (validation)
  - [ ] Test instance generation
  - [ ] Test mark as paid flow
- [ ] UI:
  - [ ] Create scheduled payment (all schedule types)
  - [ ] Edit scheduled payment
  - [ ] Delete scheduled payment
  - [ ] Mark instance as paid
  - [ ] View payment history
  - [ ] Test filters and search
- [ ] Integration:
  - [ ] Cash flow projection shows all data correctly
  - [ ] Auto-linking suggestion works
  - [ ] Navigation and routing
- [ ] Edge Cases:
  - [ ] Payment on 31st (months with < 31 days)
  - [ ] Leap year handling
  - [ ] Contract expiry handling
  - [ ] Partial payment tracking
  - [ ] Cancelled contract behavior

#### Documentation:
- [ ] **User Guide** (`docs/features/scheduled-payments-guide.md`)
  - [ ] What are scheduled payments?
  - [ ] How to create a contract
  - [ ] How to mark payments as paid
  - [ ] Understanding payment statuses
  - [ ] Cash flow projection explained
- [ ] **Technical Documentation** (`docs/architecture/scheduled-payments-system.md`)
  - [ ] Database schema
  - [ ] API reference
  - [ ] Business logic
  - [ ] Integration points
- [ ] **Migration Guide** (`docs/migrations/059-scheduled-payments.md`)
  - [ ] What changed
  - [ ] How to run migration
  - [ ] Verification steps

## File Structure

```
/database/migrations/
  059_create_scheduled_payments.sql

/types/
  scheduled-payment.ts

/app/api/
  scheduled-payments/
    route.ts (GET, POST)
    [id]/
      route.ts (GET, PATCH, DELETE)
      instances/
        route.ts (GET, POST)
  scheduled-payment-instances/
    [id]/
      route.ts (GET, PATCH)
      mark-paid/
        route.ts (POST)
  cash-flow-projection/
    route.ts (GET)

/app/dashboard/
  scheduled-payments/
    page.tsx (main list)
    [id]/
      page.tsx (detail view)
  cash-flow/
    page.tsx (projection view)

/components/
  scheduled-payments/
    CreateScheduledPaymentDialog.tsx
    ScheduledPaymentList.tsx
    ScheduledPaymentCard.tsx
    PaymentInstanceList.tsx
    MarkAsPaidDialog.tsx
  cash-flow/
    CashFlowTimeline.tsx
    MonthlyProjection.tsx
    ProjectionChart.tsx

/lib/
  scheduled-payment-utils.ts (helper functions)

/docs/
  features/
    scheduled-payments-guide.md
  architecture/
    scheduled-payments-system.md
  migrations/
    059-scheduled-payments.md
```

## Dependencies

### Existing:
- Supabase (database)
- Next.js 14 (framework)
- TypeScript (types)
- shadcn/ui (components)
- date-fns (date manipulation)

### New (if needed):
- recharts (for cash flow charts) - might already be installed
- react-day-picker (for custom schedule date picker) - if not already available

## Integration Points

### With Existing Systems:

1. **Categories System**:
   - Scheduled payments use existing expense categories
   - Filter scheduled payments by category

2. **Transaction System**:
   - Link scheduled payment instances to actual transactions
   - Auto-suggest linking when creating transactions
   - Show scheduled payment reference in transaction details

3. **Budget System**:
   - Cash flow projection combines both
   - Budget recommendations consider scheduled payments
   - "Available for budgets" = Income - Debt - Scheduled Payments

4. **Loan/Receivable System**:
   - Cash flow projection includes debt payments
   - Unified timeline view

5. **Entity System**:
   - RLS policies based on entity membership
   - Multi-entity support

## Success Criteria

### Phase 1-3 (Core System):
- [ ] Can create scheduled payments (recurring and custom dates)
- [ ] Instances are auto-generated correctly
- [ ] Can mark instances as paid
- [ ] All CRUD operations work
- [ ] RLS policies enforce access control

### Phase 4 (UI):
- [ ] User can manage contracts through UI
- [ ] Clear visibility of upcoming payments
- [ ] Easy to mark payments as paid
- [ ] Visual indicators for overdue payments

### Phase 5 (Integration):
- [ ] Cash flow projection shows complete picture
- [ ] All three layers visible (debt, scheduled, budget)
- [ ] Warning indicators for cash shortfalls
- [ ] Useful for financial planning

### Phase 6-7 (Polish):
- [ ] Auto-linking suggestions work
- [ ] Alerts for upcoming payments
- [ ] Reports provide insights
- [ ] System is well-documented

## Future Enhancements (Post-MVP)

- [ ] **Bank Integration**: Auto-pay via API
- [ ] **Document Management**: Upload contracts, leases
- [ ] **Approval Workflows**: Multi-level approval for large payments
- [ ] **Email/SMS Reminders**: Automated notifications
- [ ] **Payment Method Tracking**: Record how payment was made
- [ ] **Vendor Management**: Payee directory with contact info
- [ ] **Scenario Planning**: "What if I delay this payment?"
- [ ] **AI Forecasting**: Predict cash flow based on patterns
- [ ] **Mobile App**: View and manage on the go
- [ ] **API Webhooks**: Notify external systems of payment events

## Timeline Estimate

- **Phase 1 (Database)**: 1 day
- **Phase 2 (Types)**: 0.5 days
- **Phase 3 (API)**: 2 days
- **Phase 4 (UI)**: 3 days
- **Phase 5 (Cash Flow)**: 2 days
- **Phase 6 (Advanced)**: 2 days
- **Phase 7 (Testing)**: 1 day

**Total**: ~12 days of development time

## Notes

- Keep it simple initially - focus on monthly recurring and custom dates
- Can add more complexity (escalations, partial payments) later
- Prioritize cash flow view - that's the key value
- Ensure mobile responsiveness
- Consider adding a "Quick Pay" button on dashboard for due payments

## Questions to Resolve

- [ ] Should we support automatic payment execution? (Banking API integration)
- [ ] Do we need approval workflows for large payments?
- [ ] Should we track payment methods (bank transfer, check, cash)?
- [ ] How to handle foreign currency scheduled payments?
- [ ] Should we support recurring payments with variable amounts? (e.g., utility bills)

---

**Last Updated**: January 17, 2025
**Status**: Ready for implementation - awaiting approval to proceed
