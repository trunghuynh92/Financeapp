/**
 * API Route: /api/accounts/[id]/drawdowns
 * Manage debt drawdowns for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateDrawdownRequest, UpdateDrawdownRequest } from '@/types/debt'

// ==============================================================================
// GET - List all drawdowns for an account
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // 'active', 'settled', 'overdue', 'all'

    // Build query for direct table access
    let query = supabase
      .from('debt_drawdown')
      .select('*')
      .eq('account_id', accountId)

    // Apply status filter if not 'all'
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: drawdowns, error } = await query
      .order('drawdown_date', { ascending: false })

    if (error) {
      console.error('Error fetching drawdowns:', error)
      throw new Error(`Failed to fetch drawdowns: ${error.message}`)
    }

    // Map to include calculated fields
    const mappedData = drawdowns?.map(dd => ({
      ...dd,
      paid_amount: Number(dd.original_amount) - Number(dd.remaining_balance),
      days_until_due: dd.due_date ? Math.ceil((new Date(dd.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      total_interest_paid: 0, // Would need separate query to get from payments
      total_fees_paid: 0, // Would need separate query to get from payments
    })) || []

    return NextResponse.json({
      data: mappedData,
      count: mappedData.length,
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
    const supabase = createSupabaseServerClient()
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

    // Create transaction for the drawdown (increases debt balance)
    // For debt accounts: Debits increase the balance (debt owed becomes more negative)
    // Generate unique raw_transaction_id (PRIMARY KEY)
    const rawTxId = `DRAWDOWN-${drawdown.drawdown_id}-${Date.now()}`

    const { data: originalTx, error: txError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: accountId,
        transaction_date: body.drawdown_date,
        description: `Drawdown: ${body.drawdown_reference}`,
        debit_amount: body.original_amount,
        credit_amount: null,
      }])
      .select()
      .single()

    if (txError || !originalTx) {
      console.error('Error creating transaction:', txError)
      // Rollback: delete the drawdown
      await supabase
        .from('debt_drawdown')
        .delete()
        .eq('drawdown_id', drawdown.drawdown_id)

      return NextResponse.json(
        { error: `Failed to create transaction: ${txError?.message}` },
        { status: 500 }
      )
    }

    // Get DEBT_TAKE transaction type ID
    const { data: debtTakeType, error: typeError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'DEBT_TAKE')
      .single()

    if (typeError || !debtTakeType) {
      console.error('DEBT_TAKE transaction type not found. Please run migration 042.')
      return NextResponse.json(
        { error: 'DEBT_TAKE transaction type not found. Please run migration 042.' },
        { status: 500 }
      )
    }

    // Wait for trigger to create main_transaction
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify main_transaction was created
    const { data: mainTx, error: mainTxError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, transaction_type_id, raw_transaction_id')
      .eq('raw_transaction_id', rawTxId)
      .single()

    if (mainTxError || !mainTx) {
      console.error('Main transaction not found after creation!')
      console.error('Error code:', mainTxError?.code)
      console.error('Error message:', mainTxError?.message)
      console.error('Looking for raw_transaction_id:', rawTxId)
    } else {
      console.log('✅ Found main_transaction:', mainTx.main_transaction_id, 'with type:', mainTx.transaction_type_id)
    }

    // Update the main_transaction to add debt-specific fields
    const { error: updateError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: debtTakeType.transaction_type_id,
        transaction_subtype: 'principal',
        drawdown_id: drawdown.drawdown_id,
      })
      .eq('raw_transaction_id', rawTxId)

    if (updateError) {
      console.error('Error updating main_transaction with drawdown info:')
      console.error('Error code:', updateError.code)
      console.error('Error message:', updateError.message)
      console.error('Error details:', updateError.details)
      console.error('Error hint:', updateError.hint)
      console.error('Trying to set drawdown_id:', drawdown.drawdown_id)
      console.error('On raw_transaction_id:', rawTxId)
      // Note: Don't rollback here as the transaction is created, just log the error
    }

    console.log(`✅ Created drawdown ${body.drawdown_reference} with transaction (Debit: ${body.original_amount})`)

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

// ==============================================================================
// PATCH - Update a specific drawdown
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Get drawdown_id from query params
    const searchParams = request.nextUrl.searchParams
    const drawdownId = searchParams.get('drawdown_id')

    if (!drawdownId) {
      return NextResponse.json(
        { error: 'Missing drawdown_id query parameter' },
        { status: 400 }
      )
    }

    const body: UpdateDrawdownRequest = await request.json()

    // Verify drawdown exists and belongs to this account
    const { data: existingDrawdown, error: fetchError } = await supabase
      .from('debt_drawdown')
      .select('drawdown_id, account_id')
      .eq('drawdown_id', parseInt(drawdownId))
      .eq('account_id', accountId)
      .single()

    if (fetchError || !existingDrawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found for this account' },
        { status: 404 }
      )
    }

    // Build update object (only include fields that are provided)
    const updateData: any = {}
    if (body.drawdown_reference !== undefined) updateData.drawdown_reference = body.drawdown_reference
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.interest_rate !== undefined) updateData.interest_rate = body.interest_rate
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.status !== undefined) updateData.status = body.status

    // Update drawdown
    const { data: updatedDrawdown, error: updateError } = await supabase
      .from('debt_drawdown')
      .update(updateData)
      .eq('drawdown_id', parseInt(drawdownId))
      .select()
      .single()

    if (updateError) {
      console.error('Error updating drawdown:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updatedDrawdown,
      message: 'Drawdown updated successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
