import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/reports/cash-flow
 * Generate Cash Flow Statement
 *
 * Query params:
 * - entity_id: UUID of entity (required)
 * - start_date: ISO date string (optional, defaults to start of current year)
 * - end_date: ISO date string (optional, defaults to today)
 * - granularity: 'month' | 'quarter' | 'year' (optional, defaults to 'month')
 *
 * Returns cash flows grouped by:
 * - Operating Activities (day-to-day business operations)
 * - Investing Activities (buying/selling long-term assets)
 * - Financing Activities (loans, borrowing, equity)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const granularity = searchParams.get('granularity') || 'month'

    // Validate required params
    if (!entityId) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      )
    }

    // Set date range (default: start of current year to today)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(new Date().getFullYear(), 0, 1) // January 1st of current year

    // First, get accounts for this entity
    const { data: entityAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('entity_id', entityId)

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
      return NextResponse.json({ error: accountsError.message }, { status: 500 })
    }

    const accountIds = entityAccounts?.map(a => a.account_id) || []

    if (accountIds.length === 0) {
      // No accounts for this entity
      return NextResponse.json({
        data: {
          summary: {
            operating_activities: 0,
            investing_activities: 0,
            financing_activities: 0,
            net_change_in_cash: 0,
            uncategorized: 0,
          },
          details: {
            operating: [],
            investing: [],
            financing: [],
            uncategorized: [],
          },
          period_data: [],
        },
        metadata: {
          entity_id: entityId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          granularity,
          transaction_count: 0,
        },
      })
    }

    // Fetch all transactions with category cash flow types for the entity and date range
    // Note: Using range to handle large datasets (Supabase default limit is 1000)
    const { data: transactions, error: txError, count } = await supabase
      .from('main_transaction_details')
      .select(`
        main_transaction_id,
        raw_transaction_id,
        transaction_date,
        amount,
        transaction_type_id,
        category_id,
        description,
        account_id
      `, { count: 'exact' })
      .in('account_id', accountIds)
      .gte('transaction_date', startDate.toISOString())
      .lte('transaction_date', endDate.toISOString())
      .order('transaction_date', { ascending: true })
      .range(0, 9999) // Fetch up to 10,000 rows (0-indexed, so 0-9999 = 10,000 rows)

    if (txError) {
      console.error('Error fetching transactions:', txError)
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    console.log(`Fetched ${transactions?.length} transactions out of ${count} total`)

    // Fetch categories and transaction types for joining
    const { data: categories } = await supabase
      .from('categories')
      .select('category_id, category_name, cash_flow_type')

    const { data: transactionTypes } = await supabase
      .from('transaction_types')
      .select('transaction_type_id, type_name, type_display_name')

    // Create lookup maps
    const categoryMap = new Map(categories?.map(c => [c.category_id, c]) || [])
    const typeMap = new Map(transactionTypes?.map(t => [t.transaction_type_id, t]) || [])

    // Group transactions by cash flow type and calculate totals
    const cashFlowData = {
      operating: [] as any[],
      investing: [] as any[],
      financing: [] as any[],
      uncategorized: [] as any[],
    }

    const totals = {
      operating: 0,
      investing: 0,
      financing: 0,
      uncategorized: 0,
    }

    transactions?.forEach((tx: any) => {
      const category = categoryMap.get(tx.category_id)
      const transactionType = typeMap.get(tx.transaction_type_id)

      // Skip if no category or cash flow type
      const cashFlowType = category?.cash_flow_type

      // Determine if this is a cash inflow or outflow based on transaction type
      // Income/Credit = positive cash flow, Expense/Debit = negative cash flow
      const isIncome = transactionType?.type_name === 'income'
      const cashFlow = isIncome ? tx.amount : -tx.amount

      const txData = {
        transaction_id: tx.main_transaction_id,
        date: tx.transaction_date,
        description: tx.description,
        category_name: category?.category_name || 'Uncategorized',
        amount: tx.amount,
        cash_flow: cashFlow,
        transaction_type: transactionType?.type_display_name || 'Unknown',
      }

      if (cashFlowType === 'operating') {
        cashFlowData.operating.push(txData)
        totals.operating += cashFlow
      } else if (cashFlowType === 'investing') {
        cashFlowData.investing.push(txData)
        totals.investing += cashFlow
      } else if (cashFlowType === 'financing') {
        cashFlowData.financing.push(txData)
        totals.financing += cashFlow
      } else {
        // Transactions with no cash_flow_type or 'none'
        cashFlowData.uncategorized.push(txData)
        totals.uncategorized += cashFlow
      }
    })

    // Calculate net change in cash
    const netCashChange = totals.operating + totals.investing + totals.financing

    // Group by time period if needed
    let periodData: any[] = []
    if (granularity !== 'total') {
      periodData = generatePeriodData(transactions || [], categoryMap, typeMap, startDate, endDate, granularity as 'month' | 'quarter' | 'year')
    }

    return NextResponse.json({
      data: {
        summary: {
          operating_activities: totals.operating,
          investing_activities: totals.investing,
          financing_activities: totals.financing,
          net_change_in_cash: netCashChange,
          uncategorized: totals.uncategorized,
        },
        details: cashFlowData,
        period_data: periodData,
      },
      metadata: {
        entity_id: entityId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        granularity,
        transaction_count: transactions?.length || 0,
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
 * Generate period-based cash flow data (monthly, quarterly, yearly)
 */
function generatePeriodData(
  transactions: any[],
  categoryMap: Map<number, any>,
  typeMap: Map<number, any>,
  startDate: Date,
  endDate: Date,
  granularity: 'month' | 'quarter' | 'year'
): any[] {
  const periods = new Map<string, {
    period: string,
    operating: number,
    investing: number,
    financing: number,
    uncategorized: number,
  }>()

  transactions.forEach((tx: any) => {
    const date = new Date(tx.transaction_date)
    const periodKey = getPeriodKey(date, granularity)

    if (!periods.has(periodKey)) {
      periods.set(periodKey, {
        period: periodKey,
        operating: 0,
        investing: 0,
        financing: 0,
        uncategorized: 0,
      })
    }

    const period = periods.get(periodKey)!
    const category = categoryMap.get(tx.category_id)
    const transactionType = typeMap.get(tx.transaction_type_id)
    const isIncome = transactionType?.type_name === 'income'
    const cashFlow = isIncome ? tx.amount : -tx.amount

    const cashFlowType = category?.cash_flow_type

    if (cashFlowType === 'operating') {
      period.operating += cashFlow
    } else if (cashFlowType === 'investing') {
      period.investing += cashFlow
    } else if (cashFlowType === 'financing') {
      period.financing += cashFlow
    } else {
      period.uncategorized += cashFlow
    }
  })

  return Array.from(periods.values()).sort((a, b) => a.period.localeCompare(b.period))
}

/**
 * Get period key for grouping (e.g., "2025-01", "2025-Q1", "2025")
 */
function getPeriodKey(date: Date, granularity: 'month' | 'quarter' | 'year'): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  switch (granularity) {
    case 'month':
      return `${year}-${month.toString().padStart(2, '0')}`
    case 'quarter':
      const quarter = Math.ceil(month / 3)
      return `${year}-Q${quarter}`
    case 'year':
      return `${year}`
    default:
      return `${year}-${month.toString().padStart(2, '0')}`
  }
}
