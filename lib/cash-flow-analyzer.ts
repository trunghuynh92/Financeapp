/**
 * Cash Flow System 2.0 - Historical Transaction Analyzer
 *
 * This module analyzes historical transaction data to predict future income and expenses.
 * It implements a hierarchical priority system to prevent double-counting.
 *
 * @see docs/CASHFLOW_SYSTEM_2.0.md for full documentation
 */

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns'

export interface HistoricalIncome {
  category_id: number
  category_name: string
  monthly_average: number
  months_of_data: number
  is_recurring: boolean
  confidence: 'high' | 'medium' | 'low'
  source: 'recurring' | 'average' | 'estimate'
}

export interface HistoricalExpense {
  category_id: number
  category_name: string
  monthly_average: number
  months_of_data: number
  confidence: 'high' | 'medium' | 'low'
  variance_percentage: number
  has_scheduled_payment: boolean // Flag to prevent double-counting
}

export interface IncomeBreakdown {
  category_name: string
  amount: number
  confidence: 'high' | 'medium' | 'low'
  source: 'recurring' | 'average' | 'estimate'
}

export interface PredictedExpense {
  category_name: string
  amount: number
  historical_average: number
  months_of_data: number
  confidence: 'high' | 'medium' | 'low'
  has_gap?: boolean // True if this is a gap between scheduled and historical
  scheduled_amount?: number // Amount covered by scheduled payments
}

export interface BudgetWarning {
  category_name: string
  projected: number
  budget: number
  variance: number
}

/**
 * Analyze historical income patterns from past transactions
 *
 * @param entityId - The entity to analyze
 * @param monthsBack - Number of months to look back (default: 6)
 * @returns Array of income predictions by category
 */
export async function analyzeHistoricalIncome(
  entityId: string,
  monthsBack: number = 6
): Promise<HistoricalIncome[]> {
  const supabase = createSupabaseServerClient()

  const startDate = startOfMonth(subMonths(new Date(), monthsBack))
  const endDate = endOfMonth(new Date())

  // Fetch income transactions (credit direction transactions)
  // Exclude transfers (TRF_IN) and debt drawdowns (DEBT_TAKE) as they are not real income
  const { data: transactions, error } = await supabase
    .from('main_transaction_details')
    .select(`
      main_transaction_id,
      transaction_date,
      amount,
      transaction_direction,
      category_id,
      category_name,
      transaction_type_code,
      affects_cashflow
    `)
    .eq('entity_id', entityId)
    .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
    .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
    .not('category_id', 'is', null)
    .eq('transaction_direction', 'credit') // Only credit transactions (income)
    .eq('affects_cashflow', true) // Only transactions that affect cash flow (excludes transfers, debt)
    .not('transaction_type_code', 'in', '(TRF_IN,DEBT_TAKE,DEBT_PAYBACK)') // Explicitly exclude transfers and debt-related

  if (error) {
    console.error('Error fetching income transactions:', error)
    return []
  }

  // All transactions are income (filtered by direction)
  const incomeTransactions = transactions || []

  // Group by category and calculate statistics
  const categoryMap = new Map<number, {
    category_id: number
    category_name: string
    amounts: number[]
    months: Set<string>
  }>()

  incomeTransactions.forEach(tx => {
    const categoryId = tx.category_id!
    const categoryName = (tx as any)?.category_name || 'Unknown'
    const amount = (tx as any).amount || 0
    const month = format(parseISO(tx.transaction_date), 'yyyy-MM')

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        category_id: categoryId,
        category_name: categoryName,
        amounts: [],
        months: new Set()
      })
    }

    const entry = categoryMap.get(categoryId)!
    entry.amounts.push(amount)
    entry.months.add(month)
  })

  // Calculate predictions for each category
  const predictions: HistoricalIncome[] = Array.from(categoryMap.values()).map(category => {
    const monthsOfData = category.months.size
    const totalAmount = category.amounts.reduce((sum, amt) => sum + amt, 0)
    const monthlyAverage = totalAmount / Math.max(monthsOfData, 1)

    // Calculate variance to determine if it's recurring
    const mean = monthlyAverage
    const variance = category.amounts.reduce((sum, amt) => {
      return sum + Math.pow(amt - mean, 2)
    }, 0) / category.amounts.length
    const stdDev = Math.sqrt(variance)
    const variancePercentage = mean > 0 ? (stdDev / mean) * 100 : 100

    // Determine if recurring (low variance, appears in most months)
    const appearanceRate = monthsOfData / monthsBack
    const isRecurring = variancePercentage < 15 && appearanceRate >= 0.5

    // Confidence scoring
    let confidence: 'high' | 'medium' | 'low'
    if (monthsOfData >= 4 && variancePercentage < 10) {
      confidence = 'high'
    } else if (monthsOfData >= 3 && variancePercentage < 30) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    // Determine source
    let source: 'recurring' | 'average' | 'estimate'
    if (isRecurring) {
      source = 'recurring'
    } else if (monthsOfData >= 3) {
      source = 'average'
    } else {
      source = 'estimate'
    }

    return {
      category_id: category.category_id,
      category_name: category.category_name,
      monthly_average: monthlyAverage,
      months_of_data: monthsOfData,
      is_recurring: isRecurring,
      confidence,
      source
    }
  })

  return predictions.filter(p => p.monthly_average > 0)
}

