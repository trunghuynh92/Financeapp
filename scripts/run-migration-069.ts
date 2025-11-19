import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'
const { Pool } = pg

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔄 Running Migration 069: Auto-delete debt drawdown on unmatch...\n')

    // Read the migration file
    const migrationPath = join(process.cwd(), 'database/migrations/069_auto_delete_debt_drawdown_on_unmatch.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Execute the migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 069 completed successfully!')
    console.log('\nWhat this does:')
    console.log('- When a DEBT_TAKE transaction is unmatched')
    console.log('- Automatically deletes the paired transaction on debt_payable account')
    console.log('- Automatically deletes the debt_drawdown record')
    console.log('- Maintains data integrity for bookkeeping')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
