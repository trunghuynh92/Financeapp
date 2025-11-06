/**
 * API Route: /api/branches/[id]
 * Purpose: Update individual branch
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