/**
 * Get categories that already have scheduled payments
 * These should be excluded from historical expense predictions to prevent double-counting
 *
 * @param entityId - The entity to check
 * @param monthKey - The month to check for (format: 'yyyy-MM')
 * @returns Set of category IDs that have scheduled payments
 */
export async function getCategoriesWithScheduledPayments(
  entityId: string,
  monthKey: string
): Promise<Set<number>> {
  const supabase = createSupabaseServerClient()

  const monthStart = startOfMonth(parseISO(monthKey + '-01'))
  const monthEnd = endOfMonth(monthStart)

  const { data: scheduledPayments, error } = await supabase
    .from('scheduled_payment_instances')
    .select(`
      scheduled_payments:scheduled_payment_id!inner (
        category_id,
        entity_id
      )
    `)
    .eq('scheduled_payments.entity_id', entityId)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
    .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))

  if (error) {
    console.error('Error fetching scheduled payment categories:', error)
    return new Set()
  }

  const categoryIds = new Set<number>()
  scheduledPayments?.forEach(sp => {
    const categoryId = (sp.scheduled_payments as any)?.category_id
    if (categoryId) {
      categoryIds.add(categoryId)
    }
  })

  return categoryIds
}

/**
 * Get scheduled payment amounts by category for a given month
 * Returns a map of category_id -> total scheduled amount
 */
export async function getScheduledAmountsByCategory(
  entityId: string,
  monthKey: string
): Promise<Map<number, number>> {
  const supabase = createSupabaseServerClient()

  const monthStart = startOfMonth(parseISO(monthKey + '-01'))
  const monthEnd = endOfMonth(monthStart)

  const { data: instances, error } = await supabase
    .from('scheduled_payment_instances')
    .select(`
      amount,
      scheduled_payments:scheduled_payment_id!inner (
        category_id,
        entity_id
      )
    `)
    .eq('scheduled_payments.entity_id', entityId)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
    .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))

  if (error) {
    console.error('Error fetching scheduled payment amounts:', error)
    return new Map()
  }

  const categoryAmounts = new Map<number, number>()
  instances?.forEach(inst => {
    const categoryId = (inst.scheduled_payments as any)?.category_id
    const amount = inst.amount || 0
    if (categoryId) {
      const currentTotal = categoryAmounts.get(categoryId) || 0
      categoryAmounts.set(categoryId, currentTotal + amount)
    }
  })

  return categoryAmounts
}

