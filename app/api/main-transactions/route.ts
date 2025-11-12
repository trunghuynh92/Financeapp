/**
 * API Route: /api/main-transactions
 * Purpose: List and manage main_transaction records with full categorization
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// POST - Create a new main transaction
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    const {
      raw_transaction_id,
      account_id,
      transaction_type_id,
      amount,
      transaction_direction,
      transaction_date,
      description,
      category_id,
      branch_id,
      notes,
    } = body

    if (!raw_transaction_id || !account_id || !transaction_type_id ||
        amount === undefined || !transaction_direction || !transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: raw_transaction_id, account_id, transaction_type_id, amount, transaction_direction, transaction_date' },
        { status: 400 }
      )
    }

    // Create the transaction
    const { data, error } = await supabase
      .from('main_transaction')
      .insert({
        raw_transaction_id,
        account_id,
        transaction_type_id,
        amount,
        transaction_direction,
        transaction_date,
        description: description || null,
        category_id: category_id || null,
        branch_id: branch_id || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// GET - List main transactions with filters and pagination
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
    const branchId = searchParams.get('branch_id')
    const transactionDirection = searchParams.get('transaction_direction')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const isSplit = searchParams.get('is_split')
    const isUnmatchedTransfer = searchParams.get('is_unmatched_transfer')
    const rawTransactionId = searchParams.get('raw_transaction_id')
    const amountOperator = searchParams.get('amount_operator')
    const amountValue = searchParams.get('amount_value')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

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
          pagination: { page, limit, total: 0, totalPages: 0 }
        })
      }
    }

    // Use the view for full details
    let query = supabase
      .from('main_transaction_details')
      .select('*')

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
        // Filter for uncategorized transactions (category_id is NULL)
        query = query.is('category_id', null)
      } else {
        query = query.eq('category_id', categoryId)
      }
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

    // Amount filter
    if (amountOperator && amountOperator !== 'all' && amountValue) {
      const amount = parseFloat(amountValue)
      if (!isNaN(amount)) {
        switch (amountOperator) {
          case 'eq':
            query = query.eq('amount', amount)
            break
          case 'gt':
            query = query.gt('amount', amount)
            break
          case 'lt':
            query = query.lt('amount', amount)
            break
          case 'gte':
            query = query.gte('amount', amount)
            break
          case 'lte':
            query = query.lte('amount', amount)
            break
          case 'neq':
            query = query.neq('amount', amount)
            break
        }
      }
    }

    // Apply pagination and sorting
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Single query with count for better performance
    const { data, error, count: totalCount } = await query
      .select('*', { count: 'exact' })
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
