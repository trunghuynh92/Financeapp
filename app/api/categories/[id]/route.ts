/**
 * API Route: /api/categories/[id]
 * Purpose: Update individual category
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const categoryId = parseInt(params.id)
    const body = await request.json()

    const updates: any = {}

    if (body.category_name !== undefined) updates.category_name = body.category_name
    if (body.category_code !== undefined) updates.category_code = body.category_code
    if (body.description !== undefined) updates.description = body.description
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.display_order !== undefined) updates.display_order = body.display_order

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
