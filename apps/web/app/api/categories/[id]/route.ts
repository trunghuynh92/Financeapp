/**
 * API Route: /api/categories/[id]
 * Purpose: Update and delete individual category (custom categories only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - Get single category by ID
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const categoryId = parseInt(params.id)

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('category_id', categoryId)
      .single()

    if (error) {
      console.error('Error fetching category:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
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
// PATCH - Update category (custom categories only, protect templates)
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const categoryId = parseInt(params.id)
    const body = await request.json()

    // First, check if this is a custom category (entity_id NOT NULL)
    const { data: existing } = await supabase
      .from('categories')
      .select('entity_id')
      .eq('category_id', categoryId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (!existing.entity_id) {
      return NextResponse.json({
        error: 'Cannot modify global template categories. Create a custom category instead.'
      }, { status: 403 })
    }

    const updates: any = {}

    if (body.category_name !== undefined) updates.category_name = body.category_name
    if (body.category_code !== undefined) updates.category_code = body.category_code
    if (body.description !== undefined) updates.description = body.description
    if (body.cash_flow_type !== undefined) updates.cash_flow_type = body.cash_flow_type
    if (body.parent_category_id !== undefined) updates.parent_category_id = body.parent_category_id
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.display_order !== undefined) updates.display_order = body.display_order
    // Note: entity_id, transaction_type_id, entity_type cannot be changed after creation

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('category_id', categoryId)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
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
// DELETE - Delete category (custom categories only, protect templates)
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const categoryId = parseInt(params.id)

    // First, check if this is a custom category (entity_id NOT NULL)
    const { data: existing } = await supabase
      .from('categories')
      .select('entity_id')
      .eq('category_id', categoryId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (!existing.entity_id) {
      return NextResponse.json({
        error: 'Cannot delete global template categories'
      }, { status: 403 })
    }

    // Check if category is used by any transactions
    const { count } = await supabase
      .from('main_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)

    if (count && count > 0) {
      // Soft delete by deactivating instead of hard delete
      const { data, error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('category_id', categoryId)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating category:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data,
        message: `Category deactivated (used by ${count} transactions)`
      })
    }

    // Hard delete if not used
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('category_id', categoryId)

    if (error) {
      console.error('Error deleting category:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
