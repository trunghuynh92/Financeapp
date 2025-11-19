/**
 * Script to investigate loan receivable account balance issue
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function investigateLoanAccount() {
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
    console.log('🔍 Investigating loan account with balance mismatch...\n')

    // Find loan receivable accounts
    const accountQuery = `
      SELECT
        a.account_id,
        a.account_name,
        a.account_type,
        a.entity_id
      FROM accounts a
      WHERE a.account_type = 'loan_receivable'
      ORDER BY a.account_id DESC
      LIMIT 10
    `
    const accountResult = await client.query(accountQuery)

    console.log('📊 Loan receivable accounts:\n')
    console.table(accountResult.rows)

    if (accountResult.rows.length === 0) {
      console.log('No matching accounts found')
      return
    }

    // Check each account for balance issues
    for (const account of accountResult.rows) {
      const accountId = account.account_id
      const accountName = account.account_name

      console.log(`\n🎯 Investigating: ${accountName} (ID: ${accountId})`)

      // Get loan disbursements for this account
      const loansQuery = `
        SELECT
          ld.loan_disbursement_id,
          COALESCE(bp.partner_name, ld.borrower_name) AS borrower_name,
          ld.principal_amount,
          ld.remaining_balance,
          ld.status,
          ld.disbursement_date
        FROM loan_disbursement ld
        LEFT JOIN business_partners bp ON ld.partner_id = bp.partner_id
        WHERE ld.account_id = $1
      `
      const loansResult = await client.query(loansQuery, [accountId])

      if (loansResult.rows.length === 0) {
        console.log('   No loans found, skipping...\n')
        continue
      }

      console.log('  💰 Loan Disbursements:\n')
      console.table(loansResult.rows.map(row => ({
        ID: row.loan_disbursement_id,
        Borrower: row.borrower_name,
        Principal: parseFloat(row.principal_amount).toLocaleString(),
        Remaining: parseFloat(row.remaining_balance).toLocaleString(),
        Status: row.status
      })))

      const totalOutstanding = loansResult.rows.reduce((sum, row) =>
        sum + parseFloat(row.remaining_balance), 0
      )

      // Get all transactions for this account
      const transactionsQuery = `
        SELECT
          mt.main_transaction_id,
          mt.transaction_date,
          mt.transaction_direction,
          mt.amount,
          tt.type_code,
          tt.type_display_name,
          mt.description,
          mt.loan_disbursement_id
        FROM main_transaction mt
        JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
        WHERE mt.account_id = $1
        ORDER BY mt.transaction_date, mt.main_transaction_id
      `
      const transactionsResult = await client.query(transactionsQuery, [accountId])

      console.log('  📋 All Transactions:\n')
      console.table(transactionsResult.rows.map(row => ({
        ID: row.main_transaction_id,
        Date: row.transaction_date.toISOString().split('T')[0],
        Type: row.type_code,
        Direction: row.transaction_direction,
        Amount: parseFloat(row.amount).toLocaleString(),
        'Loan ID': row.loan_disbursement_id || '-',
        Description: row.description?.substring(0, 40)
      })))

      // Calculate balance from transactions
      let calculatedBalance = 0
      for (const tx of transactionsResult.rows) {
        if (tx.transaction_direction === 'debit') {
          calculatedBalance += parseFloat(tx.amount)
        } else {
          calculatedBalance -= parseFloat(tx.amount)
        }
      }

      console.log(`\n  💡 Balance Analysis:`)
      console.log(`     Total Outstanding (from loans): ${totalOutstanding.toLocaleString()}`)
      console.log(`     Calculated from transactions: ${calculatedBalance.toLocaleString()}`)
      console.log(`     Discrepancy: ${(totalOutstanding - calculatedBalance).toLocaleString()}`)

      // Check for orphaned LOAN_SETTLE transactions
      const orphanedQuery = `
        SELECT
          mt.main_transaction_id,
          mt.transaction_date,
          mt.amount,
          mt.loan_disbursement_id,
          ld.loan_disbursement_id as loan_exists
        FROM main_transaction mt
        JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
        LEFT JOIN loan_disbursement ld ON mt.loan_disbursement_id = ld.loan_disbursement_id
        WHERE mt.account_id = $1
        AND tt.type_code IN ('LOAN_SETTLE', 'LOAN_RECEIVE')
        AND (
          mt.loan_disbursement_id IS NULL
          OR ld.loan_disbursement_id IS NULL
        )
      `
      const orphanedResult = await client.query(orphanedQuery, [accountId])

      if (orphanedResult.rows.length > 0) {
        console.log(`\n  ⚠️  Found ${orphanedResult.rows.length} orphaned loan transactions:\n`)
        console.table(orphanedResult.rows)
      } else {
        console.log(`\n  ✅ No orphaned loan transactions found`)
      }

      if (Math.abs(totalOutstanding - calculatedBalance) > 0.01) {
        console.log(`\n  🔴 BALANCE MISMATCH DETECTED!`)
      }

      console.log('\n' + '='.repeat(80) + '\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

investigateLoanAccount()
