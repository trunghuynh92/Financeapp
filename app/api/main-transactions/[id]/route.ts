/**
 * API Route: /api/main-transactions/[id]
 * Purpose: Get, update, or delete a single main_transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getAccountEntityId, getUserEntityRole, canWrite } from '@/lib/permissions'

// ==============================================================================
// GET - Get single main transaction with full details
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const mainTransactionId = parseInt(params.id, 10)

    if (isNaN(mainTransactionId)) {
      return NextResponse.json(
        { error: 'Invalid main transaction ID' },
        { status: 400 }
      )
    }

    // Get from view for full details
    const { data, error } = await supabase
      .from('main_transaction_details')
      .select('*')
      .eq('main_transaction_id', mainTransactionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Main transaction not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching main transaction:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update main transaction (type, category, branch, description, notes)
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const mainTransactionId = parseInt(params.id, 10)

    if (isNaN(mainTransactionId)) {
      return NextResponse.json(
        { error: 'Invalid main transaction ID' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if transaction exists and if it's a balance adjustment
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, raw_transaction_id, account_id')
      .eq('main_transaction_id', mainTransactionId)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json(
        { error: 'Main transaction not found' },
        { status: 404 }
      )
    }

    // Check write permissions for this transaction's account
    const entityId = await getAccountEntityId(supabase, existingTransaction.account_id)
    if (!entityId) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 403 }
      )
    }

    const role = await getUserEntityRole(supabase, user.id, entityId)
    if (!canWrite(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Viewers cannot modify transactions.' },
        { status: 403 }
      )
    }

    // Check if it's a balance adjustment and check if it's manual (no import_batch_id)
    const { data: originalTx, error: originalError } = await supabase
      .from('original_transaction')
      .select('is_balance_adjustment, checkpoint_id, import_batch_id')
      .eq('raw_transaction_id', existingTransaction.raw_transaction_id)
      .single()

    if (originalError) {
      console.error('Error fetching original transaction:', originalError)
      return NextResponse.json({ error: originalError.message }, { status: 500 })
    }

    // Prevent editing balance adjustment transactions
    if (originalTx && originalTx.is_balance_adjustment) {
      return NextResponse.json(
        {
          error: 'Cannot edit balance adjustment transaction',
          message: 'This is a system-generated balance adjustment transaction. To modify it, edit the associated checkpoint instead.',
          checkpoint_id: originalTx.checkpoint_id,
        },
        { status: 403 }
      )
    }

    const isManualTransaction = !originalTx?.import_batch_id

    // Only allow updating specific fields
    const allowedFields = [
      'transaction_type_id',
      'category_id',
      'branch_id',
      'project_id',
      'drawdown_id',
      'description',
      'notes',
      'is_flagged',
      'flag_note',
    ]

    const updates: any = {}

    // Handle flag-specific fields FIRST
    if (body.is_flagged !== undefined) {
      updates.is_flagged = body.is_flagged
      if (body.is_flagged) {
        // Flagging the transaction
        updates.flagged_at = new Date().toISOString()
        updates.flagged_by = user.id
        // Include flag_note if provided
        if (body.flag_note !== undefined) {
          updates.flag_note = body.flag_note
        }
      } else {
        // Unflagging the transaction - explicitly clear all flag fields
        updates.flagged_at = null
        updates.flagged_by = null
        updates.flag_note = null
      }
    }

    // Handle other allowed fields
    for (const field of allowedFields) {
      // Skip flag fields as they're already handled above
      if (field === 'is_flagged' || field === 'flag_note') {
        continue
      }
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Add updated timestamp and user
    updates.updated_at = new Date().toISOString()
    if (body.updated_by_user_id) {
      updates.updated_by_user_id = body.updated_by_user_id
    }

    // For manual transactions, handle editable fields (date, amount, account) by updating original_transaction
    let originalTxUpdates: any = {}
    if (isManualTransaction) {
      if (body.transaction_date !== undefined) {
        originalTxUpdates.transaction_date = body.transaction_date
      }
      if (body.amount !== undefined) {
        // Update both debit_amount and credit_amount based on transaction direction
        const { data: mainTx } = await supabase
          .from('main_transaction')
          .select('transaction_direction')
          .eq('main_transaction_id', mainTransactionId)
          .single()

        if (mainTx?.transaction_direction === 'debit') {
          originalTxUpdates.debit_amount = body.amount
          originalTxUpdates.credit_amount = null
        } else {
          originalTxUpdates.credit_amount = body.amount
          originalTxUpdates.debit_amount = null
        }
      }
      if (body.account_id !== undefined && body.account_id !== existingTransaction.account_id) {
        originalTxUpdates.account_id = body.account_id
      }

      // Update original_transaction if there are changes
      if (Object.keys(originalTxUpdates).length > 0) {
        const { error: originalUpdateError } = await supabase
          .from('original_transaction')
          .update(originalTxUpdates)
          .eq('raw_transaction_id', existingTransaction.raw_transaction_id)

        if (originalUpdateError) {
          console.error('Error updating original transaction:', originalUpdateError)
          return NextResponse.json({ error: originalUpdateError.message }, { status: 500 })
        }
      }
    }

    if (Object.keys(updates).length === 0 && Object.keys(originalTxUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update the main_transaction table (only if there are main_transaction updates)
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('main_transaction')
        .update(updates)
        .eq('main_transaction_id', mainTransactionId)
        .select()
        .single()

      if (error) {
        console.error('Error updating main transaction:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // Get full details after update
    const { data: fullData, error: fullError } = await supabase
      .from('main_transaction_details')
      .select('*')
      .eq('main_transaction_id', mainTransactionId)
      .single()

    if (fullError) {
      console.error('Error fetching updated transaction:', fullError)
      return NextResponse.json({ error: fullError.message }, { status: 500 })
    }

    return NextResponse.json({
      data: fullData,
      message: 'Main transaction updated successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Delete main transaction (with split protection)
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const mainTransactionId = parseInt(params.id, 10)

    if (isNaN(mainTransactionId)) {
      return NextResponse.json(
        { error: 'Invalid main transaction ID' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if this transaction is part of a split
    const { data: transaction, error: fetchError } = await supabase
      .from('main_transaction')
      .select('raw_transaction_id, is_split, account_id')
      .eq('main_transaction_id', mainTransactionId)
      .single()

    if (fetchError) {
      console.error('Error fetching transaction:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!transaction) {
      return NextResponse.json(
        { error: 'Main transaction not found' },
        { status: 404 }
      )
    }

    // Check write permissions for this transaction's account
    const entityId = await getAccountEntityId(supabase, transaction.account_id)
    if (!entityId) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 403 }
      )
    }

    const role = await getUserEntityRole(supabase, user.id, entityId)
    if (!canWrite(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Viewers cannot delete transactions.' },
        { status: 403 }
      )
    }

    // If part of a split, check if there are other splits
    if (transaction.is_split) {
      const { data: splits, error: splitsError } = await supabase
        .from('main_transaction')
        .select('main_transaction_id')
        .eq('raw_transaction_id', transaction.raw_transaction_id)

      if (splitsError) {
        console.error('Error checking splits:', splitsError)
        return NextResponse.json({ error: splitsError.message }, { status: 500 })
      }

      if (splits && splits.length > 1) {
        return NextResponse.json(
          {
            error: 'Cannot delete individual split. Delete entire split group or edit splits.',
            splitCount: splits.length,
            raw_transaction_id: transaction.raw_transaction_id,
          },
          { status: 400 }
        )
      }
    }

    // Delete the transaction
    const { error: deleteError } = await supabase
      .from('main_transaction')
      .delete()
      .eq('main_transaction_id', mainTransactionId)

    if (deleteError) {
      console.error('Error deleting main transaction:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Main transaction deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
