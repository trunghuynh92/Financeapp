/**
 * Check existing payment_type values
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function checkPaymentTypes() {
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
    console.log('🔍 Checking payment_type values...\n')

    const result = await client.query(`
      SELECT DISTINCT payment_type, COUNT(*) as count
      FROM scheduled_payments
      GROUP BY payment_type
      ORDER BY payment_type
    `)

    console.table(result.rows)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

checkPaymentTypes()
