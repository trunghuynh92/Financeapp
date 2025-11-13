/**
 * API Route: /api/entities
 * Purpose: Get all entities the user has access to
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all entities the user is a member of
    const { data: memberships, error: membershipsError } = await supabase
      .from('entity_users')
      .select(`
        entity_id,
        role,
        entities:entity_id (
          id,
          name,
          type,
          description
        )
      `)
      .eq('user_id', user.id)

    if (membershipsError) {
      console.error('Error fetching entity memberships:', membershipsError)
      return NextResponse.json(
        { error: membershipsError.message },
        { status: 500 }
      )
    }

    // Extract and flatten entity data
    const entities = memberships
      ?.map((m: any) => m.entities)
      .filter((e: any) => e !== null)
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) || []

    return NextResponse.json({
      data: entities,
      count: entities.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
