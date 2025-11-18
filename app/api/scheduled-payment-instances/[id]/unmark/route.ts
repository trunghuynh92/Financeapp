import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/scheduled-payment-instances/[id]/unmark - Unmark instance (set back to pending)
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
    // Fetch instance to verify it exists and is paid
    const { data: instance, error: instanceError } = await supabase
      .from('scheduled_payment_instances')
      .select('*')
      .eq('instance_id', instanceId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: 'Payment instance not found' },
        { status: 404 }
      )
    }

    if (instance.status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment instance is not marked as paid' },
        { status: 400 }
      )
    }

    // Determine new status based on due date
    const dueDate = new Date(instance.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newStatus = dueDate < today ? 'overdue' : 'pending'

    // Unmark the instance by clearing payment fields and setting appropriate status
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_payment_instances')
      .update({
        status: newStatus,
        paid_date: null,
        paid_amount: null,
        transaction_id: null
      })
      .eq('instance_id', instanceId)
      .select()
      .single()

    if (updateError) {
      console.error('Error unmarking payment instance:', updateError)
      return NextResponse.json(
        { error: 'Failed to unmark payment instance', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updated,
      message: 'Payment instance unmarked successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
