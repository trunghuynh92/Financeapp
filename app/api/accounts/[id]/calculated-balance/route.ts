import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/accounts/[id]/calculated-balance
 * Calculate current balance from all transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Calculate balance from ALL transactions INCLUDING adjustments
    // Adjustments represent real money (opening balances, untracked income/expenses)
    const { data: transactions, error: transactionsError } = await supabase
      .from('original_transaction')
      .select('credit_amount, debit_amount')
      .eq('account_id', accountId)

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`)
    }

    let totalCredits = 0
    let totalDebits = 0

    if (transactions && transactions.length > 0) {
      for (const tx of transactions) {
        if (tx.credit_amount) {
          totalCredits += tx.credit_amount
        }
        if (tx.debit_amount) {
          totalDebits += tx.debit_amount
        }
      }
    }

    // Balance = Credits - Debits (includes ALL transactions including adjustments)
    const calculatedBalance = totalCredits - totalDebits

    return NextResponse.json({
      success: true,
      data: {
        calculated_balance: calculatedBalance,
      },
    })
  } catch (error) {
    console.error('Error calculating balance:', error)

    return NextResponse.json(
      {
        error: 'Failed to calculate balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
