import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function backfill() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('=== Backfilling Investment Account Transactions ===\n')

    // Call the backfill function
    const result = await client.query('SELECT * FROM backfill_main_transactions();')

    console.log('Backfill Results:')
    console.table(result.rows)

    if (result.rows[0]) {
      console.log('\nProcessed:', result.rows[0].processed_count)
      console.log('Errors:', result.rows[0].error_count)

      if (result.rows[0].errors && result.rows[0].errors.length > 0) {
        console.log('\nError messages:')
        result.rows[0].errors.forEach((err: string) => console.log('  -', err))
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

backfill()
