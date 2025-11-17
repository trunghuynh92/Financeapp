import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateScheduledPaymentRequest } from '@/types/scheduled-payment'

// GET /api/scheduled-payments/[id] - Get single scheduled payment with instances
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const scheduledPaymentId = parseInt(params.id)

  if (isNaN(scheduledPaymentId)) {
    return NextResponse.json(
      { error: 'Invalid scheduled payment ID' },
      { status: 400 }
    )
  }

  try {
    // Fetch scheduled payment with overview data
    const { data: payment, error: paymentError } = await supabase
      .from('scheduled_payment_overview')
      .select('*')
      .eq('scheduled_payment_id', scheduledPaymentId)
      .single()

    if (paymentError) {
      if (paymentError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Scheduled payment not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching scheduled payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled payment', details: paymentError.message },
        { status: 500 }
      )
    }

    // Fetch all payment instances
    const { data: instances, error: instancesError } = await supabase
      .from('scheduled_payment_instances')
      .select('*')
      .eq('scheduled_payment_id', scheduledPaymentId)
      .order('due_date', { ascending: true })

    if (instancesError) {
      console.error('Error fetching instances:', instancesError)
      // Return payment without instances if fetch fails
      return NextResponse.json({ data: payment })
    }

    return NextResponse.json({
      data: {
        ...payment,
        instances
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/scheduled-payments/[id] - Update scheduled payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const scheduledPaymentId = parseInt(params.id)

  if (isNaN(scheduledPaymentId)) {
    return NextResponse.json(
      { error: 'Invalid scheduled payment ID' },
      { status: 400 }
    )
  }

  try {
    const body: UpdateScheduledPaymentRequest = await request.json()

    // Build update object (only include provided fields)
    const updateData: any = {}
    if (body.contract_name !== undefined) updateData.contract_name = body.contract_name
    if (body.contract_type !== undefined) updateData.contract_type = body.contract_type
    if (body.payee_name !== undefined) updateData.payee_name = body.payee_name
    if (body.contract_number !== undefined) updateData.contract_number = body.contract_number
    if (body.payment_amount !== undefined) {
      if (body.payment_amount <= 0) {
        return NextResponse.json(
          { error: 'payment_amount must be greater than 0' },
          { status: 400 }
        )
      }
      updateData.payment_amount = body.payment_amount
    }
    if (body.schedule_type !== undefined) updateData.schedule_type = body.schedule_type
    if (body.frequency !== undefined) updateData.frequency = body.frequency
    if (body.payment_day !== undefined) updateData.payment_day = body.payment_day
    if (body.start_date !== undefined) updateData.start_date = body.start_date
    if (body.end_date !== undefined) updateData.end_date = body.end_date
    if (body.custom_schedule !== undefined) updateData.custom_schedule = body.custom_schedule
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes

    // Validate date range if dates are being updated
    if (updateData.start_date || updateData.end_date) {
      // Fetch current dates if only one is being updated
      if (!updateData.start_date || !updateData.end_date) {
        const { data: current } = await supabase
          .from('scheduled_payments')
          .select('start_date, end_date')
          .eq('scheduled_payment_id', scheduledPaymentId)
          .single()

        if (current) {
          updateData.start_date = updateData.start_date || current.start_date
          updateData.end_date = updateData.end_date || current.end_date
        }
      }

      if (updateData.end_date && new Date(updateData.end_date) < new Date(updateData.start_date)) {
        return NextResponse.json(
          { error: 'end_date must be after start_date' },
          { status: 400 }
        )
      }
    }

    // Update scheduled payment
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_payments')
      .update(updateData)
      .eq('scheduled_payment_id', scheduledPaymentId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating scheduled payment:', updateError)
      return NextResponse.json(
        { error: 'Failed to update scheduled payment', details: updateError.message },
        { status: 500 }
      )
    }

    // Regenerate instances if requested and schedule-related fields changed
    const regenerateInstances = body.regenerate_instances === true
    const scheduleChanged = !!(
      body.schedule_type || body.frequency || body.payment_day ||
      body.start_date || body.end_date || body.custom_schedule || body.payment_amount
    )

    if (regenerateInstances && scheduleChanged) {
      // Delete existing pending instances
      await supabase
        .from('scheduled_payment_instances')
        .delete()
        .eq('scheduled_payment_id', scheduledPaymentId)
        .eq('status', 'pending')

      // Generate new instances
      await supabase
        .rpc('generate_payment_instances', {
          p_scheduled_payment_id: scheduledPaymentId,
          p_months_ahead: 12
        })
    }

    // Fetch updated payment with overview data
    const { data: overview } = await supabase
      .from('scheduled_payment_overview')
      .select('*')
      .eq('scheduled_payment_id', scheduledPaymentId)
      .single()

    return NextResponse.json({
      data: overview || updated,
      message: 'Scheduled payment updated successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/scheduled-payments/[id] - Soft delete scheduled payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const scheduledPaymentId = parseInt(params.id)

  if (isNaN(scheduledPaymentId)) {
    return NextResponse.json(
      { error: 'Invalid scheduled payment ID' },
      { status: 400 }
    )
  }

  try {
    // Soft delete: set is_active = false and status = 'cancelled'
    const { error: deleteError } = await supabase
      .from('scheduled_payments')
      .update({
        is_active: false,
        status: 'cancelled'
      })
      .eq('scheduled_payment_id', scheduledPaymentId)

    if (deleteError) {
      console.error('Error deleting scheduled payment:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete scheduled payment', details: deleteError.message },
        { status: 500 }
      )
    }

    // Also cancel all pending instances
    await supabase
      .from('scheduled_payment_instances')
      .update({ status: 'cancelled' })
      .eq('scheduled_payment_id', scheduledPaymentId)
      .eq('status', 'pending')

    return NextResponse.json({
      message: 'Scheduled payment deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
