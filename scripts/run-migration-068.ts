import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'
const { Pool } = pg

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔄 Running Migration 068: Auto-delete loan disbursement on unmatch...\n')

    // Read the migration file
    const migrationPath = join(process.cwd(), 'database/migrations/068_auto_delete_loan_disbursement_on_unmatch.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Execute the migration
    await pool.query(migrationSQL)

    console.log('✅ Migration 068 completed successfully!')
    console.log('\nWhat this does:')
    console.log('- When a LOAN_DISBURSE transaction is unmatched')
    console.log('- Automatically deletes the paired transaction on loan_receivable account')
    console.log('- Automatically deletes the loan_disbursement record')
    console.log('- Maintains data integrity for bookkeeping')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
