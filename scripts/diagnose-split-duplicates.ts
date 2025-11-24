/**
 * Diagnostic Script: Check for Duplicate Split Records
 * Run with: npx tsx scripts/diagnose-split-duplicates.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnoseDuplicates() {
  console.log('🔍 Checking for duplicate split records...\n')

  // Find raw_transaction_ids with multiple splits
  const { data: splits, error } = await supabase
    .from('main_transaction')
    .select('raw_transaction_id, main_transaction_id, amount, is_split, split_sequence')
    .eq('is_split', true)
    .order('raw_transaction_id')
    .order('split_sequence')

  if (error) {
    console.error('Error fetching splits:', error)
    return
  }

  // Group by raw_transaction_id
  const grouped = splits.reduce((acc: any, split) => {
    if (!acc[split.raw_transaction_id]) {
      acc[split.raw_transaction_id] = []
    }
    acc[split.raw_transaction_id].push(split)
    return acc
  }, {})

  // Find duplicates (more than expected splits)
  const duplicates = Object.entries(grouped).filter(([_, splits]: [string, any]) => {
    // Check if there are duplicate split_sequences
    const sequences = splits.map((s: any) => s.split_sequence)
    const uniqueSequences = new Set(sequences)
    return sequences.length !== uniqueSequences.size
  })

  if (duplicates.length === 0) {
    console.log('✅ No duplicate splits found!')
    console.log('\n📊 Split Statistics:')
    console.log(`Total split groups: ${Object.keys(grouped).length}`)
    return
  }

  console.log(`⚠️  Found ${duplicates.length} transactions with duplicate splits:\n`)

  for (const [rawTxId, splits] of duplicates) {
    const splitArray = splits as any[]
    console.log(`Raw Transaction ID: ${rawTxId}`)
    console.log(`  Total split records: ${splitArray.length}`)
    console.log(`  Total amount: ${splitArray.reduce((sum, s) => sum + s.amount, 0)}`)
    console.log(`  Split details:`)
    splitArray.forEach(s => {
      console.log(`    - ID: ${s.main_transaction_id}, Sequence: ${s.split_sequence}, Amount: ${s.amount}`)
    })
    console.log()
  }

  console.log('\n🔧 To fix, you can run the cleanup script.')
}

async function main() {
  await diagnoseDuplicates()
}

main().catch(console.error)
