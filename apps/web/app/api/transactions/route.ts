import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyWritePermission } from '@/lib/permissions'

// GET /api/transactions - List all transactions with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('account_id')
    const entityId = searchParams.get('entity_id')
    const transactionSource = searchParams.get('transaction_source')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
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

    // Start building query
    let query = supabase
      .from('original_transaction')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, bank_name, entity_id),
        import_batch:import_batch(import_batch_id, import_file_name, import_date)
      `)

    // Apply filters
    if (accountId) {
      // Specific account filter takes priority
      query = query.eq('account_id', accountId)
    } else if (entityId && accountIdsForEntity.length > 0) {
      // Filter by entity's accounts
      query = query.in('account_id', accountIdsForEntity)
    }

    if (transactionSource) {
      query = query.eq('transaction_source', transactionSource)
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,bank_reference.ilike.%${search}%`)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Get total count of FILTERED results (not all transactions)
    // Build the same query for counting
    let countQuery = supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })

    if (accountId) {
      countQuery = countQuery.eq('account_id', accountId)
    } else if (entityId && accountIdsForEntity.length > 0) {
      countQuery = countQuery.in('account_id', accountIdsForEntity)
    }
    if (transactionSource) {
      countQuery = countQuery.eq('transaction_source', transactionSource)
    }
    if (startDate) {
      countQuery = countQuery.gte('transaction_date', startDate)
    }
    if (endDate) {
      countQuery = countQuery.lte('transaction_date', endDate)
    }
    if (search) {
      countQuery = countQuery.or(`description.ilike.%${search}%,bank_reference.ilike.%${search}%`)
    }

    const { count: totalCount } = await countQuery

    // Execute query with pagination
    // Sort by transaction_date first, then transaction_sequence (preserves import order), then created_at
    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .order('transaction_sequence', { ascending: true })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching transactions:', error)
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

// POST /api/transactions - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.account_id || !body.transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, transaction_date' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check write permissions
    try {
      await verifyWritePermission(supabase, user.id, body.account_id)
    } catch (permError: any) {
      return NextResponse.json(
        { error: permError.message },
        { status: 403 }
      )
    }

    // Validate that either debit or credit is provided, not both
    const hasDebit = body.debit_amount !== null && body.debit_amount !== undefined
    const hasCredit = body.credit_amount !== null && body.credit_amount !== undefined

    if (hasDebit && hasCredit) {
      return NextResponse.json(
        { error: 'Cannot have both debit_amount and credit_amount. Provide only one.' },
        { status: 400 }
      )
    }

    if (!hasDebit && !hasCredit) {
      return NextResponse.json(
        { error: 'Must provide either debit_amount or credit_amount' },
        { status: 400 }
      )
    }

    // Generate a unique transaction ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id = `TXN-${timestamp}-${random}`

    // Create transaction
    const { data: newTransaction, error: transactionError } = await supabase
      .from('original_transaction')
      .insert([
        {
          raw_transaction_id,
          account_id: body.account_id,
          transaction_date: body.transaction_date,
          description: body.description || null,
          debit_amount: body.debit_amount || null,
          credit_amount: body.credit_amount || null,
          balance: body.balance || null,
          bank_reference: body.bank_reference || null,
          transaction_source: body.transaction_source || 'user_manual',
          import_batch_id: body.import_batch_id || null,
          import_file_name: body.import_file_name || null,
          created_by_user_id: body.created_by_user_id || null,
        },
      ])
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, bank_name)
      `)
      .single()

    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      return NextResponse.json({ error: transactionError.message }, { status: 500 })
    }

    return NextResponse.json(newTransaction, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
