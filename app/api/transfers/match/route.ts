/**
 * API Route: /api/transfers/match
 * Purpose: Match transaction pairs:
 *  - TRF_OUT ↔ TRF_IN (regular transfers)
 *  - CC_PAY ↔ CC_PAY (credit card payments - both sides use same type)
 *  - DEBT_TAKE ↔ DEBT_TAKE (debt drawdowns - both sides use same type)
 *  - DEBT_PAY ↔ DEBT_PAY (debt repayments - both sides use same type)
 *  - LOAN_DISBURSE ↔ LOAN_DISBURSE (loan disbursements - both sides use same type)
 *  - LOAN_COLLECT ↔ LOAN_COLLECT (loan collections - both sides use same type)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { MatchTransferRequest } from '@/types/main-transaction'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body: MatchTransferRequest = await request.json()
    const { transfer_out_id, transfer_in_id } = body

    // Validate input
    if (!transfer_out_id || !transfer_in_id) {
      return NextResponse.json(
        { error: 'Both transfer_out_id and transfer_in_id are required' },
        { status: 400 }
      )
    }

    if (transfer_out_id === transfer_in_id) {
      return NextResponse.json(
        { error: 'Cannot match a transfer with itself' },
        { status: 400 }
      )
    }

    // Fetch both transactions to validate
    const { data: transferOut, error: outError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, transaction_type_id, amount, account_id, transfer_matched_transaction_id')
      .eq('main_transaction_id', transfer_out_id)
      .single()

    if (outError || !transferOut) {
      return NextResponse.json(
        { error: 'Transfer Out transaction not found' },
        { status: 404 }
      )
    }

    const { data: transferIn, error: inError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, transaction_type_id, amount, account_id, transfer_matched_transaction_id')
      .eq('main_transaction_id', transfer_in_id)
      .single()

    if (inError || !transferIn) {
      return NextResponse.json(
        { error: 'Transfer In transaction not found' },
        { status: 404 }
      )
    }

    // Validate that transactions are valid pairs
    const { data: types } = await supabase
      .from('transaction_types')
      .select('transaction_type_id, type_code')
      .in('transaction_type_id', [transferOut.transaction_type_id, transferIn.transaction_type_id])

    const typeMap = new Map(types?.map(t => [t.transaction_type_id, t.type_code]) || [])
    const outType = typeMap.get(transferOut.transaction_type_id)
    const inType = typeMap.get(transferIn.transaction_type_id)

    // Check for valid pairs
    const isTransferPair = (outType === 'TRF_OUT' && inType === 'TRF_IN')
    const isCreditCardPayment = (outType === 'CC_PAY' && inType === 'CC_PAY')
    const isDebtTakePair = (outType === 'DEBT_TAKE' && inType === 'DEBT_TAKE')
    const isDebtPayPair = (outType === 'DEBT_PAY' && inType === 'DEBT_PAY')
    const isLoanDisbursePair = (outType === 'LOAN_DISBURSE' && inType === 'LOAN_DISBURSE')
    const isLoanCollectPair = (outType === 'LOAN_COLLECT' && inType === 'LOAN_COLLECT')

    if (!isTransferPair && !isCreditCardPayment && !isDebtTakePair && !isDebtPayPair && !isLoanDisbursePair && !isLoanCollectPair) {
      return NextResponse.json(
        { error: 'Transactions must be matching pairs: TRF_OUT ↔ TRF_IN, CC_PAY ↔ CC_PAY, DEBT_TAKE ↔ DEBT_TAKE, DEBT_PAY ↔ DEBT_PAY, LOAN_DISBURSE ↔ LOAN_DISBURSE, or LOAN_COLLECT ↔ LOAN_COLLECT' },
        { status: 400 }
      )
    }

    // Check if they're from different accounts
    if (transferOut.account_id === transferIn.account_id) {
      return NextResponse.json(
        { error: 'Transfers must be between different accounts' },
        { status: 400 }
      )
    }

    // Check if either is already matched
    if (transferOut.transfer_matched_transaction_id) {
      return NextResponse.json(
        { error: 'Transfer Out is already matched to another transfer' },
        { status: 400 }
      )
    }

    if (transferIn.transfer_matched_transaction_id) {
      return NextResponse.json(
        { error: 'Transfer In is already matched to another transfer' },
        { status: 400 }
      )
    }

    // Check if amounts match (with small tolerance for rounding)
    if (Math.abs(transferOut.amount - transferIn.amount) > 0.01) {
      return NextResponse.json(
        {
          error: 'Transfer amounts must match',
          transfer_out_amount: transferOut.amount,
          transfer_in_amount: transferIn.amount,
        },
        { status: 400 }
      )
    }

    // Match the transfers by updating both records
    const { error: updateOutError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: transfer_in_id,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', transfer_out_id)

    if (updateOutError) {
      console.error('Error updating Transfer Out:', updateOutError)
      return NextResponse.json(
        { error: 'Failed to update Transfer Out' },
        { status: 500 }
      )
    }

    const { error: updateInError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: transfer_out_id,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', transfer_in_id)

    if (updateInError) {
      console.error('Error updating Transfer In:', updateInError)
      // Rollback the first update
      await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', transfer_out_id)

      return NextResponse.json(
        { error: 'Failed to update Transfer In' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Transfers matched successfully',
      transfer_out_id,
      transfer_in_id,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
