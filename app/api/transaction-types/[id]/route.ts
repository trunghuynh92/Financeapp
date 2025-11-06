/**
 * API Route: /api/transaction-types/[id]
 * Purpose: Update individual transaction type
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const typeId = parseInt(params.id)
    const body = await request.json()

    const updates: any = {}

    if (body.type_display_name !== undefined) updates.type_display_name = body.type_display_name
    if (body.description !== undefined) updates.description = body.description
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.display_order !== undefined) updates.display_order = body.display_order

    const { data, error } = await supabase
      .from('transaction_types')
      .update(updates)
      .eq('transaction_type_id', typeId)
      .select()
      .single()

    if (error) {
      console.error('Error updating transaction type:', error)
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
