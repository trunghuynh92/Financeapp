import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function exportSchema() {
  console.log('Exporting real schema from Supabase...\n')

  // Get all tables in public schema
  const { data: tables, error: tablesError } = await supabase.rpc('get_all_tables')

  if (tablesError) {
    // Fallback: query information_schema directly
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (error) {
      console.error('Error fetching tables:', error)

      // Alternative: use raw SQL
      const { data: rawTables, error: rawError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `
      })

      if (rawError) {
        console.error('Failed to fetch tables:', rawError)
        process.exit(1)
      }
    }
  }

  // Get table details for each table
  const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `
  })

  if (columnsError) {
    console.error('Error fetching columns:', columnsError)
  }

  // Get constraints
  const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `
  })

  if (constraintsError) {
    console.error('Error fetching constraints:', constraintsError)
  }

  // Get indexes
  const { data: indexes, error: indexesError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `
  })

  if (indexesError) {
    console.error('Error fetching indexes:', indexesError)
  }

  // Get views
  const { data: views, error: viewsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        table_name as view_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
  })

  if (viewsError) {
    console.error('Error fetching views:', viewsError)
  }

  // Get functions
  const { data: functions, error: functionsError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        routine_name,
        routine_type,
        data_type as return_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name
    `
  })

  if (functionsError) {
    console.error('Error fetching functions:', functionsError)
  }

  // Write to file
  const output = {
    exported_at: new Date().toISOString(),
    tables: tables || [],
    columns: columns || [],
    constraints: constraints || [],
    indexes: indexes || [],
    views: views || [],
    functions: functions || []
  }

  const outputPath = path.join(process.cwd(), 'database', 'schema', 'real-schema-export.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  console.log(`✓ Schema exported to ${outputPath}`)
  console.log(`✓ Found ${(columns || []).length} columns across tables`)
  console.log(`✓ Found ${(constraints || []).length} constraints`)
  console.log(`✓ Found ${(indexes || []).length} indexes`)
  console.log(`✓ Found ${(views || []).length} views`)
  console.log(`✓ Found ${(functions || []).length} functions`)
}

exportSchema().catch(console.error)
