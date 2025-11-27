"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useEntity } from "@/contexts/EntityContext"
import { useUserRole } from "@/hooks/use-user-role"
import {
  UserRole,
  getRoleDisplayName,
  getRoleDescription,
  getRoleColor,
  getRolePermissions,
  RolePermissions
} from "@/types/roles"
import { Shield, Check, X, Save, RotateCcw, Loader2, AlertTriangle, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react"

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'editor', 'data_entry', 'viewer']

interface PermissionCategory {
  name: string
  description: string
  permissions: {
    key: keyof RolePermissions
    label: string
    description: string
  }[]
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: "Transactions",
    description: "Manage transaction data",
    permissions: [
      { key: "canViewTransactions", label: "View", description: "View transaction list and details" },
      { key: "canCreateTransactions", label: "Create", description: "Create new transactions manually" },
      { key: "canEditTransactions", label: "Edit", description: "Edit transaction details and categorization" },
      { key: "canDeleteTransactions", label: "Delete", description: "Delete transactions" },
      { key: "canCategorizeTransactions", label: "Categorize", description: "Assign categories to transactions" },
      { key: "canSplitTransactions", label: "Split", description: "Split transactions into multiple parts" },
      { key: "canAddNotes", label: "Add Notes", description: "Add notes to transactions" },
      { key: "canImportTransactions", label: "Import", description: "Import transactions from files" },
    ]
  },
  {
    name: "Reports & Analytics",
    description: "Access reports and financial analytics",
    permissions: [
      { key: "canViewReports", label: "View Reports", description: "Access financial reports" },
      { key: "canViewCashFlow", label: "Cash Flow", description: "View cash flow projections" },
      { key: "canViewAnalytics", label: "Analytics", description: "Access analytics dashboard" },
      { key: "canExportData", label: "Export", description: "Export data to files" },
    ]
  },
  {
    name: "Accounts",
    description: "Manage bank accounts and financial accounts",
    permissions: [
      { key: "canViewAccounts", label: "View", description: "View account list and balances" },
      { key: "canCreateAccounts", label: "Create", description: "Create new accounts" },
      { key: "canEditAccounts", label: "Edit", description: "Edit account details" },
      { key: "canDeleteAccounts", label: "Delete", description: "Delete accounts" },
    ]
  },
  {
    name: "Team Management",
    description: "Manage team members and permissions",
    permissions: [
      { key: "canViewTeam", label: "View Team", description: "View team members list" },
      { key: "canInviteUsers", label: "Invite Users", description: "Invite new team members" },
      { key: "canRemoveUsers", label: "Remove Users", description: "Remove team members" },
      { key: "canChangeRoles", label: "Change Roles", description: "Change team member roles" },
    ]
  },
  {
    name: "Settings",
    description: "Manage system settings and configurations",
    permissions: [
      { key: "canManageCategories", label: "Categories", description: "Manage transaction categories" },
      { key: "canManageSettings", label: "Settings", description: "Manage system settings" },
    ]
  },
]

