"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"

export function BranchesManager() {
  const { currentEntity } = useEntity()
  const [branches, setBranches] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState<any>(null)
  const [newBranch, setNewBranch] = useState({
    entity_id: "",
    branch_name: "",
    branch_code: "",
    address: "",
    phone: "",
  })

  useEffect(() => {
    if (currentEntity) {
      fetchData()
    }
  }, [currentEntity])

  const fetchData = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const [branchesRes, entitiesRes] = await Promise.all([
        fetch(`/api/branches?entity_id=${currentEntity.id}&active_only=false`),
        fetch('/api/entities'),
      ])

      if (branchesRes.ok) {
        const data = await branchesRes.json()
        setBranches(data.data || [])
      }

      if (entitiesRes.ok) {
        const data = await entitiesRes.json()
        setEntities(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (branchId: number, field: string, value: any) => {
    try {
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) throw new Error('Failed to update')

      setBranches(prev => prev.map(b =>
        b.branch_id === branchId ? { ...b, [field]: value } : b
      ))
    } catch (error) {
      console.error('Error updating branch:', error)
      alert('Failed to update branch')
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranch),
      })

      if (!response.ok) throw new Error('Failed to create')

      await fetchData()
      setDialogOpen(false)
      setNewBranch({
        entity_id: currentEntity?.id || "",
        branch_name: "",
        branch_code: "",
        address: "",
        phone: "",
      })
    } catch (error) {
      console.error('Error creating branch:', error)
      alert('Failed to create branch')
    }
  }

  // Pre-fill entity_id when opening the dialog
  const handleOpenDialog = () => {
    setNewBranch({
      entity_id: currentEntity?.id || "",
      branch_name: "",
      branch_code: "",
      address: "",
      phone: "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!branchToDelete) return

    try {
      const response = await fetch(`/api/branches/${branchToDelete.branch_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')

      const result = await response.json()
      await fetchData()
      setDeleteDialogOpen(false)
      setBranchToDelete(null)

      // Show message if it was soft-deleted
      if (result.message) {
        alert(result.message)
      }
    } catch (error) {
      console.error('Error deleting branch:', error)
      alert('Failed to delete branch')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branches / Stores</CardTitle>
              <CardDescription>
                Manage branch locations for your entities. Click on any field to edit.
              </CardDescription>
            </div>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Entity</th>
                <th className="text-left py-3 px-4">Branch Name</th>
                <th className="text-left py-3 px-4">Branch Code</th>
                <th className="text-left py-3 px-4">Address</th>
                <th className="text-left py-3 px-4">Phone</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const entity = entities.find(e => e.id === branch.entity_id)
                return (
                  <tr key={branch.branch_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      {entity?.name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={branch.branch_name || ""}
                        onChange={(e) => {
                          setBranches(prev => prev.map(b =>
                            b.branch_id === branch.branch_id ? { ...b, branch_name: e.target.value } : b
                          ))
                        }}
                        onBlur={() => handleUpdate(branch.branch_id, 'branch_name', branch.branch_name)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={branch.branch_code || ""}
                        onChange={(e) => {
                          setBranches(prev => prev.map(b =>
                            b.branch_id === branch.branch_id ? { ...b, branch_code: e.target.value } : b
                          ))
                        }}
                        onBlur={() => handleUpdate(branch.branch_id, 'branch_code', branch.branch_code)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={branch.address || ""}
                        onChange={(e) => {
                          setBranches(prev => prev.map(b =>
                            b.branch_id === branch.branch_id ? { ...b, address: e.target.value } : b
                          ))
                        }}
                        onBlur={() => handleUpdate(branch.branch_id, 'address', branch.address)}
                        className="h-8 text-sm"
                        placeholder="Address"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={branch.phone || ""}
                        onChange={(e) => {
                          setBranches(prev => prev.map(b =>
                            b.branch_id === branch.branch_id ? { ...b, phone: e.target.value } : b
                          ))
                        }}
                        onBlur={() => handleUpdate(branch.branch_id, 'phone', branch.phone)}
                        className="h-8 text-sm"
                        placeholder="Phone"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={branch.is_active ? "default" : "secondary"}>
                        {branch.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBranchToDelete(branch)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {branches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No branches found
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch or store location
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Entity *</Label>
            <Select value={newBranch.entity_id} onValueChange={(value) => setNewBranch({...newBranch, entity_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch Name *</Label>
            <Input
              value={newBranch.branch_name}
              onChange={(e) => setNewBranch({...newBranch, branch_name: e.target.value})}
              placeholder="Main Store"
            />
          </div>
          <div className="space-y-2">
            <Label>Branch Code</Label>
            <Input
              value={newBranch.branch_code}
              onChange={(e) => setNewBranch({...newBranch, branch_code: e.target.value})}
              placeholder="MAIN"
            />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={newBranch.address}
              onChange={(e) => setNewBranch({...newBranch, address: e.target.value})}
              placeholder="123 Main St"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={newBranch.phone}
              onChange={(e) => setNewBranch({...newBranch, phone: e.target.value})}
              placeholder="+1234567890"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!newBranch.entity_id || !newBranch.branch_name}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Branch</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{branchToDelete?.branch_name}&quot;?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            If this branch is used by any transactions, it will be deactivated instead of deleted.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
