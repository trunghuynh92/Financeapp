/**
 * Run migration 065: Add investment transaction types
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
    console.log('🚀 Running migration 065...\n')

    // Read migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', '065_add_investment_transaction_types.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Run migration
    await client.query(migrationSQL)

    console.log('✅ Migration 065 completed successfully!\n')

    // Verify installation
    console.log('🔍 Verifying migration...\n')

    // Check if investment transaction types exist
    const typesCheck = await client.query(`
      SELECT
        type_name,
        type_display_name,
        type_code,
        affects_cashflow,
        display_order
      FROM transaction_types
      WHERE type_name IN ('investment_contribution', 'investment_withdrawal')
      ORDER BY type_name;
    `)

    if (typesCheck.rows.length === 2) {
      console.log('✅ Investment transaction types created successfully:\n')
      console.table(typesCheck.rows)
    } else {
      console.log('⚠️  Expected 2 investment types, found:', typesCheck.rows.length)
      console.table(typesCheck.rows)
    }

    console.log('\n✨ Investment transaction types installed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
