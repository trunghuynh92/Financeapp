/**
 * API Route: /api/import-batches/[batchId]
 * Handles rollback of imported transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==============================================================================
// GET /api/import-batches/[batchId]
// Get import batch details
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batchId = parseInt(params.batchId, 10)

    if (isNaN(batchId)) {
      return NextResponse.json(
        { error: 'Invalid batch ID' },
        { status: 400 }
      )
    }

    // Fetch import batch
    const { data: batch, error: batchError } = await supabase
      .from('import_batch')
      .select('*')
      .eq('import_batch_id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Import batch not found' },
        { status: 404 }
      )
    }

    // Count transactions
    const { count: transactionCount } = await supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', batchId)

    return NextResponse.json({
      success: true,
      data: {
        ...batch,
        current_transaction_count: transactionCount || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching import batch:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch import batch',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE /api/import-batches/[batchId]
// Rollback (undo) an import batch
//
// SAFETY CHECKS:
// 1. Prevents rollback if transactions are matched with transfers from OTHER imports
//    (would orphan the external matched transactions)
// 2. Splits within the same import are OK - they cascade delete together
// 3. Categorizations are OK - they belong to the transactions being deleted
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batchId = parseInt(params.batchId, 10)

    if (isNaN(batchId)) {
      return NextResponse.json(
        { error: 'Invalid batch ID' },
        { status: 400 }
      )
    }

    // Fetch import batch to verify it exists and get account_id
    const { data: batch, error: batchError } = await supabase
      .from('import_batch')
      .select('*')
      .eq('import_batch_id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Import batch not found' },
        { status: 404 }
      )
    }

    // Check if already rolled back
    if (batch.import_status === 'rolled_back') {
      return NextResponse.json(
        { error: 'This import has already been rolled back' },
        { status: 400 }
      )
    }

    // Count transactions before deletion
    const { count: transactionCount } = await supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', batchId)

    if (!transactionCount || transactionCount === 0) {
      return NextResponse.json(
        { error: 'No transactions found for this import batch' },
        { status: 404 }
      )
    }

    // Check for external transfer matches
    // Get all raw_transaction_ids from this import batch
    const { data: batchTransactions, error: batchTxError } = await supabase
      .from('original_transaction')
      .select('raw_transaction_id')
      .eq('import_batch_id', batchId)

    if (batchTxError) {
      throw new Error(`Failed to fetch batch transactions: ${batchTxError.message}`)
    }

    const rawTxIds = batchTransactions?.map(t => t.raw_transaction_id) || []

    if (rawTxIds.length > 0) {
      // Find main_transactions from this batch that have transfer matches
      const { data: matchedTransactions, error: matchedError } = await supabase
        .from('main_transaction')
        .select('main_transaction_id, transfer_matched_transaction_id, raw_transaction_id')
        .in('raw_transaction_id', rawTxIds)
        .not('transfer_matched_transaction_id', 'is', null)

      if (matchedError) {
        throw new Error(`Failed to check transfer matches: ${matchedError.message}`)
      }

      if (matchedTransactions && matchedTransactions.length > 0) {
        // Get the matched transaction IDs
        const matchedIds = matchedTransactions.map(m => m.transfer_matched_transaction_id).filter(Boolean) as number[]

        if (matchedIds.length > 0) {
          // Check if these matched transactions are from different import batches
          const { data: matchedDetails, error: detailsError } = await supabase
            .from('main_transaction')
            .select('main_transaction_id, raw_transaction_id')
            .in('main_transaction_id', matchedIds)

          if (detailsError) {
            throw new Error(`Failed to fetch matched transaction details: ${detailsError.message}`)
          }

          if (matchedDetails && matchedDetails.length > 0) {
            // Get the raw_transaction_ids of matched transactions
            const matchedRawIds = matchedDetails.map(m => m.raw_transaction_id)

            // Check if any of these are from different import batches
            const { data: matchedOriginals, error: originalsError } = await supabase
              .from('original_transaction')
              .select('raw_transaction_id, import_batch_id')
              .in('raw_transaction_id', matchedRawIds)

            if (originalsError) {
              throw new Error(`Failed to check import batch origins: ${originalsError.message}`)
            }

            // Check if any matched transactions are from different batches
            const externalMatches = matchedOriginals?.filter(o => o.import_batch_id !== batchId) || []

            if (externalMatches.length > 0) {
              return NextResponse.json(
                {
                  error: 'Cannot rollback: This import contains transfers matched with transactions from other imports',
                  details: {
                    matched_count: externalMatches.length,
                    message: 'Please unmatch these transfers before rolling back this import. Rollback would orphan the matched transactions from other imports.',
                    affected_transactions: matchedTransactions.length
                  }
                },
                { status: 409 }
              )
            }
          }
        }
      }
    }

    // Delete checkpoint created by this import (if any)
    const { error: deleteCheckpointError } = await supabase
      .from('balance_checkpoints')
      .delete()
      .eq('import_batch_id', batchId)

    if (deleteCheckpointError) {
      throw new Error(`Failed to delete checkpoint: ${deleteCheckpointError.message}`)
    }

    // Delete all transactions from this import batch
    // This will trigger checkpoint recalculation for remaining checkpoints (migration 004)
    const { error: deleteError } = await supabase
      .from('original_transaction')
      .delete()
      .eq('import_batch_id', batchId)

    if (deleteError) {
      throw new Error(`Failed to delete transactions: ${deleteError.message}`)
    }

    // Update import batch status to 'rolled_back'
    const { error: updateError } = await supabase
      .from('import_batch')
      .update({
        import_status: 'rolled_back',
        error_log: JSON.stringify({
          rolled_back_at: new Date().toISOString(),
          transactions_deleted: transactionCount,
          reason: 'User-initiated rollback',
        }),
      })
      .eq('import_batch_id', batchId)

    if (updateError) {
      throw new Error(`Failed to update import batch: ${updateError.message}`)
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully rolled back import batch ${batchId}`,
        data: {
          batch_id: batchId,
          account_id: batch.account_id,
          transactions_deleted: transactionCount,
          file_name: batch.import_file_name,
          import_date: batch.import_date,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error rolling back import batch:', error)

    return NextResponse.json(
      {
        error: 'Failed to rollback import batch',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
