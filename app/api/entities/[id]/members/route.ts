/**
 * API Route: /api/entities/[id]/members
 * Manage team members for an entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/entities/[id]/members
 * Get all members of an entity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const entityId = params.id

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has access to this entity
    const { data: userMembership, error: membershipError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !userMembership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch all members using SECURITY DEFINER function to bypass RLS
    const { data: members, error } = await supabase
      .rpc('get_entity_members', { p_entity_id: entityId })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    // Fetch user details for each member
    const userIds = members.map(m => m.user_id)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url')
      .in('id', userIds)

    if (usersError) {
      console.error('Error fetching user details:', usersError)
    }

    // Combine member and user data
    const membersWithDetails = members.map(member => {
      const userDetails = users?.find(u => u.id === member.user_id)
      return {
        ...member,
        email: userDetails?.email || 'Unknown',
        full_name: userDetails?.full_name || null,
        avatar_url: userDetails?.avatar_url || null,
      }
    })

    return NextResponse.json({
      data: membersWithDetails,
      userRole: userMembership.role,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/entities/[id]/members
 * Invite a new member to the entity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const entityId = params.id
    const body = await request.json()
    const { email, role } = body

    // Validate input
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    const validRoles = ['owner', 'admin', 'editor', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
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

    // Check if current user is owner or admin
    const { data: userMembership, error: membershipError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !userMembership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    if (!['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can invite members' },
        { status: 403 }
      )
    }

    // Only owners can assign owner or admin roles
    if (['owner', 'admin'].includes(role) && userMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can assign owner or admin roles' },
        { status: 403 }
      )
    }

    // Find user by email
    const { data: invitedUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !invitedUser) {
      return NextResponse.json(
        { error: 'User not found. The user must have an account first.' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const { data: existingMember, error: checkError } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', entityId)
      .eq('user_id', invitedUser.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this entity' },
        { status: 409 }
      )
    }

    // Add user as member using SECURITY DEFINER function to bypass RLS
    const { data: newMember, error: insertError } = await supabase
      .rpc('add_entity_member', {
        p_entity_id: entityId,
        p_user_id: invitedUser.id,
        p_role: role,
        p_created_by_user_id: user.id,
      })
      .single()

    if (insertError) {
      console.error('Error adding member:', insertError)
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      )
    }

    // Fetch user details
    const { data: userDetails } = await supabase
      .from('users')
      .select('email, full_name, avatar_url')
      .eq('id', invitedUser.id)
      .single()

    return NextResponse.json({
      data: {
        ...newMember,
        email: userDetails?.email || email,
        full_name: userDetails?.full_name || null,
        avatar_url: userDetails?.avatar_url || null,
      },
      message: 'Member added successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
