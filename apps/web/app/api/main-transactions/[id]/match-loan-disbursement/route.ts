/**
 * API Route: /api/main-transactions/[id]/match-loan-disbursement
 * Match an existing debit transaction with a loan_receivable account
 * This creates a new loan_disbursement record and the receivable-side transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// POST - Match a debit transaction to create a new loan disbursement
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

    const transactionId = parseInt(params.id, 10)

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      loan_receivable_account_id,
      partner_id,
      loan_category,
      due_date,
      term_months,
      interest_rate,
      notes,
    } = body

    // Debug logging
    console.log('=== Match Loan Disbursement Request ===')
    console.log('Transaction ID:', transactionId)
    console.log('Loan Receivable Account ID:', loan_receivable_account_id)
    console.log('Partner ID:', partner_id)

    // Validation
    if (!loan_receivable_account_id || !partner_id || !loan_category) {
      return NextResponse.json(
        { error: 'Missing required fields: loan_receivable_account_id, partner_id, loan_category' },
        { status: 400 }
      )
    }

    // Fetch the source transaction (debit transaction on cash/bank account)
    const { data: sourceTransaction, error: sourceTxError } = await supabase
      .from('main_transaction')
      .select(`
        *,
        account:accounts!main_transaction_account_id_fkey(account_id, account_name, account_type, entity_id)
      `)
      .eq('main_transaction_id', transactionId)
      .single()

    if (sourceTxError || !sourceTransaction) {
      console.error('Error fetching source transaction:', sourceTxError)
      return NextResponse.json(
        {
          error: 'Source transaction not found',
          details: sourceTxError?.message || 'Transaction does not exist or access denied'
        },
        { status: 404 }
      )
    }

    console.log('Found source transaction:', sourceTransaction.main_transaction_id)

    // Verify the source account is bank or cash
    if (!['bank', 'cash'].includes(sourceTransaction.account.account_type)) {
      return NextResponse.json(
        { error: 'Source account must be bank or cash type' },
        { status: 400 }
      )
    }

    // Verify this is a debit transaction (money out)
    const { data: originalTx } = await supabase
      .from('original_transaction')
      .select('debit_amount, credit_amount')
      .eq('raw_transaction_id', sourceTransaction.raw_transaction_id)
      .single()

    if (!originalTx?.debit_amount || originalTx.debit_amount <= 0) {
      return NextResponse.json(
        { error: 'Transaction must be a debit (money out) transaction' },
        { status: 400 }
      )
    }

    const principalAmount = originalTx.debit_amount

    // Verify the loan_receivable account exists and is correct type
    const { data: loanAccount, error: loanAccountError } = await supabase
      .from('accounts')
      .select('account_id, account_name, account_type, entity_id')
      .eq('account_id', loan_receivable_account_id)
      .single()

    if (loanAccountError || !loanAccount) {
      return NextResponse.json(
        { error: 'Loan receivable account not found' },
        { status: 404 }
      )
    }

    if (loanAccount.account_type !== 'loan_receivable') {
      return NextResponse.json(
        { error: 'Account must be of type loan_receivable' },
        { status: 400 }
      )
    }

    // Verify accounts belong to same entity
    if (loanAccount.entity_id !== sourceTransaction.account.entity_id) {
      return NextResponse.json(
        { error: 'Loan receivable and source accounts must belong to the same entity' },
        { status: 400 }
      )
    }

    // Verify partner exists
    const { data: partner, error: partnerError } = await supabase
      .from('business_partners')
      .select('partner_id, partner_name')
      .eq('partner_id', partner_id)
      .eq('entity_id', loanAccount.entity_id)
      .single()

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Business partner not found' },
        { status: 404 }
      )
    }

    // Check if transaction is already linked to a loan disbursement
    if (sourceTransaction.loan_disbursement_id) {
      return NextResponse.json(
        {
          error: 'Transaction is already linked to a loan disbursement',
          existing_disbursement_id: sourceTransaction.loan_disbursement_id
        },
        { status: 400 }
      )
    }

    // Create loan disbursement record
    const { data: disbursement, error: insertError } = await supabase
      .from('loan_disbursement')
      .insert([{
        account_id: loan_receivable_account_id,
        partner_id: partner_id,
        loan_category: loan_category,
        principal_amount: principalAmount,
        remaining_balance: principalAmount,
        disbursement_date: sourceTransaction.transaction_date,
        due_date: due_date || null,
        term_months: term_months || null,
        interest_rate: interest_rate || null,
        notes: notes || null,
        status: 'active',
        created_by_user_id: user.id,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating loan disbursement:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    console.log('Created loan disbursement:', disbursement.loan_disbursement_id)

    // Get LOAN_DISBURSE transaction type
    const { data: loanDisburseType, error: typeError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'LOAN_DISBURSE')
      .single()

    if (typeError || !loanDisburseType) {
      console.error('Error finding LOAN_DISBURSE type:', typeError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      return NextResponse.json(
        { error: 'LOAN_DISBURSE transaction type not found' },
        { status: 500 }
      )
    }

    // Update source transaction to link to disbursement and set type
    const { error: updateSourceError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanDisburseType.transaction_type_id,
        loan_disbursement_id: disbursement.loan_disbursement_id,
      })
      .eq('main_transaction_id', transactionId)

    if (updateSourceError) {
      console.error('Error updating source transaction:', updateSourceError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      return NextResponse.json(
        { error: 'Failed to link source transaction' },
        { status: 500 }
      )
    }

    // Create receivable-side transaction (credit = asset increases)
    const description = sourceTransaction.description || `Loan disbursement to ${partner.partner_name}`
    const rawTxId = `LOAN_DISBURSE_RECEIVABLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: receivableOriginalTx, error: receivableOriginalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: loan_receivable_account_id,
        transaction_date: sourceTransaction.transaction_date,
        description,
        credit_amount: principalAmount, // Credit = asset increases
        debit_amount: null,
        transaction_source: 'user_manual',
      }])
      .select()
      .single()

    if (receivableOriginalError) {
      console.error('Error creating receivable transaction:', receivableOriginalError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, loan_disbursement_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: receivableOriginalError.message },
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
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', rawTxId)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, loan_disbursement_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: 'Failed to create receivable transaction' },
        { status: 500 }
      )
    }

    // Update receivable transaction to set type, link to disbursement, and match
    const { error: updateReceivableError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanDisburseType.transaction_type_id,
        loan_disbursement_id: disbursement.loan_disbursement_id,
        transfer_matched_transaction_id: transactionId, // Match to source transaction
      })
      .eq('main_transaction_id', receivableTx.main_transaction_id)

    if (updateReceivableError) {
      console.error('Error updating receivable transaction:', updateReceivableError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', rawTxId)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, loan_disbursement_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: 'Failed to link receivable transaction' },
        { status: 500 }
      )
    }

    // Update source transaction to complete the match
    const { error: updateMatchError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: receivableTx.main_transaction_id,
      })
      .eq('main_transaction_id', transactionId)

    if (updateMatchError) {
      console.error('Error completing match:', updateMatchError)
      // Don't rollback here, the disbursement is created, just log the warning
      console.warn('Warning: Match may be incomplete')
    }

    // Fetch complete disbursement with relations
    const { data: completeDisbursement } = await supabase
      .from('loan_disbursement')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type),
        partner:business_partners(partner_id, partner_name, display_name, partner_type)
      `)
      .eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      .single()

    return NextResponse.json({
      data: {
        disbursement: completeDisbursement,
        source_transaction: {
          ...sourceTransaction,
          loan_disbursement_id: disbursement.loan_disbursement_id,
          transfer_matched_transaction_id: receivableTx.main_transaction_id
        },
        receivable_transaction: {
          ...receivableTx,
          loan_disbursement_id: disbursement.loan_disbursement_id,
          transfer_matched_transaction_id: transactionId
        },
      },
      message: 'Loan disbursement created and matched successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to match loan disbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
