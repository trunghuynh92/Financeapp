# Loan Receivable & Business Partners Implementation

**Version**: 4.2.0
**Date**: November 10, 2025
**Status**: Complete ✅

---

## Overview

This document describes the complete implementation of the Loan Receivable system and Business Partners management feature added in version 4.2.0.

## System Architecture

### Database Schema

#### 1. Business Partners Table (`business_partners`)

Centralized contact management for all business relationships.

**Key Features:**
- Partner types: Customer, Vendor, Employee, Owner, Partner, Lender, Other
- Comprehensive information storage (contact, address, banking, tax)
- Entity-based isolation with RLS
- Unique partner names per entity

**Columns:**
- `partner_id` (SERIAL PRIMARY KEY)
- `entity_id` (UUID, FK → entities)
- `partner_type` (ENUM)
- Contact fields: name, email, phone, mobile, fax, website
- Address fields: address lines, city, state, postal code, country
- Banking fields: account number, bank name, branch, SWIFT code
- Business fields: tax ID, credit limit, payment terms
- Metadata: notes, active status, timestamps

**Migration**: 039_create_business_partners.sql

#### 2. Loan Disbursement Table (`loan_disbursement`)

Tracks loans given to borrowers as assets.

**Key Features:**
- Links to business_partners via `partner_id`
- Loan categories: short-term, long-term, advance, other
- Status tracking: active, overdue, repaid, partially_written_off, written_off
- Automatic balance updates via triggers
- Write-off support

**Columns:**
- `loan_disbursement_id` (SERIAL PRIMARY KEY)
- `account_id` (FK → accounts, loan_receivable type)
- `partner_id` (FK → business_partners)
- `borrower_name` (TEXT, deprecated - use partner instead)
- Loan details: category, principal, remaining balance
- Dates: disbursement date, due date
- Terms: term months, interest rate (reference only)
- Status tracking: status, is_overpaid, written_off_amount
- Metadata: notes, timestamps

**Migration**: 037_add_loan_receivable_system.sql

#### 3. Account Type Extension

Added `loan_receivable` account type to the accounts table.

**Migration**: 038_fix_account_type_constraint.sql

#### 4. Data Model Cleanup

Removed redundant `borrower_type` column from loan_disbursement.

**Rationale**: Partner type is already stored in business_partners table, no need to duplicate.

**Migration**: 040_remove_borrower_type_from_loans.sql

---

## API Endpoints

### Business Partners API

**Base Path**: `/api/business-partners`

#### GET `/api/business-partners`
List all partners for an entity with optional filtering.

**Query Parameters:**
- `entity_id` (required): Filter by entity
- `partner_type` (optional): Filter by partner type

**Response:**
```json
{
  "data": [
    {
      "partner_id": 1,
      "entity_id": "uuid",
      "partner_type": "customer",
      "partner_name": "John Doe",
      "email": "john@example.com",
      ...
    }
  ],
  "count": 1
}
```

#### POST `/api/business-partners`
Create a new business partner.

**Request Body:**
```json
{
  "entity_id": "uuid",
  "partner_type": "customer",
  "partner_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address_line1": "123 Main St",
  ...
}
```

#### GET `/api/business-partners/[id]`
Get partner details.

#### PUT `/api/business-partners/[id]`
Update partner information.

#### DELETE `/api/business-partners/[id]`
Delete a partner (checks for references to loans).

### Loan Disbursements API

**Base Path**: `/api/loan-disbursements`

#### GET `/api/loan-disbursements`
List all loan disbursements for an account.

**Query Parameters:**
- `account_id` (required): Loan receivable account ID

**Response:**
```json
{
  "data": [
    {
      "loan_disbursement_id": 1,
      "account_id": 1,
      "partner_id": 1,
      "partner": {
        "partner_name": "John Doe",
        "partner_type": "owner"
      },
      "principal_amount": 10000.00,
      "remaining_balance": 5000.00,
      "status": "active",
      ...
    }
  ],
  "count": 1
}
```

#### POST `/api/loan-disbursements`
Create a new loan disbursement.

