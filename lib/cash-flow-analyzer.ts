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
  const { data: transactions, error } = await supabase
    .from('main_transaction_details')
    .select(`
      main_transaction_id,
      transaction_date,
      amount,
      transaction_direction,
      category_id,
      category_name
    `)
    .eq('entity_id', entityId)
    .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
    .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
    .not('category_id', 'is', null)
    .eq('transaction_direction', 'credit') // Only credit transactions (income)

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
  const { data: transactions, error } = await supabase
    .from('main_transaction_details')
    .select(`
      main_transaction_id,
      transaction_date,
      amount,
      transaction_direction,
      category_id,
      category_name
    `)
    .eq('entity_id', entityId)
    .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
    .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
    .not('category_id', 'is', null)
    .eq('transaction_direction', 'debit') // Only debit transactions (expenses)

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

    // Skip if this category has a scheduled payment
    if (scheduledCategories.has(categoryId)) {
      return
    }

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

  return expenseData.map(expense => ({
    category_name: expense.category_name,
    amount: expense.monthly_average,
    historical_average: expense.monthly_average,
    months_of_data: expense.months_of_data,
    confidence: expense.confidence
  }))
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
