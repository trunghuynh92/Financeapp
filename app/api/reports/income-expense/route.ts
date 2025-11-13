import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/reports/income-expense
 * Fetch income and expense data aggregated by time period
 * Query params:
 * - entity_id: UUID of entity (required)
 * - start_date: ISO date string (optional, defaults to 1 year ago)
 * - end_date: ISO date string (optional, defaults to today)
 * - granularity: 'year' | 'month' | 'week' (optional, defaults to 'month')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const granularity = searchParams.get('granularity') || 'month'

    if (!entityId) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    // Set date range (default: last year to today)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(new Date().setFullYear(endDate.getFullYear() - 1))

    // Build the date truncation expression based on granularity
    let dateTrunc: string
    switch (granularity) {
      case 'year':
        dateTrunc = "to_char(mt.transaction_date, 'YYYY')"
        break
      case 'week':
        dateTrunc = "to_char(date_trunc('week', mt.transaction_date), 'YYYY-MM-DD')"
        break
      case 'month':
      default:
        dateTrunc = "to_char(mt.transaction_date, 'YYYY-MM')"
        break
    }

    // Query to aggregate income and expense by period
    // INC = Income (credit increases balance)
    // EXP = Expense (debit decreases balance)
    const { data, error } = await supabase.rpc('get_income_expense_report', {
      p_entity_id: entityId,
      p_start_date: startDate.toISOString().split('T')[0],
      p_end_date: endDate.toISOString().split('T')[0],
      p_granularity: granularity
    })

    if (error) {
      // If RPC doesn't exist, use direct query as fallback
      console.error('RPC error, using fallback query:', error.message)

      // First, get all account IDs for this entity
      // Exclude: investment, credit_line, term_loan, loan_receivable accounts
      // Include: bank, cash, credit_card for business operations
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', entityId)
        .in('account_type', ['bank', 'cash', 'credit_card'])

      if (accountsError) {
        console.error('Accounts query error:', accountsError)
        return NextResponse.json({ error: accountsError.message }, { status: 500 })
      }

      const accountIds = accountsData?.map(a => a.account_id) || []

      if (accountIds.length === 0) {
        return NextResponse.json({
          data: [],
          metadata: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            granularity,
            entity_id: entityId,
          },
        })
      }

      // Now fetch transactions for these accounts
      const { data: queryData, error: queryError } = await supabase
        .from('main_transaction')
        .select(`
          transaction_date,
          amount,
          transaction_direction,
          transaction_type_id,
          transaction_types!main_transaction_transaction_type_id_fkey!inner (
            type_code
          )
        `)
        .in('account_id', accountIds)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .in('transaction_types.type_code', ['INC', 'EXP'])

      if (queryError) {
        console.error('Query error:', queryError)
        return NextResponse.json({ error: queryError.message }, { status: 500 })
      }

      // Aggregate the data in JavaScript
      const aggregated = aggregateData(queryData || [], granularity)

      return NextResponse.json({
        data: aggregated,
        metadata: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          granularity,
          entity_id: entityId,
        },
      })
    }

    return NextResponse.json({
      data: data || [],
      metadata: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        granularity,
        entity_id: entityId,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * Fallback aggregation in JavaScript if RPC doesn't exist
 */
function aggregateData(
  transactions: any[],
  granularity: string
): Array<{ period: string; income: number; expense: number; net: number }> {
  const grouped = new Map<string, { income: number; expense: number }>()

  transactions.forEach((txn) => {
    const date = new Date(txn.transaction_date)
    let period: string

    switch (granularity) {
      case 'year':
        period = date.getFullYear().toString()
        break
      case 'week':
        // Get Monday of the week
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay() + 1)
        period = weekStart.toISOString().split('T')[0]
        break
      case 'month':
      default:
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
    }

    if (!grouped.has(period)) {
      grouped.set(period, { income: 0, expense: 0 })
    }

    const data = grouped.get(period)!
    const typeCode = Array.isArray(txn.transaction_types)
      ? txn.transaction_types[0]?.type_code
      : txn.transaction_types?.type_code

    if (typeCode === 'INC') {
      data.income += txn.amount
    } else if (typeCode === 'EXP') {
      data.expense += txn.amount
    }
  })

  // Convert to array and sort by period
  return Array.from(grouped.entries())
    .map(([period, data]) => ({
      period,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}
