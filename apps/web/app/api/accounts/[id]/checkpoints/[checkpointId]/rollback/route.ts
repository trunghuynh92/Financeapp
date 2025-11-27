/**
 * API Route: /api/accounts/[id]/checkpoints/[checkpointId]/rollback
 * Rolls back an imported checkpoint and all associated transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { deleteCheckpoint, getCheckpointById } from '@/lib/checkpoint-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; checkpointId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id, 10)
    const checkpointId = parseInt(params.checkpointId, 10)

    if (isNaN(accountId) || isNaN(checkpointId)) {
      return NextResponse.json(
        { error: 'Invalid account ID or checkpoint ID' },
        { status: 400 }
      )
    }

    // Get the checkpoint
    const checkpoint = await getCheckpointById(checkpointId)

    if (!checkpoint) {
      return NextResponse.json(
        { error: 'Checkpoint not found' },
        { status: 404 }
      )
    }

    // Verify checkpoint belongs to this account
    if (checkpoint.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Checkpoint does not belong to this account' },
        { status: 403 }
      )
    }

    // Verify checkpoint is from an import
    if (checkpoint.import_batch_id === null) {
      return NextResponse.json(
        { error: 'Can only rollback checkpoints created from imports' },
        { status: 400 }
      )
    }

    const importBatchId = checkpoint.import_batch_id

    console.log(`🔄 Starting rollback for checkpoint ${checkpointId}, import batch ${importBatchId}...`)

    // Step 1: Count and delete all transactions from this import batch
    // Use count to avoid 1000 row limit
    const { count: transactionCount, error: countError } = await supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', importBatchId)
      .eq('is_balance_adjustment', false)

    if (countError) {
      throw new Error(`Failed to count import transactions: ${countError.message}`)
    }

    console.log(`📋 Found ${transactionCount || 0} transactions to delete`)

    if (transactionCount && transactionCount > 0) {
      // Delete in batches to avoid timeout for large imports
      const BATCH_SIZE = 500
      let deletedCount = 0

      while (deletedCount < transactionCount) {
        // Get a batch of transaction IDs to delete
        const { data: batch, error: fetchError } = await supabase
          .from('original_transaction')
          .select('raw_transaction_id')
          .eq('import_batch_id', importBatchId)
          .eq('is_balance_adjustment', false)
          .limit(BATCH_SIZE)

        if (fetchError) {
          throw new Error(`Failed to fetch transactions for deletion: ${fetchError.message}`)
        }

        if (!batch || batch.length === 0) {
          break
        }

        // Delete this batch
        const ids = batch.map(t => t.raw_transaction_id)
        const { error: deleteError } = await supabase
          .from('original_transaction')
          .delete()
          .in('raw_transaction_id', ids)

        if (deleteError) {
          throw new Error(`Failed to delete transaction batch: ${deleteError.message}`)
        }

        deletedCount += batch.length
        console.log(`📦 Deleted batch: ${deletedCount}/${transactionCount} transactions`)
      }

      console.log(`✅ Deleted ${deletedCount} imported transactions`)
    }

    // Step 2: Delete the checkpoint (this will also delete the adjustment transaction and recalculate)
    await deleteCheckpoint(checkpointId)
    console.log(`✅ Deleted checkpoint ${checkpointId}`)

    // Step 3: Mark the import batch as rolled back
    const { error: batchUpdateError } = await supabase
      .from('import_batch')
      .update({
        import_status: 'rolled_back',
        error_log: JSON.stringify({
          rolled_back_at: new Date().toISOString(),
          transactions_deleted: transactionCount,
        }),
      })
      .eq('import_batch_id', importBatchId)

    if (batchUpdateError) {
      console.error('Failed to update import batch status:', batchUpdateError)
      // Don't throw - the rollback was successful, this is just cleanup
    }

    console.log(`🎉 Rollback complete for import batch ${importBatchId}`)

    return NextResponse.json(
      {
        success: true,
        message: `Successfully rolled back import. Deleted ${transactionCount} transaction${
          transactionCount === 1 ? '' : 's'
        } and the checkpoint.`,
        data: {
          import_batch_id: importBatchId,
          checkpoint_id: checkpointId,
          transactions_deleted: transactionCount,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error rolling back checkpoint:', error)

    return NextResponse.json(
      {
        error: 'Failed to rollback checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
