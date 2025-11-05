import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CreateAccountInput } from '@/types/account'
import { createOrUpdateCheckpoint } from '@/lib/checkpoint-service'

// GET /api/accounts - List all accounts with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const accountTypes = searchParams.get('account_type')?.split(',')
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Start building query
    let query = supabase
      .from('accounts')
      .select(`
        *,
        balance:account_balances(current_balance, last_updated),
        entity:entities(id, name, type)
      `)

    // Apply filters
    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    if (accountTypes && accountTypes.length > 0) {
      query = query.in('account_type', accountTypes)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`account_name.ilike.%${search}%,bank_name.ilike.%${search}%`)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Execute query with pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching accounts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })

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

// POST /api/accounts - Create new account
export async function POST(request: NextRequest) {
  try {
    const body: CreateAccountInput = await request.json()

    // Validate required fields
    if (!body.entity_id || !body.account_name || !body.account_type) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, account_name, account_type' },
        { status: 400 }
      )
    }

    // Check for duplicate account (same name + type + entity)
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('entity_id', body.entity_id)
      .eq('account_name', body.account_name)
      .eq('account_type', body.account_type)

    if (existingAccounts && existingAccounts.length > 0) {
      return NextResponse.json(
        { error: 'An account with this name and type already exists for this entity' },
        { status: 409 }
      )
    }

    // Create account
    const { data: newAccount, error: accountError } = await supabase
      .from('accounts')
      .insert([
        {
          entity_id: body.entity_id,
          account_name: body.account_name,
          account_type: body.account_type,
          account_number: body.account_number || null,
          bank_name: body.bank_name || null,
          currency: body.currency || 'VND',
          credit_limit: body.credit_limit || null,
          loan_reference: body.loan_reference || null,
        },
      ])
      .select()
      .single()

    if (accountError) {
      console.error('Error creating account:', accountError)
      return NextResponse.json({ error: accountError.message }, { status: 500 })
    }

    // Set initial balance if provided
    let checkpointWarning: string | null = null

    if (body.initial_balance !== undefined && body.initial_balance !== 0) {
      // If opening_balance_date is provided, create a checkpoint
      // This follows the "No money without origin" principle
      if (body.opening_balance_date) {
        try {
          console.log('Creating checkpoint with params:', {
            account_id: newAccount.account_id,
            checkpoint_date: body.opening_balance_date,
            declared_balance: body.initial_balance,
            notes: body.opening_balance_notes || 'Opening balance',
          })

          const checkpoint = await createOrUpdateCheckpoint({
            account_id: newAccount.account_id,
            checkpoint_date: new Date(body.opening_balance_date),
            declared_balance: body.initial_balance,
            notes: body.opening_balance_notes || 'Opening balance',
          })

          console.log('✅ Checkpoint created successfully:', checkpoint)
        } catch (checkpointError: any) {
          console.error('❌ Error creating opening balance checkpoint:', checkpointError)
          console.error('Error details:', {
            message: checkpointError.message,
            stack: checkpointError.stack,
          })

          checkpointWarning = `Account created successfully, but checkpoint creation failed: ${checkpointError.message}. Please check server logs.`
        }
      } else {
        // Legacy behavior: Just update account_balances directly
        // Note: This doesn't follow "No money without origin" principle
        console.log('No opening_balance_date provided, using legacy balance update')

        const { error: balanceError } = await supabase
          .from('account_balances')
          .update({ current_balance: body.initial_balance })
          .eq('account_id', newAccount.account_id)

        if (balanceError) {
          console.error('❌ Error setting initial balance:', balanceError)
          checkpointWarning = `Account created successfully, but balance update failed: ${balanceError.message}`
        } else {
          console.log('✅ Legacy balance updated successfully')
        }
      }
    }

    // Fetch the complete account with balance and entity
    const { data: completeAccount } = await supabase
      .from('accounts')
      .select(`
        *,
        balance:account_balances(current_balance, last_updated),
        entity:entities(id, name, type)
      `)
      .eq('account_id', newAccount.account_id)
      .single()

    // Return account with optional warning about checkpoint creation
    if (checkpointWarning) {
      return NextResponse.json(
        {
          ...completeAccount,
          warning: checkpointWarning,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(completeAccount, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
