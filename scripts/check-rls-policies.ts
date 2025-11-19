import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function checkRLS() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to database\n')

    // Check RLS status on main_transaction table
    const rlsQuery = `
      SELECT
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE tablename = 'main_transaction';
    `

    const rlsResult = await client.query(rlsQuery)
    console.log('RLS status on main_transaction:')
    console.table(rlsResult.rows)

    // Check RLS policies on main_transaction
    const policiesQuery = `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'main_transaction'
      ORDER BY policyname;
    `

    const policiesResult = await client.query(policiesQuery)
    console.log('\nRLS policies on main_transaction:')
    console.table(policiesResult.rows)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

checkRLS()
