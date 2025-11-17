/**
 * TypeScript types for Scheduled Payments System
 */

// ==============================================================================
// Enums
// ==============================================================================

export type ScheduleType = 'recurring' | 'one_time' | 'custom_dates'

export type PaymentFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom'

export type ContractType = 'lease' | 'service' | 'construction' | 'subscription' | 'other'

export type ScheduledPaymentStatus = 'active' | 'completed' | 'cancelled'

export type PaymentInstanceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

// ==============================================================================
// Main Interfaces
// ==============================================================================

export interface ScheduledPayment {
  scheduled_payment_id: number
  entity_id: string
  category_id: number

  // Contract Link (new in migration 060)
  contract_id: number | null
  payment_type: string | null  // 'primary', 'rent', 'utilities', etc.

  // Contract Details
  contract_name: string
  contract_type: ContractType
  payee_name: string
  contract_number: string | null

  // Payment Amount
  payment_amount: number

  // Schedule Configuration
  schedule_type: ScheduleType
  frequency: PaymentFrequency | null
  payment_day: number | null  // 1-31

  // Time Period
  start_date: string  // ISO date string
  end_date: string | null  // ISO date string, optional for indefinite contracts

  // Custom Schedule (for construction milestones, specific dates)
  custom_schedule: string[] | null  // Array of ISO date strings

  // Status
  status: ScheduledPaymentStatus
  is_active: boolean

  // Notes
  notes: string | null

  // Metadata
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface ScheduledPaymentInstance {
  instance_id: number
  scheduled_payment_id: number

  // Due Date & Amount
  due_date: string  // ISO date string
  amount: number

  // Payment Status
  status: PaymentInstanceStatus

  // Payment Details (when marked as paid)
  paid_date: string | null  // ISO date string
  paid_amount: number | null
  transaction_id: number | null

  // Amendment Tracking (new in migration 060)
  amendment_id: number | null
  is_amended: boolean
  original_amount: number | null  // Amount before amendment

  // Notes
  notes: string | null

  // Metadata
  created_at: string
  updated_at: string
}

export interface ScheduledPaymentOverview extends ScheduledPayment {
  // Category Info
  category_name: string

  // Instance Summaries
  total_instances: number
  pending_count: number
  paid_count: number
  overdue_count: number

  // Next Due Date
  next_due_date: string | null

  // Payment Totals
  total_paid: number
  total_pending: number
  total_overdue: number
}

// ==============================================================================
// Request/Response Interfaces
// ==============================================================================

export interface CreateScheduledPaymentRequest {
  entity_id: string
  category_id: number
  contract_name: string
  contract_type: ContractType
  payee_name: string
  contract_number?: string
  payment_amount: number
  schedule_type: ScheduleType
  frequency?: PaymentFrequency  // Required if schedule_type = 'recurring'
  payment_day?: number  // Required if schedule_type = 'recurring'
  start_date: string
  end_date?: string
  custom_schedule?: string[]  // Required if schedule_type = 'custom_dates'
  notes?: string
  generate_instances?: boolean  // Whether to auto-generate instances (default: true)
  months_ahead?: number  // How many months of instances to generate (default: 12)
}

export interface UpdateScheduledPaymentRequest {
  contract_name?: string
  contract_type?: ContractType
  payee_name?: string
  contract_number?: string
  payment_amount?: number
  schedule_type?: ScheduleType
  frequency?: PaymentFrequency
  payment_day?: number
  start_date?: string
  end_date?: string
  custom_schedule?: string[]
  status?: ScheduledPaymentStatus
  notes?: string
  regenerate_instances?: boolean  // If true, regenerate instances after update
}

export interface UpdatePaymentInstanceRequest {
  due_date?: string
  amount?: number
  status?: PaymentInstanceStatus
  notes?: string
}

export interface MarkAsPaidRequest {
  paid_date?: string  // Default: today
  paid_amount: number
  transaction_id?: number  // Link to existing transaction
  create_transaction?: boolean  // If true, create new transaction
  notes?: string
}

export interface GenerateInstancesRequest {
  months_ahead: number  // How many months to generate
}

// ==============================================================================
// Summary/Statistics Interfaces
// ==============================================================================

export interface ScheduledPaymentSummary {
  total_contracts: number
  active_contracts: number
  total_monthly_obligation: number  // Sum of monthly recurring payments
  upcoming_payments_count: number  // Next 30 days
  overdue_payments_count: number
  total_paid_this_month: number
  total_pending_this_month: number
}

export interface UpcomingPayment {
  instance_id: number
  scheduled_payment_id: number
  contract_name: string
  payee_name: string
  due_date: string
  amount: number
  days_until_due: number
}

export interface MonthlyPaymentProjection {
  month: string  // "2025-02"
  total_due: number
  payments: {
    instance_id: number
    contract_name: string
    payee_name: string
    due_date: string
    amount: number
    status: PaymentInstanceStatus
  }[]
}

// ==============================================================================
// Filter/Query Interfaces
// ==============================================================================

export interface ScheduledPaymentFilters {
  entity_id: string
  contract_type?: ContractType
  status?: ScheduledPaymentStatus
  payee_name?: string
  category_id?: number
  active_only?: boolean
}

export interface PaymentInstanceFilters {
  scheduled_payment_id?: number
  status?: PaymentInstanceStatus
  start_date?: string
  end_date?: string
  overdue_only?: boolean
  pending_only?: boolean
}
