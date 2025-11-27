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

    if (instance.status !== 'paid' && instance.status !== 'partial') {
      return NextResponse.json(
        { error: 'Payment instance is not marked as paid or partial' },
        { status: 400 }
      )
    }

    // Delete all linked transactions from the junction table
    // The database trigger will automatically:
    // 1. Recalculate total_paid_amount to 0
    // 2. Update status to 'pending' or 'overdue' based on due_date
    // 3. Clear paid_date
    const { error: deleteError } = await supabase
      .from('scheduled_payment_instance_transactions')
      .delete()
      .eq('instance_id', instanceId)

    if (deleteError) {
      console.error('Error deleting payment links:', deleteError)
      return NextResponse.json(
        { error: 'Failed to unmark payment instance', details: deleteError.message },
        { status: 500 }
      )
    }

    // Fetch updated instance to return
    const { data: updated, error: fetchError } = await supabase
      .from('scheduled_payment_instances')
      .select('*')
      .eq('instance_id', instanceId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated instance:', fetchError)
      // Still return success since the unmark operation succeeded
      return NextResponse.json({
        message: 'Payment instance unmarked successfully'
      })
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
