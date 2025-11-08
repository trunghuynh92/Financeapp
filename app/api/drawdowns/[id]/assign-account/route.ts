/**
 * API Route: /api/drawdowns/[id]/assign-account
 * Assign a receiving account to a drawdown and create matched transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==============================================================================
// POST - Assign receiving account to drawdown
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const drawdownId = parseInt(params.id, 10)

    if (isNaN(drawdownId)) {
      return NextResponse.json(
        { error: 'Invalid drawdown ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { receiving_account_id } = body

    if (!receiving_account_id) {
      return NextResponse.json(
        { error: 'receiving_account_id is required' },
        { status: 400 }
      )
    }

    // Get drawdown details
    const { data: drawdown, error: drawdownError } = await supabase
      .from('debt_drawdown')
      .select('*')
      .eq('drawdown_id', drawdownId)
      .single()

    if (drawdownError || !drawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found' },
        { status: 404 }
      )
    }

    // Get the drawdown's main_transaction
    const { data: drawdownTx, error: drawdownTxError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, raw_transaction_id, transaction_type_id')
      .eq('drawdown_id', drawdownId)
      .single()

    if (drawdownTxError || !drawdownTx) {
      console.error('Drawdown transaction not found:', JSON.stringify(drawdownTxError, null, 2))
      return NextResponse.json(
        { error: 'Drawdown transaction not found', details: drawdownTxError?.message },
        { status: 404 }
      )
    }

    console.log('Found drawdown transaction:', drawdownTx.main_transaction_id, 'Type ID:', drawdownTx.transaction_type_id)

    // Check if drawdown already has an assigned receiving account
    const { data: existingMatch } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('main_transaction_id', drawdownTx.main_transaction_id)
      .not('transfer_matched_transaction_id', 'is', null)
      .single()

    if (existingMatch) {
      return NextResponse.json(
        { error: 'Drawdown already has a receiving account assigned' },
        { status: 400 }
      )
    }

    // Verify receiving account exists
    const { data: receivingAccount, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, account_name')
      .eq('account_id', receiving_account_id)
      .single()

    if (accountError || !receivingAccount) {
      return NextResponse.json(
        { error: 'Receiving account not found' },
        { status: 404 }
      )
    }

    // Get DEBT_ACQ transaction type ID
    const { data: debtAcqType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'DEBT_ACQ')
      .single()

    if (!debtAcqType) {
      return NextResponse.json(
        { error: 'DEBT_ACQ transaction type not found' },
        { status: 500 }
      )
    }

    // Create original_transaction for receiving account (CREDIT)
    const rawTxId = `DEBT_ACQ-${drawdownId}-${Date.now()}`

    const { data: originalTx, error: txError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: receiving_account_id,
        transaction_date: drawdown.drawdown_date,
        description: `Debt acquired from drawdown: ${drawdown.drawdown_reference}`,
        credit_amount: drawdown.original_amount,
        debit_amount: null,
      }])
      .select()
      .single()

    if (txError || !originalTx) {
      console.error('Error creating receiving transaction:', txError)
      return NextResponse.json(
        { error: `Failed to create receiving transaction: ${txError?.message}` },
        { status: 500 }
      )
    }

    // Wait a moment for trigger to create main_transaction
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get the auto-created main_transaction
    const { data: receivingTx, error: receivingTxError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('raw_transaction_id', rawTxId)
      .single()

    if (receivingTxError || !receivingTx) {
      console.error('Error finding auto-created main_transaction:', JSON.stringify(receivingTxError, null, 2))
      console.error('Looking for raw_transaction_id:', rawTxId)
      return NextResponse.json(
        { error: 'Failed to find receiving transaction', details: receivingTxError?.message },
        { status: 500 }
      )
    }

    console.log('Found receiving transaction:', receivingTx.main_transaction_id)

    // Update receiving main_transaction with DEBT_ACQ type and link to drawdown transaction
    const { error: updateReceivingError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: debtAcqType.transaction_type_id,
        transfer_matched_transaction_id: drawdownTx.main_transaction_id,
        notes: `Receiving account for drawdown ${drawdown.drawdown_reference}`,
      })
      .eq('main_transaction_id', receivingTx.main_transaction_id)

    if (updateReceivingError) {
      console.error('Error updating receiving transaction:', JSON.stringify(updateReceivingError, null, 2))
      console.error('Update details:', {
        receivingTxId: receivingTx.main_transaction_id,
        debtAcqTypeId: debtAcqType.transaction_type_id,
        drawdownTxId: drawdownTx.main_transaction_id,
      })
      return NextResponse.json(
        {
          error: 'Failed to update receiving transaction',
          details: updateReceivingError.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Update drawdown main_transaction with match link
    const { error: updateDrawdownError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: receivingTx.main_transaction_id,
      })
      .eq('main_transaction_id', drawdownTx.main_transaction_id)

    if (updateDrawdownError) {
      console.error('Error updating drawdown transaction:', updateDrawdownError)
      return NextResponse.json(
        { error: 'Failed to link transactions' },
        { status: 500 }
      )
    }

    console.log(`✅ Assigned receiving account ${receiving_account_id} to drawdown ${drawdownId}`)

    return NextResponse.json(
      {
        message: 'Receiving account assigned successfully',
        drawdown_transaction_id: drawdownTx.main_transaction_id,
        receiving_transaction_id: receivingTx.main_transaction_id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to assign receiving account',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
