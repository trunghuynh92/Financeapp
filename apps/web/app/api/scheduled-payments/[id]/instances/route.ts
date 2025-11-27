import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/scheduled-payments/[id]/instances - Get all instances for a scheduled payment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const scheduledPaymentId = parseInt(params.id)

  if (isNaN(scheduledPaymentId)) {
    return NextResponse.json(
      { error: 'Invalid scheduled payment ID' },
      { status: 400 }
    )
  }

  try {
    // Fetch all instances for this scheduled payment
    const { data: instances, error: instancesError } = await supabase
      .from('scheduled_payment_instances')
      .select('*')
      .eq('scheduled_payment_id', scheduledPaymentId)
      .order('due_date', { ascending: true })

    if (instancesError) {
      console.error('Error fetching payment instances:', instancesError)
      return NextResponse.json(
        { error: 'Failed to fetch payment instances', details: instancesError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: instances || [],
      count: instances?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
