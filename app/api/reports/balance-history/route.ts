import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/reports/balance-history
 * Fetch balance history for all accounts or specific accounts
 * Query params:
 * - account_ids: comma-separated account IDs (optional, defaults to all)
 * - start_date: ISO date string (optional, defaults to 1 year ago)
 * - end_date: ISO date string (optional, defaults to today)
 * - granularity: 'day' | 'week' | 'month' | 'year' (optional, defaults to 'day')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountIdsParam = searchParams.get('account_ids')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const granularity = searchParams.get('granularity') || 'day'

    // Parse account IDs
    const accountIds = accountIdsParam ? accountIdsParam.split(',').map(id => parseInt(id)) : null

    // Set date range (default: last year to today)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(new Date().setFullYear(endDate.getFullYear() - 1))

    // Fetch accounts to process
    let accountsQuery = supabase.from('accounts').select('account_id, account_name, currency, entity:entities(id, name)')

    if (accountIds && accountIds.length > 0) {
      accountsQuery = accountsQuery.in('account_id', accountIds)
    }

    const { data: accounts, error: accountsError } = await accountsQuery

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
      return NextResponse.json({ error: accountsError.message }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Generate date points based on granularity
    const datePoints = generateDatePoints(startDate, endDate, granularity as 'day' | 'week' | 'month' | 'year')

    // Calculate balance at each date point for each account
    const balanceHistory = await Promise.all(
      accounts.map(async (account) => {
        const history = await Promise.all(
          datePoints.map(async (date) => {
            // Calculate balance up to this date
            const { data: transactions, error: txError } = await supabase
              .from('original_transaction')
              .select('credit_amount, debit_amount')
              .eq('account_id', account.account_id)
              .lte('transaction_date', date.toISOString())

            if (txError) {
              console.error(`Error fetching transactions for account ${account.account_id}:`, txError)
              return { date: date.toISOString(), balance: 0 }
            }

            // Calculate balance
            let balance = 0
            if (transactions && transactions.length > 0) {
              for (const tx of transactions) {
                if (tx.credit_amount) balance += tx.credit_amount
                if (tx.debit_amount) balance -= tx.debit_amount
              }
            }

            return {
              date: date.toISOString(),
              balance,
            }
          })
        )

        return {
          account_id: account.account_id,
          account_name: account.account_name,
          currency: account.currency,
          entity: Array.isArray(account.entity) ? account.entity[0] : account.entity,
          history,
        }
      })
    )

    return NextResponse.json({
      data: balanceHistory,
      metadata: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        granularity,
        account_count: accounts.length,
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
 * Generate array of date points based on granularity
 */
function generateDatePoints(
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month' | 'year'
): Date[] {
  const points: Date[] = []
  const current = new Date(startDate)
  current.setHours(23, 59, 59, 999) // End of day

  while (current <= endDate) {
    points.push(new Date(current))

    // Increment based on granularity
    switch (granularity) {
      case 'day':
        current.setDate(current.getDate() + 1)
        break
      case 'week':
        current.setDate(current.getDate() + 7)
        break
      case 'month':
        current.setMonth(current.getMonth() + 1)
        break
      case 'year':
        current.setFullYear(current.getFullYear() + 1)
        break
    }
  }

  // Always include the end date if not already included
  const lastPoint = points[points.length - 1]
  if (!lastPoint || lastPoint.getTime() !== endDate.getTime()) {
    points.push(new Date(endDate))
  }

  return points
}
