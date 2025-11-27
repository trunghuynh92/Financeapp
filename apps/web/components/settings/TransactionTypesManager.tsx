"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function TransactionTypesManager() {
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTypes()
  }, [])

  const fetchTypes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/transaction-types')
      if (response.ok) {
        const data = await response.json()
        setTypes(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching transaction types:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (typeId: number, field: string, value: any) => {
    try {
      const response = await fetch(`/api/transaction-types/${typeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) throw new Error('Failed to update')

      setTypes(prev => prev.map(t =>
        t.transaction_type_id === typeId ? { ...t, [field]: value } : t
      ))
    } catch (error) {
      console.error('Error updating transaction type:', error)
      alert('Failed to update transaction type')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Types</CardTitle>
        <CardDescription>
          Manage core transaction types. Click on any field to edit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Display Name</th>
                <th className="text-left py-3 px-4">Code</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Affects Cashflow</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.transaction_type_id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <Input
                      value={type.type_display_name || ""}
                      onChange={(e) => {
                        setTypes(prev => prev.map(t =>
                          t.transaction_type_id === type.transaction_type_id ? { ...t, type_display_name: e.target.value } : t
                        ))
                      }}
                      onBlur={() => handleUpdate(type.transaction_type_id, 'type_display_name', type.type_display_name)}
                      className="h-8 text-sm font-medium"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{type.type_code}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      value={type.description || ""}
                      onChange={(e) => {
                        setTypes(prev => prev.map(t =>
                          t.transaction_type_id === type.transaction_type_id ? { ...t, description: e.target.value } : t
                        ))
                      }}
                      onBlur={() => handleUpdate(type.transaction_type_id, 'description', type.description)}
                      className="h-8 text-sm"
                      placeholder="Description"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={type.affects_cashflow ? "default" : "secondary"}>
                      {type.affects_cashflow ? "Yes" : "No"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
