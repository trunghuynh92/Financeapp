/**
 * API Route: POST /api/receipts/[id]/create-transaction
 *
 * Purpose: Create a main_transaction from receipt OCR data
 *
 * Flow:
 * 1. Get receipt data
 * 2. Map suggested_category_code to actual category_id
 * 3. Determine transaction type from category
 * 4. Create raw_transaction
 * 5. Create main_transaction
 * 6. Link receipt to main_transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const receiptId = params.id

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const {
      account_id,
      entity_id,
      description,
      amount,
      transaction_date,
      category_id,
      notes,
    } = body

    // Validate required fields
    if (!account_id || !entity_id || !amount || !transaction_date || !category_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get category to determine transaction type
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('transaction_type_id, category_code')
      .eq('category_id', category_id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Generate unique raw_transaction_id with random component to prevent collisions
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    const rawTransactionId = `RECEIPT_${receiptId}_${timestamp}_${random}`

    // Determine transaction direction (most expenses are debits)
    const transactionDirection = 'debit' // Receipts are typically expenses (debits)

    // Clean up any orphaned transactions from previous failed attempts
    // This prevents the split amounts validation trigger from failing
    // IMPORTANT: Delete main_transactions first (foreign key constraint)
    const { data: deletedMain, error: cleanupMainError } = await supabase
      .from('main_transaction')
      .delete()
      .like('raw_transaction_id', `RECEIPT_${receiptId}%`)
      .select()

    if (cleanupMainError) {
      console.warn('Warning: Could not clean up old main_transactions:', cleanupMainError)
    } else if (deletedMain && deletedMain.length > 0) {
      console.log(`Cleaned up ${deletedMain.length} orphaned main_transactions for receipt ${receiptId}`)
    }

    const { data: deletedOriginal, error: cleanupOriginalError } = await supabase
      .from('original_transaction')
      .delete()
      .like('raw_transaction_id', `RECEIPT_${receiptId}%`)
      .select()

    if (cleanupOriginalError) {
      console.warn('Warning: Could not clean up old original_transactions:', cleanupOriginalError)
    } else if (deletedOriginal && deletedOriginal.length > 0) {
      console.log(`Cleaned up ${deletedOriginal.length} orphaned original_transactions for receipt ${receiptId}`)
    }

    // Create raw_transaction
    // NOTE: This will automatically trigger creation of a main_transaction via database trigger
    const { data: rawTransaction, error: rawError } = await supabase
      .from('original_transaction')
      .insert({
        raw_transaction_id: rawTransactionId,
        account_id,
        transaction_date,
        description: description || 'Receipt transaction',
        debit_amount: amount,
        credit_amount: null,
        transaction_source: 'user_manual',
      })
      .select()
      .single()

    if (rawError) {
      console.error('Error creating raw transaction:', rawError)
      return NextResponse.json(
        { error: 'Failed to create raw transaction' },
        { status: 500 }
      )
    }

    // Update the auto-created main_transaction with the correct category and notes
    // The trigger automatically created a main_transaction with default type, we need to update it
    const { data: mainTransaction, error: mainError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: category.transaction_type_id,
        category_id,
        notes,
      })
      .eq('raw_transaction_id', rawTransactionId)
      .select()
      .single()

    if (mainError) {
      console.error('Error updating main transaction:', mainError)
      console.error('Update data:', {
        raw_transaction_id: rawTransactionId,
        transaction_type_id: category.transaction_type_id,
        category_id,
        notes,
      })
      return NextResponse.json(
        { error: 'Failed to update transaction category', details: mainError.message },
        { status: 500 }
      )
    }

    // Link receipt to raw_transaction
    // The account and main_transaction can be accessed via the raw_transaction relationship
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        raw_transaction_id: rawTransactionId,
      })
      .eq('receipt_id', receiptId)

    if (updateError) {
      console.error('Error linking receipt to transaction:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      transaction_id: mainTransaction.main_transaction_id,
      raw_transaction_id: rawTransactionId,
    })
  } catch (error) {
    console.error('Error creating transaction from receipt:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
