/**
 * API Route: /api/main-transactions/splits/[raw_transaction_id]
 * Purpose: Unsplit a transaction (remove all splits and create single main_transaction)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==============================================================================
// DELETE - Unsplit a transaction
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { raw_transaction_id: string } }
) {
  try {
    const rawTransactionId = params.raw_transaction_id

    if (!rawTransactionId) {
      return NextResponse.json(
        { error: 'Invalid raw transaction ID' },
        { status: 400 }
      )
    }

    // Verify the original transaction exists
    const { data: originalTransaction, error: originalError } = await supabase
      .from('original_transaction')
      .select('*')
      .eq('raw_transaction_id', rawTransactionId)
      .single()

    if (originalError || !originalTransaction) {
      return NextResponse.json(
        { error: 'Original transaction not found' },
        { status: 404 }
      )
    }

    // Check if the transaction is actually split
    const { data: existingSplits, error: splitsError } = await supabase
      .from('main_transaction')
      .select('*')
      .eq('raw_transaction_id', rawTransactionId)
      .order('split_sequence', { ascending: true })

    if (splitsError) {
      console.error('Error checking splits:', splitsError)
      return NextResponse.json(
        { error: splitsError.message },
        { status: 500 }
      )
    }

    if (!existingSplits || existingSplits.length === 0) {
      return NextResponse.json(
        { error: 'No splits found for this transaction' },
        { status: 404 }
      )
    }

    if (!existingSplits[0]?.is_split) {
      return NextResponse.json(
        { error: 'Transaction is not split' },
        { status: 400 }
      )
    }

    // Delete all existing splits
    const { error: deleteError } = await supabase
      .from('main_transaction')
      .delete()
      .eq('raw_transaction_id', rawTransactionId)

    if (deleteError) {
      console.error('Error deleting splits:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    // Create a single main_transaction record with default values from the first split
    const firstSplit = existingSplits[0]
    const originalAmount =
      originalTransaction.debit_amount || originalTransaction.credit_amount || 0
    const transactionDirection = originalTransaction.debit_amount ? 'debit' : 'credit'

    const { data: newTransaction, error: insertError } = await supabase
      .from('main_transaction')
      .insert({
        raw_transaction_id: rawTransactionId,
        account_id: originalTransaction.account_id,
        transaction_type_id: firstSplit.transaction_type_id,
        category_id: firstSplit.category_id,
        branch_id: firstSplit.branch_id,
        amount: originalAmount,
        transaction_direction: transactionDirection,
        transaction_date: originalTransaction.transaction_date,
        description: originalTransaction.description,
        notes: null,
        is_split: false,
        split_sequence: 1,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating unsplit transaction:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Get full details for the created transaction
    const { data: fullDetails, error: detailsError } = await supabase
      .from('main_transaction_details')
      .select('*')
      .eq('main_transaction_id', newTransaction.main_transaction_id)
      .single()

    if (detailsError) {
      console.error('Error fetching transaction details:', detailsError)
      // Still return the basic data
      return NextResponse.json({
        data: newTransaction,
        message: 'Transaction unsplit successfully',
      })
    }

    return NextResponse.json({
      data: fullDetails,
      message: 'Transaction unsplit successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