**Request Body:**
```json
{
  "account_id": 1,
  "partner_id": 1,
  "loan_category": "short_term",
  "principal_amount": 10000.00,
  "disbursement_date": "2025-11-10",
  "due_date": "2026-11-10",
  "term_months": 12,
  "interest_rate": 5.00,
  "notes": "Business loan"
}
```

#### GET `/api/loan-disbursements/[id]`
Get loan details.

#### PUT `/api/loan-disbursements/[id]`
Update loan information (category, dates, interest, notes only).

#### DELETE `/api/loan-disbursements/[id]`
Delete a loan disbursement.

#### POST `/api/loan-disbursements/[id]/payment`
Record a loan payment.

**Request Body:**
```json
{
  "payment_amount": 1000.00,
  "payment_date": "2025-11-15",
  "notes": "Monthly payment"
}
```

**Process:**
1. Reduces remaining_balance
2. Updates status to 'repaid' if fully paid
3. Marks as overpaid if payment exceeds balance

#### POST `/api/loan-disbursements/[id]/writeoff`
Write off all or part of a loan.

**Request Body:**
```json
{
  "writeoff_amount": 5000.00,
  "writeoff_date": "2025-11-20",
  "reason": "Borrower bankruptcy"
}
```

**Process:**
1. Reduces remaining_balance
2. Increases written_off_amount
3. Updates status to 'partially_written_off' or 'written_off'
4. Records writeoff date and reason

---

## Frontend Components

### 1. LoanDisbursementListCard

**Location**: `components/loan-disbursement-list-card.tsx`

**Purpose**: Display and manage loan disbursements for a loan_receivable account.

**Features:**
- Loan statistics dashboard (total outstanding, active loans, next due date)
- Status filtering (All, Active, Overdue, Repaid, etc.)
- Loan list table with columns:
  - Borrower (with partner type badge)
  - Disbursement date
  - Principal amount
  - Remaining balance
  - Payment progress bar
  - Due date with overdue indicators
  - Status badge
  - Record payment button
- Create new loan button
- Overdue loans alert
- Empty state messaging

**Props:**
```typescript
{
  accountId: number
  accountName: string
  currency: string
  onRefresh?: () => void
}
```

### 2. CreateLoanDisbursementDialog

**Location**: `components/create-loan-disbursement-dialog.tsx`

**Purpose**: Form to create new loan disbursements.

**Features:**
- Partner selector dropdown (auto-fetches from entity)
- Inline partner creation (opens nested dialog)
- Loan details form:
  - Principal amount (required)
  - Loan category (required)
  - Disbursement date (required)
  - Due date (optional)
  - Term in months (optional)
  - Interest rate (optional, for reference)
  - Notes (optional)
- Form validation
- Error handling

**Props:**
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  accountName: string
  onSuccess: () => void
}
```

### 3. RecordLoanPaymentDialog

**Location**: `components/record-loan-payment-dialog.tsx`

**Purpose**: Record payments against loan disbursements.

**Features:**
- Payment amount input
- Payment date picker
- Notes field
- Current balance display
- Overpayment warning
- Form validation

**Props:**
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  disbursementId: number
  borrowerName: string
  onSuccess: () => void
}
```

### 4. CreateBusinessPartnerDialog

**Location**: `components/create-business-partner-dialog.tsx`

**Purpose**: Comprehensive form to create business partners.

**Features:**
- Multi-tab layout (Basic, Contact, Address, Banking)
- Partner type selection
- All partner fields organized by category
- Form validation
- Can be used standalone or embedded in other forms

**Props:**
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  onSuccess: (partner: BusinessPartner) => void
  defaultPartnerType?: PartnerType
}
```

### 5. Account Detail Page Enhancement

**Location**: `app/dashboard/accounts/[id]/page.tsx`

**Changes:**
- Added DollarSign icon for loan_receivable accounts
- Conditionally render LoanDisbursementListCard for loan_receivable accounts
- Pass account info and refresh callback

---

## TypeScript Types

### Business Partner Types

**Location**: `types/business-partner.ts`

```typescript
export type PartnerType =
  | 'customer'
  | 'vendor'
  | 'employee'
  | 'owner'
  | 'partner'
  | 'lender'
  | 'other'

