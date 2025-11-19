/**
 * Script to check loan disbursement data
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

async function checkLoanDisbursements() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    console.error('URL:', supabaseUrl ? '✓' : '✗')
    console.error('Key:', supabaseKey ? '✓' : '✗')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 Fetching loan disbursement data...\n')

  // Get all loan disbursements with borrower info
  const { data: loans, error: loansError } = await supabase
    .from('loan_disbursement')
    .select(`
      loan_disbursement_id,
      account_id,
      partner_id,
      borrower_name,
      loan_category,
      principal_amount,
      remaining_balance,
      disbursement_date,
      due_date,
      term_months,
      status,
      is_overpaid,
      interest_rate,
      notes,
      created_at,
      accounts!inner(
        account_name,
        account_type,
        entity_id
      ),
      business_partners(
        partner_name,
        partner_type
      )
    `)
    .order('disbursement_date', { ascending: false })

  if (loansError) {
    console.error('❌ Error fetching loans:', loansError)
    console.error('Error details:', JSON.stringify(loansError, null, 2))
    return
  }

  console.log(`✅ Found ${loans?.length || 0} loan disbursements`)

  if (!loans || loans.length === 0) {
    console.log('\n⚠️  No loan disbursements found. This could mean:')
    console.log('   1. No loans exist in the database')
    console.log('   2. RLS policies are blocking access (try with service role key)')
    console.log('   3. The current user has no entity access')
    return
  }

  // Transform data for display
  const loanDetails = loans?.map(loan => ({
    id: loan.loan_disbursement_id,
    borrower: loan.business_partners?.partner_name || loan.borrower_name,
    type: loan.business_partners?.partner_type || 'N/A',
    disbursed: loan.disbursement_date,
    principal: loan.principal_amount.toLocaleString(),
    remaining: loan.remaining_balance.toLocaleString(),
    paid: (loan.principal_amount - loan.remaining_balance).toLocaleString(),
    progress: `${(((loan.principal_amount - loan.remaining_balance) / loan.principal_amount) * 100).toFixed(2)}%`,
    due_date: loan.due_date || 'N/A',
    status: loan.status,
    account: loan.accounts?.account_name
  }))

  console.log('📊 Loan Disbursements:')
  console.table(loanDetails)

  // Calculate summary statistics
  const totalOutstanding = loans?.reduce((sum, loan) => sum + parseFloat(loan.remaining_balance.toString()), 0) || 0
  const activeLoans = loans?.filter(loan => loan.status === 'active').length || 0
  const totalLoans = loans?.length || 0
  const overdueLoans = loans?.filter(loan => loan.status === 'overdue').length || 0

  // Find next due date
  const activeLoansDueDates = loans
    ?.filter(loan => loan.status === 'active' && loan.due_date && new Date(loan.due_date) >= new Date())
    .map(loan => new Date(loan.due_date!))
    .sort((a, b) => a.getTime() - b.getTime())

  const nextDueDate = activeLoansDueDates && activeLoansDueDates.length > 0
    ? activeLoansDueDates[0].toISOString().split('T')[0]
    : 'N/A'

  console.log('\n📈 Summary Statistics:')
  console.log(`   Total Outstanding: ${totalOutstanding.toLocaleString()}`)
  console.log(`   Active Loans: ${activeLoans}/${totalLoans}`)
  console.log(`   Overdue Loans: ${overdueLoans}`)
  console.log(`   Next Due Date: ${nextDueDate}`)

  // Check if there are any loans with mismatched balances
  console.log('\n🔍 Checking for potential balance issues...')

  for (const loan of loans || []) {
    // Get all LOAN_RECEIVE transactions for this loan
    const { data: transactions, error: txError } = await supabase
      .from('main_transaction')
      .select(`
        main_transaction_id,
        amount,
        transaction_date,
        transaction_types!inner(
          type_code
        )
      `)
      .eq('loan_disbursement_id', loan.loan_disbursement_id)
      .eq('transaction_types.type_code', 'LOAN_RECEIVE')

    if (!txError && transactions) {
      const totalReceived = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0)
      const expectedRemaining = loan.principal_amount - totalReceived
      const actualRemaining = loan.remaining_balance

      if (Math.abs(expectedRemaining - actualRemaining) > 0.01) {
        console.log(`   ⚠️  Loan ${loan.loan_disbursement_id} has balance mismatch:`)
        console.log(`      Principal: ${loan.principal_amount}`)
        console.log(`      Total received: ${totalReceived}`)
        console.log(`      Expected remaining: ${expectedRemaining}`)
        console.log(`      Actual remaining: ${actualRemaining}`)
        console.log(`      Difference: ${actualRemaining - expectedRemaining}`)
      }
    }
  }

  console.log('\n✅ Done!')
}

checkLoanDisbursements()
