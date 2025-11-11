/**
 * Transaction Type Restriction Rules
 *
 * Defines which transaction types are allowed based on:
 * - Account type (bank, cash, credit_card, etc.)
 * - Transaction direction (debit, credit)
 *
 * Purpose: Prevent illogical transaction types (e.g., LOAN_DISBURSE on bank account credit)
 */

export type AccountType =
  | 'bank'
  | 'cash'
  | 'credit_card'
  | 'credit_line'
  | 'term_loan'
  | 'loan_receivable'
  | 'investment'

export type TransactionDirection = 'debit' | 'credit'

export interface TransactionTypeRule {
  account_types: AccountType[]
  transaction_direction: TransactionDirection
  allowed_type_codes: string[]
  description: string
}

/**
 * Transaction type restriction rules
 * Each rule defines allowed transaction types for a specific account type + direction combination
 */
export const TRANSACTION_TYPE_RULES: TransactionTypeRule[] = [
  // ============================================================================
  // BANK & CASH ACCOUNTS
  // ============================================================================
  {
    account_types: ['bank', 'cash'],
    transaction_direction: 'debit',
    allowed_type_codes: ['EXP', 'TRF_OUT', 'DEBT_PAY', 'CC_PAY', 'INV', 'LOAN_DISBURSE'],
    description: 'Bank/Cash - Money out: expenses, transfers out, paying debts, paying credit cards, investments, lending to borrowers'
  },
  {
    account_types: ['bank', 'cash'],
    transaction_direction: 'credit',
    allowed_type_codes: ['INC', 'TRF_IN', 'DEBT_TAKE', 'LOAN_COLLECT'],
    description: 'Bank/Cash - Money in: income, transfers in, borrowing money, collecting loan repayments'
  },

  // ============================================================================
  // CREDIT CARD ACCOUNTS
  // CC_CHARGE/CC_PAY model: Clean separation from debt mechanics
  // - Charges use CC_CHARGE (affects_cashflow=false) to track expenses + debt without cash impact
  // - Payments use CC_PAY (affects_cashflow=true) to record payment received
  // - Matches with bank TRF_OUT ↔ CC_PAY
  // See CREDIT_CARD_MECHANICS.md for full explanation
  // ============================================================================
  {
    account_types: ['credit_card'],
    transaction_direction: 'debit',
    allowed_type_codes: ['CC_CHARGE', 'TRF_OUT'],
    description: 'Credit Card - Charges: credit card purchases (CC_CHARGE), balance transfers out'
  },
  {
    account_types: ['credit_card'],
    transaction_direction: 'credit',
    allowed_type_codes: ['CC_PAY', 'TRF_IN'],
    description: 'Credit Card - Payments: receiving payment (CC_PAY), balance transfers in, refunds'
  },

  // ============================================================================
  // CREDIT LINE ACCOUNTS (Revolving Credit)
  // ============================================================================
  {
    account_types: ['credit_line'],
    transaction_direction: 'debit',
    allowed_type_codes: ['DEBT_TAKE'],
    description: 'Credit Line - Drawing: drawing money from credit line (liability increases)'
  },
  {
    account_types: ['credit_line'],
    transaction_direction: 'credit',
    allowed_type_codes: ['DEBT_PAY'],
    description: 'Credit Line - Repayment: paying back credit line (liability decreases)'
  },

  // ============================================================================
  // TERM LOAN ACCOUNTS (Fixed Loans)
  // ============================================================================
  {
    account_types: ['term_loan'],
    transaction_direction: 'debit',
    allowed_type_codes: ['DEBT_TAKE'],
    description: 'Term Loan - Drawing: initial drawdown or additional drawings (liability increases)'
  },
  {
    account_types: ['term_loan'],
    transaction_direction: 'credit',
    allowed_type_codes: ['DEBT_PAY'],
    description: 'Term Loan - Repayment: making loan payments (liability decreases)'
  },

  // ============================================================================
  // LOAN RECEIVABLE ACCOUNTS (Money Lent Out - Assets)
  // ============================================================================
  {
    account_types: ['loan_receivable'],
    transaction_direction: 'debit',
    allowed_type_codes: ['LOAN_DISBURSE'],
    description: 'Loan Receivable - Disbursement: lending money to borrower (asset increases)'
  },
  {
    account_types: ['loan_receivable'],
    transaction_direction: 'credit',
    allowed_type_codes: ['LOAN_COLLECT'],
    description: 'Loan Receivable - Collection: receiving repayment from borrower (asset decreases)'
  },

  // ============================================================================
  // INVESTMENT ACCOUNTS (Similar to Loan Receivable - investing for returns)
  // ============================================================================
  {
    account_types: ['investment'],
    transaction_direction: 'debit',
    allowed_type_codes: ['INV', 'EXP'],
    description: 'Investment - Outflow: buying investments, investment fees'
  },
  {
    account_types: ['investment'],
    transaction_direction: 'credit',
    allowed_type_codes: ['INC'],
    description: 'Investment - Inflow: investment returns, selling investments'
  },
]

/**
 * Get filtered transaction types based on account type and direction
 *
 * @param accountType - The type of account (bank, cash, credit_card, etc.)
 * @param transactionDirection - The transaction direction (debit or credit)
 * @param allTypes - All available transaction types
 * @returns Filtered transaction types that are allowed for this account + direction
 */
export function getFilteredTransactionTypes<T extends { type_code: string }>(
  accountType: AccountType,
  transactionDirection: TransactionDirection,
  allTypes: T[]
): T[] {
  // Find the matching rule
  const rule = TRANSACTION_TYPE_RULES.find(
    r => r.account_types.includes(accountType) && r.transaction_direction === transactionDirection
  )

  // If no rule found, return all types (fallback - should not happen)
  if (!rule) {
    console.warn(`No transaction type rule found for ${accountType} + ${transactionDirection}`)
    return allTypes
  }

  // Filter types based on allowed codes
  return allTypes.filter(type => rule.allowed_type_codes.includes(type.type_code))
}

/**
 * Check if a transaction type is allowed for a given account type and direction
 *
 * @param typeCode - The transaction type code to check
 * @param accountType - The type of account
 * @param transactionDirection - The transaction direction
 * @returns true if the transaction type is allowed, false otherwise
 */
export function isTransactionTypeAllowed(
  typeCode: string,
  accountType: AccountType,
  transactionDirection: TransactionDirection
): boolean {
  const rule = TRANSACTION_TYPE_RULES.find(
    r => r.account_types.includes(accountType) && r.transaction_direction === transactionDirection
  )

  if (!rule) return false

  return rule.allowed_type_codes.includes(typeCode)
}

/**
 * Get a human-readable explanation of why a transaction type is not allowed
 *
 * @param typeCode - The transaction type code
 * @param accountType - The type of account
 * @param transactionDirection - The transaction direction
 * @returns Explanation string or null if allowed
 */
export function getRestrictionReason(
  typeCode: string,
  accountType: AccountType,
  transactionDirection: TransactionDirection
): string | null {
  if (isTransactionTypeAllowed(typeCode, accountType, transactionDirection)) {
    return null
  }

  const rule = TRANSACTION_TYPE_RULES.find(
    r => r.account_types.includes(accountType) && r.transaction_direction === transactionDirection
  )

  if (!rule) {
    return `No rule defined for ${accountType} accounts with ${transactionDirection} direction`
  }

  return `${typeCode} is not allowed for ${accountType} accounts with ${transactionDirection} direction. Allowed types: ${rule.allowed_type_codes.join(', ')}`
}
