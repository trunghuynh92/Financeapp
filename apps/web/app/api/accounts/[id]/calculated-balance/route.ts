import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/accounts/[id]/calculated-balance
 * Calculate current balance from all transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Try using the RPC function first (if migration was run)
    let calculatedBalance = 0

    const { data: rpcData, error: rpcError } = await supabase.rpc('calculate_account_balance', {
      p_account_id: accountId
    })

    if (!rpcError && rpcData !== null) {
      // RPC function exists and worked
      calculatedBalance = rpcData
      console.log(`Balance for account ${accountId} (via RPC): ${calculatedBalance}`)
    } else {
      // Fallback: Fetch all transactions and calculate in JavaScript
      // This will work even without the migration
      console.log('RPC not available, using fallback calculation')

      let allTransactions: any[] = []
      let page = 0
      const pageSize = 1000

      while (true) {
        const { data: transactions, error: fetchError } = await supabase
          .from('original_transaction')
          .select('credit_amount, debit_amount')
          .eq('account_id', accountId)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (fetchError) {
          throw new Error(`Failed to fetch transactions: ${fetchError.message}`)
        }

        if (!transactions || transactions.length === 0) {
          break
        }

        allTransactions = allTransactions.concat(transactions)

        if (transactions.length < pageSize) {
          break
        }

        page++
      }

      let totalCredits = 0
      let totalDebits = 0

      for (const tx of allTransactions) {
        if (tx.credit_amount) totalCredits += tx.credit_amount
        if (tx.debit_amount) totalDebits += tx.debit_amount
      }

      calculatedBalance = totalCredits - totalDebits
      console.log(`Balance for account ${accountId} (via fallback): Credits=${totalCredits}, Debits=${totalDebits}, Balance=${calculatedBalance}`)
    }

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
