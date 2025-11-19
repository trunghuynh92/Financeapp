/**
 * API Route: /api/loan-disbursements/[id]
 * Get, update, or delete a specific loan disbursement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateLoanDisbursementInput } from '@/types/loan'

// ==============================================================================
// GET - Get loan disbursement details with payment history
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const disbursementId = parseInt(params.id, 10)

    if (isNaN(disbursementId)) {
      return NextResponse.json(
        { error: 'Invalid loan disbursement ID' },
        { status: 400 }
      )
    }

    // Fetch loan disbursement
    const { data: disbursement, error: disbursementError } = await supabase
      .from('loan_disbursement')
      .select(`
        *,
        account:accounts(
          account_id,
          account_name,
          bank_name,
          account_type,
          entity:entities(id, name)
        )
      `)
      .eq('loan_disbursement_id', disbursementId)
      .single()

    if (disbursementError || !disbursement) {
      return NextResponse.json(
        { error: 'Loan disbursement not found' },
        { status: 404 }
      )
    }

    // Fetch payment history (LOAN_SETTLE transactions)
    const { data: payments, error: paymentsError } = await supabase
      .from('main_transaction')
      .select(`
        main_transaction_id,
        transaction_date,
        amount,
        description,
        notes,
        transaction_type:transaction_types(type_code, type_display_name)
      `)
      .eq('loan_disbursement_id', disbursementId)
      .order('transaction_date', { ascending: false })

    if (paymentsError) {
      console.error('Error fetching payment history:', paymentsError)
    }

    // Calculate payment summary
    const received_amount = Number(disbursement.principal_amount) - Number(disbursement.remaining_balance)

    return NextResponse.json({
      data: {
        ...disbursement,
        received_amount,
        payment_history: payments || [],
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch loan disbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update loan disbursement
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const disbursementId = parseInt(params.id, 10)

    if (isNaN(disbursementId)) {
      return NextResponse.json(
        { error: 'Invalid loan disbursement ID' },
        { status: 400 }
      )
    }

    const body: UpdateLoanDisbursementInput = await request.json()

    // Verify disbursement exists
    const { data: existingDisbursement, error: fetchError } = await supabase
      .from('loan_disbursement')
      .select('loan_disbursement_id')
      .eq('loan_disbursement_id', disbursementId)
      .single()

    if (fetchError || !existingDisbursement) {
      return NextResponse.json(
        { error: 'Loan disbursement not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (body.loan_category !== undefined) updateData.loan_category = body.loan_category
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.term_months !== undefined) updateData.term_months = body.term_months
    if (body.interest_rate !== undefined) updateData.interest_rate = body.interest_rate
    if (body.notes !== undefined) updateData.notes = body.notes

    // Update disbursement
    const { data: updatedDisbursement, error: updateError } = await supabase
      .from('loan_disbursement')
      .update(updateData)
      .eq('loan_disbursement_id', disbursementId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating loan disbursement:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updatedDisbursement,
      message: 'Loan disbursement updated successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update loan disbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Delete loan disbursement
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const disbursementId = parseInt(params.id, 10)

    if (isNaN(disbursementId)) {
      return NextResponse.json(
        { error: 'Invalid loan disbursement ID' },
        { status: 400 }
      )
    }

    // Get loan disbursement details
    const { data: disbursement, error: disbursementError } = await supabase
      .from('loan_disbursement')
      .select('loan_disbursement_id, account_id')
      .eq('loan_disbursement_id', disbursementId)
      .single()

    if (disbursementError || !disbursement) {
      console.error('Error fetching disbursement:', disbursementError)
      return NextResponse.json(
        { error: 'Loan disbursement not found' },
        { status: 404 }
      )
    }

    // Check if disbursement has any payment history (LOAN_RECEIVE/LOAN_COLLECT)
    const { data: loanReceiveType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .in('type_code', ['LOAN_RECEIVE', 'LOAN_COLLECT'])
      .single()

    if (loanReceiveType) {
      const { count: paymentsCount } = await supabase
        .from('main_transaction')
        .select('*', { count: 'exact', head: true })
        .eq('loan_disbursement_id', disbursementId)
        .eq('transaction_type_id', loanReceiveType.transaction_type_id)

      if (paymentsCount && paymentsCount > 0) {
        return NextResponse.json(
          {
            error: 'Cannot delete loan disbursement with payment history',
            message: `This loan disbursement has ${paymentsCount} payment(s). Delete the payments first or mark the loan as written_off instead.`,
            payments_count: paymentsCount,
          },
          { status: 400 }
        )
      }
    }

    // Find all linked transactions (source bank transaction + credit in Loan Receivable)
    const { data: linkedTransactions } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, raw_transaction_id, account_id')
      .eq('loan_disbursement_id', disbursementId)

    if (linkedTransactions && linkedTransactions.length > 0) {
      for (const tx of linkedTransactions) {
        // ONLY delete transactions from the Loan Receivable account (credit entries)
        // Keep the source bank transaction, just clear its link
        if (tx.account_id === disbursement.account_id) {
          // Delete the credit transaction in Loan Receivable account
          await supabase
            .from('main_transaction')
            .delete()
            .eq('main_transaction_id', tx.main_transaction_id)

          await supabase
            .from('original_transaction')
            .delete()
            .eq('raw_transaction_id', tx.raw_transaction_id)
        } else {
          // For source bank transactions, just clear the loan_disbursement_id link
          await supabase
            .from('main_transaction')
            .update({
              loan_disbursement_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('main_transaction_id', tx.main_transaction_id)
        }
      }
    }

    // Delete the loan_disbursement record
    const { error: deleteError } = await supabase
      .from('loan_disbursement')
      .delete()
      .eq('loan_disbursement_id', disbursementId)

    if (deleteError) {
      console.error('Error deleting loan disbursement:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Loan disbursement deleted successfully. Paired transactions cleaned up.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete loan disbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
