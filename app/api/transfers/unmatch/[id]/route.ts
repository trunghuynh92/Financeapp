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

    // Fetch the transaction to get its matched pair and type
    const { data: transaction, error: fetchError } = await supabase
      .from('main_transaction')
      .select(`
        main_transaction_id,
        transfer_matched_transaction_id,
        drawdown_id,
        transaction_type_id,
        raw_transaction_id
      `)
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

    // Check transaction type
    const { data: typeData } = await supabase
      .from('transaction_types')
      .select('type_code')
      .eq('transaction_type_id', transaction.transaction_type_id)
      .single()

    const isDebtPayback = typeData?.type_code === 'DEBT_PAY'

    // Special handling for DEBT_PAY transactions
    if (isDebtPayback && transaction.drawdown_id) {
      // Get the matched DEBT_SETTLE transaction details
      const { data: settleTransaction } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, raw_transaction_id, drawdown_id')
        .eq('main_transaction_id', matchedId)
        .single()

      if (settleTransaction) {
        // Find and delete any credit memos for this drawdown (if overpayment occurred)
        const { data: creditMemos } = await supabase
          .from('main_transaction')
          .select('main_transaction_id, raw_transaction_id')
          .eq('drawdown_id', transaction.drawdown_id)
          .not('main_transaction_id', 'in', `(${mainTransactionId},${matchedId})`)
          .in('transaction_type_id', [
            (await supabase.from('transaction_types').select('transaction_type_id').eq('type_code', 'INC').single()).data?.transaction_type_id
          ])

        // Delete credit memos and their original transactions
        if (creditMemos && creditMemos.length > 0) {
          for (const memo of creditMemos) {
            await supabase
              .from('main_transaction')
              .delete()
              .eq('main_transaction_id', memo.main_transaction_id)

            await supabase
              .from('original_transaction')
              .delete()
              .eq('raw_transaction_id', memo.raw_transaction_id)
          }
        }

        // Delete the DEBT_SETTLE main_transaction
        await supabase
          .from('main_transaction')
          .delete()
          .eq('main_transaction_id', settleTransaction.main_transaction_id)

        // Delete the DEBT_SETTLE original_transaction
        await supabase
          .from('original_transaction')
          .delete()
          .eq('raw_transaction_id', settleTransaction.raw_transaction_id)
      }

      // Unmatch the DEBT_PAY transaction and clear its drawdown_id
      const { error: unmatchError } = await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: null,
          drawdown_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', mainTransactionId)

      if (unmatchError) {
        console.error('Error unmatching DEBT_PAY transaction:', unmatchError)
        return NextResponse.json(
          { error: 'Failed to unmatch debt payback' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Debt payback unmatched successfully. Settlement transaction and credit memos deleted.',
        transaction_id: mainTransactionId,
        drawdown_id: transaction.drawdown_id,
      })
    }

    // Regular transfer unmatch logic
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
