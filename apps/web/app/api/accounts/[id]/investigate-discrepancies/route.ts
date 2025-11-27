import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/accounts/[id]/investigate-discrepancies
 * Compares calculated balances vs checkpoint balances for each day
 * Returns dates where discrepancies exist with transaction details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Get checkpoint_id from query params if provided
    const { searchParams } = new URL(request.url)
    const checkpointIdParam = searchParams.get('checkpoint_id')

    let checkpoints

    if (checkpointIdParam) {
      // Get specific checkpoint and all checkpoints before it
      const checkpointId = parseInt(checkpointIdParam)

      // Get the target checkpoint
      const { data: targetCheckpoint, error: targetError } = await supabase
        .from('balance_checkpoints')
        .select('checkpoint_id, checkpoint_date, declared_balance, calculated_balance, import_batch_id')
        .eq('checkpoint_id', checkpointId)
        .single()

      if (targetError || !targetCheckpoint) {
        console.error('Error fetching target checkpoint:', targetError)
        return NextResponse.json(
          { error: 'Checkpoint not found', details: targetError?.message },
          { status: 404 }
        )
      }

      // Get all checkpoints up to and including this one
      const { data: allCheckpoints, error: checkpointsError } = await supabase
        .from('balance_checkpoints')
        .select('checkpoint_id, checkpoint_date, declared_balance, calculated_balance, import_batch_id')
        .eq('account_id', accountId)
        .lte('checkpoint_date', targetCheckpoint.checkpoint_date)
        .order('checkpoint_date', { ascending: true })

      if (checkpointsError) {
        console.error('Error fetching checkpoints:', checkpointsError)
        return NextResponse.json(
          { error: checkpointsError.message },
          { status: 500 }
        )
      }

      checkpoints = allCheckpoints
    } else {
      // Get all checkpoints for this account
      const { data: allCheckpoints, error: checkpointsError } = await supabase
        .from('balance_checkpoints')
        .select('checkpoint_id, checkpoint_date, declared_balance, calculated_balance, import_batch_id')
        .eq('account_id', accountId)
        .order('checkpoint_date', { ascending: true })

      if (checkpointsError) {
        console.error('Error fetching checkpoints:', checkpointsError)
        return NextResponse.json(
          { error: checkpointsError.message },
          { status: 500 }
        )
      }

      checkpoints = allCheckpoints
    }

    if (!checkpoints || checkpoints.length === 0) {
      return NextResponse.json({
        discrepancies: [],
        message: 'No checkpoints found for this account'
      })
    }

    const discrepancies = []

    // For the selected checkpoint, analyze transactions from previous checkpoint to current
    const targetCheckpoint = checkpoints[checkpoints.length - 1]
    const checkpointDate = targetCheckpoint.checkpoint_date
    const declaredBalance = Number(targetCheckpoint.declared_balance)
    const previousCheckpoint = checkpoints.length > 1 ? checkpoints[checkpoints.length - 2] : null
    const periodStartDate = previousCheckpoint ? previousCheckpoint.checkpoint_date : null

    console.log(`🔍 Fetching transactions for period:`)
    console.log(`   Period start date: ${periodStartDate}`)
    console.log(`   Checkpoint date: ${checkpointDate}`)

    // Get transactions for this account in the specific date range
    // Filter by date in SQL query for better performance
    let query = supabase
      .from('original_transaction')
      .select('raw_transaction_id, transaction_date, description, debit_amount, credit_amount, balance, is_balance_adjustment, transaction_sequence, checkpoint_id', { count: 'exact' })
      .eq('account_id', accountId)
      .lte('transaction_date', checkpointDate)
      .order('transaction_date', { ascending: true })
      .order('transaction_sequence', { ascending: true })

    // Add start date filter if there's a previous checkpoint
    if (periodStartDate) {
      query = query.gt('transaction_date', periodStartDate)
    }

    const { data: transactions, error: transactionsError, count } = await query

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError)
      return NextResponse.json(
        { error: transactionsError.message },
        { status: 500 }
      )
    }

    console.log(`   Total transactions fetched: ${transactions?.length || 0}`)
    console.log(`   Total transactions in DB for period (count): ${count || 0}`)

    if (transactions && transactions.length > 0) {
      console.log(`   First transaction date: ${transactions[0].transaction_date}`)
      console.log(`   Last transaction date: ${transactions[transactions.length - 1].transaction_date}`)
    }

    // All fetched transactions are already in the period (filtered by SQL)
    const allTransactionsInPeriod = transactions || []

    console.log(`   ✅ Transactions in period: ${allTransactionsInPeriod.length}`)

    // Exclude balance adjustments from calculations
    const relevantTransactions = allTransactionsInPeriod.filter(txn => !txn.is_balance_adjustment)

    console.log(`📊 Investigation for checkpoint ${targetCheckpoint.checkpoint_id}:`)
    console.log(`   Period: ${periodStartDate || 'beginning'} to ${checkpointDate}`)
    console.log(`   Total transactions in period: ${allTransactionsInPeriod.length}`)
    console.log(`   Non-adjustment transactions: ${relevantTransactions.length}`)

    // Group transactions by date and find dates with declared balances
    const transactionsByDate = new Map<string, any[]>()
    const declaredBalancesByDate = new Map<string, number>()

    for (const txn of relevantTransactions) {
      const date = txn.transaction_date
      if (!transactionsByDate.has(date)) {
        transactionsByDate.set(date, [])
      }
      transactionsByDate.get(date)!.push(txn)

      // Track the last declared balance on this date
      if (txn.balance !== null) {
        declaredBalancesByDate.set(date, Number(txn.balance))
      }
    }

    // Get all unique dates sorted chronologically
    const dates = Array.from(transactionsByDate.keys()).sort()

    console.log(`   Unique dates with transactions: ${dates.length}`)
    console.log(`   Dates with declared balances: ${declaredBalancesByDate.size}`)

    // Start with the previous checkpoint's declared balance
    let lastKnownBalance = previousCheckpoint ? Number(previousCheckpoint.declared_balance) : 0

    // Analyze each date
    for (const date of dates) {
      const txnsOnDate = transactionsByDate.get(date)!
      const declaredBalanceOnDate = declaredBalancesByDate.get(date)

      // Calculate total debits and credits for this date
      let totalDebits = 0
      let totalCredits = 0

      for (const t of txnsOnDate) {
        if (t.debit_amount) totalDebits += Number(t.debit_amount)
        if (t.credit_amount) totalCredits += Number(t.credit_amount)
      }

      // Expected balance change = credits - debits
      const expectedChange = totalCredits - totalDebits
      const expectedBalance = lastKnownBalance + expectedChange

      // If this date has a declared balance, compare it
      if (declaredBalanceOnDate !== undefined) {
        const actualBalance = declaredBalanceOnDate
        const actualChange = actualBalance - lastKnownBalance
        const difference = actualChange - expectedChange

        // Only report if there's a discrepancy
        if (Math.abs(difference) > 0.01) {
          const allTxnsOnDate = allTransactionsInPeriod.filter(t => t.transaction_date === date)

          discrepancies.push({
            date: date,
            checkpoint_balance: actualBalance,
            calculated_balance: expectedBalance,
            difference: difference,
            checkpoint_source: 'transaction',
            checkpoint_id: targetCheckpoint.checkpoint_id,
            transactions_on_date: allTxnsOnDate.map(t => ({
              raw_transaction_id: t.raw_transaction_id,
              description: t.description,
              debit_amount: t.debit_amount,
              credit_amount: t.credit_amount,
              balance: t.balance,
              is_balance_adjustment: t.is_balance_adjustment
            })),
            transactions_count: allTxnsOnDate.length,
            period_start_date: periodStartDate,
            period_start_balance: lastKnownBalance,
            transactions_in_period_count: txnsOnDate.length,
            total_debits: totalDebits,
            total_credits: totalCredits,
            expected_change: expectedChange,
            actual_change: actualChange
          })
        }

        // Update last known balance to the declared balance
        lastKnownBalance = actualBalance
      } else {
        // No declared balance on this date, update expected balance for next iteration
        lastKnownBalance = expectedBalance
      }
    }

    // Finally, check the checkpoint's declared balance
    const finalExpectedBalance = lastKnownBalance
    const difference = declaredBalance - finalExpectedBalance

    if (Math.abs(difference) > 0.01) {
      const txnsOnCheckpointDate = allTransactionsInPeriod.filter(t => t.transaction_date === checkpointDate)

      discrepancies.push({
        date: checkpointDate,
        checkpoint_balance: declaredBalance,
        calculated_balance: finalExpectedBalance,
        difference: difference,
        checkpoint_source: targetCheckpoint.import_batch_id ? 'import' : 'manual',
        checkpoint_id: targetCheckpoint.checkpoint_id,
        transactions_on_date: txnsOnCheckpointDate.map(t => ({
          raw_transaction_id: t.raw_transaction_id,
          description: t.description,
          debit_amount: t.debit_amount,
          credit_amount: t.credit_amount,
          balance: t.balance,
          is_balance_adjustment: t.is_balance_adjustment
        })),
        transactions_count: txnsOnCheckpointDate.length,
        period_start_date: periodStartDate,
        period_start_balance: previousCheckpoint ? Number(previousCheckpoint.declared_balance) : 0,
        transactions_in_period_count: relevantTransactions.length
      })
    }

    return NextResponse.json({
      discrepancies,
      total_checkpoints: checkpoints.length,
      discrepancies_found: discrepancies.length
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
