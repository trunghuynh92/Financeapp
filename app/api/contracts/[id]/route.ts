import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateContractRequest } from '@/types/contract'

// GET /api/contracts/[id] - Get single contract with payment schedules and amendments
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
    // Fetch contract overview
    const { data: contract, error: contractError } = await supabase
      .from('contract_overview')
      .select('*')
      .eq('contract_id', contractId)
      .single()

    if (!contract) {
      if (contractError) {
        console.error('Error fetching contract:', contractError)
      }
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Fetch payment schedules for this contract
    const { data: schedules, error: schedulesError } = await supabase
      .from('scheduled_payment_overview')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (schedulesError) {
      console.error('Error fetching payment schedules:', schedulesError)
    }

    // Fetch amendments for this contract
    const { data: amendments, error: amendmentsError } = await supabase
      .from('amendment_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('amendment_number', { ascending: false })

    if (amendmentsError) {
      console.error('Error fetching amendments:', amendmentsError)
    }

    return NextResponse.json({
      data: {
        ...contract,
        payment_schedules: schedules || [],
        amendments: amendments || []
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

// PATCH /api/contracts/[id] - Update contract
export async function PATCH(
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
    const body: UpdateContractRequest = await request.json()

    // Build update object (only include provided fields)
    const updateData: any = {}
    if (body.contract_number !== undefined) updateData.contract_number = body.contract_number
    if (body.contract_name !== undefined) updateData.contract_name = body.contract_name
    if (body.contract_type !== undefined) updateData.contract_type = body.contract_type
    if (body.counterparty !== undefined) updateData.counterparty = body.counterparty
    if (body.counterparty_contact !== undefined) updateData.counterparty_contact = body.counterparty_contact
    if (body.counterparty_address !== undefined) updateData.counterparty_address = body.counterparty_address
    if (body.signing_date !== undefined) updateData.signing_date = body.signing_date
    if (body.effective_date !== undefined) updateData.effective_date = body.effective_date
    if (body.expiration_date !== undefined) updateData.expiration_date = body.expiration_date
    if (body.total_contract_value !== undefined) updateData.total_contract_value = body.total_contract_value
    if (body.payment_terms !== undefined) updateData.payment_terms = body.payment_terms
    if (body.renewal_terms !== undefined) updateData.renewal_terms = body.renewal_terms
    if (body.termination_terms !== undefined) updateData.termination_terms = body.termination_terms
    if (body.special_terms !== undefined) updateData.special_terms = body.special_terms
    if (body.status !== undefined) updateData.status = body.status
    if (body.document_url !== undefined) updateData.document_url = body.document_url
    if (body.notes !== undefined) updateData.notes = body.notes

    updateData.updated_at = new Date().toISOString()

    // Validate date range if dates are being updated
    if (updateData.effective_date || updateData.expiration_date) {
      // Fetch current dates if only one is being updated
      if (!updateData.effective_date || !updateData.expiration_date) {
        const { data: current } = await supabase
          .from('contracts')
          .select('effective_date, expiration_date')
          .eq('contract_id', contractId)
          .single()

        if (current) {
          updateData.effective_date = updateData.effective_date || current.effective_date
          updateData.expiration_date = updateData.expiration_date || current.expiration_date
        }
      }

      if (updateData.expiration_date && new Date(updateData.expiration_date) < new Date(updateData.effective_date)) {
        return NextResponse.json(
          { error: 'expiration_date must be after effective_date' },
          { status: 400 }
        )
      }
    }

    // Check for duplicate contract number if being changed
    if (updateData.contract_number) {
      const { data: current } = await supabase
        .from('contracts')
        .select('entity_id')
        .eq('contract_id', contractId)
        .single()

      if (current) {
        const { data: existing } = await supabase
          .from('contracts')
          .select('contract_id')
          .eq('entity_id', current.entity_id)
          .eq('contract_number', updateData.contract_number)
          .neq('contract_id', contractId)
          .single()

        if (existing) {
          return NextResponse.json(
            { error: `Contract number ${updateData.contract_number} already exists for this entity` },
            { status: 409 }
          )
        }
      }
    }

    // Update contract
    const { data: updated, error: updateError } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('contract_id', contractId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contract:', updateError)
      return NextResponse.json(
        { error: 'Failed to update contract', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch updated contract with overview data
    const { data: overview } = await supabase
      .from('contract_overview')
      .select('*')
      .eq('contract_id', contractId)
      .single()

    return NextResponse.json({
      data: overview || updated,
      message: 'Contract updated successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/contracts/[id] - Soft delete contract
export async function DELETE(
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
    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('contracts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('contract_id', contractId)

    if (deleteError) {
      console.error('Error deleting contract:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete contract', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Contract deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
