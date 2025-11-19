import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function checkInvestmentMatching() {
  console.log('=== Checking Investment Matching ===\n')

  // Check recent investment transactions
  const { data: transactions, error: txError } = await supabase
    .from('main_transaction')
    .select(`
      main_transaction_id,
      description,
      amount,
      transaction_direction,
      investment_contribution_id,
      transaction_type_id,
      account_id,
      created_at
    `)
    .or('transaction_type_id.eq.26,transaction_type_id.eq.27')
    .order('created_at', { ascending: false })
    .limit(10)

  if (txError) {
    console.error('Error fetching transactions:', txError)
    return
  }

  console.log(`Found ${transactions?.length || 0} investment transactions:\n`)
  console.table(transactions)

  // Check investment contributions
  const { data: contributions, error: contribError } = await supabase
    .from('investment_contribution')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (contribError) {
    console.error('Error fetching contributions:', contribError)
    return
  }

  console.log(`\nFound ${contributions?.length || 0} investment contributions:\n`)
  console.table(contributions)
}

checkInvestmentMatching()
