/**
 * API Route: /api/main-transactions/split
 * Purpose: Split a transaction into multiple main_transaction records
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SplitTransactionRequest } from '@/types/main-transaction'

// ==============================================================================
// POST - Split a transaction
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: SplitTransactionRequest = await request.json()
    const { raw_transaction_id, splits } = body

    // Validation
    if (!raw_transaction_id || !splits || splits.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 splits are required' },
        { status: 400 }
      )
    }

    // Verify the original transaction exists
    const { data: originalTransaction, error: originalError } = await supabase
      .from('original_transaction')
      .select('*')
      .eq('raw_transaction_id', raw_transaction_id)
      .single()

    if (originalError || !originalTransaction) {
      return NextResponse.json(
        { error: 'Original transaction not found' },
        { status: 404 }
      )
    }

    // Prevent splitting balance adjustment transactions
    if (originalTransaction.is_balance_adjustment) {
      return NextResponse.json(
        {
          error: 'Cannot split balance adjustment transaction',
          message: 'This is a system-generated balance adjustment transaction. To modify it, edit the associated checkpoint instead.',
          checkpoint_id: originalTransaction.checkpoint_id,
        },
        { status: 403 }
      )
    }

    // Calculate the original amount
    const originalAmount =
      originalTransaction.debit_amount || originalTransaction.credit_amount || 0
    const transactionDirection = originalTransaction.debit_amount ? 'debit' : 'credit'

    // Validate split amounts sum to original
    const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0)
    if (Math.abs(totalSplitAmount - originalAmount) > 0.01) {
      return NextResponse.json(
        {
          error: 'Split amounts must sum to original amount',
          original: originalAmount,
          total: totalSplitAmount,
        },
        { status: 400 }
      )
    }

    // Check if transaction is already split
    const { data: existingSplits, error: existingSplitsError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('raw_transaction_id', raw_transaction_id)

    if (existingSplitsError) {
      console.error('Error checking existing splits:', existingSplitsError)
      return NextResponse.json(
        { error: existingSplitsError.message },
        { status: 500 }
      )
    }

    // If already split, delete existing splits first
    if (existingSplits && existingSplits.length > 0) {
      const { error: deleteError } = await supabase
        .from('main_transaction')
        .delete()
        .eq('raw_transaction_id', raw_transaction_id)

      if (deleteError) {
        console.error('Error deleting existing splits:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete existing splits' },
          { status: 500 }
        )
      }
    }

    // Create the new splits
    const splitRecords = splits.map((split, index) => ({
      raw_transaction_id,
      account_id: originalTransaction.account_id,
      transaction_type_id: split.transaction_type_id,
      category_id: split.category_id || null,
      branch_id: split.branch_id || null,
      amount: split.amount,
      transaction_direction: transactionDirection,
      transaction_date: originalTransaction.transaction_date,
      description: split.description || originalTransaction.description,
      notes: split.notes || null,
      is_split: true,
      split_sequence: index + 1,
    }))

    const { data: createdSplits, error: insertError } = await supabase
      .from('main_transaction')
      .insert(splitRecords)
      .select()

    if (insertError) {
      console.error('Error creating splits:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Get full details for the created splits
    const mainTransactionIds = createdSplits.map(s => s.main_transaction_id)
    const { data: fullDetails, error: detailsError } = await supabase
      .from('main_transaction_details')
      .select('*')
      .in('main_transaction_id', mainTransactionIds)
      .order('split_sequence', { ascending: true })

    if (detailsError) {
      console.error('Error fetching split details:', detailsError)
      // Still return the basic data
      return NextResponse.json({
        data: createdSplits,
        message: 'Transaction split successfully',
      })
    }

    return NextResponse.json({
      data: fullDetails,
      message: 'Transaction split successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
