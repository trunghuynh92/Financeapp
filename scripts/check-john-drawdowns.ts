/**
 * Check John's credit line drawdowns
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function checkDrawdowns() {
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
    console.log('🔍 Checking John\'s credit line drawdowns...\n')

    // Find John's credit line account
    const accountQuery = `
      SELECT account_id, account_name, account_type, entity_id
      FROM accounts
      WHERE account_name LIKE '%John%' AND account_type = 'credit_line'
    `
    const accountResult = await client.query(accountQuery)

    console.log('📊 John\'s Credit Line Account:\n')
    console.table(accountResult.rows)

    if (accountResult.rows.length === 0) {
      console.log('No credit line account found for John')
      return
    }

    const accountId = accountResult.rows[0].account_id

    // Find drawdowns for this account
    const drawdownQuery = `
      SELECT
        drawdown_id,
        drawdown_reference,
        original_amount,
        remaining_balance,
        status,
        drawdown_date,
        due_date,
        is_overpaid
      FROM debt_drawdown
      WHERE account_id = $1
      ORDER BY drawdown_date DESC
    `
    const drawdownResult = await client.query(drawdownQuery, [accountId])

    console.log('\n💳 All Drawdowns for this account:\n')
    console.table(drawdownResult.rows.map(row => ({
      ID: row.drawdown_id,
      Reference: row.drawdown_reference,
      'Original Amount': parseFloat(row.original_amount).toLocaleString(),
      'Remaining Balance': parseFloat(row.remaining_balance).toLocaleString(),
      Status: row.status,
      'Drawdown Date': row.drawdown_date?.toISOString().split('T')[0],
      'Due Date': row.due_date?.toISOString().split('T')[0],
      'Overpaid': row.is_overpaid
    })))

    // Check which ones would be filtered as "active with balance > 0"
    const activeWithBalance = drawdownResult.rows.filter(
      row => row.status === 'active' && parseFloat(row.remaining_balance) > 0
    )

    console.log(`\n✅ Active drawdowns with remaining balance: ${activeWithBalance.length}`)
    if (activeWithBalance.length > 0) {
      console.table(activeWithBalance.map(row => ({
        ID: row.drawdown_id,
        Reference: row.drawdown_reference,
        'Remaining Balance': parseFloat(row.remaining_balance).toLocaleString()
      })))
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

checkDrawdowns()