export interface BusinessPartner {
  partner_id: number
  entity_id: string
  partner_type: PartnerType
  partner_name: string
  legal_name: string | null
  display_name: string | null
  tax_id: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  fax: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  country: string | null
  bank_account_number: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_swift_code: string | null
  payment_terms: string | null
  credit_limit: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface CreateBusinessPartnerInput {
  entity_id: string
  partner_type: PartnerType
  partner_name: string
  // ... all other fields
}

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  employee: 'Employee',
  owner: 'Owner',
  partner: 'Partner',
  lender: 'Lender',
  other: 'Other',
}
```

### Loan Types

**Location**: `types/loan.ts`

```typescript
export type LoanCategory =
  | 'short_term'
  | 'long_term'
  | 'advance'
  | 'other'

export type LoanStatus =
  | 'active'
  | 'overdue'
  | 'repaid'
  | 'partially_written_off'
  | 'written_off'

export interface LoanDisbursement {
  loan_disbursement_id: number
  account_id: number
  partner_id: number | null
  borrower_name: string | null  // Deprecated
  loan_category: LoanCategory
  principal_amount: number
  remaining_balance: number
  disbursement_date: string
  due_date: string | null
  term_months: number | null
  interest_rate: number | null
  status: LoanStatus
  is_overpaid: boolean
  written_off_amount: number
  written_off_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface LoanDisbursementWithAccount extends LoanDisbursement {
  account: {
    account_id: number
    account_name: string
    account_type: string
    entity_id: string
  }
}

export interface CreateLoanDisbursementInput {
  account_id: number
  partner_id: number  // Required
  loan_category: LoanCategory
  principal_amount: number
  disbursement_date: string
  due_date?: string | null
  term_months?: number | null
  interest_rate?: number | null
  notes?: string | null
}

export const LOAN_CATEGORY_LABELS: Record<LoanCategory, string> = {
  short_term: 'Short-term (<12 months)',
  long_term: 'Long-term (≥12 months)',
  advance: 'Advance',
  other: 'Other',
}

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  active: 'Active',
  overdue: 'Overdue',
  repaid: 'Repaid',
  partially_written_off: 'Partially Written Off',
  written_off: 'Written Off',
}

