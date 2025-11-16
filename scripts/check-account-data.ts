/**
 * Script to check account data in Supabase
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function checkAccountData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('🔍 Checking account 14 data...\n')

  // Check checkpoints
  const { data: checkpoints, error: cpError } = await supabase
    .from('balance_checkpoints')
    .select('checkpoint_id, checkpoint_date, declared_balance, calculated_balance, import_batch_id')
    .eq('account_id', 14)
    .order('checkpoint_date', { ascending: true })

  if (cpError) {
    console.error('❌ Error fetching checkpoints:', cpError)
  } else {
    console.log('📊 Checkpoints:')
    console.table(checkpoints)
  }

  // Check transaction count
  const { count: totalCount, error: countError } = await supabase
    .from('original_transaction')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', 14)

  if (countError) {
    console.error('❌ Error counting transactions:', countError)
  } else {
    console.log(`\n📈 Total transactions: ${totalCount}`)
  }

  // Check transactions by date
  const { data: transactions, error: txError } = await supabase
    .from('original_transaction')
    .select('transaction_date, is_balance_adjustment, balance')
    .eq('account_id', 14)
    .order('transaction_date', { ascending: true })

  if (txError) {
    console.error('❌ Error fetching transactions:', txError)
  } else {
    // Group by date
    const byDate = new Map<string, { count: number; adjustments: number; withBalance: number }>()

    transactions?.forEach(txn => {
      const date = txn.transaction_date
      if (!byDate.has(date)) {
        byDate.set(date, { count: 0, adjustments: 0, withBalance: 0 })
      }
      const stats = byDate.get(date)!
      stats.count++
      if (txn.is_balance_adjustment) stats.adjustments++
      if (txn.balance !== null) stats.withBalance++
    })

    console.log('\n📅 Transactions by date:')
    const dateStats = Array.from(byDate.entries()).map(([date, stats]) => ({
      transaction_date: date,
      total: stats.count,
      adjustments: stats.adjustments,
      with_balance: stats.withBalance,
      regular: stats.count - stats.adjustments
    }))
    console.table(dateStats)
  }

  // Check specific date range (Apr 30 - Jun 30)
  const { count: periodCount, error: periodError } = await supabase
    .from('original_transaction')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', 14)
    .gt('transaction_date', '2025-04-30')
    .lte('transaction_date', '2025-06-30')

  if (periodError) {
    console.error('❌ Error counting period transactions:', periodError)
  } else {
    console.log(`\n📊 Transactions between Apr 30 and Jun 30: ${periodCount}`)
  }
}

checkAccountData()
