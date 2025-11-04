// Account Management Types

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'investment' | 'credit_line' | 'term_loan'

export type Currency = 'VND' | 'USD' | 'EUR'

export interface Account {
  account_id: number
  entity_id: string
  account_name: string
  account_type: AccountType
  account_number: string | null
  bank_name: string | null
  currency: Currency
  credit_limit: number | null
  loan_reference: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AccountBalance {
  account_id: number
  current_balance: number
  last_transaction_id: number | null
  last_updated: string
}

export interface AccountWithBalance extends Account {
  balance: AccountBalance
}

export interface AccountWithEntity extends AccountWithBalance {
  entity: {
    id: string
    name: string
    type: 'company' | 'personal'
  }
}

export interface CreateAccountInput {
  entity_id: string
  account_name: string
  account_type: AccountType
  account_number?: string
  bank_name?: string
  currency?: Currency
  credit_limit?: number
  loan_reference?: string
  initial_balance?: number
  opening_balance_date?: string // ISO 8601 date for checkpoint creation
  opening_balance_notes?: string // Notes for the checkpoint
}

export interface UpdateAccountInput {
  account_name?: string
  account_type?: AccountType
  account_number?: string
  bank_name?: string
  currency?: Currency
  credit_limit?: number
  loan_reference?: string
  is_active?: boolean
}

export interface AccountFilters {
  entity_id?: string
  account_type?: AccountType[]
  is_active?: boolean
  search?: string
}

export interface AccountTypeConfig {
  label: string
  color: string
  bgColor: string
  textColor: string
  icon: string
}

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, AccountTypeConfig> = {
  bank: {
    label: 'Bank Account',
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    icon: 'Building2',
  },
  cash: {
    label: 'Cash',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: 'Wallet',
  },
  credit_card: {
    label: 'Credit Card',
    color: 'purple',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    icon: 'CreditCard',
  },
  investment: {
    label: 'Investment',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    icon: 'TrendingUp',
  },
  credit_line: {
    label: 'Credit Line',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    icon: 'LineChart',
  },
  term_loan: {
    label: 'Term Loan',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    icon: 'FileText',
  },
}

export const CURRENCIES: Currency[] = ['VND', 'USD', 'EUR']

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  VND: '₫',
  USD: '$',
  EUR: '€',
}
