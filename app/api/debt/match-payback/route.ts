/**
 * API Route: /api/debt/match-payback
 * Purpose: Match DEBT_PAYBACK transaction with a drawdown and auto-create DEBT_SETTLE transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface MatchPaybackRequest {
  payback_transaction_id: number
  drawdown_id: number
}

export async function POST(request: NextRequest) {
  try {
    const body: MatchPaybackRequest = await request.json()
    const { payback_transaction_id, drawdown_id } = body

    // Validate input
    if (!payback_transaction_id || !drawdown_id) {
      return NextResponse.json(
        { error: 'Both payback_transaction_id and drawdown_id are required' },
        { status: 400 }
      )
    }

    // Fetch the DEBT_PAYBACK transaction
    const { data: paybackTx, error: paybackError } = await supabase
      .from('main_transaction')
      .select(`
        main_transaction_id,
        transaction_type_id,
        amount,
        account_id,
        transaction_date,
        description,
        drawdown_id,
        transfer_matched_transaction_id
      `)
      .eq('main_transaction_id', payback_transaction_id)
      .single()

    if (paybackError || !paybackTx) {
      return NextResponse.json(
        { error: 'Payback transaction not found' },
        { status: 404 }
      )
    }

    // Verify it's a DEBT_PAY transaction
    const { data: typeData } = await supabase
      .from('transaction_types')
      .select('type_code')
      .eq('transaction_type_id', paybackTx.transaction_type_id)
      .single()

    if (typeData?.type_code !== 'DEBT_PAY') {
      return NextResponse.json(
        { error: 'Transaction must be of type DEBT_PAY (Debt Payback)' },
        { status: 400 }
      )
    }

    // Check if already matched
    if (paybackTx.transfer_matched_transaction_id) {
      return NextResponse.json(
        { error: 'This payback transaction is already matched' },
        { status: 400 }
      )
    }

    // Fetch the drawdown
    const { data: drawdown, error: drawdownError } = await supabase
      .from('debt_drawdown')
      .select('drawdown_id, account_id, original_amount, remaining_balance, drawdown_reference, drawdown_date')
      .eq('drawdown_id', drawdown_id)
      .single()

    if (drawdownError || !drawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found' },
        { status: 404 }
      )
    }

    // Get the credit line account
    const { data: creditAccount, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, account_type, account_name')
      .eq('account_id', drawdown.account_id)
      .single()

    if (accountError || !creditAccount) {
      return NextResponse.json(
        { error: 'Credit line account not found' },
        { status: 404 }
      )
    }

    // Verify it's a credit line or term loan
    if (!['credit_line', 'term_loan'].includes(creditAccount.account_type)) {
      return NextResponse.json(
        { error: 'Drawdown must belong to a credit_line or term_loan account' },
        { status: 400 }
      )
    }

    // Check if payment accounts are different
    if (paybackTx.account_id === creditAccount.account_id) {
      return NextResponse.json(
        { error: 'Payback and settlement must be on different accounts' },
        { status: 400 }
      )
    }

    // Warn if overpayment (but allow it)
    const willBeOverpaid = paybackTx.amount > drawdown.remaining_balance
    const overpaymentAmount = willBeOverpaid ? paybackTx.amount - drawdown.remaining_balance : 0

    // Get DEBT_SETTLE transaction type ID
    const { data: settleType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'DEBT_SETTLE')
      .single()

    if (!settleType) {
      return NextResponse.json(
        { error: 'DEBT_SETTLE transaction type not found. Please run migration 021.' },
        { status: 500 }
      )
    }

    // Create original_transaction for the credit line account
    // Generate a unique raw_transaction_id
    const rawTxId = `DEBT_SETTLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: newOriginalTx, error: originalTxError } = await supabase
      .from('original_transaction')
      .insert({
        raw_transaction_id: rawTxId,
        account_id: creditAccount.account_id,
        transaction_date: paybackTx.transaction_date,
        description: `Debt settlement for ${drawdown.drawdown_reference}`,
        credit_amount: paybackTx.amount, // Credit to the credit line account
        debit_amount: null,
        transaction_source: 'user_manual',
      })
      .select('raw_transaction_id')
      .single()

    if (originalTxError || !newOriginalTx) {
      console.error('Error creating original_transaction:', originalTxError)
      console.error('Original transaction data:', {
        raw_transaction_id: rawTxId,
        account_id: creditAccount.account_id,
        transaction_date: paybackTx.transaction_date,
        description: `Debt settlement for ${drawdown.drawdown_reference}`,
        credit_amount: paybackTx.amount,
        debit_amount: null,
        transaction_source: 'user_manual',
      })
      return NextResponse.json(
        {
          error: 'Failed to create original transaction for settlement',
          details: originalTxError?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // The auto-create trigger will have created a main_transaction with type INC
    // We need to update it to DEBT_SETTLE type instead
    // First, find the auto-created main_transaction
    const { data: autoCreatedTx } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('raw_transaction_id', newOriginalTx.raw_transaction_id)
      .single()

    if (!autoCreatedTx) {
      // Rollback if auto-create didn't work
      await supabase
        .from('original_transaction')
        .delete()
        .eq('raw_transaction_id', newOriginalTx.raw_transaction_id)

      return NextResponse.json(
        { error: 'Auto-created main_transaction not found' },
        { status: 500 }
      )
    }

    // Update the auto-created main_transaction to DEBT_SETTLE
    const { data: settleTx, error: settleTxError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: settleType.transaction_type_id,
        description: `Settlement: ${paybackTx.description}`,
        drawdown_id: drawdown_id,
        notes: `Auto-generated from DEBT_PAY transaction #${payback_transaction_id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', autoCreatedTx.main_transaction_id)
      .select('main_transaction_id')
      .single()

    if (settleTxError || !settleTx) {
      console.error('Error creating DEBT_SETTLE transaction:', settleTxError)
      console.error('DEBT_SETTLE data:', {
        raw_transaction_id: newOriginalTx.raw_transaction_id,
        account_id: creditAccount.account_id,
        transaction_date: paybackTx.transaction_date,
        transaction_direction: 'credit',
        description: `Settlement: ${paybackTx.description}`,
        amount: paybackTx.amount,
        transaction_type_id: settleType.transaction_type_id,
        drawdown_id: drawdown_id,
      })
      // Rollback: delete the original_transaction
      await supabase
        .from('original_transaction')
        .delete()
        .eq('raw_transaction_id', newOriginalTx.raw_transaction_id)

      return NextResponse.json(
        {
          error: 'Failed to create settlement transaction',
          details: settleTxError?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Update both transactions to link them (bidirectional match)
    const { error: updatePaybackError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: settleTx.main_transaction_id,
        drawdown_id: drawdown_id, // Link payback to drawdown
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', payback_transaction_id)

    if (updatePaybackError) {
      console.error('Error updating payback transaction:', updatePaybackError)
      // Rollback
      await supabase.from('main_transaction').delete().eq('main_transaction_id', settleTx.main_transaction_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', newOriginalTx.raw_transaction_id)

      return NextResponse.json(
        { error: 'Failed to link payback transaction' },
        { status: 500 }
      )
    }

    const { error: updateSettleError } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: payback_transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', settleTx.main_transaction_id)

    if (updateSettleError) {
      console.error('Error updating settle transaction:', updateSettleError)
      // Rollback
      await supabase
        .from('main_transaction')
        .update({ transfer_matched_transaction_id: null, drawdown_id: null })
        .eq('main_transaction_id', payback_transaction_id)
      await supabase.from('main_transaction').delete().eq('main_transaction_id', settleTx.main_transaction_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', newOriginalTx.raw_transaction_id)

      return NextResponse.json(
        { error: 'Failed to link settlement transaction' },
        { status: 500 }
      )
    }

    // The trigger will automatically update the drawdown balance and overpayment status

    // Create credit memo if overpaid
    let creditMemoId = null
    if (willBeOverpaid) {
      // Get the category for credit memo (we'll use a generic category or create one)
      const { data: creditMemoCategory } = await supabase
        .from('categories')
        .select('category_id')
        .eq('category_name', 'Credit Memo')
        .single()

      let categoryId = creditMemoCategory?.category_id || null

      // If no credit memo category exists, create one
      if (!categoryId) {
        // Get INC transaction type
        const { data: incType } = await supabase
          .from('transaction_types')
          .select('transaction_type_id')
          .eq('type_code', 'INC')
          .single()

        const { data: newCategory } = await supabase
          .from('categories')
          .insert({
            category_name: 'Credit Memo',
            transaction_type_id: incType?.transaction_type_id,
            entity_type: 'both',
            description: 'Overpayment credit memos',
          })
          .select('category_id')
          .single()

        categoryId = newCategory?.category_id || null
      }

      // Create credit memo transaction on credit line account
      const creditMemoRawTxId = `CREDIT_MEMO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const { data: creditMemoOriginal } = await supabase
        .from('original_transaction')
        .insert({
          raw_transaction_id: creditMemoRawTxId,
          account_id: creditAccount.account_id,
          transaction_date: paybackTx.transaction_date,
          description: `Credit Memo - Overpayment for ${drawdown.drawdown_reference}`,
          credit_amount: overpaymentAmount,
          debit_amount: null,
          transaction_source: 'user_manual',
        })
        .select('raw_transaction_id')
        .single()

      if (creditMemoOriginal) {
        // The auto-create trigger will have created a main_transaction with type INC
        // Find the auto-created main_transaction
        const { data: autoCreatedMemo } = await supabase
          .from('main_transaction')
          .select('main_transaction_id')
          .eq('raw_transaction_id', creditMemoOriginal.raw_transaction_id)
          .single()

        if (autoCreatedMemo) {
          // Update the auto-created main_transaction with category and drawdown info
          const { data: creditMemoTx } = await supabase
            .from('main_transaction')
            .update({
              category_id: categoryId,
              drawdown_id: drawdown_id,
              notes: `Overpayment: ${overpaymentAmount} over remaining balance`,
              updated_at: new Date().toISOString(),
            })
            .eq('main_transaction_id', autoCreatedMemo.main_transaction_id)
            .select('main_transaction_id')
            .single()

          creditMemoId = creditMemoTx?.main_transaction_id || null
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: willBeOverpaid
        ? `Payback matched successfully. Overpayment of ${overpaymentAmount} detected. Credit memo created.`
        : 'Payback matched successfully',
      payback_transaction_id,
      settle_transaction_id: settleTx.main_transaction_id,
      drawdown_id,
      is_overpaid: willBeOverpaid,
      overpayment_amount: overpaymentAmount,
      credit_memo_id: creditMemoId,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
