/**
 * Custom React Hook for Role-Based Access Control
 * Provides easy access to user's role and permissions in React components
 */

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
 * Now includes custom permission overrides from the database
 */
export function useUserPermissions(entityId: string | undefined) {
  const { role, isLoading: roleLoading, error: roleError } = useUserRole(entityId)
  const [customPermissions, setCustomPermissions] = useState<any>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  // Load custom permissions from the API
  useEffect(() => {
    async function loadCustomPermissions() {
      if (!entityId || !role) {
        setPermissionsLoading(false)
        setCustomPermissions(null)
        return
      }

      setPermissionsLoading(true)
      try {
        const response = await fetch(`/api/role-permissions?entity_id=${entityId}&role=${role}`)
        if (response.ok) {
          const { data } = await response.json()
          console.log('Custom permissions loaded:', data)
          if (data && data.length > 0) {
            console.log('Setting custom permissions:', data[0])
            setCustomPermissions(data[0])
          } else {
            console.log('No custom permissions found, using defaults')
            setCustomPermissions(null)
          }
        }
      } catch (err) {
        console.error('Error loading custom permissions:', err)
        setCustomPermissions(null)
      } finally {
        setPermissionsLoading(false)
      }
    }

    loadCustomPermissions()
  }, [entityId, role])

  // Get default permissions based on role
  const defaultPermissions = {
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
  }

  // Merge custom permissions with defaults
  const permissions = { ...defaultPermissions }
  if (customPermissions) {
    // Override with custom permissions where they exist (not null)
    Object.keys(defaultPermissions).forEach((key) => {
      if (customPermissions[key] !== null && customPermissions[key] !== undefined) {
        console.log(`Overriding ${key}: ${defaultPermissions[key as keyof typeof defaultPermissions]} -> ${customPermissions[key]}`)
        permissions[key as keyof typeof defaultPermissions] = customPermissions[key]
      }
    })
  }

  const finalPermissions = {
    ...permissions,
    // Utility
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isEditor: role && hasPermission(role, 'editor'),
    isDataEntry: role === 'data_entry',
    isViewer: role === 'viewer',
    isDataEntryOrLower: role && ROLE_HIERARCHY[role] <= ROLE_HIERARCHY.data_entry,
  }

  console.log('Final permissions:', finalPermissions)
  console.log('canViewAccounts:', finalPermissions.canViewAccounts)

  return {
    role,
    permissions: finalPermissions,
    isLoading: roleLoading || permissionsLoading,
    error: roleError,
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
