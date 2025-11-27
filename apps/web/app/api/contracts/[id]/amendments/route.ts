import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateAmendmentRequest, AmendmentImpactPreview } from '@/types/contract'

// GET /api/contracts/[id]/amendments - List amendments for a contract
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const contractId = parseInt(params.id)

  if (isNaN(contractId)) {
    return NextResponse.json(
      { error: 'Invalid contract ID' },
      { status: 400 }
    )
  }

  try {
    // Fetch amendments with history data
    const { data: amendments, error: amendmentsError } = await supabase
      .from('amendment_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('amendment_number', { ascending: false })

    if (amendmentsError) {
      console.error('Error fetching amendments:', amendmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch amendments', details: amendmentsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: amendments || [],
      count: amendments?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/contracts/[id]/amendments - Create new amendment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const contractId = parseInt(params.id)

  if (isNaN(contractId)) {
    return NextResponse.json(
      { error: 'Invalid contract ID' },
      { status: 400 }
    )
  }

  try {
    const body: CreateAmendmentRequest = await request.json()

    // Validation
    if (!body.effective_start_date) {
      return NextResponse.json(
        { error: 'effective_start_date is required' },
        { status: 400 }
      )
    }

    if (!body.amendment_type) {
      return NextResponse.json(
        { error: 'amendment_type is required' },
        { status: 400 }
      )
    }

    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      )
    }

    // Validate type-specific fields
    if (body.amendment_type === 'amount_change' && !body.new_payment_amount) {
      return NextResponse.json(
        { error: 'new_payment_amount is required for amount_change amendments' },
        { status: 400 }
      )
    }

    if (body.amendment_type === 'payment_schedule_change' && !body.new_frequency) {
      return NextResponse.json(
        { error: 'new_frequency is required for payment_schedule_change amendments' },
        { status: 400 }
      )
    }

    if (body.amendment_type === 'term_extension' && !body.new_expiration_date) {
      return NextResponse.json(
        { error: 'new_expiration_date is required for term_extension amendments' },
        { status: 400 }
      )
    }

    // Verify contract exists
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('contract_id, entity_id, status')
      .eq('contract_id', contractId)
      .single()

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Get next amendment number
    let amendmentNumber = body.amendment_number
    if (!amendmentNumber) {
      const { data: lastAmendment } = await supabase
        .from('contract_amendments')
        .select('amendment_number')
        .eq('contract_id', contractId)
        .order('amendment_number', { ascending: false })
        .limit(1)
        .single()

      amendmentNumber = lastAmendment ? lastAmendment.amendment_number + 1 : 1
    }

    // Insert amendment
    const { data: amendment, error: insertError } = await supabase
      .from('contract_amendments')
      .insert([{
        contract_id: contractId,
        amendment_number: amendmentNumber,
        amendment_date: body.amendment_date || new Date().toISOString().split('T')[0],
        effective_start_date: body.effective_start_date,
        effective_end_date: body.effective_end_date || null,
        amendment_type: body.amendment_type,
        new_payment_amount: body.new_payment_amount || null,
        new_frequency: body.new_frequency || null,
        new_expiration_date: body.new_expiration_date || null,
        title: body.title,
        description: body.description,
        reason: body.reason || null,
        estimated_impact: body.estimated_impact || null,
        impact_direction: body.impact_direction || null,
        amendment_document_url: body.amendment_document_url || null,
        status: body.status || 'draft'
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating amendment:', insertError)
      return NextResponse.json(
        { error: 'Failed to create amendment', details: insertError.message },
        { status: 500 }
      )
    }

    // Auto-apply if requested and status is approved
    let applyResult = null
    if (body.auto_apply && amendment.status === 'approved') {
      const { data: result, error: applyError } = await supabase
        .rpc('apply_amendment_to_instances', { p_amendment_id: amendment.amendment_id })
        .single()

      if (applyError) {
        console.error('Error applying amendment:', applyError)
        // Don't fail the request, just log the error
      } else {
        applyResult = result
      }
    }

    // Fetch the created amendment with history data
    const { data: amendmentHistory } = await supabase
      .from('amendment_history')
      .select('*')
      .eq('amendment_id', amendment.amendment_id)
      .single()

    return NextResponse.json({
      data: amendmentHistory || amendment,
      apply_result: applyResult,
      message: 'Amendment created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
