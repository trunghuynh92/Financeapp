import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function checkTriggers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to database\n')

    // Check for triggers on original_transaction table
    const triggerQuery = `
      SELECT
        trigger_name,
        event_manipulation,
        event_object_table,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'original_transaction'
      ORDER BY trigger_name;
    `

    const triggerResult = await client.query(triggerQuery)
    console.log('Triggers on original_transaction table:')
    console.table(triggerResult.rows)

    // Check if main_transaction records exist
    const mainTxnQuery = `
      SELECT COUNT(*) as count
      FROM main_transaction;
    `
    const mainTxnResult = await client.query(mainTxnQuery)
    console.log(`\nTotal main_transaction records: ${mainTxnResult.rows[0].count}`)

    // Check if original_transaction records exist
    const origTxnQuery = `
      SELECT COUNT(*) as count
      FROM original_transaction;
    `
    const origTxnResult = await client.query(origTxnQuery)
    console.log(`Total original_transaction records: ${origTxnResult.rows[0].count}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

checkTriggers()