/**
 * Analyze historical expense patterns from past transactions
 * Excludes categories that have scheduled payments to prevent double-counting
 *
 * @param entityId - The entity to analyze
 * @param monthKey - The month to predict for (to check scheduled payments)
 * @param monthsBack - Number of months to look back (default: 6)
 * @returns Array of expense predictions by category
 */
export async function analyzeHistoricalExpenses(
  entityId: string,
  monthKey: string,
  monthsBack: number = 6
): Promise<HistoricalExpense[]> {
  const supabase = createSupabaseServerClient()

  const startDate = startOfMonth(subMonths(new Date(), monthsBack))
  const endDate = endOfMonth(new Date())

  // Get categories with scheduled payments (to exclude)
  const scheduledCategories = await getCategoriesWithScheduledPayments(entityId, monthKey)

  // Fetch expense transactions (debit direction transactions)
  // Exclude transfers (TRF_OUT) and debt payments (DEBT_PAYBACK) as they are not regular expenses
  const { data: transactions, error } = await supabase
    .from('main_transaction_details')
    .select(`
      main_transaction_id,
      transaction_date,
      amount,
      transaction_direction,
      category_id,
      category_name,
      transaction_type_code,
      affects_cashflow
    `)
    .eq('entity_id', entityId)
    .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
    .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
    .not('category_id', 'is', null)
    .eq('transaction_direction', 'debit') // Only debit transactions (expenses)
    .eq('affects_cashflow', true) // Only transactions that affect cash flow
    .not('transaction_type_code', 'in', '(TRF_OUT,DEBT_TAKE,DEBT_PAYBACK)') // Exclude transfers and debt-related

  if (error) {
    console.error('Error fetching expense transactions:', error)
    return []
  }

  // All transactions are expenses (filtered by direction)
  const expenseTransactions = transactions || []

  // Group by category and calculate statistics
  const categoryMap = new Map<number, {
    category_id: number
    category_name: string
    amounts: number[]
    months: Set<string>
  }>()

  expenseTransactions.forEach(tx => {
    const categoryId = tx.category_id!
    const categoryName = (tx as any)?.category_name || 'Unknown'
    const amount = (tx as any).amount || 0
    const month = format(parseISO(tx.transaction_date), 'yyyy-MM')

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        category_id: categoryId,
        category_name: categoryName,
        amounts: [],
        months: new Set()
      })
    }

    const entry = categoryMap.get(categoryId)!
    entry.amounts.push(amount)
    entry.months.add(month)
  })

  // Calculate predictions for each category
  const predictions: HistoricalExpense[] = Array.from(categoryMap.values()).map(category => {
    const monthsOfData = category.months.size
    const totalAmount = category.amounts.reduce((sum, amt) => sum + amt, 0)
    const monthlyAverage = totalAmount / Math.max(monthsOfData, 1)

    // Calculate variance
    const mean = monthlyAverage
    const variance = category.amounts.reduce((sum, amt) => {
      return sum + Math.pow(amt - mean, 2)
    }, 0) / category.amounts.length
    const stdDev = Math.sqrt(variance)
    const variancePercentage = mean > 0 ? (stdDev / mean) * 100 : 100

    // Confidence scoring
    let confidence: 'high' | 'medium' | 'low'
    if (monthsOfData >= 4 && variancePercentage < 10) {
      confidence = 'high'
    } else if (monthsOfData >= 3 && variancePercentage < 30) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    return {
      category_id: category.category_id,
      category_name: category.category_name,
      monthly_average: monthlyAverage,
      months_of_data: monthsOfData,
      confidence,
      variance_percentage: variancePercentage,
      has_scheduled_payment: false // Already filtered out
    }
  })

  return predictions.filter(p => p.monthly_average > 0)
}

/**
 * Calculate total predicted income for a month
 *
 * @param entityId - The entity to analyze
 * @returns Total predicted monthly income and breakdown
 */
