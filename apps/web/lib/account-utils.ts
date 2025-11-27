import { AccountType, Currency, CURRENCY_SYMBOLS, ACCOUNT_TYPE_CONFIG } from '@/types/account'

/**
 * Format a number as currency with the specified currency code
 */
export function formatCurrency(amount: number, currency: Currency = 'VND', short: boolean = false): string {
  const symbol = CURRENCY_SYMBOLS[currency]

  // Short format for charts (abbreviated)
  if (short) {
    const absAmount = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''

    if (absAmount >= 1_000_000_000) {
      return `${sign}${(absAmount / 1_000_000_000).toFixed(1)}B${symbol}`
    } else if (absAmount >= 1_000_000) {
      return `${sign}${(absAmount / 1_000_000).toFixed(1)}M${symbol}`
    } else if (absAmount >= 1_000) {
      return `${sign}${(absAmount / 1_000).toFixed(0)}K${symbol}`
    }
    return `${sign}${absAmount}${symbol}`
  }

  // Format based on currency
  if (currency === 'VND') {
    // Vietnamese Dong - no decimals
    return `${amount.toLocaleString('vi-VN')}${symbol}`
  } else if (currency === 'USD') {
    // US Dollar - 2 decimals, symbol before
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } else if (currency === 'EUR') {
    // Euro - 2 decimals, symbol after
    return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${symbol}`
  }

  return `${symbol}${amount.toLocaleString()}`
}

/**
 * Format currency for input fields (no symbol, just the number)
 */
export function formatCurrencyInput(amount: number, currency: Currency = 'VND'): string {
  if (currency === 'VND') {
    return amount.toLocaleString('vi-VN')
  }
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parse formatted currency string back to number
 */
export function parseCurrency(value: string): number {
  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = value.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Mask account number to show only last 4 digits
 */
export function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber) return '—'

  if (accountNumber.length <= 4) return accountNumber

  const lastFour = accountNumber.slice(-4)
  return `**** ${lastFour}`
}

/**
 * Get account type configuration (color, icon, label)
 */
export function getAccountTypeConfig(accountType: AccountType) {
  return ACCOUNT_TYPE_CONFIG[accountType]
}

/**
 * Get account type color class for badges
 */
export function getAccountTypeColor(accountType: AccountType): string {
  return ACCOUNT_TYPE_CONFIG[accountType].color
}

/**
 * Calculate available credit for credit accounts
 */
export function calculateAvailableCredit(creditLimit: number | null, currentBalance: number): number {
  if (creditLimit === null) return 0

  // For credit accounts, balance is typically negative (debt)
  // Available credit = limit - |balance|
  return creditLimit - Math.abs(currentBalance)
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(creditLimit: number | null, currentBalance: number): number {
  if (creditLimit === null || creditLimit === 0) return 0

  const utilized = Math.abs(currentBalance)
  return (utilized / creditLimit) * 100
}

/**
 * Check if account type requires bank information
 */
export function requiresBankInfo(accountType: AccountType): boolean {
  return ['bank', 'credit_card', 'credit_line', 'term_loan'].includes(accountType)
}

/**
 * Check if account type is a credit/debt account
 */
export function isCreditAccount(accountType: AccountType): boolean {
  return ['credit_card', 'credit_line', 'term_loan'].includes(accountType)
}

/**
 * Check if account type requires credit limit (mandatory field)
 */
export function requiresCreditLimit(accountType: AccountType): boolean {
  return ['credit_line', 'term_loan'].includes(accountType)
}

/**
 * Check if account type supports credit limit (optional or required)
 */
export function supportsCreditLimit(accountType: AccountType): boolean {
  return ['credit_card', 'credit_line', 'term_loan'].includes(accountType)
}

/**
 * Validate account number format (basic validation)
 */
export function validateAccountNumber(accountNumber: string): boolean {
  if (!accountNumber) return true // Optional field

  // Remove spaces and dashes
  const cleaned = accountNumber.replace(/[\s-]/g, '')

  // Should be alphanumeric and between 4-50 characters
  return /^[A-Za-z0-9]{4,50}$/.test(cleaned)
}

/**
 * Get balance color based on account type and balance
 */
export function getBalanceColor(accountType: AccountType, balance: number): string {
  if (isCreditAccount(accountType)) {
    // For credit accounts, negative balance is debt (red), positive is credit (green)
    return balance < 0 ? 'text-red-600' : 'text-green-600'
  } else {
    // For regular accounts, positive is good (green), negative is bad (red)
    return balance >= 0 ? 'text-green-600' : 'text-red-600'
  }
}

/**
 * Format balance with appropriate sign for account type
 */
export function formatBalanceDisplay(accountType: AccountType, balance: number, currency: Currency): string {
  const formatted = formatCurrency(Math.abs(balance), currency)

  if (isCreditAccount(accountType)) {
    // For credit accounts, show debt as positive, credit as negative
    return balance < 0 ? `-${formatted}` : formatted
  } else {
    // For regular accounts, show as-is
    return balance >= 0 ? formatted : `-${formatted}`
  }
}

/**
 * Get status badge color
 */
export function getStatusColor(isActive: boolean): { bg: string; text: string; label: string } {
  return isActive
    ? { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' }
    : { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Inactive' }
}

/**
 * Format date for display (DD/MM/YYYY format)
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format datetime for display (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}
