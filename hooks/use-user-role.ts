/**
 * Custom React Hook for Role-Based Access Control
 * Provides easy access to user's role and permissions in React components
 */

'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { UserRole } from '@/lib/permissions'
import { hasPermission, ROLE_HIERARCHY, canAccessReports } from '@/lib/permissions'

interface UserRoleData {
  role: UserRole | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to get user's role for a specific entity
 */
export function useUserRole(entityId: string | undefined): UserRoleData {
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchRole() {
      if (!entityId) {
        setIsLoading(false)
        return
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setRole(null)
          setIsLoading(false)
          return
        }

        const { data, error: fetchError } = await supabase
          .from('entity_users')
          .select('role')
          .eq('entity_id', entityId)
          .eq('user_id', user.id)
          .single()

        if (fetchError) throw fetchError

        setRole(data?.role as UserRole || null)
      } catch (err) {
        console.error('Error fetching user role:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRole()
  }, [entityId, supabase])

  return { role, isLoading, error }
}

/**
 * Hook to get user's permissions for a specific entity
 */
export function useUserPermissions(entityId: string | undefined) {
  const { role, isLoading, error } = useUserRole(entityId)

  const permissions = {
    // Transaction Management
    canViewTransactions: role !== null,
    canCreateTransactions: role ? hasPermission(role, 'data_entry') : false,
    canEditTransactions: role ? hasPermission(role, 'data_entry') : false,
    canDeleteTransactions: role ? hasPermission(role, 'editor') : false,
    canCategorizeTransactions: role ? hasPermission(role, 'data_entry') : false,
    canSplitTransactions: role ? hasPermission(role, 'data_entry') : false,
    canAddNotes: role ? hasPermission(role, 'data_entry') : false,
    canImportTransactions: role ? hasPermission(role, 'data_entry') : false,

    // Reports & Analytics
    canViewReports: role ? canAccessReports(role) : false,
    canViewCashFlow: role ? canAccessReports(role) : false,
    canViewAnalytics: role ? canAccessReports(role) : false,
    canExportData: role ? hasPermission(role, 'editor') : false,

    // Account Management
    canViewAccounts: role !== null,
    canCreateAccounts: role ? hasPermission(role, 'admin') : false,
    canEditAccounts: role ? hasPermission(role, 'admin') : false,
    canDeleteAccounts: role ? hasPermission(role, 'owner') : false,

    // User Management
    canViewTeam: role ? hasPermission(role, 'admin') : false,
    canInviteUsers: role === 'owner',
    canRemoveUsers: role === 'owner',
    canChangeRoles: role === 'owner',

    // Settings
    canManageCategories: role ? hasPermission(role, 'admin') : false,
    canManageSettings: role ? hasPermission(role, 'admin') : false,

    // Utility
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isEditor: role && hasPermission(role, 'editor'),
    isDataEntry: role === 'data_entry',
    isViewer: role === 'viewer',
    isDataEntryOrLower: role && ROLE_HIERARCHY[role] <= ROLE_HIERARCHY.data_entry,
  }

  return {
    role,
    permissions,
    isLoading,
    error,
  }
}

/**
 * Hook to check if user can access a specific route
 */
export function useRouteAccess(entityId: string | undefined, requiredRole: UserRole) {
  const { role, isLoading } = useUserRole(entityId)

  const canAccess = role ? hasPermission(role, requiredRole) : false

  return { canAccess, isLoading, role }
}