export async function calculatePredictedIncome(
  entityId: string
): Promise<{ total: number; breakdown: IncomeBreakdown[] }> {
  const incomeData = await analyzeHistoricalIncome(entityId, 6)

  const breakdown: IncomeBreakdown[] = incomeData.map(income => ({
    category_name: income.category_name,
    amount: income.monthly_average,
    confidence: income.confidence,
    source: income.source
  }))

  const total = incomeData.reduce((sum, income) => sum + income.monthly_average, 0)

  return { total, breakdown }
}

/**
 * Calculate predicted expenses for a month, excluding scheduled payments
 *
 * @param entityId - The entity to analyze
 * @param monthKey - The month to predict for
 * @returns Predicted expenses breakdown
 */
export async function calculatePredictedExpenses(
  entityId: string,
  monthKey: string
): Promise<PredictedExpense[]> {
  const expenseData = await analyzeHistoricalExpenses(entityId, monthKey, 6)
  const scheduledAmounts = await getScheduledAmountsByCategory(entityId, monthKey)

  const predictions: PredictedExpense[] = []

  expenseData.forEach(expense => {
    const scheduledAmount = scheduledAmounts.get(expense.category_id) || 0
    const historicalAverage = expense.monthly_average

    // If there's no scheduled payment, show full historical average
    if (scheduledAmount === 0) {
      predictions.push({
        category_name: expense.category_name,
        amount: historicalAverage,
        historical_average: historicalAverage,
        months_of_data: expense.months_of_data,
        confidence: expense.confidence,
        has_gap: false
      })
    }
    // If historical average > scheduled, show the gap
    else if (historicalAverage > scheduledAmount) {
      const gapAmount = historicalAverage - scheduledAmount
      predictions.push({
        category_name: expense.category_name,
        amount: gapAmount,
        historical_average: historicalAverage,
        months_of_data: expense.months_of_data,
        confidence: expense.confidence,
        has_gap: true,
        scheduled_amount: scheduledAmount
      })
    }
    // If scheduled >= historical, don't show in predictions (fully covered)
    // This prevents showing the category in Priority 2 at all
  })

  return predictions
}

/**
 * Compare predicted expenses with budgets to generate warnings
 *
 * @param predictedExpenses - Predicted expense amounts
 * @param budgets - Active budgets
 * @returns Array of budget warnings for overages
 */
export function compareBudgets(
  predictedExpenses: PredictedExpense[],
  budgets: Array<{ category_name: string; budget_amount: number }>
): BudgetWarning[] {
  const warnings: BudgetWarning[] = []

  // Create a map of budgets by category
  const budgetMap = new Map<string, number>()
  budgets.forEach(budget => {
    budgetMap.set(budget.category_name, budget.budget_amount)
  })

  // Check each predicted expense against budget
  predictedExpenses.forEach(expense => {
    const budgetAmount = budgetMap.get(expense.category_name)
    if (budgetAmount && expense.amount > budgetAmount) {
      warnings.push({
        category_name: expense.category_name,
        projected: expense.amount,
        budget: budgetAmount,
        variance: expense.amount - budgetAmount
      })
    }
  })

  return warnings
}

// ==============================================================================
// CASH FLOW 3.0: LIQUIDITY & SOLVENCY ANALYSIS
// ==============================================================================

export interface AccountBalance {
  account_id: number
  account_name: string
  account_type: string
  current_balance: number
}

export interface ReceivableLoan {
  loan_disbursement_id: number
  borrower_name: string
  remaining_balance: number
  due_date: string | null
  is_overdue: boolean
  days_overdue: number
}

export interface LiquidityPosition {
  // Cash accounts (checking, savings)
  cash_balance: number
  cash_accounts: AccountBalance[]
  
  // Investment accounts (stocks, bonds, funds)
  investment_balance: number
  investment_accounts: AccountBalance[]
  
  // Receivables (loans given out)
  receivables_balance: number
  receivables: ReceivableLoan[]
  overdue_receivables: number
  overdue_count: number
  
  // Total liquidity
  total_liquid_assets: number
}

export interface RunwayAnalysis {
  monthly_burn_rate: number
  cash_runway_months: number
  liquidity_runway_months: number
  quick_ratio: number
  will_run_out_of_cash: boolean
  cash_depletion_month: string | null
  liquidity_buffer: number // Extra months from investments + receivables
}

