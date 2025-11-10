/**
 * API Route: /api/entities/[id]/members/[memberId]
 * Update or remove a specific team member
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * PATCH /api/entities/[id]/members/[memberId]
 * Update a member's role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const entityId = params.id
    const memberId = parseInt(params.memberId, 10)
    const body = await request.json()
    const { role } = body

    // Validate input
    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
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
        { error: 'Only owners and admins can change member roles' },
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

    // Get the member being updated
    const { data: member, error: memberError } = await supabase
      .from('entity_users')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('entity_id', entityId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent users from changing their own role
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 403 }
      )
    }

    // Admins cannot change owner roles
    if (member.role === 'owner' && userMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change owner roles' },
        { status: 403 }
      )
    }

    // Update the member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from('entity_users')
      .update({ role })
      .eq('id', memberId)
      .eq('entity_id', entityId)
      .select(`
        id,
        role,
        created_at,
        user_id
      `)
      .single()

    if (updateError) {
      console.error('Error updating member:', updateError)
      return NextResponse.json(
        { error: 'Failed to update member role' },
        { status: 500 }
      )
    }

    // Fetch user details
    const { data: userDetails } = await supabase
      .from('users')
      .select('email, full_name, avatar_url')
      .eq('id', member.user_id)
      .single()

    return NextResponse.json({
      data: {
        ...updatedMember,
        email: userDetails?.email || 'Unknown',
        full_name: userDetails?.full_name || null,
        avatar_url: userDetails?.avatar_url || null,
      },
      message: 'Member role updated successfully',
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
 * DELETE /api/entities/[id]/members/[memberId]
 * Remove a member from the entity
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const entityId = params.id
    const memberId = parseInt(params.memberId, 10)

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
        { error: 'Only owners and admins can remove members' },
        { status: 403 }
      )
    }

    // Get the member being removed
    const { data: member, error: memberError } = await supabase
      .from('entity_users')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('entity_id', entityId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent users from removing themselves
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself. Transfer ownership first or contact another admin.' },
        { status: 403 }
      )
    }

    // Admins cannot remove owners
    if (member.role === 'owner' && userMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can remove other owners' },
        { status: 403 }
      )
    }

    // Count total owners
    const { data: owners, error: ownersError } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', entityId)
      .eq('role', 'owner')

    if (ownersError) {
      console.error('Error counting owners:', ownersError)
    }

    // Prevent removing the last owner
    if (member.role === 'owner' && owners && owners.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last owner. Transfer ownership to another member first.' },
        { status: 403 }
      )
    }

    // Remove the member
    const { error: deleteError } = await supabase
      .from('entity_users')
      .delete()
      .eq('id', memberId)
      .eq('entity_id', entityId)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
