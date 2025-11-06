"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"

export function CategoriesManager() {
  const [categories, setCategories] = useState<any[]>([])
  const [transactionTypes, setTransactionTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCategory, setNewCategory] = useState({
    transaction_type_id: "",
    category_name: "",
    category_code: "",
    entity_type: "both",
    description: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [categoriesRes, typesRes] = await Promise.all([
        fetch('/api/categories?active_only=false'),
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

      if (!response.ok) throw new Error('Failed to update')

      setCategories(prev => prev.map(c =>
        c.category_id === categoryId ? { ...c, [field]: value } : c
      ))
    } catch (error) {
      console.error('Error updating category:', error)
      alert('Failed to update category')
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategory,
          transaction_type_id: parseInt(newCategory.transaction_type_id),
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
                Manage transaction categories. Click on any field to edit.
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
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
                <th className="text-left py-3 px-4">Transaction Type</th>
                <th className="text-left py-3 px-4">Entity Type</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const type = transactionTypes.find(t => t.transaction_type_id === category.transaction_type_id)
                return (
                  <tr key={category.category_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{type?.type_display_name || '—'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{category.entity_type || 'both'}</Badge>
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
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
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a new transaction category
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
    </>
  )
}
