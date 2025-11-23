/**
 * Cash Flow Projection API - Version 2.0
 *
 * Implements intelligent predictive forecasting with hierarchical priority system
 * to prevent double-counting of expenses.
 *
 * @see docs/CASHFLOW_SYSTEM_2.0.md for full documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { startOfMonth, endOfMonth, addMonths, format, parseISO, eachMonthOfInterval } from 'date-fns'
import {
  calculatePredictedIncome,
  calculatePredictedExpenses,
  compareBudgets,
  getCategoriesWithScheduledPayments
} from '@/lib/cash-flow-analyzer'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams

  const entityId = searchParams.get('entity_id')
  const monthsAhead = parseInt(searchParams.get('months_ahead') || '6')

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    const startDate = startOfMonth(new Date())
    const endDate = endOfMonth(addMonths(startDate, monthsAhead - 1))

    // Generate list of months
    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    // Fetch debt payments (loan disbursements/drawdowns)
    const { data: debtPayments, error: debtError } = await supabase
      .from('loan_disbursement')
      .select(`
        *,
        accounts!inner (
          entity_id,
          account_name
        )
      `)
      .eq('accounts.entity_id', entityId)
      .eq('status', 'active')
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: true })

    if (debtError) {
      console.error('Error fetching debt payments:', debtError)
    }

    // Fetch scheduled payment instances (only unpaid)
    const { data: scheduledInstances, error: scheduledError } = await supabase
      .from('scheduled_payment_instances')
      .select(`
        *,
        scheduled_payments:scheduled_payment_id!inner (
          contract_name,
          payment_type,
          payee_name,
          category_id,
          entity_id
        )
      `)
      .eq('scheduled_payments.entity_id', entityId)
      .in('status', ['pending', 'overdue']) // Only include unpaid instances
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: true })

    if (scheduledError) {
      console.error('Error fetching scheduled payments:', scheduledError)
    }

    // Fetch active budgets
    const { data: budgets, error: budgetsError } = await supabase
      .from('category_budgets')
      .select(`
        *,
        categories:category_id (
          category_name
        )
      `)
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .gte('end_date', format(startDate, 'yyyy-MM-dd'))
      .order('start_date', { ascending: true })

    if (budgetsError) {
      console.error('Error fetching budgets:', budgetsError)
    }

    // Get current cash balance (sum of all account balances)
    // First get all account IDs for this entity
    const { data: accounts, error: accountsError} = await supabase
      .from('accounts')
      .select('account_id')
      .eq('entity_id', entityId)
      .eq('is_active', true)

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
    }

    const accountIds = accounts?.map(a => a.account_id) || []

    // Then get balances for those accounts
    let currentBalance = 0
    if (accountIds.length > 0) {
      const { data: balances, error: balancesError } = await supabase
        .from('account_balances')
        .select('current_balance')
        .in('account_id', accountIds)

      if (balancesError) {
        console.error('Error fetching balances:', balancesError)
      }

      currentBalance = balances?.reduce((sum, b) => sum + (b.current_balance || 0), 0) || 0
    }

    // === CASH FLOW SYSTEM 2.0: Calculate predicted income (once for all months) ===
    const { total: predictedMonthlyIncome, breakdown: incomeBreakdown } = await calculatePredictedIncome(entityId)

    console.log(`[Cash Flow 2.0] Predicted monthly income: ${predictedMonthlyIncome.toLocaleString()} VND`)
    console.log(`[Cash Flow 2.0] Income sources: ${incomeBreakdown.length}`)

    // Build monthly projections
    const projections = await Promise.all(months.map(async (month) => {
      const monthKey = format(month, 'yyyy-MM')
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      // === PRIORITY 1: DEBT PAYMENTS ===
      const monthDebtPayments = (debtPayments || []).filter((payment: any) => {
        const dueDate = parseISO(payment.due_date)
        return dueDate >= monthStart && dueDate <= monthEnd
      }).map((payment: any) => ({
        type: 'Loan Due',
        loan_name: payment.accounts?.account_name || 'Loan Receivable',
        borrower_name: payment.borrower_name || 'Unknown',
        amount: payment.remaining_balance || 0,
        due_date: payment.due_date,
        status: payment.status
      }))

      // === PRIORITY 1: SCHEDULED PAYMENTS ===
      const monthScheduledPayments = (scheduledInstances || []).filter((instance: any) => {
        const dueDate = parseISO(instance.due_date)
        return dueDate >= monthStart && dueDate <= monthEnd
      }).map((instance: any) => ({
        contract_name: instance.scheduled_payments?.contract_name || 'Unknown',
        payment_type: instance.scheduled_payments?.payment_type,
        payee_name: instance.scheduled_payments?.payee_name || 'Unknown',
        amount: instance.amount || 0,
        due_date: instance.due_date,
        status: instance.status,
        category_id: instance.scheduled_payments?.category_id
      }))

      // === PRIORITY 2: PREDICTED EXPENSES (Cash Flow 2.0) ===
      // Only predict for categories NOT covered by scheduled payments
      const predictedExpenses = await calculatePredictedExpenses(entityId, monthKey)

      const totalPredicted = predictedExpenses.reduce((sum, exp) => sum + exp.amount, 0)

      // === PRIORITY 3: BUDGETS (only for categories with no schedule AND no history) ===
      // Get categories already covered
      const scheduledCategoryIds = await getCategoriesWithScheduledPayments(entityId, monthKey)
      const predictedCategoryNames = new Set(predictedExpenses.map(exp => exp.category_name))

      const monthBudgets = (budgets || []).filter((budget: any) => {
        const budgetStart = parseISO(budget.start_date)
        const budgetEnd = parseISO(budget.end_date)
        const categoryId = budget.category_id
        const categoryName = budget.categories?.category_name || 'Unknown'

        // Only include budget if:
        // 1. It's active this month
        // 2. NOT in scheduled payments (Priority 1)
        // 3. NOT in predicted expenses (Priority 2)
        return budgetStart <= monthEnd &&
               budgetEnd >= monthStart &&
               !scheduledCategoryIds.has(categoryId) &&
               !predictedCategoryNames.has(categoryName)
      }).map((budget: any) => ({
        category_name: budget.categories?.category_name || 'Unknown',
        budget_amount: budget.budget_amount || 0,
        estimated_spend: budget.budget_amount || 0
      }))

      // === BUDGET WARNINGS (Cash Flow 2.0) ===
      const allBudgets = (budgets || [])
        .filter((budget: any) => {
          const budgetStart = parseISO(budget.start_date)
          const budgetEnd = parseISO(budget.end_date)
          return budgetStart <= monthEnd && budgetEnd >= monthStart
        })
        .map((budget: any) => ({
          category_name: budget.categories?.category_name || 'Unknown',
          budget_amount: budget.budget_amount || 0
        }))

      const budgetWarnings = compareBudgets(predictedExpenses, allBudgets)

      // Calculate totals
      const totalDebt = monthDebtPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
      const totalScheduled = monthScheduledPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
      const totalBudgets = monthBudgets.reduce((sum: number, b: any) => sum + b.estimated_spend, 0)
      const totalObligations = totalDebt + totalScheduled + totalPredicted + totalBudgets

      return {
        month: monthKey,
        month_label: format(month, 'MMMM yyyy'),
        debt_payments: monthDebtPayments,
        scheduled_payments: monthScheduledPayments,
        predicted_expenses: predictedExpenses,
        budgets: monthBudgets,
        total_debt: totalDebt,
        total_scheduled: totalScheduled,
        total_predicted: totalPredicted,
        total_budgets: totalBudgets,
        total_obligations: totalObligations,
        income_breakdown: incomeBreakdown,
        budget_warnings: budgetWarnings
      }
    }))

    // === CASH FLOW 2.0: Calculate running balances WITH predicted income ===
    let runningBalance = currentBalance
    const projectionsWithBalance = projections.map((proj) => {
      const openingBalance = runningBalance
      const projectedIncome = predictedMonthlyIncome // Use predicted income from historical data
      const closingBalance = openingBalance + projectedIncome - proj.total_obligations
      runningBalance = closingBalance

      // Determine health status
      let health: 'surplus' | 'tight' | 'deficit'
      if (closingBalance < 0) {
        health = 'deficit'
      } else if (closingBalance < openingBalance * 0.2) {
        health = 'tight'
      } else {
        health = 'surplus'
      }

      return {
        ...proj,
        opening_balance: openingBalance,
        projected_income: projectedIncome,
        closing_balance: closingBalance,
        health
      }
    })

    // === CASH FLOW 2.0: Enhanced summary statistics ===
    const totalObligations = projections.reduce((sum, p) => sum + p.total_obligations, 0)
    const totalProjectedIncome = predictedMonthlyIncome * monthsAhead
    const lowestBalance = Math.min(...projectionsWithBalance.map(p => p.closing_balance))
    const monthsUntilNegative = projectionsWithBalance.findIndex(p => p.closing_balance < 0)

    console.log(`[Cash Flow 2.0] Total obligations (${monthsAhead} months): ${totalObligations.toLocaleString()} VND`)
    console.log(`[Cash Flow 2.0] Total projected income (${monthsAhead} months): ${totalProjectedIncome.toLocaleString()} VND`)
    console.log(`[Cash Flow 2.0] Net change: ${(totalProjectedIncome - totalObligations).toLocaleString()} VND`)
    console.log(`[Cash Flow 2.0] Lowest projected balance: ${lowestBalance.toLocaleString()} VND`)

    return NextResponse.json({
      data: {
        current_balance: currentBalance,
        months_ahead: monthsAhead,
        total_obligations: totalObligations,
        total_projected_income: totalProjectedIncome, // NEW in v2.0
        net_projected_change: totalProjectedIncome - totalObligations, // NEW in v2.0
        lowest_projected_balance: lowestBalance,
        months_until_negative: monthsUntilNegative === -1 ? null : monthsUntilNegative + 1,
        projections: projectionsWithBalance,
        version: '2.0' // Mark this as v2.0 response
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
