import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { startOfMonth, endOfMonth, addMonths, format, parseISO, eachMonthOfInterval } from 'date-fns'

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
        scheduled_payments:scheduled_payment_id (
          contract_name,
          payment_type,
          payee_name,
          category_id
        )
      `)
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
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('entity_id', entityId)
      .eq('is_active', true)

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
    }

    const currentBalance = accounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0

    // Build monthly projections
    const projections = months.map((month) => {
      const monthKey = format(month, 'yyyy-MM')
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      // Filter debt payments for this month
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

      // Filter scheduled payments for this month
      const monthScheduledPayments = (scheduledInstances || []).filter((instance: any) => {
        const dueDate = parseISO(instance.due_date)
        return dueDate >= monthStart && dueDate <= monthEnd
      }).map((instance: any) => ({
        contract_name: instance.scheduled_payments?.contract_name || 'Unknown',
        payment_type: instance.scheduled_payments?.payment_type,
        payee_name: instance.scheduled_payments?.payee_name || 'Unknown',
        amount: instance.amount || 0,
        due_date: instance.due_date,
        status: instance.status
      }))

      // Filter budgets for this month
      const monthBudgets = (budgets || []).filter((budget: any) => {
        const budgetStart = parseISO(budget.start_date)
        const budgetEnd = parseISO(budget.end_date)
        return budgetStart <= monthEnd && budgetEnd >= monthStart
      }).map((budget: any) => ({
        category_name: budget.categories?.category_name || 'Unknown',
        budget_amount: budget.budget_amount || 0,
        estimated_spend: budget.budget_amount || 0 // For now, assume full budget will be spent
      }))

      // Calculate totals
      const totalDebt = monthDebtPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
      const totalScheduled = monthScheduledPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
      const totalBudgets = monthBudgets.reduce((sum: number, b: any) => sum + b.estimated_spend, 0)
      const totalObligations = totalDebt + totalScheduled + totalBudgets

      return {
        month: monthKey,
        month_label: format(month, 'MMMM yyyy'),
        debt_payments: monthDebtPayments,
        scheduled_payments: monthScheduledPayments,
        budgets: monthBudgets,
        total_debt: totalDebt,
        total_scheduled: totalScheduled,
        total_budgets: totalBudgets,
        total_obligations: totalObligations
      }
    })

    // Calculate running balances (assuming 0 income for now)
    let runningBalance = currentBalance
    const projectionsWithBalance = projections.map((proj) => {
      const openingBalance = runningBalance
      const closingBalance = openingBalance - proj.total_obligations
      runningBalance = closingBalance

      return {
        ...proj,
        opening_balance: openingBalance,
        projected_income: 0, // Can be enhanced to calculate from historical data
        closing_balance: closingBalance,
        health: closingBalance > 0 ? (closingBalance > openingBalance * 0.2 ? 'surplus' : 'tight') : 'deficit'
      }
    })

    // Calculate summary statistics
    const totalObligations = projections.reduce((sum, p) => sum + p.total_obligations, 0)
    const lowestBalance = Math.min(...projectionsWithBalance.map(p => p.closing_balance))
    const monthsUntilNegative = projectionsWithBalance.findIndex(p => p.closing_balance < 0)

    return NextResponse.json({
      data: {
        current_balance: currentBalance,
        months_ahead: monthsAhead,
        total_obligations: totalObligations,
        lowest_projected_balance: lowestBalance,
        months_until_negative: monthsUntilNegative === -1 ? null : monthsUntilNegative + 1,
        projections: projectionsWithBalance
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
