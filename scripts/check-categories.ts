/**
 * Check categories and their transaction types
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Client } = pg

async function checkCategories() {
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
    console.log('🔍 Checking categories with transaction types...\n')

    // Check categories with their transaction types
    const query = `
      SELECT
        c.category_id,
        c.category_name,
        c.transaction_type_id,
        tt.type_name,
        tt.type_code,
        c.entity_type,
        c.is_active
      FROM categories c
      JOIN transaction_types tt ON c.transaction_type_id = tt.transaction_type_id
      WHERE c.is_active = true
      ORDER BY tt.type_name, c.display_order
      LIMIT 30
    `
    const result = await client.query(query)

    console.log('📊 Categories with Transaction Types:\n')
    console.table(result.rows.map(row => ({
      ID: row.category_id,
      'Category Name': row.category_name,
      'Type ID': row.transaction_type_id,
      'Type Name': row.type_name,
      'Type Code': row.type_code,
      'Entity Type': row.entity_type
    })))

    // Count by type
    const countQuery = `
      SELECT
        tt.type_name,
        tt.type_code,
        COUNT(c.category_id) as category_count
      FROM transaction_types tt
      LEFT JOIN categories c ON tt.transaction_type_id = c.transaction_type_id AND c.is_active = true
      GROUP BY tt.type_name, tt.type_code
      ORDER BY tt.type_name
    `
    const countResult = await client.query(countQuery)

    console.log('\n📈 Category Count by Transaction Type:\n')
    console.table(countResult.rows)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

checkCategories()
