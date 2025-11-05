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

    // Build update data
    const updateData: any = {}
    if (body.account_id !== undefined) updateData.account_id = body.account_id
    if (body.transaction_date !== undefined) updateData.transaction_date = body.transaction_date
    if (body.description !== undefined) updateData.description = body.description
    if (body.debit_amount !== undefined) {
      updateData.debit_amount = body.debit_amount
      updateData.credit_amount = null
    }
    if (body.credit_amount !== undefined) {
      updateData.credit_amount = body.credit_amount
      updateData.debit_amount = null
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
