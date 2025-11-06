/**
 * TypeScript types for main_transaction system
 */

// ==============================================================================
// Core Types
// ==============================================================================

export interface TransactionType {
  transaction_type_id: number
  type_name: string
  type_display_name: string
  type_code: string
  description: string | null
  affects_cashflow: boolean
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Category {
  category_id: number
  category_name: string
  category_code: string | null
  parent_category_id: number | null
  transaction_type_id: number
  entity_type: 'business' | 'personal' | 'both'
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export interface Branch {
  branch_id: number
  entity_id: string
  branch_name: string
  branch_code: string | null
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MainTransaction {
  main_transaction_id: number
  raw_transaction_id: string
  account_id: number
  transaction_type_id: number
  category_id: number | null
  branch_id: number | null
  amount: number
  transaction_direction: 'debit' | 'credit'
  transaction_date: string
  description: string | null
  notes: string | null
  is_split: boolean
  split_sequence: number
  transfer_matched_transaction_id: number | null
  loan_id: number | null
  created_at: string
  updated_at: string
  created_by_user_id: number | null
  updated_by_user_id: number | null
}

// ==============================================================================
// Extended Types (with joins)
// ==============================================================================

export interface MainTransactionDetails extends MainTransaction {
  // Account details
  account_name: string
  bank_name: string | null
  account_type: string

  // Entity details
  entity_id: string
  entity_name: string
  entity_type: 'company' | 'personal'

  // Transaction type details
  transaction_type_code: string
  transaction_type: string // display name
  affects_cashflow: boolean

  // Category details
  category_name?: string
  category_code?: string

  // Branch details
  branch_name?: string
  branch_code?: string
}

export interface UnmatchedTransfer {
  main_transaction_id: number
  raw_transaction_id: string
  account_id: number
  amount: number
  transaction_direction: 'debit' | 'credit'
  transaction_date: string
  description: string | null
  notes: string | null
  account_name: string
  bank_name: string | null
  entity_name: string
  type_code: string
  transaction_type: string
}

// ==============================================================================
// Request/Response Types
// ==============================================================================

export interface CreateMainTransactionRequest {
  raw_transaction_id: string
  account_id: number
  transaction_type_id: number
  category_id?: number
  branch_id?: number
  amount: number
  transaction_direction: 'debit' | 'credit'
  transaction_date: string
  description?: string
  notes?: string
}

export interface UpdateMainTransactionRequest {
  transaction_type_id?: number
  category_id?: number | null
  branch_id?: number | null
  description?: string
  notes?: string
}

export interface SplitTransactionRequest {
  raw_transaction_id: string
  splits: {
    amount: number
    transaction_type_id: number
    category_id?: number
    branch_id?: number
    description?: string
    notes?: string
  }[]
}

export interface MatchTransferRequest {
  transfer_out_id: number
  transfer_in_id: number
}

export interface BackfillResult {
  processed_count: number
  error_count: number
  errors: string[]
}

export interface UnprocessedOriginal {
  raw_transaction_id: string
  account_id: number
  transaction_date: string
  description: string | null
  debit_amount: number | null
  credit_amount: number | null
  account_name: string
}

// ==============================================================================
// Utility Types
// ==============================================================================

export type TransactionDirection = 'debit' | 'credit'

export type EntityType = 'business' | 'personal' | 'both'

export type TransactionTypeCode =
  | 'INC'       // Income
  | 'EXP'       // Expense
  | 'TRF_OUT'   // Transfer Out
  | 'TRF_IN'    // Transfer In
  | 'DEBT_ACQ'  // Debt Acquired
  | 'DEBT_PAY'  // Debt Payback
  | 'INV'       // Investment
