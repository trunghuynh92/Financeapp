/**
 * API Route: /api/projects
 * Purpose: List and manage projects
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - List projects with optional filtering
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const status = searchParams.get('status')
    const activeOnly = searchParams.get('active_only') !== 'false' // default true

    let query = supabase
      .from('projects')
      .select('*')
      .order('project_name', { ascending: true })

    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create new project
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.entity_id || !body.project_name) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, project_name' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        entity_id: body.entity_id,
        project_name: body.project_name,
        project_code: body.project_code || null,
        description: body.description || null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        status: body.status || 'active',
        budget_amount: body.budget_amount || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
