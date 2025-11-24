/**
 * Run migration 076: Add receipt suggestions
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔄 Running migration 076: Add receipt suggestions...\n')

  try {
    // Read migration file
    const migrationPath = path.join(
      __dirname,
      '../database/migrations/076_add_receipt_suggestions.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try direct execution if rpc doesn't work
      console.log('Trying direct SQL execution...')

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'))

      for (const statement of statements) {
        if (statement) {
          const { error: execError } = await supabase.rpc('exec', {
            sql: statement
          })
          if (execError) {
            console.log('Statement:', statement)
            throw execError
          }
        }
      }
    }

    console.log('✅ Migration 076 completed successfully!\n')
    console.log('Added columns:')
    console.log('  - suggested_description')
    console.log('  - suggested_category_code')
    console.log('  - suggested_category_name')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n💡 You may need to run this SQL manually in Supabase Dashboard:')
    console.log('   SQL Editor > New Query > Paste migration file content\n')
    process.exit(1)
  }
}

runMigration()
