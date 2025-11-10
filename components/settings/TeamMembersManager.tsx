"use client"

import { useState, useEffect } from "react"
import { useEntity } from "@/contexts/EntityContext"
import { UserPlus, Trash2, Loader2, Shield, Crown, Edit3, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

type Member = {
  id: number
  user_id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

const ROLE_CONFIG = {
  owner: {
    label: 'Owner',
    icon: Crown,
    color: 'bg-purple-100 text-purple-800',
    description: 'Full access including member management and deletion',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800',
    description: 'Can manage members and all data',
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    color: 'bg-green-100 text-green-800',
    description: 'Can create and edit data',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'bg-gray-100 text-gray-800',
    description: 'Read-only access',
  },
}

export function TeamMembersManager() {
  const { currentEntity } = useEntity()
  const [members, setMembers] = useState<Member[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer")
  const [newRole, setNewRole] = useState<UserRole>("viewer")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentEntity) {
      fetchMembers()
    }
  }, [currentEntity?.id])

  async function fetchMembers() {
    if (!currentEntity) return

    try {
      setLoading(true)
      const response = await fetch(`/api/entities/${currentEntity.id}/members`)

      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await response.json()
      setMembers(data.data || [])
      setUserRole(data.userRole || null)
    } catch (error) {
      console.error("Error fetching members:", error)
      alert("Failed to load team members")
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!currentEntity) return

    try {
      setSubmitting(true)
      const response = await fetch(`/api/entities/${currentEntity.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member")
      }

      alert(data.message || "Member invited successfully")
      setIsInviteDialogOpen(false)
      setInviteEmail("")
      setInviteRole("viewer")
      await fetchMembers()
    } catch (error: any) {
      console.error("Error inviting member:", error)
      alert(error.message || "Failed to invite member")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange() {
    if (!currentEntity || !selectedMember) return

    try {
      setSubmitting(true)
      const response = await fetch(
        `/api/entities/${currentEntity.id}/members/${selectedMember.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role")
      }

      alert(data.message || "Role updated successfully")
      setIsRoleDialogOpen(false)
      setSelectedMember(null)
      await fetchMembers()
    } catch (error: any) {
      console.error("Error updating role:", error)
      alert(error.message || "Failed to update role")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    if (!currentEntity || !selectedMember) return

    try {
      setSubmitting(true)
      const response = await fetch(
        `/api/entities/${currentEntity.id}/members/${selectedMember.id}`,
        {
          method: "DELETE",
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove member")
      }

      alert(data.message || "Member removed successfully")
      setIsRemoveDialogOpen(false)
      setSelectedMember(null)
      await fetchMembers()
    } catch (error: any) {
      console.error("Error removing member:", error)
      alert(error.message || "Failed to remove member")
    } finally {
      setSubmitting(false)
    }
  }

  function openRoleDialog(member: Member) {
    setSelectedMember(member)
    setNewRole(member.role)
    setIsRoleDialogOpen(true)
  }

  function openRemoveDialog(member: Member) {
    setSelectedMember(member)
    setIsRemoveDialogOpen(true)
  }

  const canManageMembers = userRole === 'owner' || userRole === 'admin'

  if (!currentEntity) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Please select an entity to manage team members
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage team access and roles for {currentEntity.name}
            </CardDescription>
          </div>
          {canManageMembers && (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No team members found</p>
            <p className="text-sm text-muted-foreground">
              Invite team members to collaborate
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const roleConfig = ROLE_CONFIG[member.role]
                  const RoleIcon = roleConfig.icon
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name || "—"}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={roleConfig.color}
                        >
                          <RoleIcon className="mr-1 h-3 w-3" />
                          {roleConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      {canManageMembers && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRoleDialog(member)}
                            >
                              Change Role
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRemoveDialog(member)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Role Descriptions */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Role Permissions</h4>
              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon
                  return (
                    <div key={key} className="flex items-start gap-2 text-sm">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{config.label}:</span>{" "}
                        <span className="text-muted-foreground">
                          {config.description}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to {currentEntity.name}. They must have an existing
              account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value: UserRole) => setInviteRole(value)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.label}
                        <span className="text-xs text-muted-foreground">
                          - {config.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={submitting || !inviteEmail}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                "Invite Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select
                value={newRole}
                onValueChange={(value: UserRole) => setNewRole(value)}
              >
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.label}
                        <span className="text-xs text-muted-foreground">
                          - {config.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRoleDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={submitting || newRole === selectedMember?.role}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember?.email} from{" "}
              {currentEntity.name}? They will lose all access to this entity's
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
