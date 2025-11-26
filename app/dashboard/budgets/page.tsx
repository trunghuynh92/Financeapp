"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Repeat,
  Loader2,
  LayoutGrid,
  CalendarRange
} from "lucide-react"
import { BudgetOverview, BudgetSummary } from "@/types/budget"
import { Category } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"
import { formatCurrency, formatDate } from "@/lib/account-utils"
import { CreateBudgetDialog } from "@/components/budgets/CreateBudgetDialog"
import { BudgetTimeline } from "@/components/budgets/BudgetTimeline"

export default function BudgetsPage() {
  const { currentEntity } = useEntity()

  // Data state
  const [budgets, setBudgets] = useState<BudgetOverview[]>([])
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedHealthStatus, setSelectedHealthStatus] = useState<string>("all")

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('timeline')

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetOverview | null>(null)

  useEffect(() => {
    if (currentEntity) {
      fetchBudgets()
      fetchCategories()
    }
  }, [currentEntity?.id, selectedCategory, selectedStatus])

  const fetchBudgets = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('entity_id', currentEntity.id)
      params.set('include_summary', 'true')

      if (selectedCategory !== 'all') {
        params.set('category_id', selectedCategory)
      }

      if (selectedStatus !== 'all') {
        params.set('status', selectedStatus)
      }

      const response = await fetch(`/api/budgets?${params.toString()}`)

      if (response.ok) {
        const data = await response.json()
        setBudgets(data.data || [])
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleDeleteBudget = async (budgetId: number, budgetName: string) => {
    if (!confirm(`Are you sure you want to delete budget "${budgetName || 'Unnamed'}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/budgets/${budgetId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchBudgets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete budget')
      }
    } catch (error) {
      console.error('Error deleting budget:', error)
      alert('Failed to delete budget')
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'exceeded': return 'text-red-600 bg-red-50 border-red-200'
      case 'upcoming': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'expired': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'exceeded': return <TrendingUp className="h-4 w-4" />
      case 'upcoming': return <Clock className="h-4 w-4" />
      case 'expired': return <Clock className="h-4 w-4" />
      default: return null
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Filter budgets by health status
  const filteredBudgets = budgets.filter(budget => {
    if (selectedHealthStatus === 'all') return true
    return budget.budget_status === selectedHealthStatus
  })

  // Show loading while entity context is loading
  if (!currentEntity) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Track spending against category budgets
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budgets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.active_budgets}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_budgets} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budget Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_budget_amount, 'VND')}
              </div>
              <p className="text-xs text-green-600">
                Allocated across all budgets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_spent, 'VND')}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.total_budget_amount > 0
                  ? `${((summary.total_spent / summary.total_budget_amount) * 100).toFixed(1)}% of budget`
                  : '0% of budget'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Budget Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{summary.budgets_on_track}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">{summary.budgets_warning}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">{summary.budgets_exceeded}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                On track / Warning / Exceeded
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Cards
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
              >
                <CalendarRange className="h-4 w-4 mr-2" />
                Timeline
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Health</label>
              <Select value={selectedHealthStatus} onValueChange={setSelectedHealthStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="exceeded">Exceeded</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget List / Timeline */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading budgets...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredBudgets.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No budgets found</p>
              <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Budget
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'timeline' ? (
        <Card>
          <CardHeader>
            <CardTitle>Budget Timeline ({filteredBudgets.length})</CardTitle>
            <CardDescription>
              Visualize budgets on a timeline with overlap detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetTimeline
              budgets={filteredBudgets}
              onEdit={(budget) => {
                setEditingBudget(budget)
                setCreateDialogOpen(true)
              }}
              onDelete={handleDeleteBudget}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Budget Overview ({filteredBudgets.length})</CardTitle>
            <CardDescription>
              Track your spending against budgeted amounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredBudgets.map((budget) => (
                <Card key={budget.budget_id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">
                            {budget.budget_name || budget.category_name}
                          </h3>
                          <Badge variant="outline" className={getHealthStatusColor(budget.budget_status)}>
                            {getHealthStatusIcon(budget.budget_status)}
                            <span className="ml-1">{budget.budget_status.replace('_', ' ')}</span>
                          </Badge>
                          {budget.recurring_period !== 'one-time' && (
                            <Badge variant="secondary">
                              <Repeat className="h-3 w-3 mr-1" />
                              {budget.recurring_period}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {budget.category_name} • {budget.transaction_type}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingBudget(budget)
                            setCreateDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBudget(budget.budget_id, budget.budget_name || 'Unnamed Budget')}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Budget</p>
                        <p className="text-lg font-semibold">{formatCurrency(budget.budget_amount, 'VND')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Spent</p>
                        <p className="text-lg font-semibold text-red-600">
                          {formatCurrency(budget.spent_amount, 'VND')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(budget.remaining_amount, 'VND')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{budget.percentage_used.toFixed(1)}%</span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={Math.min(budget.percentage_used, 100)}
                          className="h-2"
                        />
                        <div
                          className={`absolute top-0 left-0 h-2 rounded-full ${getProgressColor(budget.percentage_used)}`}
                          style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(budget.start_date)} - {formatDate(budget.end_date)}
                        </span>
                        <span>{budget.transaction_count} transactions</span>
                      </div>
                      <Badge variant="outline">{budget.status}</Badge>
                    </div>

                    {budget.notes && (
                      <p className="mt-2 text-sm text-muted-foreground italic">
                        {budget.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Budget Dialog */}
      <CreateBudgetDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) {
            setEditingBudget(null)
          }
        }}
        onSuccess={fetchBudgets}
        categories={categories}
        editingBudget={editingBudget}
      />
    </div>
  )
}
