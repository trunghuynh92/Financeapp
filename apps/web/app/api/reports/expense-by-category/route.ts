import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/reports/expense-by-category
 * Fetch expense data aggregated by category
 * Query params:
 * - entity_id: UUID of entity (required)
 * - start_date: ISO date string (optional, defaults to 1 year ago)
 * - end_date: ISO date string (optional, defaults to today)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    if (!entityId) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    // Set date range (default: last year to today)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(new Date().setFullYear(endDate.getFullYear() - 1))

    // Get all account IDs for this entity (business operations only)
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
        total: 0,
        metadata: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          entity_id: entityId,
        },
      })
    }

    // Get expense transaction type ID
    const { data: typeData, error: typeError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'EXP')
      .single()

    if (typeError) {
      console.error('Transaction type query error:', typeError)
      return NextResponse.json({ error: typeError.message }, { status: 500 })
    }

    const expTypeId = typeData?.transaction_type_id

    // Fetch all expense transactions with category info
    // Paginate to handle large datasets
    const PAGE_SIZE = 1000
    let allTransactions: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('main_transaction')
        .select(`
          amount,
          category_id,
          categories!fk_category (
            category_id,
            category_name
          )
        `)
        .in('account_id', accountIds)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .eq('transaction_type_id', expTypeId)
        .order('main_transaction_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (pageError) {
        console.error('Query error at offset', offset, ':', pageError)
        return NextResponse.json({ error: pageError.message }, { status: 500 })
      }

      if (pageData && pageData.length > 0) {
        allTransactions = allTransactions.concat(pageData)
        offset += PAGE_SIZE
        hasMore = pageData.length === PAGE_SIZE
      } else {
        hasMore = false
      }

      // Safety limit
      if (offset > 100000) {
        console.warn('[Expense by Category] Safety limit reached at offset', offset)
        hasMore = false
      }
    }

    // Aggregate by category
    const categoryMap = new Map<number | null, {
      category_id: number | null
      category_name: string
      total: number
      count: number
    }>()

    allTransactions.forEach((txn) => {
      const categoryId = txn.category_id
      const categoryName = txn.categories?.category_name || 'Uncategorized'

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: categoryName,
          total: 0,
          count: 0,
        })
      }

      const data = categoryMap.get(categoryId)!
      data.total += Number(txn.amount) || 0
      data.count += 1
    })

    // Convert to array and sort by total (descending)
    const categoryBreakdown = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)

    // Calculate grand total
    const grandTotal = categoryBreakdown.reduce((sum, cat) => sum + cat.total, 0)

    // Add percentage to each category
    const dataWithPercentage = categoryBreakdown.map(cat => ({
      ...cat,
      percentage: grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0,
    }))

    return NextResponse.json({
      data: dataWithPercentage,
      total: grandTotal,
      transaction_count: allTransactions.length,
      metadata: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
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
