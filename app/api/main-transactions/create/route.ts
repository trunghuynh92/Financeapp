/**
 * API Route: /api/main-transactions/create
 * Purpose: Create a fully categorized transaction in one request
 * This combines: create original_transaction + wait for trigger + update main_transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyWritePermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.account_id || !body.transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, transaction_date' },
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

    // Check write permissions
    try {
      await verifyWritePermission(supabase, user.id, body.account_id)
    } catch (permError: any) {
      return NextResponse.json(
        { error: permError.message },
        { status: 403 }
      )
    }

    // Validate that either debit or credit is provided, not both
    const hasDebit = body.debit_amount !== null && body.debit_amount !== undefined
    const hasCredit = body.credit_amount !== null && body.credit_amount !== undefined

    if (hasDebit && hasCredit) {
      return NextResponse.json(
        { error: 'Cannot have both debit_amount and credit_amount. Provide only one.' },
        { status: 400 }
      )
    }

    if (!hasDebit && !hasCredit) {
      return NextResponse.json(
        { error: 'Must provide either debit_amount or credit_amount' },
        { status: 400 }
      )
    }

    // Generate a unique transaction ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id = `TXN-${timestamp}-${random}`

    // Step 1: Create original transaction
    const { data: newTransaction, error: transactionError } = await supabase
      .from('original_transaction')
      .insert([
        {
          raw_transaction_id,
          account_id: body.account_id,
          transaction_date: body.transaction_date,
          description: body.description || null,
          debit_amount: body.debit_amount || null,
          credit_amount: body.credit_amount || null,
          balance: body.balance || null,
          bank_reference: body.bank_reference || null,
          transaction_source: body.transaction_source || 'user_manual',
          import_batch_id: body.import_batch_id || null,
          import_file_name: body.import_file_name || null,
          created_by_user_id: body.created_by_user_id || null,
        },
      ])
      .select()
      .single()

    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      return NextResponse.json({ error: transactionError.message }, { status: 500 })
    }

    // Step 2: Fetch the auto-created main_transaction (trigger creates it)
    // Retry up to 5 times with short delays
    let mainTransaction = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: mainTxData, error: mainTxError } = await supabase
        .from('main_transaction')
        .select('*')
        .eq('raw_transaction_id', raw_transaction_id)
        .single()

      if (!mainTxError && mainTxData) {
        mainTransaction = mainTxData
        break
      }

      // Wait briefly before retry
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    }

    if (!mainTransaction) {
      console.error('Main transaction was not created by trigger')
      return NextResponse.json(
        { error: 'Failed to create main transaction' },
        { status: 500 }
      )
    }

    // Step 3: Update main_transaction with type, category, branch if provided
    if (body.transaction_type_id || body.category_id || body.branch_id) {
      const updateData: any = {}

      if (body.transaction_type_id) {
        updateData.transaction_type_id = body.transaction_type_id
      }
      if (body.category_id) {
        updateData.category_id = body.category_id
      }
      if (body.branch_id) {
        updateData.branch_id = body.branch_id
      }

      updateData.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('main_transaction')
        .update(updateData)
        .eq('main_transaction_id', mainTransaction.main_transaction_id)

      if (updateError) {
        console.error('Error updating main transaction:', updateError)
        return NextResponse.json(
          { error: 'Transaction created but failed to update categorization' },
          { status: 500 }
        )
      }
    }

    // Fetch the final main transaction with all details
    const { data: finalTransaction, error: finalError } = await supabase
      .from('main_transaction_details')
      .select('*')
      .eq('main_transaction_id', mainTransaction.main_transaction_id)
      .single()

    if (finalError) {
      console.error('Error fetching final transaction:', finalError)
      // Return basic info even if detailed fetch fails
      return NextResponse.json({
        data: mainTransaction,
        raw_transaction_id,
      }, { status: 201 })
    }

    return NextResponse.json({
      data: finalTransaction,
      raw_transaction_id,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
