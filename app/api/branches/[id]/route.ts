/**
 * API Route: /api/branches/[id]
 * Purpose: Update and delete individual branch
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - Get single branch by ID
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const branchId = parseInt(params.id)

    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('branch_id', branchId)
      .single()

    if (error) {
      console.error('Error fetching branch:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
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
// PATCH - Update branch
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const branchId = parseInt(params.id)
    const body = await request.json()

    const updates: any = {}

    if (body.branch_name !== undefined) updates.branch_name = body.branch_name
    if (body.branch_code !== undefined) updates.branch_code = body.branch_code
    if (body.address !== undefined) updates.address = body.address
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('branch_id', branchId)
      .select()
      .single()

    if (error) {
      console.error('Error updating branch:', error)
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
// DELETE - Soft delete branch (set is_active = false)
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const branchId = parseInt(params.id)

    // Check if branch is used by any transactions
    const { count } = await supabase
      .from('main_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)

    if (count && count > 0) {
      // Soft delete by deactivating
      const { data, error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('branch_id', branchId)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating branch:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data,
        message: `Branch deactivated (used by ${count} transactions)`
      })
    }

    // Hard delete if not used
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('branch_id', branchId)

    if (error) {
      console.error('Error deleting branch:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Branch deleted successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
