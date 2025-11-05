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
