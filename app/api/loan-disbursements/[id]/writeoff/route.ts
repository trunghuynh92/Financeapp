/**
 * API Route: /api/loan-disbursements/[id]/writeoff
 * Write off a loan disbursement (partial or full)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { LoanWriteoffInput } from '@/types/loan'

// ==============================================================================
// POST - Write off a loan
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const disbursementId = parseInt(params.id, 10)

    if (isNaN(disbursementId)) {
      return NextResponse.json(
        { error: 'Invalid loan disbursement ID' },
        { status: 400 }
      )
    }

    const body: LoanWriteoffInput = await request.json()

    // Validation
    if (!body.writeoff_amount || !body.writeoff_date) {
      return NextResponse.json(
        { error: 'Missing required fields: writeoff_amount, writeoff_date' },
        { status: 400 }
      )
    }

    if (body.writeoff_amount <= 0) {
      return NextResponse.json(
        { error: 'Write-off amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Fetch loan disbursement
    const { data: disbursement, error: disbursementError } = await supabase
      .from('loan_disbursement')
      .select('*')
      .eq('loan_disbursement_id', disbursementId)
      .single()

    if (disbursementError || !disbursement) {
      return NextResponse.json(
        { error: 'Loan disbursement not found' },
        { status: 404 }
      )
    }

    // Check if already fully written off
    if (disbursement.status === 'written_off') {
      return NextResponse.json(
        {
          error: 'Loan is already fully written off',
          status: disbursement.status,
        },
        { status: 400 }
      )
    }

    // Check if write-off amount exceeds remaining balance
    if (body.writeoff_amount > disbursement.remaining_balance) {
      return NextResponse.json(
        {
          error: 'Write-off amount cannot exceed remaining balance',
          remaining_balance: disbursement.remaining_balance,
          writeoff_amount: body.writeoff_amount,
        },
        { status: 400 }
      )
    }

    // Determine new status
    const newWrittenOffAmount = Number(disbursement.written_off_amount) + body.writeoff_amount
    const newRemainingBalance = Number(disbursement.remaining_balance) - body.writeoff_amount
    let newStatus = disbursement.status

    if (newRemainingBalance === 0) {
      newStatus = 'written_off'
    } else if (newWrittenOffAmount > 0) {
      newStatus = 'partially_written_off'
    }

    // Update loan disbursement
    const { data: updatedDisbursement, error: updateError } = await supabase
      .from('loan_disbursement')
      .update({
        written_off_amount: newWrittenOffAmount,
        written_off_date: body.writeoff_date,
        remaining_balance: newRemainingBalance,
        status: newStatus,
        notes: body.reason ? `${disbursement.notes || ''}\n\nWrite-off: ${body.reason}`.trim() : disbursement.notes,
        updated_at: new Date().toISOString(),
      })
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

    // Find LOAN_WRITEOFF transaction type
    const { data: writeoffType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'LOAN_WRITEOFF')
      .single()

    if (!writeoffType) {
      console.warn('LOAN_WRITEOFF transaction type not found, skipping transaction creation')
    } else {
      // Create LOAN_WRITEOFF transaction (non-cash adjustment)
      const description = `Loan write-off for ${disbursement.borrower_name}${body.reason ? ` - ${body.reason}` : ''}`
      const rawTxId = `LOAN_WRITEOFF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const { error: txError } = await supabase
        .from('original_transaction')
        .insert([{
          raw_transaction_id: rawTxId,
          account_id: disbursement.account_id,
          transaction_date: body.writeoff_date,
          description,
          debit_amount: null,
          credit_amount: body.writeoff_amount, // Credit reduces the asset (loan receivable)
          transaction_source: 'system_generated',
          notes: body.reason || 'Loan write-off',
        }])

      if (txError) {
        console.error('Error creating write-off transaction:', txError)
      } else {
        // Update the main_transaction to link to disbursement
        const { error: mainTxError } = await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: writeoffType.transaction_type_id,
            loan_disbursement_id: disbursementId,
          })
          .eq('raw_transaction_id', rawTxId)

        if (mainTxError) {
          console.error('Error updating main transaction:', mainTxError)
        }
      }
    }

    return NextResponse.json({
      data: updatedDisbursement,
      message: newStatus === 'written_off'
        ? 'Loan fully written off successfully'
        : 'Loan partially written off successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to write off loan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
