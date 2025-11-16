/**
 * Script to refresh Supabase PostgREST schema cache
 *
 * This script forces Supabase to reload its schema cache by sending
 * a NOTIFY signal to PostgREST
 */

import { createClient } from '@supabase/supabase-js'

async function refreshSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('🔄 Refreshing Supabase schema cache...')

  try {
    // Method 1: Execute NOTIFY command
    const { error: notifyError } = await supabase.rpc('pg_notify', {
      channel: 'pgrst',
      payload: 'reload schema'
    })

    if (notifyError) {
      console.log('⚠️  Direct NOTIFY failed (this is normal):', notifyError.message)
    } else {
      console.log('✅ Schema cache refresh signal sent')
    }

    // Method 2: Query the table to force cache update
    console.log('🔄 Verifying table access...')
    const { error: queryError } = await supabase
      .from('balance_checkpoints')
      .select('checkpoint_id')
      .limit(1)

    if (queryError) {
      console.error('❌ Error accessing balance_checkpoints table:', queryError.message)
      console.log('   This suggests the schema cache is still stale.')
      console.log('   You may need to restart your Supabase instance or wait a few moments.')
      process.exit(1)
    }

    console.log('✅ Table access verified - schema cache is up to date')
    console.log('✅ Schema refresh complete!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

refreshSchema()
