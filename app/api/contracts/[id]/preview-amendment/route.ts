import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/contracts/:id/preview-amendment
 * Preview how many payment instances would be affected by an amendment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const contractId = parseInt(params.id)
    const searchParams = request.nextUrl.searchParams

    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate) {
      return NextResponse.json(
        { error: 'start_date is required' },
        { status: 400 }
      )
    }

    // Get all payment schedules for this contract
    const { data: schedules, error: schedulesError } = await supabase
      .from('scheduled_payments')
      .select('scheduled_payment_id')
      .eq('contract_id', contractId)
      .eq('is_active', true)

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError)
      return NextResponse.json(
        { error: 'Failed to fetch payment schedules' },
        { status: 500 }
      )
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        affected_instances_count: 0,
        schedules_affected: 0
      })
    }

    const scheduleIds = schedules.map(s => s.scheduled_payment_id)

    // Count instances that would be affected
    let query = supabase
      .from('scheduled_payment_instances')
      .select('instance_id', { count: 'exact', head: true })
      .in('scheduled_payment_id', scheduleIds)
      .gte('due_date', startDate)
      .not('status', 'in', '(paid,cancelled)')

    if (endDate) {
      query = query.lte('due_date', endDate)
    }

    const { count, error: countError } = await query

    if (countError) {
      console.error('Error counting instances:', countError)
      return NextResponse.json(
        { error: 'Failed to count affected instances' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      affected_instances_count: count || 0,
      schedules_affected: schedules.length,
      preview: {
        start_date: startDate,
        end_date: endDate || 'indefinite'
      }
    })

  } catch (error) {
    console.error('Error in preview-amendment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
