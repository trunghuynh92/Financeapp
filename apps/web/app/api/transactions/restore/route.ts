import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getAccountEntityId, getUserEntityRole, canWrite } from '@/lib/permissions'

/**
 * POST /api/transactions/restore
 * Restore a previously deleted transaction
 * Used for undo functionality
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate that we have transaction data to restore
    if (!body.transaction) {
      return NextResponse.json(
        { error: 'Transaction data is required' },
        { status: 400 }
      )
    }

    const transactionToRestore = body.transaction

    console.log('Restore API - Received transaction data:', JSON.stringify(transactionToRestore, null, 2))

    // Check write permissions for this transaction's account
    const entityId = await getAccountEntityId(supabase, transactionToRestore.account_id)
    if (!entityId) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 403 }
      )
    }

    const role = await getUserEntityRole(supabase, user.id, entityId)
    if (!canWrite(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Viewers cannot restore transactions.' },
        { status: 403 }
      )
    }

    // Restore the transaction by inserting it back
    // Build insert object with proper null handling
    const insertData: any = {
      raw_transaction_id: transactionToRestore.raw_transaction_id,
      account_id: transactionToRestore.account_id,
      transaction_date: transactionToRestore.transaction_date,
      description: transactionToRestore.description,
      debit_amount: transactionToRestore.debit_amount,
      credit_amount: transactionToRestore.credit_amount,
      balance: transactionToRestore.balance,
      bank_reference: transactionToRestore.bank_reference,
      updated_at: new Date().toISOString(),
    }

    // Only include these fields if they have values
    if (transactionToRestore.import_batch_id) {
      insertData.import_batch_id = transactionToRestore.import_batch_id
    }
    if (transactionToRestore.is_balance_adjustment !== undefined) {
      insertData.is_balance_adjustment = transactionToRestore.is_balance_adjustment
    }
    if (transactionToRestore.checkpoint_id) {
      insertData.checkpoint_id = transactionToRestore.checkpoint_id
    }
    if (transactionToRestore.created_by_user_id) {
      insertData.created_by_user_id = transactionToRestore.created_by_user_id
    }
    if (transactionToRestore.created_at) {
      insertData.created_at = transactionToRestore.created_at
    }

    // Don't set updated_by_user_id - let the database handle it with defaults
    // The user.id is a UUID but updated_by_user_id expects an integer

    console.log('Restore API - Attempting insert with data:', JSON.stringify(insertData, null, 2))

    const { data: restoredTransaction, error: restoreError } = await supabase
      .from('original_transaction')
      .insert(insertData)
      .select()
      .single()

    if (restoreError) {
      console.error('Error restoring transaction:', restoreError)
      console.error('Failed insert data:', JSON.stringify(insertData, null, 2))
      return NextResponse.json({ error: restoreError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Transaction restored successfully',
      data: restoredTransaction
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
