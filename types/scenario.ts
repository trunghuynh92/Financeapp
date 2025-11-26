// Cash Flow Scenario Types

export type ScenarioAdjustmentType =
  | 'one_time_income'
  | 'one_time_expense'
  | 'recurring_income'
  | 'recurring_expense'
  | 'debt_drawdown'
  | 'modify_predicted'
  | 'modify_income'
  | 'exclude_scheduled'

export interface CashFlowScenario {
  scenario_id: number
  entity_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

// Metadata structure for debt_drawdown adjustments
export interface DebtDrawdownMetadata {
  repayment_month?: string // YYYY-MM format - when to repay (calculated)
  repayment_months?: number // Number of months after drawdown (user selection)
  credit_line_account_id?: number // Which credit line to draw from
  interest_rate?: number // Optional interest rate
}

export interface ScenarioAdjustment {
  adjustment_id: number
  scenario_id: number
  adjustment_type: ScenarioAdjustmentType
  name: string
  amount: number | null
  percentage: number | null
  start_month: string | null // YYYY-MM-DD
  end_month: string | null // YYYY-MM-DD
  category_id: number | null
  scheduled_payment_id: number | null
  account_id: number | null
  metadata: Record<string, any> | DebtDrawdownMetadata
  created_at: string
  updated_at: string
}

export interface ScenarioWithAdjustments extends CashFlowScenario {
  adjustments: ScenarioAdjustment[]
}

export interface ScenarioOverview extends CashFlowScenario {
  adjustment_count: number
  total_income_adjustments: number
  total_expense_adjustments: number
}

// Input types for creating/updating

export interface CreateScenarioInput {
  entity_id: string
  name: string
  description?: string
  color?: string
}

export interface UpdateScenarioInput {
  name?: string
  description?: string
  color?: string
  is_active?: boolean
}

export interface CreateAdjustmentInput {
  scenario_id: number
  adjustment_type: ScenarioAdjustmentType
  name: string
  amount?: number
  percentage?: number
  start_month?: string
  end_month?: string
  category_id?: number
  scheduled_payment_id?: number
  account_id?: number
  metadata?: Record<string, any>
}

export interface UpdateAdjustmentInput {
  name?: string
  amount?: number
  percentage?: number
  start_month?: string
  end_month?: string
  category_id?: number
  scheduled_payment_id?: number
  account_id?: number
  metadata?: Record<string, any>
}

// UI Helper types

export const ADJUSTMENT_TYPE_CONFIG: Record<ScenarioAdjustmentType, {
  label: string
  description: string
  icon: string
  color: string
  requiresAmount: boolean
  requiresPercentage: boolean
  requiresDateRange: boolean
}> = {
  one_time_income: {
    label: 'One-time Income',
    description: 'A single income event (e.g., sell equipment, bonus)',
    icon: 'TrendingUp',
    color: 'green',
    requiresAmount: true,
    requiresPercentage: false,
    requiresDateRange: false, // Just start_month
  },
  one_time_expense: {
    label: 'One-time Expense',
    description: 'A single expense event (e.g., equipment purchase, repair)',
    icon: 'TrendingDown',
    color: 'red',
    requiresAmount: true,
    requiresPercentage: false,
    requiresDateRange: false,
  },
  recurring_income: {
    label: 'Recurring Income',
    description: 'Monthly recurring income (e.g., new contract)',
    icon: 'Repeat',
    color: 'green',
    requiresAmount: true,
    requiresPercentage: false,
    requiresDateRange: true,
  },
  recurring_expense: {
    label: 'Recurring Expense',
    description: 'Monthly recurring expense (e.g., new subscription)',
    icon: 'Repeat',
    color: 'red',
    requiresAmount: true,
    requiresPercentage: false,
    requiresDateRange: true,
  },
  debt_drawdown: {
    label: 'New Debt/Loan',
    description: 'Draw down from credit line or take new loan',
    icon: 'Landmark',
    color: 'yellow',
    requiresAmount: true,
    requiresPercentage: false,
    requiresDateRange: false,
  },
  modify_predicted: {
    label: 'Modify Predicted Expenses',
    description: 'Percentage change to predicted expenses (e.g., -20% cost cut)',
    icon: 'Percent',
    color: 'orange',
    requiresAmount: false,
    requiresPercentage: true,
    requiresDateRange: true,
  },
  modify_income: {
    label: 'Modify Predicted Income',
    description: 'Percentage change to predicted income (e.g., +10% growth)',
    icon: 'Percent',
    color: 'blue',
    requiresAmount: false,
    requiresPercentage: true,
    requiresDateRange: true,
  },
  exclude_scheduled: {
    label: 'Exclude Scheduled Payment',
    description: 'Remove a scheduled payment from projection',
    icon: 'X',
    color: 'gray',
    requiresAmount: false,
    requiresPercentage: false,
    requiresDateRange: false,
  },
}

// Preset scenario colors
export const SCENARIO_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#0ea5e9', // Sky
]
