/**
 * API Route: /api/accounts/[id]/drawdowns
 * Manage debt drawdowns for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CreateDrawdownRequest } from '@/types/debt'

// ==============================================================================
// GET - List all drawdowns for an account
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // 'active', 'settled', 'overdue', 'all'

    // Use RPC function to get drawdowns with details
    const { data: drawdowns, error } = await supabase.rpc('get_active_drawdowns', {
      p_account_id: accountId
    })

    if (error) {
      console.error('Error fetching drawdowns:', error)

      // Fallback: fetch directly from table
      let query = supabase
        .from('debt_drawdown')
        .select(`
          *,
          account:accounts(account_name, bank_name, account_type, entity:entities(name))
        `)
        .eq('account_id', accountId)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data: fallbackData, error: fallbackError } = await query
        .order('drawdown_date', { ascending: false })

      if (fallbackError) {
        throw new Error(`Failed to fetch drawdowns: ${fallbackError.message}`)
      }

      return NextResponse.json({
        data: fallbackData || [],
        count: fallbackData?.length || 0,
      })
    }

    // Filter by status if needed (RPC only returns active)
    let filteredData = drawdowns || []
    if (status === 'active' || !status) {
      // RPC already returns only active
    } else {
      // For other statuses, fetch directly
      const { data: otherData, error: otherError } = await supabase
        .from('debt_drawdown')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', status)
        .order('drawdown_date', { ascending: false })

      if (otherError) {
        throw new Error(`Failed to fetch ${status} drawdowns: ${otherError.message}`)
      }

      filteredData = otherData || []
    }

    return NextResponse.json({
      data: filteredData,
      count: filteredData.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch drawdowns',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create a new drawdown
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const body: CreateDrawdownRequest = await request.json()

    // Validation
    if (!body.drawdown_reference || !body.drawdown_date || !body.original_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: drawdown_reference, drawdown_date, original_amount' },
        { status: 400 }
      )
    }

    if (body.original_amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify account exists and is a debt account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, account_type, credit_limit')
      .eq('account_id', accountId)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    if (!['credit_line', 'term_loan'].includes(account.account_type)) {
      return NextResponse.json(
        { error: 'Account must be a credit_line or term_loan type' },
        { status: 400 }
      )
    }

    // Check if drawdown reference already exists for this account
    const { data: existingDrawdown } = await supabase
      .from('debt_drawdown')
      .select('drawdown_id')
      .eq('account_id', accountId)
      .eq('drawdown_reference', body.drawdown_reference)
      .single()

    if (existingDrawdown) {
      return NextResponse.json(
        { error: 'A drawdown with this reference already exists' },
        { status: 409 }
      )
    }

    // Check if drawdown would exceed credit limit
    if (account.credit_limit) {
      const { data: creditData } = await supabase.rpc('get_available_credit', {
        p_account_id: accountId
      })

      if (creditData && creditData[0]) {
        const availableCredit = creditData[0].available_credit
        if (body.original_amount > availableCredit) {
          return NextResponse.json(
            {
              error: 'Drawdown amount exceeds available credit',
              available_credit: availableCredit,
              requested_amount: body.original_amount,
            },
            { status: 400 }
          )
        }
      }
    }

    // Create the drawdown
    const { data: drawdown, error: insertError } = await supabase
      .from('debt_drawdown')
      .insert([{
        account_id: accountId,
        drawdown_reference: body.drawdown_reference,
        drawdown_date: body.drawdown_date,
        original_amount: body.original_amount,
        remaining_balance: body.original_amount, // Initially, full amount is owed
        due_date: body.due_date || null,
        interest_rate: body.interest_rate || null,
        notes: body.notes || null,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating drawdown:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: drawdown,
        message: 'Drawdown created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
