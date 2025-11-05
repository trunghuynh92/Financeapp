/**
 * API Route: /api/admin/cleanup-orphaned-adjustments
 * Removes balance adjustment transactions that reference non-existent checkpoints
 *
 * USE WITH CAUTION: This is an admin utility endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting cleanup of orphaned balance adjustment transactions...')

    // Step 1: Get all balance adjustment transactions with checkpoint_id
    const { data: adjustmentTransactions, error: fetchError } = await supabase
      .from('original_transaction')
      .select('raw_transaction_id, checkpoint_id, description, credit_amount, debit_amount, account_id')
      .eq('is_balance_adjustment', true)
      .not('checkpoint_id', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch adjustment transactions: ${fetchError.message}`)
    }

    if (!adjustmentTransactions || adjustmentTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No balance adjustment transactions found',
        orphanedCount: 0,
        deletedCount: 0,
      })
    }

    console.log(`📊 Found ${adjustmentTransactions.length} balance adjustment transactions`)

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
      }
    }

    if (orphanedTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned adjustment transactions found. All checkpoints exist!',
        orphanedCount: 0,
        deletedCount: 0,
      })
    }

    console.log(`⚠️  Found ${orphanedTransactions.length} orphaned adjustment transactions`)
    console.log('🗑️  Deleting orphaned transactions...')

    // Step 3: Delete the orphaned transactions
    const deletedTransactions = []
    const failedTransactions = []

    for (const tx of orphanedTransactions) {
      const { error: deleteError } = await supabase
        .from('original_transaction')
        .delete()
        .eq('raw_transaction_id', tx.raw_transaction_id)

      if (deleteError) {
        console.error(`❌ Failed to delete ${tx.raw_transaction_id}:`, deleteError.message)
        failedTransactions.push({
          transaction_id: tx.raw_transaction_id,
          error: deleteError.message,
        })
      } else {
        console.log(`✅ Deleted ${tx.raw_transaction_id}`)
        deletedTransactions.push(tx.raw_transaction_id)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Cleanup complete. Deleted ${deletedTransactions.length} orphaned adjustment transactions.`,
        orphanedCount: orphanedTransactions.length,
        deletedCount: deletedTransactions.length,
        failedCount: failedTransactions.length,
        deletedTransactions,
        failedTransactions,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error during cleanup:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup orphaned adjustments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
