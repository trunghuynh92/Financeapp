/**
 * API Route: /api/flagged-transactions
 * Purpose: Fetch flagged main_transaction records for audit purposes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - List flagged main transactions with filters and pagination
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams

    // Filters
    const entityId = searchParams.get('entity_id')
    const accountId = searchParams.get('account_id')
    const transactionTypeId = searchParams.get('transaction_type_id')
    const categoryId = searchParams.get('category_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const flaggedBy = searchParams.get('flagged_by')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Sorting
    const sortField = searchParams.get('sort_field') || 'flagged_at'
    const sortDirection = searchParams.get('sort_direction') || 'desc'

    // If entity_id filter is provided, get all account IDs for that entity first
    let accountIdsForEntity: number[] = []
    if (entityId && !accountId) {
      const { data: entityAccounts } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', entityId)

      accountIdsForEntity = entityAccounts?.map(a => a.account_id) || []

      // If entity has no accounts, return empty result
      if (accountIdsForEntity.length === 0) {
        return NextResponse.json({
          data: [],
          summary: {
            total: 0,
            total_flagged_amount: 0,
          },
          pagination: { page, limit, total: 0, totalPages: 0 }
        })
      }
    }

    // Use the view for full details
    let query = supabase
      .from('main_transaction_details')
      .select('*')

    // CRITICAL: Only show flagged transactions
    query = query.eq('is_flagged', true)

    // Apply filters
    if (accountId) {
      // Specific account filter takes priority
      query = query.eq('account_id', accountId)
    } else if (entityId && accountIdsForEntity.length > 0) {
      // Filter by entity's accounts
      query = query.in('account_id', accountIdsForEntity)
    }

    if (transactionTypeId) {
      query = query.eq('transaction_type_id', transactionTypeId)
    }

    if (categoryId) {
      if (categoryId === 'none') {
        query = query.is('category_id', null)
      } else {
        query = query.eq('category_id', categoryId)
      }
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%,flag_note.ilike.%${search}%`)
    }

    if (flaggedBy) {
      query = query.eq('flagged_by', flaggedBy)
    }

    // Apply pagination and sorting
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Clone the query for count (before adding order/range)
    const countQuery = supabase
      .from('main_transaction_details')
      .select('*', { count: 'exact', head: true })

    // Apply same filters to count query
    countQuery.eq('is_flagged', true)

    if (accountId) {
      countQuery.eq('account_id', accountId)
    } else if (entityId && accountIdsForEntity.length > 0) {
      countQuery.in('account_id', accountIdsForEntity)
    }
    if (transactionTypeId) countQuery.eq('transaction_type_id', transactionTypeId)
    if (categoryId) {
      if (categoryId === 'none') {
        countQuery.is('category_id', null)
      } else {
        countQuery.eq('category_id', categoryId)
      }
    }
    if (startDate) countQuery.gte('transaction_date', startDate)
    if (endDate) countQuery.lte('transaction_date', endDate)
    if (search) countQuery.or(`description.ilike.%${search}%,notes.ilike.%${search}%,flag_note.ilike.%${search}%`)
    if (flaggedBy) countQuery.eq('flagged_by', flaggedBy)

    // Validate sort field to prevent SQL injection
    const allowedSortFields = [
      'flagged_at',
      'transaction_date',
      'amount',
      'description',
      'account_name',
      'category_name'
    ]
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'flagged_at'
    const isAscending = sortDirection === 'asc'

    // Execute both queries in parallel
    const [{ data, error }, { count: totalCount, error: countError }] = await Promise.all([
      query
        .select('*')
        .order(validSortField, { ascending: isAscending, nullsFirst: false })
        .order('main_transaction_id', { ascending: false }) // Secondary sort for consistency
        .range(from, to),
      countQuery
    ])

    if (error) {
      console.error('Error fetching flagged transactions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (countError) {
      console.error('Error counting flagged transactions:', countError)
    }

    // Calculate summary statistics
    const totalFlaggedAmount = data?.reduce((sum, t) => {
      const amount = parseFloat(t.amount || '0')
      return sum + (t.transaction_direction === 'debit' ? amount : -amount)
    }, 0) || 0

    console.log(`API: Returning ${data?.length || 0} flagged transactions, total count: ${totalCount}`)

    return NextResponse.json({
      data: data || [],
      summary: {
        total: totalCount ?? 0,
        total_flagged_amount: totalFlaggedAmount,
      },
      pagination: {
        page,
        limit,
        total: totalCount ?? 0,
        totalPages: Math.ceil((totalCount ?? 0) / limit),
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
