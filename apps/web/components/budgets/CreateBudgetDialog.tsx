"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertTriangle, Info } from "lucide-react"
import { BudgetOverview, RecurringPeriod } from "@/types/budget"
import { Category } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"

interface CreateBudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  categories: Category[]
  editingBudget?: BudgetOverview | null
}

export function CreateBudgetDialog({
  open,
  onOpenChange,
  onSuccess,
  categories,
  editingBudget,
}: CreateBudgetDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category_id: "",
    budget_name: "",
    budget_amount: "",
    start_date: "",
    end_date: "",
    recurring_period: "one-time" as RecurringPeriod,
    auto_renew: false,
    alert_threshold: "80",
    notes: "",
  })

  // Reset form when dialog opens or editingBudget changes
  useEffect(() => {
    if (open) {
      if (editingBudget) {
        setFormData({
          category_id: editingBudget.category_id.toString(),
          budget_name: editingBudget.budget_name || "",
          budget_amount: editingBudget.budget_amount.toString(),
          start_date: editingBudget.start_date,
          end_date: editingBudget.end_date,
          recurring_period: editingBudget.recurring_period,
          auto_renew: editingBudget.auto_renew,
          alert_threshold: editingBudget.alert_threshold.toString(),
          notes: editingBudget.notes || "",
        })
      } else {
        // Set default dates (current month)
        const today = new Date()
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

        setFormData({
          category_id: "",
          budget_name: "",
          budget_amount: "",
          start_date: firstDay.toISOString().split('T')[0],
          end_date: lastDay.toISOString().split('T')[0],
          recurring_period: "one-time",
          auto_renew: false,
          alert_threshold: "80",
          notes: "",
        })
      }
      setError(null)
      setWarning(null)
    }
  }, [open, editingBudget])

  // Update end date when recurring period changes
  const handleRecurringPeriodChange = (value: RecurringPeriod) => {
    setFormData(prev => {
      const newData = { ...prev, recurring_period: value }

      // If changing to one-time, disable auto-renew
      if (value === 'one-time') {
        newData.auto_renew = false
      }

      // Auto-calculate end date based on recurring period
      if (prev.start_date) {
        const startDate = new Date(prev.start_date)
        let endDate = new Date(startDate)

        switch (value) {
          case 'monthly':
            endDate.setMonth(startDate.getMonth() + 1)
            endDate.setDate(endDate.getDate() - 1)
            break
          case 'quarterly':
            endDate.setMonth(startDate.getMonth() + 3)
            endDate.setDate(endDate.getDate() - 1)
            break
          case 'yearly':
            endDate.setFullYear(startDate.getFullYear() + 1)
            endDate.setDate(endDate.getDate() - 1)
            break
        }

        newData.end_date = endDate.toISOString().split('T')[0]
      }

      return newData
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEntity) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      // Validation
      if (!formData.category_id || !formData.budget_amount || !formData.start_date || !formData.end_date) {
        throw new Error('Please fill in all required fields')
      }

      const budgetAmount = parseFloat(formData.budget_amount)
      if (isNaN(budgetAmount) || budgetAmount <= 0) {
        throw new Error('Budget amount must be a positive number')
      }

      const alertThreshold = parseFloat(formData.alert_threshold)
      if (isNaN(alertThreshold) || alertThreshold < 0 || alertThreshold > 100) {
        throw new Error('Alert threshold must be between 0 and 100')
      }

      // Date validation
      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)

      if (endDate < startDate) {
        throw new Error('End date must be after start date')
      }

      // Prepare request body
      const requestBody = {
        entity_id: currentEntity.id,
        category_id: parseInt(formData.category_id),
        budget_name: formData.budget_name || null,
        budget_amount: budgetAmount,
        start_date: formData.start_date,
        end_date: formData.end_date,
        recurring_period: formData.recurring_period,
        auto_renew: formData.auto_renew,
        alert_threshold: alertThreshold,
        notes: formData.notes || null,
      }

      const url = editingBudget
        ? `/api/budgets/${editingBudget.budget_id}`
        : `/api/budgets`

      const method = editingBudget ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save budget')
      }

      // Show warning if exists (e.g., overlapping budgets)
      if (data.warning) {
        setWarning(data.warning)
        setTimeout(() => {
          onSuccess()
          onOpenChange(false)
        }, 2000)
      } else {
        onSuccess()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error saving budget:', error)
      setError(error instanceof Error ? error.message : 'Failed to save budget')
    } finally {
      setLoading(false)
    }
  }

  // Filter categories to only show expense categories
  const expenseCategories = categories.filter(cat =>
    cat.transaction_type_id === 2  // Expense type
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingBudget ? 'Edit Budget' : 'Create New Budget'}
          </DialogTitle>
          <DialogDescription>
            {editingBudget
              ? 'Update budget details and settings'
              : 'Set a spending limit for a category with optional recurring schedule'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning Alert */}
          {warning && (
            <Alert>
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_id">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              disabled={!!editingBudget}  // Cannot change category when editing
            >
              <SelectTrigger id="category_id">
                <SelectValue placeholder="Select expense category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((category) => (
                  <SelectItem key={category.category_id} value={category.category_id.toString()}>
                    {category.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingBudget && (
              <p className="text-xs text-muted-foreground">
                Category cannot be changed after budget creation
              </p>
            )}
          </div>

          {/* Budget Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="budget_name">Budget Name (Optional)</Label>
            <Input
              id="budget_name"
              value={formData.budget_name}
              onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
              placeholder="e.g., Q1 2024 Marketing Budget"
            />
            <p className="text-xs text-muted-foreground">
              If not provided, budget will be named after the category
            </p>
          </div>

          {/* Budget Amount */}
          <div className="space-y-2">
            <Label htmlFor="budget_amount">
              Budget Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="budget_amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.budget_amount}
              onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
              placeholder="Enter budget amount"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Recurring Period */}
          <div className="space-y-2">
            <Label htmlFor="recurring_period">Recurring Period</Label>
            <Select
              value={formData.recurring_period}
              onValueChange={(value) => handleRecurringPeriodChange(value as RecurringPeriod)}
            >
              <SelectTrigger id="recurring_period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One-Time</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.recurring_period === 'one-time'
                ? 'This budget will not renew automatically'
                : `This budget will repeat every ${formData.recurring_period === 'monthly' ? 'month' : formData.recurring_period === 'quarterly' ? 'quarter' : 'year'}`
              }
            </p>
          </div>

          {/* Auto-Renew Checkbox */}
          {formData.recurring_period !== 'one-time' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto_renew"
                checked={formData.auto_renew}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_renew: checked as boolean })}
              />
              <Label
                htmlFor="auto_renew"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Automatically renew this budget
              </Label>
            </div>
          )}

          {/* Alert Threshold */}
          <div className="space-y-2">
            <Label htmlFor="alert_threshold">Alert Threshold (%)</Label>
            <Input
              id="alert_threshold"
              type="number"
              step="1"
              min="0"
              max="100"
              value={formData.alert_threshold}
              onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Show warning when spending reaches this percentage of the budget
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes about this budget"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBudget ? 'Save Changes' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
