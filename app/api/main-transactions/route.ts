/**
 * API Route: /api/main-transactions
 * Purpose: List and manage main_transaction records with full categorization
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - List main transactions with filters and pagination
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams

    // Filters
    const accountId = searchParams.get('account_id')
    const transactionTypeId = searchParams.get('transaction_type_id')
    const categoryId = searchParams.get('category_id')
    const branchId = searchParams.get('branch_id')
    const transactionDirection = searchParams.get('transaction_direction')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const isSplit = searchParams.get('is_split')
    const isUnmatchedTransfer = searchParams.get('is_unmatched_transfer')
    const rawTransactionId = searchParams.get('raw_transaction_id')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Use the view for full details
    let query = supabase
      .from('main_transaction_details')
      .select('*')

    // Apply filters
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    if (transactionTypeId) {
      query = query.eq('transaction_type_id', transactionTypeId)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    if (transactionDirection) {
      query = query.eq('transaction_direction', transactionDirection)
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    if (isSplit !== null) {
      query = query.eq('is_split', isSplit === 'true')
    }

    if (isUnmatchedTransfer === 'true') {
      // Only show transfers without matches
      query = query
        .in('transaction_type_code', ['TRF_OUT', 'TRF_IN'])
        .is('transfer_matched_transaction_id', null)
    }

    if (rawTransactionId) {
      query = query.eq('raw_transaction_id', rawTransactionId)
    }

    // Get total count of FILTERED results
    let countQuery = supabase
      .from('main_transaction_details')
      .select('*', { count: 'exact', head: true })

    // Apply same filters to count query
    if (accountId) countQuery = countQuery.eq('account_id', accountId)
    if (transactionTypeId) countQuery = countQuery.eq('transaction_type_id', transactionTypeId)
    if (categoryId) countQuery = countQuery.eq('category_id', categoryId)
    if (branchId) countQuery = countQuery.eq('branch_id', branchId)
    if (transactionDirection) countQuery = countQuery.eq('transaction_direction', transactionDirection)
    if (startDate) countQuery = countQuery.gte('transaction_date', startDate)
    if (endDate) countQuery = countQuery.lte('transaction_date', endDate)
    if (search) countQuery = countQuery.or(`description.ilike.%${search}%,notes.ilike.%${search}%`)
    if (isSplit !== null) countQuery = countQuery.eq('is_split', isSplit === 'true')
    if (isUnmatchedTransfer === 'true') {
      countQuery = countQuery
        .in('transaction_type_code', ['TRF_OUT', 'TRF_IN'])
        .is('transfer_matched_transaction_id', null)
    }
    if (rawTransactionId) countQuery = countQuery.eq('raw_transaction_id', rawTransactionId)

    const { count: totalCount } = await countQuery

    // Apply pagination and sorting
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error} = await query
      .order('transaction_date', { ascending: false })
      .order('split_sequence', { ascending: false, nullsFirst: false }) // NULLs last, preserve CSV order
      .order('main_transaction_id', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching main transactions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
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