export const LOAN_STATUS_COLORS: Record<LoanStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  repaid: 'bg-green-100 text-green-800',
  partially_written_off: 'bg-orange-100 text-orange-800',
  written_off: 'bg-gray-100 text-gray-800',
}
```

---

## User Flow

### Creating a Loan Disbursement

1. Navigate to loan_receivable account detail page
2. Click "New Loan" button
3. In the Create Loan dialog:
   - Select existing borrower from dropdown OR
   - Click "+" to create new business partner inline
4. Fill in loan details (amount, dates, terms)
5. Submit form
6. Loan appears in list with "Active" status

### Recording a Loan Payment

1. Find loan in the disbursement list
2. Click "Record Payment" button
3. Enter payment amount and date
4. Add optional notes
5. Submit
6. Loan balance updates automatically
7. Payment progress bar updates
8. Status changes to "Repaid" if fully paid

### Managing Business Partners

1. Create partners from:
   - Loan disbursement form (inline)
   - Direct API calls (future: dedicated partners page)
2. Partners are entity-specific
3. Can be referenced by multiple loans
4. Cannot be deleted if referenced by loans

---

## Security & Permissions

### Row-Level Security (RLS)

**Business Partners:**
- Users can view partners for entities they're members of
- Editor+ can create/update partners
- Admin+ can delete partners (with cascade checks)

**Loan Disbursements:**
- Users can view loans for accounts in their entities
- Editor+ can create/update loans
- Admin+ can delete loans

### Data Isolation

- All queries filtered by entity_id through account relationships
- Foreign key constraints prevent cross-entity references
- Partner names unique per entity (not globally)

---

## Migration History

1. **Migration 037**: Add loan_receivable system
   - Create loan_disbursement table
   - Add enums for loan categories and statuses
   - Create triggers for balance updates
   - Add RLS policies

2. **Migration 038**: Fix account_type constraint
   - Update CHECK constraint to include loan_receivable
   - Fix account creation validation

3. **Migration 039**: Create business_partners table
   - Comprehensive partner information storage
   - Add partner_type enum
   - Link loan_disbursement via partner_id
   - Create indexes and RLS policies

4. **Migration 040**: Remove redundant borrower_type
   - Drop borrower_type column from loan_disbursement
   - Update indexes
   - Simplify data model

---

## Testing Checklist

### Database Migrations
- [ ] Run Migration 037 successfully
- [ ] Run Migration 038 successfully
- [ ] Run Migration 039 successfully
- [ ] Run Migration 040 successfully
- [ ] Verify all tables created
- [ ] Verify all constraints and indexes
- [ ] Verify RLS policies working

### Business Partners
- [ ] Create a business partner
- [ ] View partners list filtered by entity
- [ ] Update partner information
- [ ] Try to delete partner (should fail if has loans)
- [ ] Verify partner name uniqueness per entity

### Loan Disbursements
- [ ] Create loan_receivable account
- [ ] Create loan disbursement with existing partner
- [ ] Create loan disbursement with new partner (inline)
- [ ] View loan list with statistics
- [ ] Filter loans by status
- [ ] Record loan payment
- [ ] Verify balance updates automatically
- [ ] Verify status changes when fully paid
- [ ] Test overpayment warning
- [ ] Test due date alerts (overdue, due soon)
- [ ] Write off loan (partial or full)
- [ ] Delete loan

### UI/UX
- [ ] Loan statistics display correctly
- [ ] Payment progress bars show accurate percentages
- [ ] Status badges display with correct colors
- [ ] Overdue/due soon indicators appear
- [ ] Empty states show appropriate messages
- [ ] Forms validate input properly
- [ ] Error messages are clear and helpful
- [ ] Inline partner creation works seamlessly

### Permissions
- [ ] Viewer can only view loans
- [ ] Editor can create and edit loans
- [ ] Admin can delete loans
- [ ] Users cannot access other entities' data

---

## Future Enhancements

### Planned Features
1. **Dedicated Business Partners Page**
   - Full CRUD interface for partners
   - Advanced filtering and search
   - Import partners from CSV
   - Export partners list

2. **Loan Receivable Enhancements**
   - Automatic interest calculation
   - Payment schedules/reminders
   - Bulk loan creation
   - Loan templates
   - Collateral tracking

3. **Integration with Other Features**
   - Link partners to transactions
   - Invoice generation for partners
   - Customer statements
   - Vendor payment tracking
   - Employee loan deductions

4. **Reporting**
   - Aging report for loans
   - Partner transaction summary
   - Loan performance analytics
   - Write-off reports

5. **Automation**
   - Email reminders for due loans
   - Auto-payment processing
   - Recurring loan payments
   - Late fee calculations

---

## Known Limitations

1. **Interest Calculation**: Interest rates are stored for reference only and not automatically calculated or compounded.

2. **Payment Tracking**: Loan payments don't currently create main_transaction entries automatically. They only update the loan_disbursement balance.

3. **Multiple Payments**: Each payment reduces the balance but doesn't maintain a detailed payment history (planned for future).

4. **Partial Payments**: System supports partial payments but doesn't track payment allocation to principal vs interest.

5. **Currency**: Loan amounts inherit currency from the account but don't support multi-currency loans.

---

## Support & Documentation

**Related Documentation:**
- SCHEMA.md: Complete database schema
- README.md: Feature overview and version history
- Migration files: Detailed SQL changes

**Key Files:**
- Types: `types/loan.ts`, `types/business-partner.ts`
- API: `app/api/loan-disbursements/`, `app/api/business-partners/`
- Components: `components/loan-disbursement-list-card.tsx`, etc.
- Migrations: `migrations/037-040_*.sql`

---

**End of Document**
