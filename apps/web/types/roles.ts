/**
 * Role-Based Access Control Types
 * Defines user roles and their permissions across the system
 */

export type UserRole = 'owner' | 'admin' | 'editor' | 'data_entry' | 'viewer'

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  data_entry: 2,
  viewer: 1,
}

/**
 * Check if a user role has at least the required permission level
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Route permission requirements
 * Routes not listed here are accessible to all authenticated users
 */
export const ROUTE_PERMISSIONS: Record<string, UserRole> = {
  // Reports & Analytics - Restricted from data_entry
  '/dashboard/cash-flow': 'editor',
  '/dashboard/reports': 'editor',
  '/dashboard/analytics': 'editor',

  // Account Management - Admin only
  '/dashboard/accounts/new': 'admin',
  '/dashboard/settings/accounts': 'admin',

  // User Management - Owner only
  '/dashboard/settings/users': 'owner',
  '/dashboard/settings/team': 'owner',
}

/**
 * API endpoint permission requirements
 */
export const API_PERMISSIONS: Record<string, UserRole> = {
  // Cash Flow & Projections
  '/api/cash-flow-projection': 'editor',

  // Reports
  '/api/reports': 'editor',
  '/api/reports/income-statement': 'editor',
  '/api/reports/balance-sheet': 'editor',

  // Analytics
  '/api/analytics': 'editor',

  // Account Management
  '/api/accounts/create': 'admin',
  '/api/accounts/delete': 'admin',

  // User Management
  '/api/users/invite': 'owner',
  '/api/users/remove': 'owner',
  '/api/users/change-role': 'owner',
}

/**
 * Feature flags based on role
 */
export interface RolePermissions {
  // Transaction Management
  canViewTransactions: boolean
  canCreateTransactions: boolean
  canEditTransactions: boolean
  canDeleteTransactions: boolean
  canCategorizeTransactions: boolean
  canSplitTransactions: boolean
  canAddNotes: boolean
  canImportTransactions: boolean

  // Reports & Analytics
  canViewReports: boolean
  canViewCashFlow: boolean
  canViewAnalytics: boolean
  canExportData: boolean

  // Account Management
  canViewAccounts: boolean
  canCreateAccounts: boolean
  canEditAccounts: boolean
  canDeleteAccounts: boolean

  // User Management
  canViewTeam: boolean
  canInviteUsers: boolean
  canRemoveUsers: boolean
  canChangeRoles: boolean

  // Settings
  canManageCategories: boolean
  canManageSettings: boolean
}

/**
 * Get permissions for a given role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  const roleLevel = ROLE_HIERARCHY[role]

  return {
    // Transaction Management
    canViewTransactions: roleLevel >= ROLE_HIERARCHY.viewer,
    canCreateTransactions: roleLevel >= ROLE_HIERARCHY.data_entry,
    canEditTransactions: roleLevel >= ROLE_HIERARCHY.data_entry,
    canDeleteTransactions: roleLevel >= ROLE_HIERARCHY.editor,
    canCategorizeTransactions: roleLevel >= ROLE_HIERARCHY.data_entry,
    canSplitTransactions: roleLevel >= ROLE_HIERARCHY.data_entry,
    canAddNotes: roleLevel >= ROLE_HIERARCHY.data_entry,
    canImportTransactions: roleLevel >= ROLE_HIERARCHY.data_entry,

    // Reports & Analytics
    canViewReports: roleLevel >= ROLE_HIERARCHY.editor,
    canViewCashFlow: roleLevel >= ROLE_HIERARCHY.editor,
    canViewAnalytics: roleLevel >= ROLE_HIERARCHY.editor,
    canExportData: roleLevel >= ROLE_HIERARCHY.editor,

    // Account Management
    canViewAccounts: roleLevel >= ROLE_HIERARCHY.viewer,
    canCreateAccounts: roleLevel >= ROLE_HIERARCHY.admin,
    canEditAccounts: roleLevel >= ROLE_HIERARCHY.admin,
    canDeleteAccounts: roleLevel >= ROLE_HIERARCHY.owner,

    // User Management
    canViewTeam: roleLevel >= ROLE_HIERARCHY.admin,
    canInviteUsers: roleLevel >= ROLE_HIERARCHY.owner,
    canRemoveUsers: roleLevel >= ROLE_HIERARCHY.owner,
    canChangeRoles: roleLevel >= ROLE_HIERARCHY.owner,

    // Settings
    canManageCategories: roleLevel >= ROLE_HIERARCHY.admin,
    canManageSettings: roleLevel >= ROLE_HIERARCHY.admin,
  }
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    data_entry: 'Data Entry',
    viewer: 'Viewer',
  }
  return names[role]
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    owner: 'Full access including user management',
    admin: 'Manage accounts and settings, no user management',
    editor: 'Full transaction access and reports',
    data_entry: 'Can manage transactions but no reports/analytics access',
    viewer: 'Read-only access to transactions and accounts',
  }
  return descriptions[role]
}

/**
 * Get role color for UI display
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'purple',
    admin: 'blue',
    editor: 'green',
    data_entry: 'yellow',
    viewer: 'gray',
  }
  return colors[role]
}
