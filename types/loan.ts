/**
 * Type definitions for Loan Receivable System
 * Mirror of debt/drawdown system but for assets (money owed TO company)
 */

export type LoanCategory = 'short_term' | 'long_term' | 'advance' | 'other'

export type LoanStatus = 'active' | 'overdue' | 'repaid' | 'partially_written_off' | 'written_off'

export interface LoanDisbursement {
  loan_disbursement_id: number
  account_id: number
  partner_id: number | null
  borrower_name: string | null  // Deprecated: use partner instead
  loan_category: LoanCategory
  principal_amount: number
  remaining_balance: number
  disbursement_date: string // ISO date string
  due_date: string | null // ISO date string or null
  term_months: number | null
  interest_rate: number | null // Percentage (e.g., 5.00 for 5%)
  status: LoanStatus
  is_overpaid: boolean
  written_off_amount: number
  written_off_date: string | null // ISO date string or null
  notes: string | null
  created_at: string // ISO datetime string
  updated_at: string // ISO datetime string
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
  account_id?: number  // Optional: Loan receivable account (auto-created if not provided)
  source_account_id: number  // Bank/cash account that disburses funds (source - decreases)
  partner_id: number  // Required: must select a business partner
  loan_category: LoanCategory
  principal_amount: number
  disbursement_date: string
  due_date?: string | null
  term_months?: number | null
  interest_rate?: number | null
  notes?: string | null
  existing_source_transaction_id?: number  // Optional: if provided, links to existing transaction instead of creating new one
}

export interface UpdateLoanDisbursementInput {
  loan_category?: LoanCategory
  due_date?: string | null
  term_months?: number | null
  interest_rate?: number | null
  notes?: string | null
}

export interface LoanPaymentInput {
  loan_disbursement_id: number
  payment_amount: number
  payment_date: string
  notes?: string
}

export interface LoanWriteoffInput {
  loan_disbursement_id: number
  writeoff_amount: number
  writeoff_date: string
  reason?: string
}

// Display configuration
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
