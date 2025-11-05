/**
 * TypeScript types for the Balance Checkpoint & Adjustment System
 * Implements "No money without origin" principle
 */

// ==============================================================================
// Core Checkpoint Types
// ==============================================================================

export interface BalanceCheckpoint {
  checkpoint_id: number
  account_id: number
  checkpoint_date: string // ISO 8601 format
  declared_balance: number
  calculated_balance: number
  adjustment_amount: number
  is_reconciled: boolean
  notes: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export interface BalanceCheckpointWithAccount extends BalanceCheckpoint {
  account: {
    account_id: number
    account_name: string
    account_type: string
    currency: string
  }
}

// ==============================================================================
// Request/Response Types for API
// ==============================================================================

export interface CreateCheckpointRequest {
  checkpoint_date: string // ISO 8601 format
  declared_balance: number
  notes?: string
}

export interface UpdateCheckpointRequest {
  declared_balance?: number
  notes?: string
}

export interface CreateCheckpointResponse {
  checkpoint: BalanceCheckpoint
  adjustment_transaction?: FlaggedTransaction
}

export interface CheckpointListQuery {
  include_reconciled?: boolean
  order_by?: 'date_asc' | 'date_desc'
  limit?: number
  offset?: number
}

// ==============================================================================
// Flagged Transaction Types
// ==============================================================================

export interface FlaggedTransaction {
  transaction_id: number
  account_id: number
  transaction_date: string
  description: string
  credit_amount: number
  debit_amount: number
  checkpoint_id: number | null
  is_balance_adjustment: boolean
  is_flagged: boolean
  created_at: string
  updated_at: string
}

export interface FlaggedTransactionWithCheckpoint extends FlaggedTransaction {
  checkpoint: {
    checkpoint_id: number
    checkpoint_date: string
    declared_balance: number
    adjustment_amount: number
    is_reconciled: boolean
  } | null
}

// ==============================================================================
// Calculation Types
// ==============================================================================

export interface BalanceCalculation {
  account_id: number
  up_to_date: string
  calculated_balance: number
  transaction_count: number
}

export interface CheckpointRecalculationResult {
  checkpoint_id: number
  old_calculated_balance: number
  new_calculated_balance: number
  old_adjustment_amount: number
  new_adjustment_amount: number
  old_is_reconciled: boolean
  new_is_reconciled: boolean
  adjustment_transaction_updated: boolean
}

export interface AccountCheckpointSummary {
  account_id: number
  account_name: string
  total_checkpoints: number
  reconciled_checkpoints: number
  unreconciled_checkpoints: number
  total_adjustment_amount: number
  earliest_checkpoint_date: string | null
  latest_checkpoint_date: string | null
}

// ==============================================================================
// Validation Types
// ==============================================================================

export interface CheckpointValidationError {
  field: string
  message: string
  code: string
}

export interface CheckpointConflict {
  type: 'date_conflict' | 'transaction_conflict' | 'duplicate'
  message: string
  existing_checkpoint?: BalanceCheckpoint
  conflicting_transactions?: Array<{
    transaction_id: number
    transaction_date: string
    description: string
  }>
}

// ==============================================================================
// Service Function Types
// ==============================================================================

export interface CheckpointServiceConfig {
  reconciliation_threshold: number // Default: 0.01 (1 cent)
  auto_recalculate: boolean // Default: true
  notification_enabled: boolean // Default: true
}

export interface CreateOrUpdateCheckpointParams {
  account_id: number
  checkpoint_date: Date
  declared_balance: number
  notes?: string | null
  user_id?: number | null
}

export interface RecalculateCheckpointsParams {
  account_id: number
  from_date?: Date
  to_date?: Date
  checkpoint_ids?: number[]
}

export interface BalanceAdjustmentTransactionData {
  raw_transaction_id: string
  account_id: number
  transaction_date: Date
  description: string
  credit_amount: number | null  // Either credit OR debit is null (DB constraint)
  debit_amount: number | null   // Either credit OR debit is null (DB constraint)
  transaction_source: 'auto_adjustment'  // Always auto_adjustment for balance adjustments
  checkpoint_id: number
  is_balance_adjustment: boolean
  is_flagged: boolean
}

// ==============================================================================
// Dashboard/UI Types
// ==============================================================================

export interface CheckpointAlert {
  severity: 'info' | 'warning' | 'error'
  message: string
  checkpoint_id: number
  account_id: number
  adjustment_amount: number
  action_url: string
}

export interface CheckpointStats {
  total_unreconciled: number
  total_adjustment_amount: number
  accounts_with_flags: number
  oldest_unreconciled_date: string | null
  checkpoints: Array<{
    checkpoint_id: number
    account_name: string
    checkpoint_date: string
    adjustment_amount: number
  }>
}

// ==============================================================================
// Constants
// ==============================================================================

export const CHECKPOINT_CONFIG = {
  RECONCILIATION_THRESHOLD: 0.01, // 1 cent
  MAX_CHECKPOINTS_PER_ACCOUNT: 100,
  BALANCE_ADJUSTMENT_DESCRIPTION: 'Balance Adjustment (Checkpoint)',
} as const

export const CHECKPOINT_VALIDATION = {
  MIN_DECLARED_BALANCE: -999999999999.99,
  MAX_DECLARED_BALANCE: 999999999999.99,
  MAX_NOTE_LENGTH: 1000,
} as const

// ==============================================================================
// Type Guards
// ==============================================================================

export function isBalanceCheckpoint(obj: any): obj is BalanceCheckpoint {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.checkpoint_id === 'number' &&
    typeof obj.account_id === 'number' &&
    typeof obj.declared_balance === 'number' &&
    typeof obj.calculated_balance === 'number' &&
    typeof obj.adjustment_amount === 'number' &&
    typeof obj.is_reconciled === 'boolean'
  )
}

