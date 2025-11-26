/**
 * Cash Flow Scenarios API
 * GET - List all scenarios for an entity
 * POST - Create a new scenario
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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
    // Fetch scenarios with adjustment counts
    const { data: scenarios, error } = await supabase
      .from('cashflow_scenarios')
      .select(`
        *,
        adjustments:scenario_adjustments(count)
      `)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching scenarios:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scenarios' },
        { status: 500 }
      )
    }

    // Transform to include adjustment count
    const scenariosWithCount = scenarios?.map(s => ({
      ...s,
      adjustment_count: s.adjustments?.[0]?.count || 0,
      adjustments: undefined // Remove the nested adjustments object
    })) || []

    return NextResponse.json({ data: scenariosWithCount })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  try {
    const body = await request.json()
    const { entity_id, name, description, color } = body

    if (!entity_id || !name) {
      return NextResponse.json(
        { error: 'entity_id and name are required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data: scenario, error } = await supabase
      .from('cashflow_scenarios')
      .insert({
        entity_id,
        name,
        description: description || null,
        color: color || '#6366f1',
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating scenario:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A scenario with this name already exists' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create scenario' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: scenario }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
