/**
 * Script to fix loan account balance by manually recalculating
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function fixLoanBalance() {
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
    await client.connect()
    console.log('🔧 Fixing loan account balance...\n')

    // Find Mary's Construct loan (loan_disbursement_id = 30)
    const loanQuery = `
      SELECT
        ld.loan_disbursement_id,
        ld.account_id,
        COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
        ld.principal_amount,
        ld.remaining_balance,
        ld.status
      FROM loan_disbursement ld
      LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
      WHERE ld.loan_disbursement_id = 30
    `
    const loanResult = await client.query(loanQuery)

    if (loanResult.rows.length === 0) {
      console.log('⚠️  Loan not found')
      return
    }

    const loan = loanResult.rows[0]
    console.log('📊 Current loan state:')
    console.log(`   Borrower: ${loan.borrower_name}`)
    console.log(`   Principal: ${parseFloat(loan.principal_amount).toLocaleString()}`)
    console.log(`   Remaining Balance: ${parseFloat(loan.remaining_balance).toLocaleString()}`)
    console.log(`   Status: ${loan.status}\n`)

    // Check transactions on the loan_receivable account
    const accountTxQuery = `
      SELECT
        mt.main_transaction_id,
        mt.transaction_date,
        mt.transaction_direction,
        mt.amount,
        tt.type_code,
        mt.loan_disbursement_id
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.account_id = $1
      AND mt.loan_disbursement_id = 30
      ORDER BY mt.transaction_date, mt.main_transaction_id
    `
    const txResult = await client.query(accountTxQuery, [loan.account_id])

    console.log('📋 Transactions on loan account:\n')
    console.table(txResult.rows.map(row => ({
      ID: row.main_transaction_id,
      Date: row.transaction_date.toISOString().split('T')[0],
      Type: row.type_code,
      Direction: row.transaction_direction,
      Amount: parseFloat(row.amount).toLocaleString()
    })))

    // Calculate current account balance from transactions
    let accountBalance = 0
    for (const tx of txResult.rows) {
      if (tx.transaction_direction === 'debit') {
        accountBalance += parseFloat(tx.amount)
      } else {
        accountBalance -= parseFloat(tx.amount)
      }
    }

    console.log(`\n💡 Balance Analysis:`)
    console.log(`   Loan Remaining Balance: ${parseFloat(loan.remaining_balance).toLocaleString()}`)
    console.log(`   Account Calculated Balance: ${accountBalance.toLocaleString()}`)
    console.log(`   Expected Balance: ${parseFloat(loan.principal_amount).toLocaleString()}`)
    console.log(`   Discrepancy: ${(parseFloat(loan.remaining_balance) - accountBalance).toLocaleString()}\n`)

    // Check if there are any orphaned LOAN_COLLECT transactions
    const orphanedCollectQuery = `
      SELECT
        mt.main_transaction_id,
        mt.raw_transaction_id,
        mt.amount,
        mt.loan_disbursement_id
      FROM main_transaction mt
      JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
      WHERE mt.account_id = $1
      AND tt.type_code IN ('LOAN_COLLECT', 'LOAN_RECEIVE')
      AND mt.loan_disbursement_id = 30
    `
    const orphanedResult = await client.query(orphanedCollectQuery, [loan.account_id])

    if (orphanedResult.rows.length > 0) {
      console.log(`⚠️  Found ${orphanedResult.rows.length} LOAN_COLLECT transactions that should not be on loan account:\n`)
      console.table(orphanedResult.rows)

      console.log('\n🗑️  Deleting orphaned LOAN_COLLECT transactions...\n')

      for (const tx of orphanedResult.rows) {
        // Delete main_transaction
        await client.query(
          'DELETE FROM main_transaction WHERE main_transaction_id = $1',
          [tx.main_transaction_id]
        )

        // Delete original_transaction
        await client.query(
          'DELETE FROM original_transaction WHERE raw_transaction_id = $1',
          [tx.raw_transaction_id]
        )

        console.log(`   ✅ Deleted transaction ${tx.main_transaction_id}`)
      }
    }

    // Recalculate account balance after deletion
    const newTxResult = await client.query(accountTxQuery, [loan.account_id])
    let newAccountBalance = 0
    for (const tx of newTxResult.rows) {
      if (tx.transaction_direction === 'debit') {
        newAccountBalance += parseFloat(tx.amount)
      } else {
        newAccountBalance -= parseFloat(tx.amount)
      }
    }

    console.log(`\n✅ Fixed! New account balance: ${newAccountBalance.toLocaleString()}`)
    console.log(`   Should match loan remaining: ${parseFloat(loan.remaining_balance).toLocaleString()}`)

    if (Math.abs(newAccountBalance + parseFloat(loan.remaining_balance)) < 0.01) {
      console.log(`\n🎉 Balance is now correct!`)
    } else {
      console.log(`\n⚠️  Balance still mismatched by: ${(newAccountBalance + parseFloat(loan.remaining_balance)).toLocaleString()}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

fixLoanBalance()
