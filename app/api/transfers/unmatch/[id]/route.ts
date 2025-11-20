/**
 * API Route: /api/transfers/unmatch/[id]
 * Purpose: Unmatch a transfer (remove the link between TRF_OUT and TRF_IN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
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
        loan_disbursement_id,
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
    const isLoanCollection = typeData?.type_code === 'LOAN_RECEIVE' || typeData?.type_code === 'LOAN_COLLECT'
    const isLoanDisbursement = typeData?.type_code === 'LOAN_DISBURSE'
    const isInvestmentContribution = typeData?.type_code === 'INV_CONTRIB'
    const isInvestmentWithdrawal = typeData?.type_code === 'INV_WITHDRAW'

    // Special handling for LOAN_RECEIVE/LOAN_COLLECT transactions
    if (isLoanCollection && transaction.loan_disbursement_id) {
      const loanDisbursementId = transaction.loan_disbursement_id

      // Get the matched LOAN_SETTLE transaction details
      const { data: matchedTransaction } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, raw_transaction_id, loan_disbursement_id')
        .eq('main_transaction_id', matchedId)
        .single()

      if (matchedTransaction) {
        // Delete the matched LOAN_SETTLE main_transaction
        await supabase
          .from('main_transaction')
          .delete()
          .eq('main_transaction_id', matchedTransaction.main_transaction_id)

        // Delete the matched LOAN_SETTLE original_transaction
        await supabase
          .from('original_transaction')
          .delete()
          .eq('raw_transaction_id', matchedTransaction.raw_transaction_id)
      }

      // Unmatch the LOAN_RECEIVE transaction and clear its loan_disbursement_id
      const { error: unmatchError } = await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: null,
          loan_disbursement_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', mainTransactionId)

      if (unmatchError) {
        console.error('Error unmatching LOAN_RECEIVE transaction:', unmatchError)
        return NextResponse.json(
          { error: 'Failed to unmatch loan collection' },
          { status: 500 }
        )
      }

      // CRITICAL: Recalculate the loan disbursement balance after unmatching
      const { data: loanDisbursement } = await supabase
        .from('loan_disbursement')
        .select('principal_amount, due_date')
        .eq('loan_disbursement_id', loanDisbursementId)
        .single()

      if (loanDisbursement) {
        // Get LOAN_RECEIVE transaction type ID
        const { data: loanReceiveType } = await supabase
          .from('transaction_types')
          .select('transaction_type_id')
          .in('type_code', ['LOAN_RECEIVE', 'LOAN_COLLECT'])
          .single()

        if (loanReceiveType) {
          // Recalculate using only matched LOAN_RECEIVE transactions
          const { data: receivedPayments } = await supabase
            .from('main_transaction')
            .select('amount')
            .eq('loan_disbursement_id', loanDisbursementId)
            .eq('transaction_type_id', loanReceiveType.transaction_type_id)
            .not('transfer_matched_transaction_id', 'is', null)

          const totalReceived = receivedPayments?.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0) || 0

          const newRemainingBalance = Math.max(loanDisbursement.principal_amount - totalReceived, 0)
          const isNowOverpaid = totalReceived > loanDisbursement.principal_amount
          const newStatus = totalReceived >= loanDisbursement.principal_amount ? 'repaid' :
                           (loanDisbursement.due_date && new Date() > new Date(loanDisbursement.due_date)) ? 'overdue' : 'active'

          await supabase
            .from('loan_disbursement')
            .update({
              remaining_balance: newRemainingBalance,
              is_overpaid: isNowOverpaid,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('loan_disbursement_id', loanDisbursementId)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Loan collection unmatched successfully. Balance recalculated.',
        transaction_id: mainTransactionId,
        loan_disbursement_id: loanDisbursementId,
      })
    }

    // Special handling for LOAN_DISBURSE transactions
    if (isLoanDisbursement && transaction.loan_disbursement_id) {
      const loanDisbursementId = transaction.loan_disbursement_id

      // Get the loan disbursement details (might not exist if already deleted)
      const { data: loanDisbursement } = await supabase
        .from('loan_disbursement')
        .select('loan_disbursement_id, loan_receivable_account_id')
        .eq('loan_disbursement_id', loanDisbursementId)
        .single()

      // If disbursement exists, check for payment history
      if (loanDisbursement) {
        const { data: loanReceiveType } = await supabase
          .from('transaction_types')
          .select('transaction_type_id')
          .in('type_code', ['LOAN_RECEIVE', 'LOAN_COLLECT'])
          .single()

        if (loanReceiveType) {
          const { count: paymentsCount } = await supabase
            .from('main_transaction')
            .select('*', { count: 'exact', head: true })
            .eq('loan_disbursement_id', loanDisbursementId)
            .eq('transaction_type_id', loanReceiveType.transaction_type_id)

          if (paymentsCount && paymentsCount > 0) {
            return NextResponse.json(
              { error: 'Cannot unmatch loan disbursement with payment history. Please delete payments first.' },
              { status: 400 }
            )
          }
        }
      }

      // Get the matched credit transaction (in Loan Receivable account)
      const { data: matchedTransaction } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, raw_transaction_id, account_id')
        .eq('main_transaction_id', matchedId)
        .single()

      if (matchedTransaction) {
        // Delete the credit transaction in Loan Receivable account
        await supabase
          .from('main_transaction')
          .delete()
          .eq('main_transaction_id', matchedTransaction.main_transaction_id)

        await supabase
          .from('original_transaction')
          .delete()
          .eq('raw_transaction_id', matchedTransaction.raw_transaction_id)
      }

      // Clear the loan_disbursement_id and transfer link from source transaction
      const { error: unmatchError } = await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: null,
          loan_disbursement_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', mainTransactionId)

      if (unmatchError) {
        console.error('Error unmatching LOAN_DISBURSE transaction:', unmatchError)
        return NextResponse.json(
          { error: 'Failed to unmatch loan disbursement' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Loan disbursement unmatched successfully. Credit transaction deleted and links cleared.',
        transaction_id: mainTransactionId,
        loan_disbursement_id: loanDisbursementId,
      })
    }

    // Special handling for DEBT_PAY transactions
    if (isDebtPayback && transaction.drawdown_id) {
      const drawdownId = transaction.drawdown_id

      // Get the matched DEBT_PAY transaction details (credit to credit line)
      const { data: matchedTransaction } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, raw_transaction_id, drawdown_id')
        .eq('main_transaction_id', matchedId)
        .single()

      if (matchedTransaction) {
        // Find and delete any credit memos for this drawdown (if overpayment occurred)
        const { data: creditMemos } = await supabase
          .from('main_transaction')
          .select('main_transaction_id, raw_transaction_id')
          .eq('drawdown_id', drawdownId)
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

        // Delete the matched DEBT_PAY main_transaction (credit to credit line)
        await supabase
          .from('main_transaction')
          .delete()
          .eq('main_transaction_id', matchedTransaction.main_transaction_id)

        // Delete the matched DEBT_PAY original_transaction
        await supabase
          .from('original_transaction')
          .delete()
          .eq('raw_transaction_id', matchedTransaction.raw_transaction_id)
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

      // CRITICAL: Recalculate the drawdown balance after unmatching
      const { data: drawdown } = await supabase
        .from('debt_drawdown')
        .select('original_amount, due_date')
        .eq('drawdown_id', drawdownId)
        .single()

      if (drawdown) {
        // Get DEBT_PAY transaction type ID
        const { data: debtPayType } = await supabase
          .from('transaction_types')
          .select('transaction_type_id')
          .eq('type_code', 'DEBT_PAY')
          .single()

        if (debtPayType) {
          // Recalculate using only CREDIT transactions (to avoid double-counting)
          const { data: paidTransactions } = await supabase
            .from('main_transaction')
            .select('amount')
            .eq('drawdown_id', drawdownId)
            .eq('transaction_type_id', debtPayType.transaction_type_id)
            .eq('transaction_direction', 'credit')
            .not('transfer_matched_transaction_id', 'is', null)

          const settledAmount = paidTransactions?.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0) || 0

          const newRemainingBalance = Math.max(drawdown.original_amount - settledAmount, 0)
          const isNowOverpaid = settledAmount > drawdown.original_amount
          const newStatus = settledAmount >= drawdown.original_amount ? 'settled' :
                           (drawdown.due_date && new Date() > new Date(drawdown.due_date)) ? 'overdue' : 'active'

          await supabase
            .from('debt_drawdown')
            .update({
              remaining_balance: newRemainingBalance,
              is_overpaid: isNowOverpaid,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('drawdown_id', drawdownId)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Debt payback unmatched successfully. Balance recalculated.',
        transaction_id: mainTransactionId,
        drawdown_id: drawdownId,
      })
    }

    // Special handling for INV_CONTRIB and INV_WITHDRAW transactions
    if (isInvestmentContribution || isInvestmentWithdrawal) {
      // Get the matched transaction (the paired transaction in the investment account)
      const { data: matchedTransaction } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, raw_transaction_id, account_id')
        .eq('main_transaction_id', matchedId)
        .single()

      if (matchedTransaction) {
        // Delete the paired transaction in the investment account
        await supabase
          .from('main_transaction')
          .delete()
          .eq('main_transaction_id', matchedTransaction.main_transaction_id)

        await supabase
          .from('original_transaction')
          .delete()
          .eq('raw_transaction_id', matchedTransaction.raw_transaction_id)
      }

      // Clear the transfer link from the source transaction
      const { error: unmatchError } = await supabase
        .from('main_transaction')
        .update({
          transfer_matched_transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('main_transaction_id', mainTransactionId)

      if (unmatchError) {
        console.error('Error unmatching investment transaction:', unmatchError)
        return NextResponse.json(
          { error: 'Failed to unmatch investment' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Investment unmatched successfully. Paired transaction deleted.',
        transaction_id: mainTransactionId,
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
