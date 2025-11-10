/**
 * Permission Helper Functions
 * Centralized role-based access control
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

/**
 * Get user's role for a specific entity
 */
export async function getUserEntityRole(
  supabase: SupabaseClient,
  userId: string,
  entityId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('entity_users')
    .select('role')
    .eq('entity_id', entityId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data.role as UserRole
}

/**
 * Get entity_id for an account
 */
export async function getAccountEntityId(
  supabase: SupabaseClient,
  accountId: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('entity_id')
    .eq('account_id', accountId)
    .single()

  if (error || !data) {
    return null
  }

  return data.entity_id
}

/**
 * Check if user can write (create/edit/delete) for an entity
 * Only owner, admin, and editor can write. Viewer is read-only.
 */
export function canWrite(role: UserRole | null): boolean {
  if (!role) return false
  return ['owner', 'admin', 'editor'].includes(role)
}

/**
 * Check if user can manage team members
 * Only owner and admin can manage team members
 */
export function canManageTeam(role: UserRole | null): boolean {
  if (!role) return false
  return ['owner', 'admin'].includes(role)
}

/**
 * Check if user can delete entity
 * Only owner can delete entity
 */
export function canDeleteEntity(role: UserRole | null): boolean {
  if (!role) return false
  return role === 'owner'
}

/**
 * Verify user has write permissions for a given account
 * Returns the entity_id if permitted, throws error if not
 */
export async function verifyWritePermission(
  supabase: SupabaseClient,
  userId: string,
  accountId: number
): Promise<string> {
  // Get entity_id for the account
  const entityId = await getAccountEntityId(supabase, accountId)
  if (!entityId) {
    throw new Error('Account not found or access denied')
  }

  // Get user's role for the entity
  const role = await getUserEntityRole(supabase, userId, entityId)
  if (!canWrite(role)) {
    throw new Error('Insufficient permissions. Viewers cannot modify data.')
  }

  return entityId
}
