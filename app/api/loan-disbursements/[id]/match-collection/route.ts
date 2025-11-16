/**
 * API Route: /api/loan-disbursements/[id]/match-collection
 * Match an existing LOAN_COLLECT transaction to a loan disbursement
 * This creates the receivable-side transaction and matches them together
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// POST - Match a cash LOAN_COLLECT transaction to a loan disbursement
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

    const body = await request.json()
    const { cash_transaction_id } = body

    // Validation
    if (!cash_transaction_id) {
      return NextResponse.json(
        { error: 'Missing required field: cash_transaction_id' },
        { status: 400 }
      )
    }

    // Fetch the cash LOAN_COLLECT transaction
    const { data: cashTransaction, error: cashTxError } = await supabase
      .from('main_transaction')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, entity_id)
      `)
      .eq('main_transaction_id', cash_transaction_id)
      .single()

    if (cashTxError || !cashTransaction) {
      return NextResponse.json(
        { error: 'Cash transaction not found' },
        { status: 404 }
      )
    }

    // Verify it's a LOAN_COLLECT transaction
    const { data: loanCollectType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id, type_code')
      .eq('type_code', 'LOAN_COLLECT')
      .single()

    if (!loanCollectType) {
      throw new Error('LOAN_COLLECT transaction type not found')
    }

    if (cashTransaction.transaction_type_id !== loanCollectType.transaction_type_id) {
      return NextResponse.json(
        { error: 'Transaction must be of type LOAN_COLLECT' },
        { status: 400 }
      )
    }

    // Fetch loan disbursement with account details
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
          error: 'Cannot match collection to written-off loan',
          status: disbursement.status,
        },
        { status: 400 }
      )
    }

    // Check for overpayment (allow it, but flag it)
    let isOverpayment = false
    let overpaymentAmount = 0

    if (cashTransaction.amount > disbursement.remaining_balance) {
      isOverpayment = true
      overpaymentAmount = cashTransaction.amount - disbursement.remaining_balance
      console.warn(`⚠️ Overpayment detected: Loan ${disbursement.loan_disbursement_id}, Owed: ${disbursement.remaining_balance}, Received: ${cashTransaction.amount}, Excess: ${overpaymentAmount}`)
    }

    // Create receivable-side LOAN_COLLECT transaction (debit - asset decreasing)
    const description = cashTransaction.description || `Loan collection from ${disbursement.partner?.partner_name || disbursement.borrower_name || 'borrower'}`

    // Generate unique transaction ID for receivable side
    const rawTxId = `LOAN_COLLECT_RECEIVABLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create original_transaction for receivable side (this will auto-create main_transaction via trigger)
    const { data: originalTx, error: originalTxError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: disbursement.account_id, // loan_receivable account
        transaction_date: cashTransaction.transaction_date,
        description,
        debit_amount: cashTransaction.amount, // Debit decreases the receivable asset
        credit_amount: null,
        transaction_source: 'user_manual',
        notes: `Matched to cash transaction #${cash_transaction_id}`,
      }])
      .select()
      .single()

    if (originalTxError) {
      console.error('Error creating receivable transaction:', originalTxError)
      return NextResponse.json(
        { error: originalTxError.message },
        { status: 500 }
      )
    }

    // Get the auto-created main_transaction for receivable side
    const { data: receivableTx, error: receivableTxError } = await supabase
      .from('main_transaction')
      .select('*')
      .eq('raw_transaction_id', rawTxId)
      .single()

    if (receivableTxError || !receivableTx) {
      console.error('Error fetching receivable main transaction:', receivableTxError)
      return NextResponse.json(
        { error: 'Failed to create receivable transaction' },
        { status: 500 }
      )
    }

    // Update receivable transaction to set type to LOAN_COLLECT and link to disbursement
    const { error: updateReceivableError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanCollectType.transaction_type_id,
        loan_disbursement_id: disbursementId,
        transfer_matched_transaction_id: cash_transaction_id, // Match to cash transaction
      })
      .eq('main_transaction_id', receivableTx.main_transaction_id)

    if (updateReceivableError) {
      console.error('Error updating receivable transaction:', updateReceivableError)
      return NextResponse.json(
        { error: 'Failed to link receivable transaction' },
        { status: 500 }
      )
    }

    // Update cash transaction to match with receivable and link to disbursement
    const { error: updateCashError } = await supabase
      .from('main_transaction')
      .update({
        loan_disbursement_id: disbursementId,
        transfer_matched_transaction_id: receivableTx.main_transaction_id,
      })
      .eq('main_transaction_id', cash_transaction_id)

    if (updateCashError) {
      console.error('Error updating cash transaction:', updateCashError)
      return NextResponse.json(
        { error: 'Failed to link cash transaction' },
        { status: 500 }
      )
    }

    // Note: The trigger `update_loan_disbursement_after_settlement` will automatically
    // update the loan_disbursement remaining_balance when LOAN_COLLECT is linked

    // Fetch updated disbursement
    const { data: updatedDisbursement } = await supabase
      .from('loan_disbursement')
      .select('*')
      .eq('loan_disbursement_id', disbursementId)
      .single()

    // Build response
    const responseData: any = {
      data: {
        cash_transaction: { ...cashTransaction, loan_disbursement_id: disbursementId, transfer_matched_transaction_id: receivableTx.main_transaction_id },
        receivable_transaction: { ...receivableTx, loan_disbursement_id: disbursementId, transfer_matched_transaction_id: cash_transaction_id },
        disbursement: updatedDisbursement,
      },
      message: 'Loan collection matched successfully',
    }

    // Add overpayment warning if applicable
    if (isOverpayment) {
      responseData.warning = {
        type: 'overpayment',
        message: `Collection exceeded remaining balance by ${overpaymentAmount.toLocaleString()}`,
        overpayment_amount: overpaymentAmount,
        original_balance: disbursement.remaining_balance,
        collection_amount: cashTransaction.amount,
      }
    }

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to match loan collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
