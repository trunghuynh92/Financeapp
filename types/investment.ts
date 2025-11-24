/**
 * Type definitions for Investment Contribution System
 * Tracks money moved from bank/cash accounts to investment accounts
 */

export type InvestmentContributionStatus = 'active' | 'partial_withdrawal' | 'fully_withdrawn'

export interface InvestmentContribution {
  contribution_id: number
  entity_id: string
  investment_account_id: number
  source_account_id: number
  contribution_amount: number
  contribution_date: string // ISO date string
  main_transaction_id: number | null
  status: InvestmentContributionStatus
  notes: string | null
  created_at: string // ISO datetime string
  updated_at: string // ISO datetime string
  created_by: string | null // UUID
}

export interface InvestmentContributionWithAccounts extends InvestmentContribution {
  investment_account: {
    account_id: number
    account_name: string
    account_type: string
    entity_id: string
  }
  source_account: {
    account_id: number
    account_name: string
    account_type: string
    entity_id: string
  }
}

export interface CreateInvestmentContributionInput {
  investment_account_id?: number  // Optional: Investment account (auto-created if not provided)
  source_account_id: number  // Required: Bank/cash account that provides funds
  contribution_amount: number  // Required: Amount to invest
  contribution_date: string  // Required: Date of contribution
  notes?: string | null  // Optional: Additional notes
  existing_source_transaction_id?: number  // Optional: if provided, links to existing transaction instead of creating new one
  is_withdrawal?: boolean  // Optional: true for withdrawals, false/undefined for contributions
}

export interface UpdateInvestmentContributionInput {
  notes?: string | null
}

export interface InvestmentWithdrawalInput {
  contribution_id: number
  withdrawal_amount: number
  withdrawal_date: string
  destination_account_id: number  // Bank/cash account to receive funds
  notes?: string
}

// Display configuration
export const INVESTMENT_STATUS_LABELS: Record<InvestmentContributionStatus, string> = {
  active: 'Active',
  partial_withdrawal: 'Partially Withdrawn',
  fully_withdrawn: 'Fully Withdrawn',
}

export const INVESTMENT_STATUS_COLORS: Record<InvestmentContributionStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  partial_withdrawal: 'bg-yellow-100 text-yellow-800',
  fully_withdrawn: 'bg-gray-100 text-gray-800',
}
