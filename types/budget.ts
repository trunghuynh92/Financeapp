/**
 * TypeScript types for Budget System
 */

export type RecurringPeriod = 'one-time' | 'monthly' | 'quarterly' | 'yearly'

export type BudgetStatus = 'active' | 'completed' | 'paused' | 'cancelled'

export type BudgetHealthStatus = 'upcoming' | 'on_track' | 'warning' | 'exceeded' | 'expired'

export interface CategoryBudget {
  budget_id: number
  entity_id: string
  category_id: number

  // Budget Details
  budget_name: string | null
  budget_amount: number

  // Time Period
  start_date: string  // ISO date string
  end_date: string    // ISO date string

  // Recurring Settings
  recurring_period: RecurringPeriod
  auto_renew: boolean

  // Status & Alerts
  status: BudgetStatus
  alert_threshold: number  // Percentage (0-100)

  // Priority
  priority: number  // Lower number = higher priority

  // Metadata
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface BudgetOverview extends CategoryBudget {
  // Category Info
  category_name: string
  category_code: string | null
  transaction_type: string

  // Spending Data
  spent_amount: number
  remaining_amount: number
  percentage_used: number
  transaction_count: number

  // Status Indicator
  budget_status: BudgetHealthStatus
}

export interface BudgetSpending {
  budget_id: number
  budget_amount: number
  spent_amount: number
  remaining_amount: number
  percentage_used: number
  transaction_count: number
}

export interface BudgetSummary {
  total_budgets: number
  active_budgets: number
  total_budget_amount: number
  total_spent: number
  total_remaining: number
  budgets_exceeded: number
  budgets_warning: number
  budgets_on_track: number
}

export interface CreateBudgetRequest {
  entity_id: string
  category_id: number
  budget_name?: string
  budget_amount: number
  start_date: string
  end_date: string
  recurring_period: RecurringPeriod
  auto_renew: boolean
  priority?: number
  alert_threshold?: number
  notes?: string
}

export interface UpdateBudgetRequest {
  budget_name?: string
  budget_amount?: number
  start_date?: string
  end_date?: string
  recurring_period?: RecurringPeriod
  auto_renew?: boolean
  status?: BudgetStatus
  priority?: number
  alert_threshold?: number
  notes?: string
}
