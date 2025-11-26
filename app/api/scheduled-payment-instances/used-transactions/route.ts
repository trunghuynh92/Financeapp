import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/scheduled-payment-instances/used-transactions - Get all transaction IDs used by payment instances
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams
  const entityId = searchParams.get('entity_id')

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    // Get all transaction IDs from the junction table for this entity
    const { data: links, error } = await supabase
      .from('scheduled_payment_instance_transactions')
      .select(`
        transaction_id,
        scheduled_payment_instances!inner (
          scheduled_payments!inner (
            entity_id
          )
        )
      `)
      .eq('scheduled_payment_instances.scheduled_payments.entity_id', entityId)

    if (error) {
      console.error('Error fetching used transactions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch used transactions', details: error.message },
        { status: 500 }
      )
    }

    // Extract unique transaction IDs
    const transactionIds = Array.from(
      new Set(
        (links || []).map((link: any) => link.transaction_id).filter(Boolean)
      )
    )

    return NextResponse.json({
      transaction_ids: transactionIds,
      count: transactionIds.length
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
