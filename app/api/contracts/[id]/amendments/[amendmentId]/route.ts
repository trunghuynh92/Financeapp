import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateAmendmentRequest } from '@/types/contract'

// GET /api/contracts/[id]/amendments/[amendmentId] - Get single amendment
export async function GET(
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
    // Fetch amendment with history data
    const { data: amendment, error: amendmentError } = await supabase
      .from('amendment_history')
      .select('*')
      .eq('amendment_id', amendmentId)
      .single()

    if (!amendment) {
      return NextResponse.json(
        { error: 'Amendment not found' },
        { status: 404 }
      )
    }

    // Fetch affected instances
    const { data: affectedInstances } = await supabase
      .from('scheduled_payment_instances')
      .select('instance_id, due_date, amount, original_amount, status')
      .eq('amendment_id', amendmentId)
      .order('due_date', { ascending: true })

    return NextResponse.json({
      data: {
        ...amendment,
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

// PATCH /api/contracts/[id]/amendments/[amendmentId] - Update amendment
export async function PATCH(
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
    const body: UpdateAmendmentRequest = await request.json()

    // Build update object
    const updateData: any = {}
    if (body.amendment_date !== undefined) updateData.amendment_date = body.amendment_date
    if (body.effective_start_date !== undefined) updateData.effective_start_date = body.effective_start_date
    if (body.effective_end_date !== undefined) updateData.effective_end_date = body.effective_end_date
    if (body.amendment_type !== undefined) updateData.amendment_type = body.amendment_type
    if (body.new_payment_amount !== undefined) updateData.new_payment_amount = body.new_payment_amount
    if (body.new_frequency !== undefined) updateData.new_frequency = body.new_frequency
    if (body.new_expiration_date !== undefined) updateData.new_expiration_date = body.new_expiration_date
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.reason !== undefined) updateData.reason = body.reason
    if (body.estimated_impact !== undefined) updateData.estimated_impact = body.estimated_impact
    if (body.impact_direction !== undefined) updateData.impact_direction = body.impact_direction
    if (body.amendment_document_url !== undefined) updateData.amendment_document_url = body.amendment_document_url
    if (body.status !== undefined) updateData.status = body.status

    updateData.updated_at = new Date().toISOString()

    // Update amendment
    const { data: updated, error: updateError } = await supabase
      .from('contract_amendments')
      .update(updateData)
      .eq('amendment_id', amendmentId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating amendment:', updateError)
      return NextResponse.json(
        { error: 'Failed to update amendment', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch updated amendment with history data
    const { data: amendmentHistory } = await supabase
      .from('amendment_history')
      .select('*')
      .eq('amendment_id', amendmentId)
      .single()

    return NextResponse.json({
      data: amendmentHistory || updated,
      message: 'Amendment updated successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/contracts/[id]/amendments/[amendmentId] - Delete amendment
export async function DELETE(
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
    // Check if amendment has been applied
    const { data: affectedInstances } = await supabase
      .from('scheduled_payment_instances')
      .select('instance_id')
      .eq('amendment_id', amendmentId)
      .limit(1)

    if (affectedInstances && affectedInstances.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete amendment that has been applied to instances. Revert it first.' },
        { status: 400 }
      )
    }

    // Delete amendment
    const { error: deleteError } = await supabase
      .from('contract_amendments')
      .delete()
      .eq('amendment_id', amendmentId)

    if (deleteError) {
      console.error('Error deleting amendment:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete amendment', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Amendment deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
