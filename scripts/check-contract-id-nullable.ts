/**
 * Check if contract_id is nullable in scheduled_payments
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function checkContractIdNullable() {
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
    console.log('🔍 Checking contract_id column in scheduled_payments...\n')

    // Check if contract_id is nullable
    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'scheduled_payments'
      AND column_name = 'contract_id'
    `)

    if (result.rows.length > 0) {
      console.log('📊 Column Details:')
      console.table(result.rows)

      const isNullable = result.rows[0].is_nullable === 'YES'
      console.log(`\n${isNullable ? '✅' : '❌'} contract_id is ${isNullable ? 'OPTIONAL (nullable)' : 'REQUIRED (not null)'}`)

      if (isNullable) {
        console.log('\n💡 This means scheduled payments can exist WITHOUT being linked to a contract!')
        console.log('   - With contract_id: Part of a formal contract')
        console.log('   - Without contract_id (NULL): Standalone recurring payment')
      }
    } else {
      console.log('❌ contract_id column not found in scheduled_payments')
    }

    // Check existing data
    const dataCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(contract_id) as with_contract,
        COUNT(*) - COUNT(contract_id) as without_contract
      FROM scheduled_payments
    `)

    console.log('\n📈 Current Data:')
    console.table(dataCheck.rows.map(r => ({
      'Total Schedules': r.total,
      'Linked to Contract': r.with_contract,
      'Standalone (No Contract)': r.without_contract
    })))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

checkContractIdNullable()
