/**
 * Test category filtering with transaction types
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testCategoryFiltering() {
  console.log('🧪 Testing category filtering with transaction types...\n')

  // Test the API query that the component will use
  const { data: categories, error } = await supabase
    .from('categories')
    .select(`
      *,
      transaction_types!categories_transaction_type_id_fkey (
        type_name,
        type_code
      )
    `)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Fetched ${categories?.length || 0} categories\n`)

  // Test income filtering (like the dialog does)
  const incomeCategories = categories?.filter((c: any) =>
    c.transaction_types?.type_name === 'income'
  ) || []

  console.log(`📥 Income Categories (${incomeCategories.length}):`)
  incomeCategories.slice(0, 5).forEach((c: any) => {
    console.log(`   - ${c.category_name} (${c.transaction_types?.type_code})`)
  })

  // Test expense filtering
  const expenseCategories = categories?.filter((c: any) =>
    c.transaction_types?.type_name === 'expense'
  ) || []

  console.log(`\n📤 Expense Categories (${expenseCategories.length}):`)
  expenseCategories.slice(0, 5).forEach((c: any) => {
    console.log(`   - ${c.category_name} (${c.transaction_types?.type_code})`)
  })

  console.log('\n✅ Category filtering test complete!')
  console.log(`\nSummary:`)
  console.log(`  - Total categories: ${categories?.length || 0}`)
  console.log(`  - Income: ${incomeCategories.length}`)
  console.log(`  - Expense: ${expenseCategories.length}`)
}

testCategoryFiltering()
