const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration(filePath) {
  try {
    console.log(`Running migration: ${filePath}`)

    const sql = fs.readFileSync(filePath, 'utf8')

    // Execute SQL using Supabase raw query
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>')
  process.exit(1)
}

runMigration(migrationFile)
