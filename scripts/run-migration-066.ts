/**
 * Run migration 066: Add investment_contribution_id to main_transaction
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
    console.log('🚀 Running migration 066...\n')

    // Read migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', '066_add_investment_contribution_link.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Run migration
    await client.query(migrationSQL)

    console.log('✅ Migration 066 completed successfully!\n')

    // Verify installation
    console.log('🔍 Verifying migration...\n')

    // Check if investment_contribution_id column exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'main_transaction'
        AND column_name = 'investment_contribution_id'
      ) as exists
    `)
    console.log(`${columnCheck.rows[0].exists ? '✅' : '❌'} investment_contribution_id column: ${columnCheck.rows[0].exists ? 'ADDED' : 'MISSING'}`)

    // Check if index exists
    const indexCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'main_transaction'
        AND indexname = 'idx_main_transaction_investment_contribution'
      ) as exists
    `)
    console.log(`${indexCheck.rows[0].exists ? '✅' : '❌'} Index idx_main_transaction_investment_contribution: ${indexCheck.rows[0].exists ? 'CREATED' : 'MISSING'}`)

    console.log('\n✨ Investment matching system is ready!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
