/**
 * API Route: /api/transfers/unmatch/[id]
 * Purpose: Unmatch a transfer (remove the link between TRF_OUT and TRF_IN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mainTransactionId = parseInt(params.id, 10)

    if (isNaN(mainTransactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    // Fetch the transaction to get its matched pair
    const { data: transaction, error: fetchError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, transfer_matched_transaction_id')
      .eq('main_transaction_id', mainTransactionId)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    if (!transaction.transfer_matched_transaction_id) {
      return NextResponse.json(
        { error: 'Transaction is not matched to any transfer' },
        { status: 400 }
      )
    }

    const matchedId = transaction.transfer_matched_transaction_id

    // Unmatch both transactions
    const { error: unmatchError1 } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', mainTransactionId)

    if (unmatchError1) {
      console.error('Error unmatching first transaction:', unmatchError1)
      return NextResponse.json(
        { error: 'Failed to unmatch transfer' },
        { status: 500 }
      )
    }

    const { error: unmatchError2 } = await supabase
      .from('main_transaction')
      .update({
        transfer_matched_transaction_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('main_transaction_id', matchedId)

    if (unmatchError2) {
      console.error('Error unmatching second transaction:', unmatchError2)
      // Attempt to rollback
      await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: matchedId,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', mainTransactionId)

      return NextResponse.json(
        { error: 'Failed to unmatch transfer' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Transfer unmatched successfully',
      transaction_id: mainTransactionId,
      matched_transaction_id: matchedId,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
