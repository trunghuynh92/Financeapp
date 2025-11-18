/**
 * Check schema issues reported in the app
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function checkSchemaIssues() {
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
    console.log('🔍 Checking schema issues...\n')

    // 1. Check accounts table columns
    console.log('1️⃣ Checking accounts table columns:')
    const accountsColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position
    `)
    console.table(accountsColumns.rows.map(r => ({
      Column: r.column_name,
      Type: r.data_type
    })))

    // Check if current_balance exists
    const hasCurrentBalance = accountsColumns.rows.some(r => r.column_name === 'current_balance')
    console.log(`   ${hasCurrentBalance ? '✅' : '❌'} current_balance column ${hasCurrentBalance ? 'EXISTS' : 'MISSING'}\n`)

    // 2. Check scheduled_payment_overview view
    console.log('2️⃣ Checking scheduled_payment_overview view:')
    const viewExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_views
        WHERE viewname = 'scheduled_payment_overview'
      ) as exists
    `)

    if (viewExists.rows[0].exists) {
      const viewColumns = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'scheduled_payment_overview'
        ORDER BY ordinal_position
      `)
      console.table(viewColumns.rows.map(r => ({
        Column: r.column_name,
        Type: r.data_type
      })))

      const hasContractId = viewColumns.rows.some(r => r.column_name === 'contract_id')
      console.log(`   ${hasContractId ? '✅' : '❌'} contract_id column ${hasContractId ? 'EXISTS' : 'MISSING'}\n`)
    } else {
      console.log('   ❌ scheduled_payment_overview view DOES NOT EXIST\n')
    }

    // 3. Check loan_disbursement_instances table
    console.log('3️⃣ Checking loan_disbursement_instances table:')
    const loanTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'loan_disbursement_instances'
      ) as exists
    `)
    console.log(`   ${loanTableExists.rows[0].exists ? '✅' : '❌'} loan_disbursement_instances table ${loanTableExists.rows[0].exists ? 'EXISTS' : 'MISSING'}\n`)

    // 4. Check get_income_expense_report function
    console.log('4️⃣ Checking get_income_expense_report function:')
    const functionExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE pg_proc.proname = 'get_income_expense_report'
        AND pg_namespace.nspname = 'public'
      ) as exists
    `)
    console.log(`   ${functionExists.rows[0].exists ? '✅' : '❌'} get_income_expense_report function ${functionExists.rows[0].exists ? 'EXISTS' : 'MISSING'}\n`)

    // 5. Check scheduled_payments table for payment_type constraint
    console.log('5️⃣ Checking scheduled_payments constraints:')
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'scheduled_payments'
      AND constraint_type = 'CHECK'
    `)
    console.table(constraints.rows)

    // Check the actual constraint definition
    const checkConstraint = await client.query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'scheduled_payments_payment_type_check'
    `)
    if (checkConstraint.rows.length > 0) {
      console.log('\n   Payment type constraint definition:')
      console.log(`   ${checkConstraint.rows[0].definition}\n`)
    } else {
      console.log('   ❌ scheduled_payments_payment_type_check constraint NOT FOUND\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

checkSchemaIssues()
