import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { MarkAsPaidRequest } from '@/types/scheduled-payment'

// POST /api/scheduled-payment-instances/[id]/mark-paid - Mark instance as paid
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const instanceId = parseInt(params.id)

  if (isNaN(instanceId)) {
    return NextResponse.json(
      { error: 'Invalid instance ID' },
      { status: 400 }
    )
  }

  try {
    const body: MarkAsPaidRequest = await request.json()

    // Validation
    if (!body.paid_amount || body.paid_amount <= 0) {
      return NextResponse.json(
        { error: 'paid_amount is required and must be greater than 0' },
        { status: 400 }
      )
    }

    // Fetch instance to get scheduled payment details
    const { data: instance, error: instanceError } = await supabase
      .from('scheduled_payment_instances')
      .select('*, scheduled_payments(*)')
      .eq('instance_id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: 'Payment instance not found' },
        { status: 404 }
      )
    }

    if (instance.status === 'paid') {
      return NextResponse.json(
        { error: 'Payment instance is already marked as paid' },
        { status: 400 }
      )
    }

    const paidDate = body.paid_date || new Date().toISOString().split('T')[0]
    let transactionId = body.transaction_id

    // Create transaction if requested
    if (body.create_transaction && !transactionId) {
      // Get scheduled payment details
      const scheduledPayment = instance.scheduled_payments as any

      if (!body.account_id) {
        return NextResponse.json(
          { error: 'account_id is required when creating a transaction' },
          { status: 400 }
        )
      }

      // Step 1: Insert into original_transaction first (this is the source of truth)
      const { data: originalTx, error: originalError } = await supabase
        .from('original_transaction')
        .insert([{
          account_id: body.account_id,
          transaction_date: paidDate,
          description: `${scheduledPayment.contract_name} - Payment to ${scheduledPayment.payee_name}`,
          debit_amount: body.paid_amount, // Payment is expense = debit
          credit_amount: null,
          is_balance_adjustment: false
        }])
        .select()
        .single()

      if (originalError) {
        console.error('Error creating original transaction:', originalError)
        return NextResponse.json(
          { error: 'Failed to create transaction', details: originalError.message },
          { status: 500 }
        )
      }

      // Step 2: Create main_transaction linked to original_transaction
      // This will automatically set transaction_type_id = 2 (Expense) via trigger
      const { data: newTransaction, error: transactionError} = await supabase
        .from('main_transaction')
        .insert([{
          raw_transaction_id: originalTx.raw_transaction_id,
          account_id: body.account_id,
          transaction_type_id: 2, // Expense type
          category_id: scheduledPayment.category_id,
          transaction_date: paidDate,
          amount: body.paid_amount,
          transaction_direction: 'debit', // Payment is always debit (expense)
          description: `${scheduledPayment.contract_name} - Payment to ${scheduledPayment.payee_name}`,
          notes: body.notes || `Auto-generated from scheduled payment instance ${instanceId}`
        }])
        .select()
        .single()

      if (transactionError) {
        console.error('Error creating main transaction:', transactionError)
        return NextResponse.json(
          { error: 'Failed to create transaction', details: transactionError.message },
          { status: 500 }
        )
      }

      transactionId = newTransaction.main_transaction_id
    }

    // Mark instance as paid using the database function
    const { data: result, error: markPaidError } = await supabase
      .rpc('mark_payment_as_paid', {
        p_instance_id: instanceId,
        p_transaction_id: transactionId || null,
        p_paid_amount: body.paid_amount,
        p_paid_date: paidDate
      })

    if (markPaidError) {
      console.error('Error marking payment as paid:', markPaidError)
      return NextResponse.json(
        { error: 'Failed to mark payment as paid', details: markPaidError.message },
        { status: 500 }
      )
    }

    // Update notes if provided
    if (body.notes) {
      await supabase
        .from('scheduled_payment_instances')
        .update({ notes: body.notes })
        .eq('instance_id', instanceId)
    }

    // Fetch updated instance
    const { data: updatedInstance } = await supabase
      .from('scheduled_payment_instances')
      .select('*')
      .eq('instance_id', instanceId)
      .single()

    return NextResponse.json({
      data: updatedInstance,
      message: 'Payment instance marked as paid successfully',
      transaction_created: body.create_transaction && !body.transaction_id,
      transaction_id: transactionId
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
