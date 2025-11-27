/**
 * API Route: /api/main-transactions/[id]/match-debt-drawdown
 * Match an existing credit transaction with a debt_payable account
 * This creates a new debt_drawdown record and the payable-side transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// POST - Match a credit transaction to create a new debt drawdown
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
      debt_payable_account_id,
      drawdown_reference,
      due_date,
      interest_rate,
      notes,
    } = body

    // Debug logging
    console.log('=== Match Debt Drawdown Request ===')
    console.log('Transaction ID:', transactionId)
    console.log('Debt Payable Account ID:', debt_payable_account_id)
    console.log('Drawdown Reference:', drawdown_reference)

    // Validation
    if (!debt_payable_account_id || !drawdown_reference) {
      return NextResponse.json(
        { error: 'Missing required fields: debt_payable_account_id, drawdown_reference' },
        { status: 400 }
      )
    }

    // Fetch the source transaction (credit transaction on cash/bank account)
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

    // Verify this is a credit transaction (money in)
    const { data: originalTx } = await supabase
      .from('original_transaction')
      .select('debit_amount, credit_amount')
      .eq('raw_transaction_id', sourceTransaction.raw_transaction_id)
      .single()

    if (!originalTx?.credit_amount || originalTx.credit_amount <= 0) {
      return NextResponse.json(
        { error: 'Transaction must be a credit (money in) transaction' },
        { status: 400 }
      )
    }

    const borrowedAmount = originalTx.credit_amount

    // Verify the debt_payable account exists and is correct type
    const { data: debtAccount, error: debtAccountError } = await supabase
      .from('accounts')
      .select('account_id, account_name, account_type, entity_id')
      .eq('account_id', debt_payable_account_id)
      .single()

    if (debtAccountError || !debtAccount) {
      return NextResponse.json(
        { error: 'Debt payable account not found' },
        { status: 404 }
      )
    }

    if (!['credit_line', 'term_loan', 'credit_card'].includes(debtAccount.account_type)) {
      return NextResponse.json(
        { error: 'Account must be of type credit_line, term_loan, or credit_card' },
        { status: 400 }
      )
    }

    // Verify accounts belong to same entity
    if (debtAccount.entity_id !== sourceTransaction.account.entity_id) {
      return NextResponse.json(
        { error: 'Debt payable and source accounts must belong to the same entity' },
        { status: 400 }
      )
    }

    // Check if transaction is already linked to a debt drawdown
    if (sourceTransaction.drawdown_id) {
      return NextResponse.json(
        {
          error: 'Transaction is already linked to a debt drawdown',
          existing_drawdown_id: sourceTransaction.drawdown_id
        },
        { status: 400 }
      )
    }

    // Create debt drawdown record
    const { data: drawdown, error: insertError } = await supabase
      .from('debt_drawdown')
      .insert([{
        account_id: debt_payable_account_id,
        drawdown_reference: drawdown_reference,
        original_amount: borrowedAmount,
        remaining_balance: borrowedAmount,
        drawdown_date: sourceTransaction.transaction_date,
        due_date: due_date || null,
        interest_rate: interest_rate || null,
        notes: notes || null,
        status: 'active',
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating debt drawdown:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    console.log('Created debt drawdown:', drawdown.drawdown_id)

    // Get DEBT_TAKE transaction type
    const { data: debtTakeType, error: typeError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'DEBT_TAKE')
      .single()

    if (typeError || !debtTakeType) {
      console.error('Error finding DEBT_TAKE type:', typeError)
      // Rollback
      await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
      return NextResponse.json(
        { error: 'DEBT_TAKE transaction type not found' },
        { status: 500 }
      )
    }

    // Update source transaction to link to drawdown and set type
    const { error: updateSourceError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: debtTakeType.transaction_type_id,
        drawdown_id: drawdown.drawdown_id,
      })
      .eq('main_transaction_id', transactionId)

    if (updateSourceError) {
      console.error('Error updating source transaction:', updateSourceError)
      // Rollback
      await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
      return NextResponse.json(
        { error: 'Failed to link source transaction' },
        { status: 500 }
      )
    }

    // Create payable-side transaction (debit = liability increases)
    const description = sourceTransaction.description || `Debt drawdown: ${drawdown_reference}`
    const rawTxId = `DEBT_TAKE_PAYABLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: payableOriginalTx, error: payableOriginalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: rawTxId,
        account_id: debt_payable_account_id,
        transaction_date: sourceTransaction.transaction_date,
        description,
        debit_amount: borrowedAmount, // Debit = liability increases
        credit_amount: null,
        transaction_source: 'user_manual',
      }])
      .select()
      .single()

    if (payableOriginalError) {
      console.error('Error creating payable transaction:', payableOriginalError)
      // Rollback
      await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, drawdown_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: payableOriginalError.message },
        { status: 500 }
      )
    }

    // Get the auto-created main_transaction for payable side
    const { data: payableTx, error: payableTxError } = await supabase
      .from('main_transaction')
      .select('*')
      .eq('raw_transaction_id', rawTxId)
      .single()

    if (payableTxError || !payableTx) {
      console.error('Error fetching payable main transaction:', payableTxError)
      // Rollback
      await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', rawTxId)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, drawdown_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: 'Failed to create payable transaction' },
        { status: 500 }
      )
    }

    // Update payable transaction to set type, link to drawdown, and match
    const { error: updatePayableError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: debtTakeType.transaction_type_id,
        drawdown_id: drawdown.drawdown_id,
        transfer_matched_transaction_id: transactionId, // Match to source transaction
      })
      .eq('main_transaction_id', payableTx.main_transaction_id)

    if (updatePayableError) {
      console.error('Error updating payable transaction:', updatePayableError)
      // Rollback
      await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', rawTxId)
      await supabase
        .from('main_transaction')
        .update({ transaction_type_id: null, drawdown_id: null })
        .eq('main_transaction_id', transactionId)
      return NextResponse.json(
        { error: 'Failed to link payable transaction' },
        { status: 500 }
      )
    }

    // Update source transaction to complete the match
    const { error: updateMatchError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: payableTx.main_transaction_id,
      })
      .eq('main_transaction_id', transactionId)

    if (updateMatchError) {
      console.error('Error completing match:', updateMatchError)
      // Don't rollback here, the drawdown is created, just log the warning
      console.warn('Warning: Match may be incomplete')
    }

    // Fetch complete drawdown with relations
    const { data: completeDrawdown } = await supabase
      .from('debt_drawdown')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, bank_name)
      `)
      .eq('drawdown_id', drawdown.drawdown_id)
      .single()

    return NextResponse.json({
      data: {
        drawdown: completeDrawdown,
        source_transaction: {
          ...sourceTransaction,
          drawdown_id: drawdown.drawdown_id,
          transfer_matched_transaction_id: payableTx.main_transaction_id
        },
        payable_transaction: {
          ...payableTx,
          drawdown_id: drawdown.drawdown_id,
          transfer_matched_transaction_id: transactionId
        },
      },
      message: 'Debt drawdown created and matched successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to match debt drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
