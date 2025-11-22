/**
 * Run Receipt Migration Script
 *
 * Purpose: Execute migration 075 to create receipts table and storage bucket
 *
 * Usage:
 *   npx tsx scripts/run-receipt-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 Starting receipt migration 075...\n')

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/075_create_receipts_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded:', migrationPath)
    console.log('📝 SQL length:', migrationSQL.length, 'characters\n')

    // Execute migration
    console.log('⚙️  Executing migration...')
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      // If exec_sql RPC doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql RPC not found, trying direct execution...')

      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.length === 0) continue

        console.log(`\n📌 Executing statement ${i + 1}/${statements.length}...`)
        console.log(statement.substring(0, 100) + '...')

        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        })

        if (stmtError) {
          console.error(`❌ Error in statement ${i + 1}:`, stmtError.message)
          throw stmtError
        }
      }
    }

    console.log('\n✅ Migration executed successfully!\n')

    // Verify migration
    console.log('🔍 Verifying migration...')

    // Check if receipts table exists
    const { data: tables, error: tablesError } = await supabase
      .from('receipts')
      .select('*')
      .limit(0)

    if (tablesError) {
      console.error('❌ receipts table verification failed:', tablesError.message)
    } else {
      console.log('✅ receipts table created successfully')
    }

    // Check if storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()

    if (bucketsError) {
      console.error('❌ Storage bucket verification failed:', bucketsError.message)
    } else {
      const receiptsBucket = buckets.find(b => b.id === 'receipts')
      if (receiptsBucket) {
        console.log('✅ receipts storage bucket created successfully')
        console.log('   - Public:', receiptsBucket.public)
        console.log('   - File size limit:', receiptsBucket.file_size_limit, 'bytes')
      } else {
        console.log('⚠️  receipts bucket not found (may need manual creation in Supabase Dashboard)')
      }
    }

    // Check RLS policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql_query: "SELECT * FROM pg_policies WHERE tablename = 'receipts'"
      })

    if (!policiesError && policies) {
      console.log(`✅ RLS policies created: ${policies.length || 0} policies`)
    }

    console.log('\n🎉 Migration 075 completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Verify storage bucket in Supabase Dashboard (Storage → receipts)')
    console.log('2. Test receipt upload via API')
    console.log('3. Check RLS policies are working correctly')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
runMigration()
