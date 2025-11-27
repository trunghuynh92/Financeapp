/**
 * API Route: /api/projects/[id]
 * Purpose: Update and delete individual project
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - Get single project by ID
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const projectId = parseInt(params.id)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error) {
      console.error('Error fetching project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update project
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const projectId = parseInt(params.id)
    const body = await request.json()

    const updates: any = {}

    if (body.project_name !== undefined) updates.project_name = body.project_name
    if (body.project_code !== undefined) updates.project_code = body.project_code
    if (body.description !== undefined) updates.description = body.description
    if (body.start_date !== undefined) updates.start_date = body.start_date
    if (body.end_date !== undefined) updates.end_date = body.end_date
    if (body.status !== undefined) updates.status = body.status
    if (body.budget_amount !== undefined) updates.budget_amount = body.budget_amount
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Smart delete project (soft delete if used, hard delete if unused)
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const projectId = parseInt(params.id)

    // Check if project is used by any transactions
    const { count } = await supabase
      .from('main_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (count && count > 0) {
      // Soft delete by deactivating
      const { data, error } = await supabase
        .from('projects')
        .update({ is_active: false })
        .eq('project_id', projectId)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating project:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data,
        message: `Project deactivated (used by ${count} transactions)`
      })
    }

    // Hard delete if not used
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('project_id', projectId)

    if (error) {
      console.error('Error deleting project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Project deleted successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
