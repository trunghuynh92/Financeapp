/**
 * API Route: /api/role-permissions
 * Purpose: Manage custom role permissions per entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET - Get role permissions for an entity
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams
  const entityId = searchParams.get('entity_id')
  const role = searchParams.get('role')

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    // Build query
    let query = supabase
      .from('role_permissions')
      .select('*')
      .eq('entity_id', entityId)

    if (role) {
      query = query.eq('role', role)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching role permissions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Convert snake_case column names to camelCase for frontend
    const camelCaseData = data?.map(row => {
      const converted: any = {}
      Object.entries(row).forEach(([key, value]) => {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        converted[camelKey] = value
      })
      return converted
    })

    return NextResponse.json({ data: camelCaseData })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create or update role permissions
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  try {
    const body = await request.json()
    const { entity_id, role, permissions } = body

    if (!entity_id || !role) {
      return NextResponse.json(
        { error: 'entity_id and role are required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is owner of this entity
    const { data: entityUser, error: roleError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entity_id)
      .eq('user_id', user.id)
      .single()

    if (roleError || !entityUser || entityUser.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can modify role permissions' },
        { status: 403 }
      )
    }

    // Check if permission override already exists
    const { data: existing } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('entity_id', entity_id)
      .eq('role', role)
      .single()

    // Convert camelCase permission keys to snake_case for database
    const dbPermissions: any = {}
    Object.entries(permissions).forEach(([key, value]) => {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      dbPermissions[snakeKey] = value
    })

    const permissionData = {
      entity_id,
      role,
      ...dbPermissions,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('role_permissions')
        .update(permissionData)
        .eq('permission_id', existing.permission_id)
        .select()
        .single()

      if (error) {
        console.error('Error updating role permissions:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data,
        message: 'Role permissions updated successfully'
      })
    } else {
      // Create new
      const { data, error } = await supabase
        .from('role_permissions')
        .insert({
          ...permissionData,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating role permissions:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        data,
        message: 'Role permissions created successfully'
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE - Reset role permissions to default (delete custom override)
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams
  const entityId = searchParams.get('entity_id')
  const role = searchParams.get('role')

  if (!entityId || !role) {
    return NextResponse.json(
      { error: 'entity_id and role are required' },
      { status: 400 }
    )
  }

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is owner of this entity
    const { data: entityUser, error: roleError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .single()

    if (roleError || !entityUser || entityUser.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can reset role permissions' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('entity_id', entityId)
      .eq('role', role)

    if (error) {
      console.error('Error deleting role permissions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Role permissions reset to default successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
