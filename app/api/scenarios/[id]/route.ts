/**
 * Individual Scenario API
 * GET - Get scenario with all adjustments
 * PUT - Update scenario metadata
 * DELETE - Delete scenario and all adjustments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id } = await params
  const scenarioId = parseInt(id)

  if (isNaN(scenarioId)) {
    return NextResponse.json(
      { error: 'Invalid scenario ID' },
      { status: 400 }
    )
  }

  try {
    // Fetch scenario with all adjustments
    const { data: scenario, error } = await supabase
      .from('cashflow_scenarios')
      .select(`
        *,
        adjustments:scenario_adjustments(
          *,
          category:categories(category_id, category_name),
          scheduled_payment:scheduled_payments(scheduled_payment_id, contract_name),
          account:accounts(account_id, account_name)
        )
      `)
      .eq('scenario_id', scenarioId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching scenario:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scenario' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: scenario })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id } = await params
  const scenarioId = parseInt(id)

  if (isNaN(scenarioId)) {
    return NextResponse.json(
      { error: 'Invalid scenario ID' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { name, description, color, is_active } = body

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: scenario, error } = await supabase
      .from('cashflow_scenarios')
      .update(updateData)
      .eq('scenario_id', scenarioId)
      .select()
      .single()

    if (error) {
      console.error('Error updating scenario:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A scenario with this name already exists' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update scenario' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: scenario })
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
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id } = await params
  const scenarioId = parseInt(id)

  if (isNaN(scenarioId)) {
    return NextResponse.json(
      { error: 'Invalid scenario ID' },
      { status: 400 }
    )
  }

  try {
    // Adjustments will be cascade deleted
    const { error } = await supabase
      .from('cashflow_scenarios')
      .delete()
      .eq('scenario_id', scenarioId)

    if (error) {
      console.error('Error deleting scenario:', error)
      return NextResponse.json(
        { error: 'Failed to delete scenario' },
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
