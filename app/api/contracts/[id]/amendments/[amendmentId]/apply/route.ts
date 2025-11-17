import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/contracts/[id]/amendments/[amendmentId]/apply - Apply amendment to instances
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; amendmentId: string } }
) {
  const supabase = createSupabaseServerClient()
  const amendmentId = parseInt(params.amendmentId)

  if (isNaN(amendmentId)) {
    return NextResponse.json(
      { error: 'Invalid amendment ID' },
      { status: 400 }
    )
  }

  try {
    // Verify amendment exists and is approved
    const { data: amendment, error: amendmentError } = await supabase
      .from('contract_amendments')
      .select('*')
      .eq('amendment_id', amendmentId)
      .single()

    if (!amendment) {
      return NextResponse.json(
        { error: 'Amendment not found' },
        { status: 404 }
      )
    }

    if (amendment.status !== 'approved') {
      return NextResponse.json(
        { error: 'Amendment must be approved before applying' },
        { status: 400 }
      )
    }

    // Apply amendment using database function
    const { data: result, error: applyError } = await supabase
      .rpc('apply_amendment_to_instances', { p_amendment_id: amendmentId })
      .single()

    if (applyError) {
      console.error('Error applying amendment:', applyError)
      return NextResponse.json(
        { error: 'Failed to apply amendment', details: applyError.message },
        { status: 500 }
      )
    }

    // Fetch affected instances
    const { data: affectedInstances } = await supabase
      .from('scheduled_payment_instances')
      .select('instance_id, due_date, amount, original_amount, status')
      .eq('amendment_id', amendmentId)
      .order('due_date', { ascending: true })

    return NextResponse.json({
      message: 'Amendment applied successfully',
      data: {
        instances_updated: result.instances_updated,
        old_total: result.old_total,
        new_total: result.new_total,
        financial_impact: result.new_total - result.old_total,
        affected_instances: affectedInstances || []
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
