/**
 * Script to query loan disbursements using direct PostgreSQL connection
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function queryLoanDisbursements() {
  // Get connection string from environment
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables')
    console.error('\nAdd this to your .env.local:')
    console.error('DATABASE_URL=postgresql://postgres.mflyrbzriksgjutlalkf:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected!\n')

    // Query 1: Get all loan disbursements with borrower details
    console.log('📊 Fetching loan disbursements...\n')

    const loansQuery = `
      SELECT
          ld.loan_disbursement_id AS id,
          ld.account_id,
          a.account_name,

          -- Borrower info
          COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
          bp.partner_type AS borrower_type,

          -- Loan details
          ld.loan_category,
          ld.principal_amount,
          ld.remaining_balance,

          -- Calculate paid amount and progress
          (ld.principal_amount - ld.remaining_balance) AS paid_amount,
          ROUND(
              ((ld.principal_amount - ld.remaining_balance) / NULLIF(ld.principal_amount, 0) * 100)::NUMERIC,
              2
          ) AS progress_pct,

          -- Dates
          ld.disbursement_date,
          ld.due_date,
          ld.term_months,

          -- Status
          ld.status,
          ld.is_overpaid,

          -- Additional
          ld.interest_rate,
          ld.notes

      FROM loan_disbursement ld
      LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
      INNER JOIN accounts a ON ld.account_id = a.account_id
      ORDER BY ld.disbursement_date DESC;
    `

    const loansResult = await client.query(loansQuery)

    if (loansResult.rows.length === 0) {
      console.log('⚠️  No loan disbursements found in database\n')
    } else {
      console.log(`Found ${loansResult.rows.length} loan(s):\n`)
      console.table(loansResult.rows.map(row => ({
        ID: row.id,
        Borrower: row.borrower_name,
        Type: row.borrower_type || 'N/A',
        Disbursed: row.disbursement_date,
        Principal: parseFloat(row.principal_amount).toLocaleString(),
        Remaining: parseFloat(row.remaining_balance).toLocaleString(),
        Paid: parseFloat(row.paid_amount).toLocaleString(),
        Progress: `${row.progress_pct}%`,
        'Due Date': row.due_date || 'N/A',
        Status: row.status,
        Account: row.account_name
      })))
    }

    // Query 2: Summary statistics
    console.log('\n📈 Summary Statistics:\n')

    const summaryQuery = `
      SELECT
          SUM(ld.remaining_balance) AS total_outstanding,
          COUNT(CASE WHEN ld.status = 'active' THEN 1 END) AS active_loans,
          COUNT(*) AS total_loans,
          MIN(CASE WHEN ld.status = 'active' AND ld.due_date >= CURRENT_DATE THEN ld.due_date END) AS next_due_date,
          COUNT(CASE WHEN ld.status = 'overdue' THEN 1 END) AS overdue_loans
      FROM loan_disbursement ld;
    `

    const summaryResult = await client.query(summaryQuery)
    const stats = summaryResult.rows[0]

    console.log(`   Total Outstanding: ${parseFloat(stats.total_outstanding || 0).toLocaleString()}`)
    console.log(`   Active Loans: ${stats.active_loans}/${stats.total_loans}`)
    console.log(`   Overdue Loans: ${stats.overdue_loans}`)
    console.log(`   Next Due Date: ${stats.next_due_date || 'N/A'}`)

    // Query 3: Breakdown by borrower type
    console.log('\n📊 Breakdown by Borrower Type:\n')

    const typeBreakdownQuery = `
      SELECT
          COALESCE(bp.partner_type::TEXT, 'Unknown') AS borrower_type,
          COUNT(*) AS loan_count,
          SUM(ld.principal_amount) AS total_principal,
          SUM(ld.remaining_balance) AS total_remaining,
          SUM(ld.principal_amount - ld.remaining_balance) AS total_paid
      FROM loan_disbursement ld
      LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
      GROUP BY bp.partner_type
      ORDER BY total_remaining DESC;
    `

    const typeBreakdownResult = await client.query(typeBreakdownQuery)

    if (typeBreakdownResult.rows.length > 0) {
      console.table(typeBreakdownResult.rows.map(row => ({
        Type: row.borrower_type,
        Count: row.loan_count,
        Principal: parseFloat(row.total_principal).toLocaleString(),
        Remaining: parseFloat(row.total_remaining).toLocaleString(),
        Paid: parseFloat(row.total_paid).toLocaleString()
      })))
    }

    // Query 4: Check for balance calculation issues
    console.log('\n🔍 Checking for balance calculation issues...\n')

    const balanceCheckQuery = `
      SELECT
          ld.loan_disbursement_id,
          COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
          ld.principal_amount,
          ld.remaining_balance,
          ld.principal_amount - COALESCE((
              SELECT SUM(mt.amount)
              FROM main_transaction mt
              JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
              WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
              AND tt.type_code = 'LOAN_RECEIVE'
          ), 0) AS expected_remaining,
          ld.remaining_balance - (
              ld.principal_amount - COALESCE((
                  SELECT SUM(mt.amount)
                  FROM main_transaction mt
                  JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
                  WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
                  AND tt.type_code = 'LOAN_RECEIVE'
              ), 0)
          ) AS balance_discrepancy
      FROM loan_disbursement ld
      LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
      WHERE ABS(
          ld.remaining_balance - (
              ld.principal_amount - COALESCE((
                  SELECT SUM(mt.amount)
                  FROM main_transaction mt
                  JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
                  WHERE mt.loan_disbursement_id = ld.loan_disbursement_id
                  AND tt.type_code = 'LOAN_RECEIVE'
              ), 0)
          )
      ) > 0.01;
    `

    const balanceCheckResult = await client.query(balanceCheckQuery)

    if (balanceCheckResult.rows.length === 0) {
      console.log('   ✅ All loan balances are correct!')
    } else {
      console.log('   ⚠️  Found balance discrepancies:')
      console.table(balanceCheckResult.rows.map(row => ({
        ID: row.loan_disbursement_id,
        Borrower: row.borrower_name,
        Principal: parseFloat(row.principal_amount).toLocaleString(),
        'Actual Balance': parseFloat(row.remaining_balance).toLocaleString(),
        'Expected Balance': parseFloat(row.expected_remaining).toLocaleString(),
        Discrepancy: parseFloat(row.balance_discrepancy).toLocaleString()
      })))
    }

    console.log('\n✅ Query complete!')

  } catch (error) {
    console.error('❌ Database error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
  } finally {
    await client.end()
    console.log('🔌 Disconnected from database')
  }
}

queryLoanDisbursements()
