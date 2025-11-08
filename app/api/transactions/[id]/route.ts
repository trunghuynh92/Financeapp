import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/transactions/[id] - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id

    const { data, error } = await supabase
      .from('original_transaction')
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, bank_name),
        import_batch:import_batch(import_batch_id, import_file_name, import_date)
      `)
      .eq('raw_transaction_id', transactionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }
      console.error('Error fetching transaction:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PATCH /api/transactions/[id] - Update transaction
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id
    const body = await request.json()

    // Check if transaction exists and get is_balance_adjustment flag
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('original_transaction')
      .select('raw_transaction_id, is_balance_adjustment, checkpoint_id')
      .eq('raw_transaction_id', transactionId)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Prevent editing balance adjustment transactions
    if (existingTransaction.is_balance_adjustment) {
      return NextResponse.json(
        {
          error: 'Cannot edit balance adjustment transaction',
          message: 'This is a system-generated balance adjustment transaction. To modify it, edit the associated checkpoint instead.',
          checkpoint_id: existingTransaction.checkpoint_id,
        },
        { status: 403 }
      )
    }

    // Validate debit/credit logic if they're being updated
    const hasDebit = body.debit_amount !== null && body.debit_amount !== undefined
    const hasCredit = body.credit_amount !== null && body.credit_amount !== undefined

    if (hasDebit && hasCredit) {
      return NextResponse.json(
        { error: 'Cannot have both debit_amount and credit_amount. Provide only one.' },
        { status: 400 }
      )
    }

    // Check if editing amount and splits exist
    if (hasDebit || hasCredit) {
      const { data: splits, error: splitsError } = await supabase
        .from('main_transaction')
        .select('main_transaction_id')
        .eq('raw_transaction_id', transactionId)
        .eq('is_split', true)

      if (splitsError) {
        console.error('Error checking splits:', splitsError)
        return NextResponse.json({ error: splitsError.message }, { status: 500 })
      }

      if (splits && splits.length > 0) {
        // Splits exist - check if force delete is requested
        if (body.force_delete_splits === true) {
          // User confirmed - delete all splits first
          const { error: deleteSplitsError } = await supabase
            .from('main_transaction')
            .delete()
            .eq('raw_transaction_id', transactionId)

          if (deleteSplitsError) {
            console.error('Error deleting splits:', deleteSplitsError)
            return NextResponse.json(
              { error: 'Failed to delete splits' },
              { status: 500 }
            )
          }

          // Splits deleted, proceed with update
          // The trigger will create a new single main_transaction after update
        } else {
          // Splits exist but user hasn't confirmed deletion
          return NextResponse.json(
            {
              error: 'Cannot edit amount when transaction is split',
              message: 'This transaction has been split into multiple parts. To edit the amount, the splits must be deleted first.',
              split_count: splits.length,
              requires_confirmation: true,
              raw_transaction_id: transactionId,
            },
            { status: 409 } // Conflict status
          )
        }
      }
    }

    // Build update data
    const updateData: any = {}
    if (body.account_id !== undefined) updateData.account_id = body.account_id
    if (body.transaction_date !== undefined) updateData.transaction_date = body.transaction_date
    if (body.description !== undefined) updateData.description = body.description

    // Only update amounts if they are actually provided and valid
    if (body.debit_amount !== undefined && body.debit_amount !== null) {
      // Ensure it's a valid number
      const debitValue = typeof body.debit_amount === 'number' ? body.debit_amount : parseFloat(body.debit_amount)
      if (!isNaN(debitValue)) {
        updateData.debit_amount = debitValue
        updateData.credit_amount = null
      }
    }
    if (body.credit_amount !== undefined && body.credit_amount !== null) {
      // Ensure it's a valid number
      const creditValue = typeof body.credit_amount === 'number' ? body.credit_amount : parseFloat(body.credit_amount)
      if (!isNaN(creditValue)) {
        updateData.credit_amount = creditValue
        updateData.debit_amount = null
      }
    }

    if (body.balance !== undefined) updateData.balance = body.balance
    if (body.bank_reference !== undefined) updateData.bank_reference = body.bank_reference
    if (body.updated_by_user_id !== undefined) updateData.updated_by_user_id = body.updated_by_user_id

    // Always update updated_at
    updateData.updated_at = new Date().toISOString()

    const { data: updatedTransaction, error: updateError } = await supabase
      .from('original_transaction')
      .update(updateData)
      .eq('raw_transaction_id', transactionId)
      .select(`
        *,
        account:accounts(account_id, account_name, account_type, bank_name)
      `)
      .single()

    if (updateError) {
      console.error('Error updating transaction:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updatedTransaction)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/transactions/[id] - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id

    // Check if transaction exists and get is_balance_adjustment flag
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('original_transaction')
      .select('raw_transaction_id, description, is_balance_adjustment, checkpoint_id')
      .eq('raw_transaction_id', transactionId)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Prevent deleting balance adjustment transactions
    if (existingTransaction.is_balance_adjustment) {
      return NextResponse.json(
        {
          error: 'Cannot delete balance adjustment transaction',
          message: 'This is a system-generated balance adjustment transaction. To remove it, delete the associated checkpoint instead.',
          checkpoint_id: existingTransaction.checkpoint_id,
        },
        { status: 403 }
      )
    }

    // Delete transaction
    const { error: deleteError } = await supabase
      .from('original_transaction')
      .delete()
      .eq('raw_transaction_id', transactionId)

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
