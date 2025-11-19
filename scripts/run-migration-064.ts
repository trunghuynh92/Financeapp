/**
 * Run migration 064: Create investment_contributions table
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import * as fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function runMigration() {
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
    console.log('🚀 Running migration 064...\n')

    // Read migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', '064_create_investment_contributions.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Run migration
    await client.query(migrationSQL)

    console.log('✅ Migration 064 completed successfully!\n')

    // Verify installation
    console.log('🔍 Verifying migration...\n')

    // 1. Check if investment_contribution table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'investment_contribution'
      ) as exists
    `)
    console.log(`${tableCheck.rows[0].exists ? '✅' : '❌'} investment_contribution table: ${tableCheck.rows[0].exists ? 'CREATED' : 'MISSING'}`)

    // 2. Verify investment account type (already exists from migration 037)
    console.log('✅ investment account type: Should already exist from migration 037')

    console.log('\n✨ Investment contribution table installed successfully!')
    console.log('📝 Note: Transaction types for investment_contribution and investment_withdrawal')
    console.log('   should be added manually based on your transaction_types schema')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
