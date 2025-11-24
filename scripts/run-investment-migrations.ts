/**
 * Script to run investment system migrations (070, 071, 072)
 * Run with: npx tsx scripts/run-investment-migrations.ts
 */

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local')
  process.exit(1)
}

// Create PostgreSQL client
const client = new Client({
  connectionString: databaseUrl,
})

const migrations = [
  {
    number: '070',
    name: 'Auto-delete investment contribution on unmatch',
    file: '070_auto_delete_investment_on_unmatch.sql',
  },
  {
    number: '071',
    name: 'Add investment balance tracking',
    file: '071_add_investment_balance_tracking.sql',
  },
  {
    number: '072',
    name: 'Auto-update investment balance',
    file: '072_auto_update_investment_balance.sql',
  },
]

async function runMigration(migration: typeof migrations[0]) {
  console.log(`\n📝 Running Migration ${migration.number}: ${migration.name}`)
  console.log('━'.repeat(60))

  try {
    // Read migration file
    const filePath = join(process.cwd(), 'database', 'migrations', migration.file)
    const sql = readFileSync(filePath, 'utf-8')

    console.log(`📂 File: ${migration.file}`)
    console.log(`📏 Size: ${(sql.length / 1024).toFixed(2)} KB`)
    console.log('⚙️  Executing SQL...')

    // Execute the SQL
    await client.query(sql)

    console.log(`✅ Migration ${migration.number} completed successfully!`)
    return { success: true, migration: migration.number }
  } catch (error) {
    console.error(`❌ Error in migration ${migration.number}:`)
    console.error(error)
    return { success: false, migration: migration.number, error }
  }
}

async function main() {
  console.log('🚀 Investment System Migrations')
  console.log('='.repeat(60))
  console.log('Database:', databaseUrl?.split('@')[1]?.split('/')[0] || 'Connected')
  console.log('Migrations to run:', migrations.length)
  console.log('')

  try {
    // Connect to database
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected successfully!\n')

    const results = []

    // Run each migration in order
    for (const migration of migrations) {
      const result = await runMigration(migration)
      results.push(result)

      // Stop if migration failed
      if (!result.success) {
        console.error(`\n❌ Migration ${migration.number} failed. Stopping here.`)
        break
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Migration Summary')
    console.log('='.repeat(60))

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} Migration ${result.migration}`)
    })

    console.log('')
    console.log(`Total: ${results.length} | Success: ${successful} | Failed: ${failed}`)

    if (failed === 0) {
      console.log('\n🎉 All migrations completed successfully!')
      console.log('✨ Investment system is now fully consistent with Loan/Debt systems!')
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    throw error
  } finally {
    // Always close connection
    await client.end()
    console.log('\n🔌 Database connection closed')
  }
}

main()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
