/**
 * Cleanup Script: Remove Orphaned Balance Adjustment Transactions
 *
 * This script finds and deletes balance adjustment transactions that have a checkpoint_id
 * pointing to a checkpoint that no longer exists.
 *
 * Run with: npx ts-node scripts/cleanup-orphaned-adjustments.ts
 */

import { supabase } from '../lib/supabase'

async function cleanupOrphanedAdjustments() {
  console.log('🔍 Starting cleanup of orphaned balance adjustment transactions...\n')

  try {
    // Step 1: Get all balance adjustment transactions with checkpoint_id
    const { data: adjustmentTransactions, error: fetchError } = await supabase
      .from('original_transaction')
      .select('raw_transaction_id, checkpoint_id, description, credit_amount, debit_amount')
      .eq('is_balance_adjustment', true)
      .not('checkpoint_id', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch adjustment transactions: ${fetchError.message}`)
    }

    if (!adjustmentTransactions || adjustmentTransactions.length === 0) {
      console.log('✅ No balance adjustment transactions found.')
      return
    }

    console.log(`📊 Found ${adjustmentTransactions.length} balance adjustment transactions\n`)

    // Step 2: Check each one to see if its checkpoint exists
    const orphanedTransactions = []

    for (const tx of adjustmentTransactions) {
      const { data: checkpoint, error: checkError } = await supabase
        .from('balance_checkpoints')
        .select('checkpoint_id')
        .eq('checkpoint_id', tx.checkpoint_id!)
        .maybeSingle()

      if (checkError) {
        console.error(`Error checking checkpoint ${tx.checkpoint_id}:`, checkError)
        continue
      }

      if (!checkpoint) {
        // Checkpoint doesn't exist - this is an orphaned transaction
        orphanedTransactions.push(tx)
        console.log(`❌ Orphaned: ${tx.raw_transaction_id} (checkpoint ${tx.checkpoint_id} not found)`)
        console.log(`   Description: ${tx.description}`)
        console.log(`   Amount: ${tx.credit_amount || tx.debit_amount}`)
        console.log()
      }
    }

    if (orphanedTransactions.length === 0) {
      console.log('✅ No orphaned adjustment transactions found. All checkpoints exist!')
      return
    }

    console.log(`\n⚠️  Found ${orphanedTransactions.length} orphaned adjustment transactions\n`)
    console.log('🗑️  Deleting orphaned transactions...\n')

    // Step 3: Delete the orphaned transactions
    let successCount = 0
    let errorCount = 0

    for (const tx of orphanedTransactions) {
      const { error: deleteError } = await supabase
        .from('original_transaction')
        .delete()
        .eq('raw_transaction_id', tx.raw_transaction_id)

      if (deleteError) {
        console.error(`❌ Failed to delete ${tx.raw_transaction_id}:`, deleteError.message)
        errorCount++
      } else {
        console.log(`✅ Deleted ${tx.raw_transaction_id}`)
        successCount++
      }
    }

    console.log(`\n📊 Cleanup Results:`)
    console.log(`   ✅ Successfully deleted: ${successCount}`)
    console.log(`   ❌ Failed to delete: ${errorCount}`)
    console.log(`\n🎉 Cleanup complete!`)

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Run the cleanup
cleanupOrphanedAdjustments()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
