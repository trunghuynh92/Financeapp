/**
 * Types for Debt Drawdown System
 * Supports credit lines, term loans, and credit cards
 */

export type DrawdownStatus = 'active' | 'settled' | 'overdue' | 'written_off'

export type TransactionSubtype = 'regular' | 'principal' | 'interest' | 'fee' | 'penalty'

export interface DebtDrawdown {
  drawdown_id: number
  account_id: number
  drawdown_reference: string
  drawdown_date: string
  original_amount: number
  remaining_balance: number
  due_date: string | null
  interest_rate: number | null
  status: DrawdownStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DrawdownWithDetails extends DebtDrawdown {
  // Account details
  account_name: string
  bank_name: string
  account_type: string
  entity_name: string

  // Calculated fields
  paid_amount: number
  days_until_due: number | null
  total_interest_paid: number
  total_fees_paid: number

  // Payment breakdown
  payment_history?: DrawdownPayment[]
}

export interface DrawdownPayment {
  main_transaction_id: number
  transaction_date: string
  transaction_subtype: TransactionSubtype
  amount: number
  description: string | null
  notes: string | null
}

export interface DebtSummary {
  account_id: number
  account_name: string
  account_type: string
  bank_name: string
  credit_limit: number | null
  entity_id: string
  entity_name: string

  // Drawdown counts
  total_drawdowns: number
  active_drawdowns: number
  settled_drawdowns: number
  overdue_drawdowns: number

  // Financial summary
  total_borrowed: number
  total_outstanding: number
  total_paid: number
  available_credit: number | null
}

export interface AvailableCredit {
  credit_limit: number
  total_drawn: number
  available_credit: number
}

// API Request/Response Types

export interface CreateDrawdownRequest {
  account_id: number
  drawdown_reference: string
  drawdown_date: string
  original_amount: number
  due_date?: string | null
  interest_rate?: number | null
  notes?: string | null
}

export interface UpdateDrawdownRequest {
  drawdown_reference?: string
  due_date?: string | null
  interest_rate?: number | null
  notes?: string | null
  status?: DrawdownStatus
}

export interface RecordDrawdownPaymentRequest {
  drawdown_id: number
  account_id: number
  transaction_date: string
  amount: number
  transaction_subtype: 'principal' | 'interest' | 'fee' | 'penalty'
  description?: string
  notes?: string
  category_id?: number
}

// UI Display Types

export interface DrawdownListItem {
  drawdown_id: number
  drawdown_reference: string
  drawdown_date: string
  original_amount: number
  remaining_balance: number
  paid_amount: number
  status: DrawdownStatus
  due_date: string | null
  days_until_due: number | null
  interest_rate: number | null
  total_interest_paid: number
  total_fees_paid: number
}

export interface DrawdownStats {
  total_drawdowns: number
  active_drawdowns: number
  total_outstanding: number
  total_interest_paid: number
  total_fees_paid: number
  average_interest_rate: number | null
  next_due_date: string | null
}

// Helper functions

export function getDrawdownStatusColor(status: DrawdownStatus): string {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-800'
    case 'settled':
      return 'bg-green-100 text-green-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    case 'written_off':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getDrawdownStatusLabel(status: DrawdownStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'settled':
      return 'Settled'
    case 'overdue':
      return 'Overdue'
    case 'written_off':
      return 'Written Off'
    default:
      return status
  }
}

export function getSubtypeLabel(subtype: TransactionSubtype): string {
  switch (subtype) {
    case 'regular':
      return 'Regular'
    case 'principal':
      return 'Principal Payment'
    case 'interest':
      return 'Interest Payment'
    case 'fee':
      return 'Fee'
    case 'penalty':
      return 'Penalty'
    default:
      return subtype
  }
}

export function getSubtypeColor(subtype: TransactionSubtype): string {
  switch (subtype) {
    case 'principal':
      return 'bg-green-100 text-green-800'
    case 'interest':
      return 'bg-orange-100 text-orange-800'
    case 'fee':
    case 'penalty':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function calculatePaymentProgress(original: number, remaining: number): number {
  if (original === 0) return 0
  return ((original - remaining) / original) * 100
}

export function isDueWithinDays(dueDate: string | null, days: number): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff <= days && diff >= 0
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}
