import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('🚀 Running migration 061: Remove payment_type constraint...\n')

    // Drop the constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql_string: `
        ALTER TABLE scheduled_payments
        DROP CONSTRAINT IF EXISTS scheduled_payments_payment_type_check;

        COMMENT ON COLUMN scheduled_payments.payment_type IS
        'Flexible label for payment identification. Can be predefined types (rent, utilities) or custom labels (Year 1, Year 2, Q1 2025)';
      `
    })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.log('\n💡 Try running this SQL manually in Supabase SQL Editor:')
      console.log('   ALTER TABLE scheduled_payments DROP CONSTRAINT IF EXISTS scheduled_payments_payment_type_check;')
      process.exit(1)
    }

    console.log('✅ Migration completed successfully!')
    console.log('   - Removed CHECK constraint on payment_type')
    console.log('   - payment_type now accepts any text value\n')

  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

runMigration()
