import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to database\n')

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '067_add_investment_contribution_to_view.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration 067: Add investment_contribution_id to view...\n')

    await client.query(migrationSQL)

    console.log('✅ Migration 067 completed successfully!\n')

    // Verify the view includes investment_contribution_id
    const checkQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'main_transaction_details'
        AND column_name = 'investment_contribution_id';
    `

    const result = await client.query(checkQuery)

    if (result.rows.length > 0) {
      console.log('✅ Verified: investment_contribution_id is now in the view')
      console.table(result.rows)
    } else {
      console.log('❌ Warning: investment_contribution_id not found in view')
    }

  } catch (error) {
    console.error('❌ Error running migration:', error)
  } finally {
    await client.end()
  }
}

runMigration()