export function RolePermissionsManager() {
  const { currentEntity } = useEntity()
  const { role: userRole } = useUserRole(currentEntity?.id)
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer')
  const [customPermissions, setCustomPermissions] = useState<Partial<RolePermissions>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const isOwner = userRole === 'owner'
  const defaultPermissions = getRolePermissions(selectedRole)

  // Merge default permissions with custom overrides
  const rolePermissions = { ...defaultPermissions, ...customPermissions }

  // Load custom permissions for selected role
  useEffect(() => {
    if (currentEntity && selectedRole) {
      loadCustomPermissions()
    }
  }, [currentEntity, selectedRole])

  async function loadCustomPermissions() {
    if (!currentEntity) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/role-permissions?entity_id=${currentEntity.id}&role=${selectedRole}`
      )

      if (response.ok) {
        const { data } = await response.json()
        if (data && data.length > 0) {
          const perms = data[0]
          // Extract only the permission fields (not metadata)
          const customPerms: Partial<RolePermissions> = {}
          Object.keys(defaultPermissions).forEach((key) => {
            if (perms[key] !== null && perms[key] !== undefined) {
              customPerms[key as keyof RolePermissions] = perms[key]
            }
          })
          setCustomPermissions(customPerms)
        } else {
          setCustomPermissions({})
        }
      }
      setHasChanges(false)
    } catch (error) {
      console.error('Error loading custom permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function savePermissions() {
    if (!currentEntity) return

    setSaving(true)
    try {
      const response = await fetch('/api/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: currentEntity.id,
          role: selectedRole,
          permissions: customPermissions
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save permissions')
      }

      setHasChanges(false)
      alert('Permissions saved successfully!')
    } catch (error) {
      console.error('Error saving permissions:', error)
      alert('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefault() {
    if (!currentEntity) return
    if (!confirm('Reset all permissions for this role to default values?')) return

    setSaving(true)
    try {
      const response = await fetch(
        `/api/role-permissions?entity_id=${currentEntity.id}&role=${selectedRole}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to reset permissions')
      }

      setCustomPermissions({})
      setHasChanges(false)
      alert('Permissions reset to default successfully!')
    } catch (error) {
      console.error('Error resetting permissions:', error)
      alert('Failed to reset permissions')
    } finally {
      setSaving(false)
    }
  }

  function togglePermission(key: keyof RolePermissions) {
    if (!isOwner) return

    const currentValue = rolePermissions[key]
    setCustomPermissions({
      ...customPermissions,
      [key]: !currentValue
    })
    setHasChanges(true)
  }

  function toggleCategory(categoryName: string) {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  function expandAll() {
    setExpandedCategories(new Set(PERMISSION_CATEGORIES.map(c => c.name)))
  }

  function collapseAll() {
    setExpandedCategories(new Set())
  }

  const getRoleBadgeVariant = (role: UserRole) => {
    const color = getRoleColor(role)
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      purple: "default",
      blue: "default",
      green: "default",
      yellow: "secondary",
      gray: "outline",
    }
    return variants[color] || "default"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Permissions Matrix
                {currentEntity && (
                  <Badge variant="outline" className="ml-2">
                    {currentEntity.name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {isOwner
                  ? 'Customize permissions for each role. Changes apply to all users with this role in your entity.'
                  : 'View permissions for each role. Only owners can modify role permissions.'}
              </CardDescription>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={resetToDefault}
                  disabled={saving || Object.keys(customPermissions).length === 0}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reset to Default
                </Button>
                <Button
                  onClick={savePermissions}
                  disabled={!hasChanges || saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Not Owner Warning */}
      {!isOwner && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardHeader>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <CardTitle className="text-base text-yellow-900 dark:text-yellow-100">
                  View Only Mode
                </CardTitle>
                <CardDescription className="text-yellow-700 dark:text-yellow-300">
                  You need to be an Owner to modify role permissions. Contact your entity owner if you need to change permissions.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Role Selector */}
      <div className="flex gap-2 flex-wrap">
        {ALL_ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
              selectedRole === role
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{getRoleDisplayName(role)}</span>
              <Badge variant={getRoleBadgeVariant(role)} className="text-xs">
                {role}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      {/* Expand/Collapse Controls */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={expandAll}
        >
          <ChevronsDownUp className="h-4 w-4 mr-2" />
          Expand All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={collapseAll}
        >
          <ChevronsUpDown className="h-4 w-4 mr-2" />
          Collapse All
        </Button>
      </div>

      {/* Selected Role Info */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getRoleDisplayName(selectedRole)}
                <Badge variant={getRoleBadgeVariant(selectedRole)}>
                  {selectedRole}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {getRoleDescription(selectedRole)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Permissions by Category */}
      <div className="grid gap-4">
        {PERMISSION_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.name)

          return (
            <Card key={category.name}>
              <Collapsible
                open={isExpanded}
                onOpenChange={() => toggleCategory(category.name)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid gap-3">
                      {category.permissions.map((permission) => {
                        const hasPermission = rolePermissions[permission.key]
                        const isCustomized = customPermissions.hasOwnProperty(permission.key)

                        return (
                          <div
                            key={permission.key}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              hasPermission
                                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                                : 'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {!isOwner && (
                                  hasPermission ? (
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <X className="h-4 w-4 text-gray-400" />
                                  )
                                )}
                                <span className="font-medium">{permission.label}</span>
                                {isCustomized && (
                                  <Badge variant="outline" className="text-xs">Custom</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground ml-6">
                                {permission.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOwner ? (
                                <Switch
                                  checked={hasPermission}
                                  onCheckedChange={() => togglePermission(permission.key)}
                                  disabled={loading}
                                />
                              ) : (
                                <Badge variant={hasPermission ? "default" : "secondary"}>
                                  {hasPermission ? "Allowed" : "Denied"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {/* Comparison View */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Comparison</CardTitle>
          <CardDescription>
            See which roles have which permissions at a glance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Permission</th>
                  {ALL_ROLES.map((role) => (
                    <th key={role} className="text-center p-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">{getRoleDisplayName(role)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATEGORIES.map((category) => (
                  <tr key={category.name} className="border-b">
                    <td colSpan={ALL_ROLES.length + 1} className="p-2 bg-muted font-semibold">
                      {category.name}
                    </td>
                  </tr>
                )).concat(
                  PERMISSION_CATEGORIES.flatMap((category) =>
                    category.permissions.map((permission) => (
                      <tr key={permission.key} className="border-b hover:bg-muted/50">
                        <td className="p-2 text-sm">{permission.label}</td>
                        {ALL_ROLES.map((role) => {
                          const perms = getRolePermissions(role)
                          const hasPermission = perms[permission.key]
                          return (
                            <td key={role} className="text-center p-2">
                              {hasPermission ? (
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-gray-300 mx-auto" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
