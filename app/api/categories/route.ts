/**
 * API Route: /api/categories
 * Purpose: List and manage categories with hierarchy
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==============================================================================
// GET - List categories with optional filtering
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const transactionTypeId = searchParams.get('transaction_type_id')
    const entityType = searchParams.get('entity_type') // 'business', 'personal', 'both'
    const activeOnly = searchParams.get('active_only') !== 'false' // default true

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
    const body = await request.json()

    const { data, error } = await supabase
      .from('categories')
      .insert({
        category_name: body.category_name,
        category_code: body.category_code || null,
        transaction_type_id: body.transaction_type_id,
        entity_type: body.entity_type || 'both',
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

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