/**
 * Get all account balances grouped by type
 * 
 * @param entityId - The entity to analyze
 * @returns Account balances grouped by type
 */
export async function getAccountBalancesByType(
  entityId: string
): Promise<{ cash: AccountBalance[]; investments: AccountBalance[]; total_cash: number; total_investments: number }> {
  const supabase = createSupabaseServerClient()

  // Get all accounts with their balances
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('account_id, account_name, account_type')
    .eq('entity_id', entityId)
    .eq('is_active', true)

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError)
    return { cash: [], investments: [], total_cash: 0, total_investments: 0 }
  }

  console.log(`[Liquidity] Found ${accounts?.length || 0} accounts for entity ${entityId}`)
  console.log(`[Liquidity] Account types: ${accounts?.map(a => `${a.account_name}(${a.account_type})`).join(', ')}`)

  const accountIds = accounts?.map(a => a.account_id) || []

  if (accountIds.length === 0) {
    return { cash: [], investments: [], total_cash: 0, total_investments: 0 }
  }

  // Calculate balances for those accounts using RPC function
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const accountsWithBalances: AccountBalance[] = []

  for (const acc of (accounts || [])) {
    const { data: balance, error: balanceError } = await supabase.rpc('calculate_balance_up_to_date', {
      p_account_id: acc.account_id,
      p_up_to_date: today,
    })

    if (balanceError) {
      console.error(`[Liquidity] Error calculating balance for ${acc.account_name}:`, JSON.stringify(balanceError))
    }
    console.log(`[Liquidity] ${acc.account_name} (${acc.account_type}) balance: ${balance || 0}`)

    accountsWithBalances.push({
      account_id: acc.account_id,
      account_name: acc.account_name,
      account_type: acc.account_type,
      current_balance: balance || 0
    })
  }

  // Separate cash accounts from investment accounts
  // Based on AccountType: 'bank' | 'cash' | 'credit_card' | 'investment' | 'credit_line' | 'term_loan' | 'loan_receivable'
  const cashAccounts = accountsWithBalances.filter(a =>
    a.account_type === 'bank' ||
    a.account_type === 'cash'
  )

  const investmentAccounts = accountsWithBalances.filter(a =>
    a.account_type === 'investment'
  )

  const totalCash = cashAccounts.reduce((sum, a) => sum + a.current_balance, 0)
  const totalInvestments = investmentAccounts.reduce((sum, a) => sum + a.current_balance, 0)

  return {
    cash: cashAccounts,
    investments: investmentAccounts,
    total_cash: totalCash,
    total_investments: totalInvestments
  }
}

/**
 * Get outstanding receivables (loans given to others)
 * 
 * @param entityId - The entity to analyze
 * @returns Receivables summary
 */
export async function analyzeReceivables(
  entityId: string
): Promise<{ total: number; overdue_total: number; loans: ReceivableLoan[] }> {
  const supabase = createSupabaseServerClient()

  // Get all accounts for this entity
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('account_id')
    .eq('entity_id', entityId)
    .eq('is_active', true)

  if (accountsError) {
    console.error('Error fetching accounts for receivables:', accountsError)
    return { total: 0, overdue_total: 0, loans: [] }
  }

  const accountIds = accounts?.map(a => a.account_id) || []

  if (accountIds.length === 0) {
    return { total: 0, overdue_total: 0, loans: [] }
  }

  // Get loan disbursements (money we lent out)
  const { data: loans, error } = await supabase
    .from('loan_disbursement')
    .select(`
      loan_disbursement_id,
      borrower_name,
      remaining_balance,
      due_date,
      status
    `)
    .in('account_id', accountIds)
    .eq('status', 'active')

  if (error) {
    console.error('Error fetching receivables:', error)
    return { total: 0, overdue_total: 0, loans: [] }
  }

  const today = new Date()
  const receivableLoans: ReceivableLoan[] = (loans || []).map((loan: any) => {
    const dueDate = loan.due_date ? new Date(loan.due_date) : null
    const isOverdue = dueDate ? dueDate < today : false
    const daysOverdue = isOverdue && dueDate 
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return {
      loan_disbursement_id: loan.loan_disbursement_id,
      borrower_name: loan.borrower_name,
      remaining_balance: loan.remaining_balance || 0,
      due_date: loan.due_date,
      is_overdue: isOverdue,
      days_overdue: daysOverdue
    }
  })

  const total = receivableLoans.reduce((sum, l) => sum + l.remaining_balance, 0)
  const overdueTotal = receivableLoans
    .filter(l => l.is_overdue)
    .reduce((sum, l) => sum + l.remaining_balance, 0)

  return { 
    total, 
    overdue_total: overdueTotal,
    loans: receivableLoans 
  }
}

