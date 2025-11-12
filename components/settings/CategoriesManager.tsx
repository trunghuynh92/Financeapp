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

export function CategoriesManager() {
  const { currentEntity } = useEntity()
  const [categories, setCategories] = useState<any[]>([])
  const [transactionTypes, setTransactionTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null)
  const [newCategory, setNewCategory] = useState({
    transaction_type_id: "",
    category_name: "",
    category_code: "",
    entity_type: "both",
    cash_flow_type: "",
    description: "",
  })

  useEffect(() => {
    if (currentEntity) {
      fetchData()
    }
  }, [currentEntity?.id])

  const fetchData = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const [categoriesRes, typesRes] = await Promise.all([
        fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true&active_only=false`),
        fetch('/api/transaction-types'),
      ])

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.data || [])
      }

      if (typesRes.ok) {
        const data = await typesRes.json()
        setTransactionTypes(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (categoryId: number, field: string, value: any) => {
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update')
      }

      setCategories(prev => prev.map(c =>
        c.category_id === categoryId ? { ...c, [field]: value } : c
      ))
    } catch (error: any) {
      console.error('Error updating category:', error)
      alert(error.message || 'Failed to update category')
    }
  }

  const handleCreate = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategory,
          transaction_type_id: parseInt(newCategory.transaction_type_id),
          entity_id: currentEntity.id, // Create as custom category
        }),
      })

      if (!response.ok) throw new Error('Failed to create')

      await fetchData()
      setDialogOpen(false)
      setNewCategory({
        transaction_type_id: "",
        category_name: "",
        category_code: "",
        entity_type: "both",
        description: "",
      })
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Failed to create category')
    }
  }

  const handleDelete = async () => {
    if (!categoryToDelete) return

    try {
      const response = await fetch(`/api/categories/${categoryToDelete.category_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete')
      }

      const result = await response.json()
      await fetchData()
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)

      // Show message if it was soft-deleted
      if (result.message) {
        alert(result.message)
      }
    } catch (error: any) {
      console.error('Error deleting category:', error)
      alert(error.message || 'Failed to delete category')
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
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Manage transaction categories. Templates are read-only, custom categories can be edited.
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Category
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Category Name</th>
                <th className="text-left py-3 px-4">Code</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Transaction Type</th>
                <th className="text-left py-3 px-4">Cash Flow Type</th>
                <th className="text-left py-3 px-4">Entity Type</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const type = transactionTypes.find(t => t.transaction_type_id === category.transaction_type_id)
                const isTemplate = !category.entity_id
                return (
                  <tr key={category.category_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      {isTemplate ? (
                        <span className="text-sm font-medium text-muted-foreground">{category.category_name}</span>
                      ) : (
                        <Input
                          value={category.category_name || ""}
                          onChange={(e) => {
                            setCategories(prev => prev.map(c =>
                              c.category_id === category.category_id ? { ...c, category_name: e.target.value } : c
                            ))
                          }}
                          onBlur={() => handleUpdate(category.category_id, 'category_name', category.category_name)}
                          className="h-8 text-sm font-medium"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isTemplate ? (
                        <span className="text-sm text-muted-foreground">{category.category_code || '—'}</span>
                      ) : (
                        <Input
                          value={category.category_code || ""}
                          onChange={(e) => {
                            setCategories(prev => prev.map(c =>
                              c.category_id === category.category_id ? { ...c, category_code: e.target.value } : c
                            ))
                          }}
                          onBlur={() => handleUpdate(category.category_id, 'category_code', category.category_code)}
                          className="h-8 text-sm"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={isTemplate ? "secondary" : "default"}>
                        {isTemplate ? "Template" : "Custom"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{type?.type_display_name || '—'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={category.cash_flow_type || "none"}
                        onValueChange={(value) => handleUpdate(category.category_id, 'cash_flow_type', value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Not Set</span>
                          </SelectItem>
                          <SelectItem value="operating">Operating</SelectItem>
                          <SelectItem value="investing">Investing</SelectItem>
                          <SelectItem value="financing">Financing</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{category.entity_type || 'both'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {isTemplate ? (
                        <span className="text-sm text-muted-foreground">{category.description || '—'}</span>
                      ) : (
                        <Input
                          value={category.description || ""}
                          onChange={(e) => {
                            setCategories(prev => prev.map(c =>
                              c.category_id === category.category_id ? { ...c, description: e.target.value } : c
                            ))
                          }}
                          onBlur={() => handleUpdate(category.category_id, 'description', category.description)}
                          className="h-8 text-sm"
                          placeholder="Description"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        {!isTemplate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCategoryToDelete(category)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No categories found
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Category</DialogTitle>
          <DialogDescription>
            Create a new custom category for your entity
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Transaction Type *</Label>
            <Select value={newCategory.transaction_type_id} onValueChange={(value) => setNewCategory({...newCategory, transaction_type_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {transactionTypes.map((type) => (
                  <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                    {type.type_display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category Name *</Label>
            <Input
              value={newCategory.category_name}
              onChange={(e) => setNewCategory({...newCategory, category_name: e.target.value})}
              placeholder="Office Supplies"
            />
          </div>
          <div className="space-y-2">
            <Label>Category Code</Label>
            <Input
              value={newCategory.category_code}
              onChange={(e) => setNewCategory({...newCategory, category_code: e.target.value})}
              placeholder="OFFICE_SUP"
            />
          </div>
          <div className="space-y-2">
            <Label>Cash Flow Type</Label>
            <Select value={newCategory.cash_flow_type || "none"} onValueChange={(value) => setNewCategory({...newCategory, cash_flow_type: value === "none" ? "" : value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Not Set</span>
                </SelectItem>
                <SelectItem value="operating">Operating</SelectItem>
                <SelectItem value="investing">Investing</SelectItem>
                <SelectItem value="financing">Financing</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Operating: Day-to-day business • Investing: Assets/investments • Financing: Loans/equity
            </p>
          </div>
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={newCategory.entity_type} onValueChange={(value) => setNewCategory({...newCategory, entity_type: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="business">Business Only</SelectItem>
                <SelectItem value="personal">Personal Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="Office supplies and equipment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!newCategory.transaction_type_id || !newCategory.category_name}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{categoryToDelete?.category_name}&quot;?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            If this category is used by any transactions, it will be deactivated instead of deleted.
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
