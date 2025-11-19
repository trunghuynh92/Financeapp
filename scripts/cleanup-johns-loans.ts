/**
 * Script to clean up all loan disbursements from John's Loan giveout account
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

async function cleanupJohnsLoans() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found')
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

    // Step 1: Get account_id for John's Loan giveout
    const accountQuery = `
      SELECT account_id, account_name, account_type
      FROM accounts
      WHERE account_name = $1
    `
    const accountResult = await client.query(accountQuery, ["John's Loan giveout"])

    if (accountResult.rows.length === 0) {
      console.log('⚠️  Account "John\'s Loan giveout" not found')
      return
    }

    const accountId = accountResult.rows[0].account_id
    console.log(`📍 Found account: ${accountResult.rows[0].account_name} (ID: ${accountId})\n`)

    // Step 2: Get all loan disbursements for this account
    const loansQuery = `
      SELECT
        ld.loan_disbursement_id,
        COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
        ld.principal_amount,
        ld.remaining_balance
      FROM loan_disbursement ld
      LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
      WHERE ld.account_id = $1
      ORDER BY ld.loan_disbursement_id
    `
    const loansResult = await client.query(loansQuery, [accountId])

    console.log(`📊 Found ${loansResult.rows.length} loan disbursements to delete:\n`)
    console.table(loansResult.rows.map(row => ({
      ID: row.loan_disbursement_id,
      Borrower: row.borrower_name,
      Principal: parseFloat(row.principal_amount).toLocaleString(),
      Remaining: parseFloat(row.remaining_balance).toLocaleString()
    })))

    const totalAmount = loansResult.rows.reduce((sum, row) => sum + parseFloat(row.principal_amount), 0)
    console.log(`\n💰 Total amount: ${totalAmount.toLocaleString()}\n`)

    if (loansResult.rows.length === 0) {
      console.log('✅ No loans to delete')
      return
    }

    const loanIds = loansResult.rows.map(row => row.loan_disbursement_id)

    // Step 3: Check for related transactions
    const transactionsQuery = `
      SELECT
        mt.main_transaction_id,
        mt.loan_disbursement_id,
        mt.raw_transaction_id,
        mt.transaction_date,
        mt.amount,
        tt.type_code,
        tt.type_display_name
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.loan_disbursement_id = ANY($1)
      ORDER BY mt.loan_disbursement_id, mt.transaction_date
    `
    const transactionsResult = await client.query(transactionsQuery, [loanIds])

    console.log(`🔍 Found ${transactionsResult.rows.length} related transactions:\n`)
    if (transactionsResult.rows.length > 0) {
      console.table(transactionsResult.rows.map(row => ({
        'Main TX ID': row.main_transaction_id,
        'Loan ID': row.loan_disbursement_id,
        Date: row.transaction_date.toISOString().split('T')[0],
        Type: row.type_code,
        Amount: parseFloat(row.amount).toLocaleString()
      })))
    }

    // Step 4: Start deletion process
    console.log('\n🗑️  Starting cleanup...\n')

    await client.query('BEGIN')

    try {
      // Delete main_transaction records
      if (transactionsResult.rows.length > 0) {
        const mainTxIds = transactionsResult.rows.map(row => row.main_transaction_id)
        const deleteMainTxResult = await client.query(
          'DELETE FROM main_transaction WHERE main_transaction_id = ANY($1)',
          [mainTxIds]
        )
        console.log(`✅ Deleted ${deleteMainTxResult.rowCount} main_transaction records`)

        // Delete original_transaction records
        const rawTxIds = transactionsResult.rows.map(row => row.raw_transaction_id)
        const deleteOriginalTxResult = await client.query(
          'DELETE FROM original_transaction WHERE raw_transaction_id = ANY($1)',
          [rawTxIds]
        )
        console.log(`✅ Deleted ${deleteOriginalTxResult.rowCount} original_transaction records`)
      }

      // Delete loan_disbursement records
      const deleteLoansResult = await client.query(
        'DELETE FROM loan_disbursement WHERE loan_disbursement_id = ANY($1)',
        [loanIds]
      )
      console.log(`✅ Deleted ${deleteLoansResult.rowCount} loan_disbursement records`)

      await client.query('COMMIT')
      console.log('\n✅ Cleanup completed successfully!')

      // Verify deletion
      const verifyQuery = `
        SELECT COUNT(*) as count
        FROM loan_disbursement
        WHERE account_id = $1
      `
      const verifyResult = await client.query(verifyQuery, [accountId])
      console.log(`\n🔍 Remaining loans in account: ${verifyResult.rows[0].count}`)

    } catch (error) {
      await client.query('ROLLBACK')
      console.error('❌ Error during deletion, rolled back:', error)
      throw error
    }

  } catch (error) {
    console.error('❌ Database error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
  } finally {
    await client.end()
    console.log('\n🔌 Disconnected from database')
  }
}

cleanupJohnsLoans()