export function isFlaggedTransaction(obj: any): obj is FlaggedTransaction {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.transaction_id === 'number' &&
    typeof obj.is_flagged === 'boolean' &&
    obj.is_flagged === true
  )
}

// ==============================================================================
// Utility Functions
// ==============================================================================

export function isReconciled(adjustmentAmount: number, threshold = CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD): boolean {
  return Math.abs(adjustmentAmount) < threshold
}

export function getAdjustmentType(adjustmentAmount: number): 'credit' | 'debit' | 'none' {
  if (adjustmentAmount > 0.01) return 'credit'
  if (adjustmentAmount < -0.01) return 'debit'
  return 'none'
}

export function formatAdjustmentAmount(amount: number, currency: string = 'VND'): string {
  const absAmount = Math.abs(amount)
  const type = getAdjustmentType(amount)

  if (type === 'none') return 'Reconciled'

  const sign = type === 'credit' ? '+' : '-'

  // Format based on currency
  if (currency === 'VND') {
    return `${sign}${absAmount.toLocaleString('vi-VN')} ₫`
  } else if (currency === 'USD') {
    return `${sign}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } else if (currency === 'EUR') {
    return `${sign}€${absAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return `${sign}${absAmount}`
}

export function getCheckpointStatusColor(checkpoint: BalanceCheckpoint): 'green' | 'yellow' | 'red' {
  if (checkpoint.is_reconciled) return 'green'
  if (Math.abs(checkpoint.adjustment_amount) < 1000000) return 'yellow' // Less than 1M VND
  return 'red'
}

export function getCheckpointAlertMessage(checkpoint: BalanceCheckpoint): string {
  if (checkpoint.is_reconciled) {
    return 'Fully reconciled - all transactions accounted for'
  }

  const type = getAdjustmentType(checkpoint.adjustment_amount)
  const absAmount = Math.abs(checkpoint.adjustment_amount)

  if (type === 'credit') {
    return `You have ${absAmount.toLocaleString()} in unexplained income. Add transactions to reconcile.`
  } else {
    return `You have ${absAmount.toLocaleString()} in unexplained expenses. Add transactions to reconcile.`
  }
}
