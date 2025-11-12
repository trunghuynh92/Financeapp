/**
 * API Route: /api/categories
 * Purpose: List and manage categories with hierarchy
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - List categories with optional filtering
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const transactionTypeId = searchParams.get('transaction_type_id')
    const entityType = searchParams.get('entity_type') // 'business', 'personal', 'both'
    const entityId = searchParams.get('entity_id')
    const activeOnly = searchParams.get('active_only') !== 'false' // default true
    const includeCustom = searchParams.get('include_custom') !== 'false' // default true
    const customOnly = searchParams.get('custom_only') === 'true' // default false

    let query = supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (transactionTypeId) {
      query = query.eq('transaction_type_id', parseInt(transactionTypeId))
    }

    if (entityType) {
      // Show categories that match entity type OR 'both'
      query = query.or(`entity_type.eq.${entityType},entity_type.eq.both`)
    }

    // Handle entity-specific filtering
    if (customOnly) {
      // Only custom categories for this entity
      if (entityId) {
        query = query.eq('entity_id', entityId)
      }
    } else if (includeCustom && entityId) {
      // Both global templates (entity_id IS NULL) AND entity-specific custom
      query = query.or(`entity_id.is.null,entity_id.eq.${entityId}`)
    } else {
      // Only global templates (default behavior for backward compatibility)
      query = query.is('entity_id', null)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching categories:', error)
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
// POST - Create new category
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.category_name || !body.transaction_type_id) {
      return NextResponse.json(
        { error: 'Missing required fields: category_name, transaction_type_id' },
        { status: 400 }
      )
    }

    // If entity_id is provided, this is a custom category
    // If not provided, only allow creation if user is admin (future: add permission check)
    const isCustomCategory = !!body.entity_id

    const { data, error } = await supabase
      .from('categories')
      .insert({
        category_name: body.category_name,
        category_code: body.category_code || null,
        transaction_type_id: body.transaction_type_id,
        entity_type: body.entity_type || 'both',
        cash_flow_type: body.cash_flow_type || null,
        entity_id: body.entity_id || null,  // NULL = global template, NOT NULL = custom
        description: body.description || null,
        parent_category_id: body.parent_category_id || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        display_order: body.display_order || 999,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
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