/**
 * Calculate complete liquidity position
 * 
 * @param entityId - The entity to analyze
 * @returns Complete liquidity analysis
 */
export async function analyzeLiquidityPosition(
  entityId: string
): Promise<LiquidityPosition> {
  // Get account balances by type
  const {
    cash: cashAccounts,
    investments: investmentAccounts,
    total_cash,
    total_investments
  } = await getAccountBalancesByType(entityId)
  
  // Get receivables
  const { total: totalReceivables, overdue_total, loans } = await analyzeReceivables(entityId)

  const totalLiquidAssets = total_cash + total_investments + totalReceivables
  const overdueCount = loans.filter(l => l.is_overdue).length

  return {
    cash_balance: total_cash,
    cash_accounts: cashAccounts,
    investment_balance: total_investments,
    investment_accounts: investmentAccounts,
    receivables_balance: totalReceivables,
    receivables: loans,
    overdue_receivables: overdue_total,
    overdue_count: overdueCount,
    total_liquid_assets: totalLiquidAssets
  }
}

/**
 * Calculate runway analysis
 * 
 * @param liquidity - Liquidity position
 * @param monthlyBurnRate - Average monthly expenses
 * @param monthlyIncome - Average monthly income
 * @param monthsAhead - Number of months to project
 * @returns Runway analysis with depletion warnings
 */
export function calculateRunwayAnalysis(
  liquidity: LiquidityPosition,
  monthlyBurnRate: number,
  monthlyIncome: number,
  monthsAhead: number = 6
): RunwayAnalysis {
  const netMonthlyBurn = monthlyBurnRate - monthlyIncome

  // If income > expenses, infinite runway
  if (netMonthlyBurn <= 0) {
    return {
      monthly_burn_rate: netMonthlyBurn,
      cash_runway_months: Infinity,
      liquidity_runway_months: Infinity,
      quick_ratio: Infinity,
      will_run_out_of_cash: false,
      cash_depletion_month: null,
      liquidity_buffer: Infinity
    }
  }

  // Calculate cash runway
  const cashRunway = liquidity.cash_balance / netMonthlyBurn

  // Calculate total liquidity runway
  const liquidityRunway = liquidity.total_liquid_assets / netMonthlyBurn

  // Quick ratio (liquid assets / monthly obligations)
  const quickRatio = liquidity.total_liquid_assets / monthlyBurnRate

  // Determine cash depletion month
  let cashDepletionMonth: string | null = null
  if (cashRunway < monthsAhead) {
    const depletionDate = new Date()
    depletionDate.setMonth(depletionDate.getMonth() + Math.floor(cashRunway))
    cashDepletionMonth = format(depletionDate, 'yyyy-MM')
  }

  return {
    monthly_burn_rate: netMonthlyBurn,
    cash_runway_months: cashRunway,
    liquidity_runway_months: liquidityRunway,
    quick_ratio: quickRatio,
    will_run_out_of_cash: cashRunway < monthsAhead,
    cash_depletion_month: cashDepletionMonth,
    liquidity_buffer: liquidityRunway - cashRunway
  }
}
