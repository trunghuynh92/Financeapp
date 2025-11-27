/**
 * Individual Adjustment API
 * PUT - Update adjustment
 * DELETE - Delete adjustment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adjustmentId: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id, adjustmentId } = await params
  const scenarioId = parseInt(id)
  const adjId = parseInt(adjustmentId)

  if (isNaN(scenarioId) || isNaN(adjId)) {
    return NextResponse.json(
      { error: 'Invalid ID' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const {
      name,
      amount,
      percentage,
      start_month,
      end_month,
      category_id,
      scheduled_payment_id,
      account_id,
      metadata
    } = body

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (amount !== undefined) updateData.amount = amount
    if (percentage !== undefined) updateData.percentage = percentage
    if (start_month !== undefined) updateData.start_month = start_month
    if (end_month !== undefined) updateData.end_month = end_month
    if (category_id !== undefined) updateData.category_id = category_id
    if (scheduled_payment_id !== undefined) updateData.scheduled_payment_id = scheduled_payment_id
    if (account_id !== undefined) updateData.account_id = account_id
    if (metadata !== undefined) updateData.metadata = metadata

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: adjustment, error } = await supabase
      .from('scenario_adjustments')
      .update(updateData)
      .eq('adjustment_id', adjId)
      .eq('scenario_id', scenarioId)
      .select()
      .single()

    if (error) {
      console.error('Error updating adjustment:', error)
      return NextResponse.json(
        { error: 'Failed to update adjustment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: adjustment })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adjustmentId: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id, adjustmentId } = await params
  const scenarioId = parseInt(id)
  const adjId = parseInt(adjustmentId)

  if (isNaN(scenarioId) || isNaN(adjId)) {
    return NextResponse.json(
      { error: 'Invalid ID' },
      { status: 400 }
    )
  }

  try {
    const { error } = await supabase
      .from('scenario_adjustments')
      .delete()
      .eq('adjustment_id', adjId)
      .eq('scenario_id', scenarioId)

    if (error) {
      console.error('Error deleting adjustment:', error)
      return NextResponse.json(
        { error: 'Failed to delete adjustment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
