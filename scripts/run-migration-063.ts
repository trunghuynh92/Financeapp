/**
 * Run migration 063
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
    console.log('🚀 Running migration 063...\n')

    // Read migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', '063_fix_schema_issues.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Run migration
    await client.query(migrationSQL)

    console.log('✅ Migration 063 completed successfully!\n')

    // Verify fixes
    console.log('🔍 Verifying fixes...\n')

    // 1. Check contract_id in view
    const viewCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'scheduled_payment_overview'
      AND column_name = 'contract_id'
    `)
    console.log(`${viewCheck.rows.length > 0 ? '✅' : '❌'} scheduled_payment_overview.contract_id: ${viewCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`)

    // 2. Check payment_type constraint (should NOT exist)
    const constraintCheck = await client.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'scheduled_payments_payment_type_check'
    `)
    console.log(`${constraintCheck.rows.length === 0 ? '✅' : '❌'} scheduled_payments_payment_type_check constraint: ${constraintCheck.rows.length === 0 ? 'REMOVED (correct)' : 'STILL EXISTS (incorrect)'}`)

    console.log('\n✨ Schema fixes applied successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
