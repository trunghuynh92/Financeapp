/**
 * API Route: /api/loan-disbursements/[id]/payment
 * Record a payment received from borrower for a loan disbursement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { LoanPaymentInput } from '@/types/loan'

// ==============================================================================
// POST - Record a loan payment received
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const disbursementId = parseInt(params.id, 10)

    if (isNaN(disbursementId)) {
      return NextResponse.json(
        { error: 'Invalid loan disbursement ID' },
        { status: 400 }
      )
    }

    const body: LoanPaymentInput = await request.json()

    // Validation
    if (!body.payment_amount || !body.payment_date) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_amount, payment_date' },
        { status: 400 }
      )
    }

    if (body.payment_amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Fetch loan disbursement
    const { data: disbursement, error: disbursementError } = await supabase
      .from('loan_disbursement')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, entity_id)
      `)
      .eq('loan_disbursement_id', disbursementId)
      .single()

    if (disbursementError || !disbursement) {
      return NextResponse.json(
        { error: 'Loan disbursement not found' },
        { status: 404 }
      )
    }

    // Check if loan is in a state that can receive payments
    if (disbursement.status === 'written_off') {
      return NextResponse.json(
        {
          error: 'Cannot receive payment on written-off loan',
          status: disbursement.status,
        },
        { status: 400 }
      )
    }

    // Check for overpayment (allow it, but flag it)
    let isOverpayment = false
    let overpaymentAmount = 0

    if (body.payment_amount > disbursement.remaining_balance) {
      isOverpayment = true
      overpaymentAmount = body.payment_amount - disbursement.remaining_balance
      console.warn(`⚠️ Overpayment detected: Loan ${disbursement.loan_disbursement_id}, Owed: ${disbursement.remaining_balance}, Received: ${body.payment_amount}, Excess: ${overpaymentAmount}`)
    }

    // Find LOAN_RECEIVE transaction type
    const { data: loanReceiveType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'LOAN_RECEIVE')
      .single()

    if (!loanReceiveType) {
      throw new Error('LOAN_RECEIVE transaction type not found')
    }

    // Create LOAN_RECEIVE transaction (on bank account that received the payment)
    // Note: User will need to specify which bank account received the payment
    // For now, we'll create the transaction and let the trigger handle LOAN_SETTLE

    const description = body.notes || `Loan payment from ${disbursement.borrower_name}`

    // Generate unique transaction ID
    const rawTxId = `LOAN_RECEIVE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create original_transaction first (this will auto-create main_transaction via trigger)
    const { data: originalTx, error: originalTxError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: disbursement.account_id, // loan_receivable account
        transaction_date: body.payment_date,
        description,
        debit_amount: body.payment_amount, // Debit increases the asset (loan receivable)
        credit_amount: null,
        transaction_source: 'user_manual',
        notes: body.notes || null,
      }])
      .select()
      .single()

    if (originalTxError) {
      console.error('Error creating original transaction:', originalTxError)
      return NextResponse.json(
        { error: originalTxError.message },
        { status: 500 }
      )
    }

    // Get the auto-created main_transaction
    const { data: mainTx, error: mainTxError } = await supabase
      .from('main_transaction')
      .select('*')
      .eq('raw_transaction_id', rawTxId)
      .single()

    if (mainTxError) {
      console.error('Error fetching main transaction:', mainTxError)
    }

    // Update main_transaction to set transaction type to LOAN_RECEIVE and link to disbursement
    if (mainTx) {
      const { error: updateError } = await supabase
        .from('main_transaction')
        .update({
          transaction_type_id: loanReceiveType.transaction_type_id,
          loan_disbursement_id: disbursementId,
        })
        .eq('main_transaction_id', mainTx.main_transaction_id)

      if (updateError) {
        console.error('Error updating main transaction:', updateError)
      }
    }

    // Note: The trigger `update_loan_disbursement_after_settlement` will automatically
    // update the loan_disbursement remaining_balance when LOAN_SETTLE is created

    // Fetch updated disbursement
    const { data: updatedDisbursement } = await supabase
      .from('loan_disbursement')
      .select('*')
      .eq('loan_disbursement_id', disbursementId)
      .single()

    // Build response
    const responseData: any = {
      data: {
        transaction: mainTx,
        disbursement: updatedDisbursement,
      },
      message: 'Loan payment recorded successfully',
    }

    // Add overpayment warning if applicable
    if (isOverpayment) {
      responseData.warning = {
        type: 'overpayment',
        message: `Payment exceeded remaining balance by ${overpaymentAmount.toLocaleString()}`,
        overpayment_amount: overpaymentAmount,
        original_balance: disbursement.remaining_balance,
        payment_amount: body.payment_amount,
      }
    }

    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to record payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
