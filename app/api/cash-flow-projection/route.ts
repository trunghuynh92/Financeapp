/**
 * Cash Flow Projection API - Version 3.0
 *
 * Implements intelligent predictive forecasting with hierarchical priority system
 * to prevent double-counting of expenses, plus liquidity & solvency analysis.
 *
 * @see docs/CASHFLOW_SYSTEM_2.0.md for v2.0 documentation
 * @see docs/CASHFLOW_SYSTEM_3.0.md for v3.0 liquidity features
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { startOfMonth, endOfMonth, addMonths, format, parseISO, eachMonthOfInterval } from 'date-fns'
import {
  calculatePredictedIncome,
  calculatePredictedExpenses,
  compareBudgets,
  getCategoriesWithScheduledPayments,
  analyzeLiquidityPosition,
  calculateRunwayAnalysis
} from '@/lib/cash-flow-analyzer'

// Helper type for scenario adjustments
interface ScenarioAdjustment {
  adjustment_id: number
  adjustment_type: string
  name: string
  amount: number | null
  percentage: number | null
  start_month: string | null
  end_month: string | null
  category_id: number | null
  scheduled_payment_id: number | null
  account_id: number | null
  metadata: {
    repayment_month?: string // YYYY-MM format (calculated)
    repayment_months?: number // Number of months after drawdown (user selection)
    credit_line_account_id?: number
    interest_rate?: number
  } | null
}

// Helper type for debt repayment from scenarios
interface ScenarioDebtRepayment {
  adjustment_id: number
  name: string
  amount: number
  repayment_month: string // YYYY-MM format
  credit_line_account_id?: number
}

// Apply scenario adjustments to a monthly projection
function applyScenarioAdjustments(
  monthKey: string, // YYYY-MM format
  baseIncome: number,
  basePredictedExpenses: number,
  adjustments: ScenarioAdjustment[]
): {
  adjustedIncome: number
  adjustedPredicted: number
  scenarioDebtDrawdown: number // NEW: Separate debt drawdown amount for chart display
  scenarioDebtRepayment: number // NEW: Debt repayment amount (from scenario) for chart display
  scenarioIncome: number // NEW: Additional scenario income (not debt)
  scenarioExpense: number // NEW: Additional scenario expense
  scenarioItems: { name: string; amount: number; type: string }[]
} {
  let adjustedIncome = baseIncome
  let adjustedPredicted = basePredictedExpenses
  let scenarioDebtDrawdown = 0 // Track debt drawdowns separately
  let scenarioDebtRepayment = 0 // Track debt repayments separately
  let scenarioIncome = 0 // Track scenario income additions
  let scenarioExpense = 0 // Track scenario expense additions
  const scenarioItems: { name: string; amount: number; type: string }[] = []

  const monthDate = parseISO(`${monthKey}-01`)

  for (const adj of adjustments) {
    // Check if adjustment applies to this month
    const startMonth = adj.start_month ? parseISO(adj.start_month) : null
    const endMonth = adj.end_month ? parseISO(adj.end_month) : null

    const startsBeforeOrOn = !startMonth || startMonth <= monthDate
    const endsAfterOrOn = !endMonth || endMonth >= monthDate

    // For one-time items, only apply if start_month matches
    // debt_drawdown is also a one-time event (single loan disbursement)
    const isOneTime = adj.adjustment_type.startsWith('one_time') || adj.adjustment_type === 'debt_drawdown'
    const matchesMonth = isOneTime
      ? (startMonth && format(startMonth, 'yyyy-MM') === monthKey)
      : (startsBeforeOrOn && endsAfterOrOn)

    // Check for debt repayment in this month (from debt_drawdown metadata)
    if (adj.adjustment_type === 'debt_drawdown' && adj.amount && adj.metadata?.repayment_month) {
      const repaymentMonth = adj.metadata.repayment_month
      if (repaymentMonth === monthKey) {
        // Add debt repayment as an expense in the repayment month
        adjustedPredicted += adj.amount
        scenarioDebtRepayment += adj.amount
        scenarioItems.push({
          name: `${adj.name} (Repayment)`,
          amount: -adj.amount,
          type: 'debt_repayment'
        })
        console.log(`[Scenario Debug] Added debt_repayment: ${adj.amount} to month ${monthKey}`)
      }
    }

    if (!matchesMonth) continue

    console.log(`[Scenario Debug] Applying ${adj.adjustment_type} "${adj.name}" to month ${monthKey}`)

    switch (adj.adjustment_type) {
      case 'one_time_income':
      case 'recurring_income':
        if (adj.amount) {
          adjustedIncome += adj.amount
          scenarioIncome += adj.amount
          scenarioItems.push({
            name: adj.name,
            amount: adj.amount,
            type: 'income'
          })
        }
        break

      case 'one_time_expense':
      case 'recurring_expense':
        if (adj.amount) {
          adjustedPredicted += adj.amount
          scenarioExpense += adj.amount
          scenarioItems.push({
            name: adj.name,
            amount: -adj.amount,
            type: 'expense'
          })
        }
        break

      case 'debt_drawdown':
        // Add debt as income (cash inflow) but track it separately for display
        if (adj.amount) {
          adjustedIncome += adj.amount
          scenarioDebtDrawdown += adj.amount // Track separately!
          scenarioItems.push({
            name: adj.name,
            amount: adj.amount,
            type: 'debt'
          })
          console.log(`[Scenario Debug] Added debt_drawdown: ${adj.amount} to month ${monthKey}`)
        }
        break

      case 'modify_predicted':
        // Apply percentage change to predicted expenses
        if (adj.percentage !== null) {
          const change = basePredictedExpenses * (adj.percentage / 100)
          adjustedPredicted += change
          scenarioExpense += change
          scenarioItems.push({
            name: adj.name,
            amount: change,
            type: 'modification'
          })
        }
        break

      case 'modify_income':
        // Apply percentage change to income
        if (adj.percentage !== null) {
          const change = baseIncome * (adj.percentage / 100)
          adjustedIncome += change
          scenarioIncome += change
          scenarioItems.push({
            name: adj.name,
            amount: change,
            type: 'modification'
          })
        }
        break
    }
  }

  return { adjustedIncome, adjustedPredicted, scenarioDebtDrawdown, scenarioDebtRepayment, scenarioIncome, scenarioExpense, scenarioItems }
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams

  const entityId = searchParams.get('entity_id')
  const monthsAhead = parseInt(searchParams.get('months_ahead') || '6')
  const scenarioId = searchParams.get('scenario_id') // NEW: Optional scenario

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    const startDate = startOfMonth(new Date())
    const endDate = endOfMonth(addMonths(startDate, monthsAhead - 1))

    // Fetch scenario adjustments if scenario_id provided
    let scenarioAdjustments: ScenarioAdjustment[] = []
    let scenarioInfo: { name: string; color: string } | null = null

    if (scenarioId) {
      console.log(`[Scenario Debug] Fetching scenario ${scenarioId} for entity ${entityId}`)
      const { data: scenario, error: scenarioError } = await supabase
        .from('cashflow_scenarios')
        .select(`
          name,
          color,
          adjustments:scenario_adjustments(*)
        `)
        .eq('scenario_id', scenarioId)
        .eq('entity_id', entityId)
        .single()

      if (scenarioError) {
        console.error('[Scenario Debug] Error fetching scenario:', scenarioError)
      }

      if (!scenarioError && scenario) {
        scenarioInfo = { name: scenario.name, color: scenario.color }
        scenarioAdjustments = scenario.adjustments || []
        console.log(`[Scenario Debug] Found scenario: ${scenario.name}, adjustments: ${scenarioAdjustments.length}`)
        console.log('[Scenario Debug] Adjustments:', JSON.stringify(scenarioAdjustments, null, 2))
      }
    }

    // Generate list of months
    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    // Fetch debt drawdowns (money we borrowed and need to pay back)
    // These are from credit_line/term_loan accounts with due dates
    const { data: debtDrawdowns, error: debtDrawdownError } = await supabase
      .from('debt_drawdown')
      .select(`
        *,
        accounts!inner (
          entity_id,
          account_name,
          account_type
        )
      `)
      .eq('accounts.entity_id', entityId)
      .eq('status', 'active')
      .not('due_date', 'is', null)
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: true })

    if (debtDrawdownError) {
      console.error('Error fetching debt drawdowns:', debtDrawdownError)
    }

    // Also fetch loan disbursements (loans we gave out - receivables with due dates)
    const { data: loanReceivables, error: loanError } = await supabase
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
      .not('due_date', 'is', null)
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: true })

    if (loanError) {
      console.error('Error fetching loan receivables:', loanError)
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
          entity_id,
          categories:category_id (
            category_name
          )
        )
      `)
      .eq('scheduled_payments.entity_id', entityId)
      .in('status', ['pending', 'overdue']) // Only include unpaid instances
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))
      .order('due_date', { ascending: true })

    // DEBUG: Also fetch ALL instances to compare
    const { data: allInstances } = await supabase
      .from('scheduled_payment_instances')
      .select(`
        *,
        scheduled_payments:scheduled_payment_id!inner (
          contract_name,
          payment_type,
          payee_name,
          category_id,
          entity_id,
          categories:category_id (
            category_name
          )
        )
      `)
      .eq('scheduled_payments.entity_id', entityId)
      .gte('due_date', format(startDate, 'yyyy-MM-dd'))
      .lte('due_date', format(endDate, 'yyyy-MM-dd'))

    const totalAllInstances = allInstances?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0
    const totalUnpaidInstances = scheduledInstances?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0
    console.log(`[DEBUG] Total all instances (${allInstances?.length}): ${totalAllInstances.toLocaleString()} VND`)
    console.log(`[DEBUG] Total unpaid instances (${scheduledInstances?.length}): ${totalUnpaidInstances.toLocaleString()} VND`)
    console.log(`[DEBUG] Difference: ${(totalAllInstances - totalUnpaidInstances).toLocaleString()} VND`)

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

    // Get current cash balance (sum of cash/bank account balances only)
    // Excludes debt accounts (credit_card, credit_line, term_loan) and loan_receivable
    const { data: accounts, error: accountsError} = await supabase
      .from('accounts')
      .select('account_id, account_name, account_type')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .in('account_type', ['bank', 'cash', 'investment']) // Only liquid asset accounts

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
    }

    // Fetch credit line accounts with their limits and usage
    const { data: creditLineAccounts, error: creditLineError } = await supabase
      .from('accounts')
      .select('account_id, account_name, credit_limit, bank_name')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .in('account_type', ['credit_line', 'term_loan'])
      .not('credit_limit', 'is', null)

    if (creditLineError) {
      console.error('Error fetching credit lines:', creditLineError)
    }

    // Calculate used amount for each credit line from active debt drawdowns
    const creditLines = await Promise.all((creditLineAccounts || []).map(async (account) => {
      const { data: drawdowns } = await supabase
        .from('debt_drawdown')
        .select('remaining_balance')
        .eq('account_id', account.account_id)
        .in('status', ['active', 'overdue'])

      const usedAmount = drawdowns?.reduce((sum, d) => sum + (d.remaining_balance || 0), 0) || 0
      const creditLimit = account.credit_limit || 0
      const availableCredit = creditLimit - usedAmount

      return {
        account_id: account.account_id,
        account_name: account.account_name,
        bank_name: account.bank_name,
        credit_limit: creditLimit,
        used_amount: usedAmount,
        available_credit: availableCredit,
        utilization_percent: creditLimit > 0 ? (usedAmount / creditLimit) * 100 : 0
      }
    }))

    // Calculate total credit line availability
    const totalCreditLimit = creditLines.reduce((sum, cl) => sum + cl.credit_limit, 0)
    const totalCreditUsed = creditLines.reduce((sum, cl) => sum + cl.used_amount, 0)
    const totalCreditAvailable = totalCreditLimit - totalCreditUsed

    console.log(`[Cash Flow] Found ${accounts?.length || 0} cash/bank/investment accounts for entity ${entityId}`)
    console.log(`[Cash Flow] Accounts: ${accounts?.map(a => `${a.account_name}(${a.account_type})`).join(', ')}`)

    const accountIds = accounts?.map(a => a.account_id) || []

    // Get current balances by calculating from transactions
    let currentBalance = 0
    if (accountIds.length > 0) {
      // Calculate balance for each account up to today
      const today = new Date()
      for (const account of (accounts || [])) {
        const { data: balance, error: balanceError } = await supabase.rpc('calculate_balance_up_to_date', {
          p_account_id: account.account_id,
          p_up_to_date: today.toISOString().split('T')[0], // YYYY-MM-DD
        })
        if (balanceError) {
          console.error(`[Cash Flow] Error calculating balance for ${account.account_name}:`, JSON.stringify(balanceError))
        }
        console.log(`[Cash Flow] ${account.account_name} (${account.account_type}) balance: ${balance || 0}`)
        currentBalance += (balance || 0)
      }
    }
    console.log(`[Cash Flow] Total current balance (cash/bank/investment only): ${currentBalance}`)

    // === CASH FLOW SYSTEM 2.0: Calculate predicted income (once for all months) ===
    const { total: predictedMonthlyIncome, breakdown: incomeBreakdown } = await calculatePredictedIncome(entityId)

    console.log(`[Cash Flow 2.0] Predicted monthly income: ${predictedMonthlyIncome.toLocaleString()} VND`)
    console.log(`[Cash Flow 2.0] Income sources: ${incomeBreakdown.length}`)

    // Build monthly projections
    const projections = await Promise.all(months.map(async (month) => {
      const monthKey = format(month, 'yyyy-MM')
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      // === PRIORITY 1: DEBT PAYMENTS (Drawdowns we need to repay) ===
      const monthDebtPayments = (debtDrawdowns || []).filter((drawdown: any) => {
        const dueDate = parseISO(drawdown.due_date)
        return dueDate >= monthStart && dueDate <= monthEnd
      }).map((drawdown: any) => ({
        type: 'Debt Repayment',
        loan_name: drawdown.accounts?.account_name || 'Debt Account',
        drawdown_reference: drawdown.drawdown_reference || 'Unknown',
        amount: drawdown.remaining_balance || 0,
        due_date: drawdown.due_date,
        status: drawdown.status,
        account_type: drawdown.accounts?.account_type || 'unknown'
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
        category_id: instance.scheduled_payments?.category_id,
        category_name: instance.scheduled_payments?.categories?.category_name || 'Uncategorized'
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
    // === CASH FLOW 3.1: Apply scenario adjustments if provided ===
    let runningBalance = currentBalance
    const projectionsWithBalance = projections.map((proj) => {
      const openingBalance = runningBalance
      let projectedIncome = predictedMonthlyIncome // Use predicted income from historical data
      let totalPredictedWithScenario = proj.total_predicted

      // Apply scenario adjustments
      let scenarioItems: { name: string; amount: number; type: string }[] = []
      let scenarioDebtDrawdown = 0
      let scenarioDebtRepayment = 0
      let scenarioIncome = 0
      let scenarioExpense = 0

      if (scenarioAdjustments.length > 0) {
        const adjusted = applyScenarioAdjustments(
          proj.month,
          projectedIncome,
          proj.total_predicted,
          scenarioAdjustments
        )
        projectedIncome = adjusted.adjustedIncome
        totalPredictedWithScenario = adjusted.adjustedPredicted
        scenarioItems = adjusted.scenarioItems
        scenarioDebtDrawdown = adjusted.scenarioDebtDrawdown
        scenarioDebtRepayment = adjusted.scenarioDebtRepayment
        scenarioIncome = adjusted.scenarioIncome
        scenarioExpense = adjusted.scenarioExpense

      }

      // Recalculate total obligations with scenario adjustments
      const totalObligationsWithScenario = proj.total_debt + proj.total_scheduled + totalPredictedWithScenario + proj.total_budgets
      const closingBalance = openingBalance + projectedIncome - totalObligationsWithScenario
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

      // Calculate base income (without scenario adjustments) for chart display
      const baseIncome = predictedMonthlyIncome

      return {
        ...proj,
        opening_balance: openingBalance,
        projected_income: projectedIncome,
        base_income: baseIncome, // NEW: Base income before scenario adjustments
        scenario_debt_drawdown: scenarioDebtDrawdown, // NEW: Debt drawdown from scenarios
        scenario_debt_repayment: scenarioDebtRepayment, // NEW: Debt repayment from scenarios (expense)
        scenario_income: scenarioIncome, // NEW: Additional income from scenarios
        scenario_expense: scenarioExpense, // NEW: Additional expense from scenarios
        total_predicted: totalPredictedWithScenario,
        total_obligations: totalObligationsWithScenario,
        closing_balance: closingBalance,
        health,
        scenario_items: scenarioItems // NEW: Items from scenario adjustments
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

    // === CASH FLOW 3.0: LIQUIDITY & SOLVENCY ANALYSIS ===
    const liquidityPosition = await analyzeLiquidityPosition(entityId)
    const monthlyBurnRate = totalObligations / monthsAhead
    const runwayAnalysis = calculateRunwayAnalysis(
      liquidityPosition,
      monthlyBurnRate,
      predictedMonthlyIncome,
      monthsAhead
    )

    console.log(`[Cash Flow 3.0] Total liquid assets: ${liquidityPosition.total_liquid_assets.toLocaleString()} VND`)
    console.log(`[Cash Flow 3.0] Cash runway: ${runwayAnalysis.cash_runway_months.toFixed(1)} months`)
    console.log(`[Cash Flow 3.0] Liquidity runway: ${runwayAnalysis.liquidity_runway_months.toFixed(1)} months`)

    // Calculate total scenario debt drawdown (reduces credit availability for scenario)
    const totalScenarioDebtDrawdown = projectionsWithBalance.reduce(
      (sum, proj) => sum + (proj.scenario_debt_drawdown || 0), 0
    )

    // Calculate projected credit availability per month
    // As debt payments are made, credit availability increases
    // Scenario debt drawdowns reduce availability, scenario repayments restore it
    const creditProjections = projectionsWithBalance.map((proj) => {
      // Find debt repayments for this month that will free up credit
      const monthRepayments = proj.debt_payments.reduce((sum: number, p: any) => sum + p.amount, 0)
      // Scenario debt drawdown reduces credit (negative effect)
      const monthScenarioDrawdown = proj.scenario_debt_drawdown || 0
      // Scenario debt repayment restores credit (positive effect)
      const monthScenarioRepayment = proj.scenario_debt_repayment || 0

      return {
        month: proj.month,
        month_label: proj.month_label,
        repayment_amount: monthRepayments,
        scenario_drawdown: monthScenarioDrawdown,
        scenario_repayment: monthScenarioRepayment
      }
    })

    // Calculate cumulative credit changes over projection period
    let cumulativeRepayments = 0
    let cumulativeScenarioDrawdowns = 0
    let cumulativeScenarioRepayments = 0
    const creditAvailabilityProjection = creditProjections.map((proj) => {
      cumulativeRepayments += proj.repayment_amount
      cumulativeScenarioDrawdowns += proj.scenario_drawdown
      cumulativeScenarioRepayments += proj.scenario_repayment

      // Net effect: actual repayments free credit, scenario drawdowns use it, scenario repayments restore it
      const netCreditChange = cumulativeRepayments - cumulativeScenarioDrawdowns + cumulativeScenarioRepayments

      return {
        month: proj.month,
        month_label: proj.month_label,
        available_credit: totalCreditAvailable + netCreditChange,
        repayment_this_month: proj.repayment_amount,
        scenario_drawdown_this_month: proj.scenario_drawdown,
        scenario_repayment_this_month: proj.scenario_repayment,
        cumulative_repayments: cumulativeRepayments,
        cumulative_scenario_drawdowns: cumulativeScenarioDrawdowns,
        cumulative_scenario_repayments: cumulativeScenarioRepayments
      }
    })

    console.log(`[Cash Flow 3.0] Credit lines: ${creditLines.length}, total available: ${totalCreditAvailable.toLocaleString()} VND`)

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

        // NEW in v3.0: Liquidity & Solvency Analysis
        liquidity: liquidityPosition,
        runway: runwayAnalysis,

        // NEW in v3.1: Credit Line Analysis
        credit_lines: {
          accounts: creditLines,
          total_limit: totalCreditLimit,
          total_used: totalCreditUsed,
          total_available: totalCreditAvailable,
          overall_utilization: totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0,
          availability_projection: creditAvailabilityProjection,
          // NEW: Scenario impact on credit
          scenario_debt_drawdown: totalScenarioDebtDrawdown,
          scenario_adjusted_available: totalCreditAvailable - totalScenarioDebtDrawdown
        },

        // NEW in v3.1: Scenario info (if applied)
        scenario: scenarioInfo,

        version: '3.0' // Mark this as v3.0 response
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
