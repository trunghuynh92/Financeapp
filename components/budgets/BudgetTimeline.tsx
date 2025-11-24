"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { BudgetOverview } from "@/types/budget"
import { formatCurrency } from "@/lib/account-utils"
import { Calendar, TrendingUp, AlertTriangle, CheckCircle, Repeat, ChevronsUpDown, ChevronsDownUp } from "lucide-react"
import { format, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"

interface BudgetTimelineProps {
  budgets: BudgetOverview[]
  onEdit: (budget: BudgetOverview) => void
  onDelete: (budgetId: number, budgetName: string) => void
}

export function BudgetTimeline({ budgets, onEdit, onDelete }: BudgetTimelineProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Calculate timeline range
  const { minDate, maxDate, monthMarkers } = useMemo(() => {
    if (budgets.length === 0) {
      const today = new Date()
      return {
        minDate: startOfMonth(today),
        maxDate: endOfMonth(today),
        monthMarkers: [today]
      }
    }

    const dates = budgets.flatMap(b => [new Date(b.start_date), new Date(b.end_date)])
    const min = new Date(Math.min(...dates.map(d => d.getTime())))
    const max = new Date(Math.max(...dates.map(d => d.getTime())))

    const minMonth = startOfMonth(min)
    const maxMonth = endOfMonth(max)

    const markers = eachMonthOfInterval({ start: minMonth, end: maxMonth })

    return {
      minDate: minMonth,
      maxDate: maxMonth,
      monthMarkers: markers
    }
  }, [budgets])

  // Calculate overlapping budgets for each budget
  const budgetsWithOverlaps = useMemo(() => {
    return budgets.map(budget => {
      const start = new Date(budget.start_date)
      const end = new Date(budget.end_date)

      // Find overlapping budgets (same category)
      const overlapping = budgets.filter(other => {
        if (other.budget_id === budget.budget_id) return false
        if (other.category_id !== budget.category_id) return false

        const otherStart = new Date(other.start_date)
        const otherEnd = new Date(other.end_date)

        // Check if there's any overlap
        return (
          isWithinInterval(start, { start: otherStart, end: otherEnd }) ||
          isWithinInterval(end, { start: otherStart, end: otherEnd }) ||
          isWithinInterval(otherStart, { start, end }) ||
          isWithinInterval(otherEnd, { start, end })
        )
      })

      const totalOverlappingBudget = overlapping.reduce((sum, b) => sum + parseFloat(b.budget_amount.toString()), 0)
      const totalBudget = parseFloat(budget.budget_amount.toString()) + totalOverlappingBudget

      return {
        ...budget,
        hasOverlap: overlapping.length > 0,
        overlappingCount: overlapping.length,
        totalBudgetWithOverlaps: totalBudget,
        overlappingBudgets: overlapping
      }
    })
  }, [budgets])

  // Calculate max budget for proportional bar widths
  const maxBudgetAmount = useMemo(() => {
    if (budgets.length === 0) return 0
    return Math.max(...budgets.map(b => parseFloat(b.budget_amount.toString())))
  }, [budgets])

  const today = new Date()
  const totalDays = differenceInDays(maxDate, minDate)

  const getPositionPercent = (date: Date) => {
    const days = differenceInDays(date, minDate)
    return (days / totalDays) * 100
  }

  const getDuration = (startDate: string, endDate: string) => {
    return differenceInDays(new Date(endDate), new Date(startDate)) + 1
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'border-green-500 bg-green-50'
      case 'warning': return 'border-yellow-500 bg-yellow-50'
      case 'exceeded': return 'border-red-500 bg-red-50'
      case 'upcoming': return 'border-blue-500 bg-blue-50'
      case 'expired': return 'border-gray-400 bg-gray-50'
      default: return 'border-gray-300 bg-white'
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'exceeded': return <TrendingUp className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {format(minDate, 'MMM d, yyyy')} - {format(maxDate, 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {budgetsWithOverlaps.length} budget(s)
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="gap-2"
          >
            {collapsed ? (
              <>
                <ChevronsDownUp className="h-4 w-4" />
                Expand
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-10 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/40 via-primary/60 to-primary/40 rounded-full" />

        {/* Today Marker */}
        {isWithinInterval(today, { start: minDate, end: maxDate }) && (
          <div
            className="absolute left-0 right-0 z-10"
            style={{ top: `${getPositionPercent(today)}%` }}
          >
            <div className="flex items-center">
              <div className="w-10 h-1 bg-primary rounded-full" />
              <div className="flex-1 h-0.5 border-t-2 border-dashed border-primary" />
              <Badge variant="default" className="ml-2 font-semibold shadow-lg">Today</Badge>
            </div>
          </div>
        )}

        {/* Month Markers */}
        <div className="space-y-16">
          {monthMarkers.map((month, idx) => (
            <div key={idx} className="relative">
              {/* Month Label */}
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center z-20 border-4 border-background shadow-lg ring-2 ring-primary/20">
                  <span className="text-sm font-bold text-primary">{format(month, 'MMM')}</span>
                </div>
                <div className="ml-6 text-lg font-bold text-foreground">
                  {format(month, 'MMMM yyyy')}
                </div>
              </div>

              {/* Budgets for this month */}
              <div className="ml-16 space-y-4">
                {budgetsWithOverlaps
                  .filter(budget => {
                    const start = new Date(budget.start_date)
                    const end = new Date(budget.end_date)
                    return (
                      isWithinInterval(month, { start, end }) ||
                      isWithinInterval(start, { start: month, end: endOfMonth(month) }) ||
                      isWithinInterval(end, { start: month, end: endOfMonth(month) })
                    )
                  })
                  .map((budget) => {
                    const duration = getDuration(budget.start_date, budget.end_date)
                    const isActive = budget.budget_status !== 'expired' && budget.budget_status !== 'upcoming'
                    const barWidth = maxBudgetAmount > 0 ? (parseFloat(budget.budget_amount.toString()) / maxBudgetAmount) * 100 : 100

                    // Collapsed bar view
                    if (collapsed) {
                      return (
                        <div
                          key={budget.budget_id}
                          className={`group relative p-2 border-l-4 rounded cursor-pointer transition-all hover:shadow-md ${getHealthStatusColor(budget.budget_status)} ${
                            isActive ? 'opacity-100' : 'opacity-60'
                          }`}
                          onClick={() => onEdit(budget)}
                        >
                          <div className="flex items-center gap-2">
                            {/* Budget bar */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm">{budget.category_name}</span>
                                  {budget.recurring_period !== 'one-time' && (
                                    <Badge variant="secondary" className="text-xs h-5">
                                      <Repeat className="h-2 w-2 mr-1" />
                                      {budget.recurring_period}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs font-bold">{formatCurrency(budget.budget_amount, 'VND')}</span>
                              </div>

                              {/* Visual bar */}
                              <div className="relative h-6 bg-white/50 rounded overflow-hidden">
                                <div
                                  className={`absolute top-0 left-0 h-full ${getProgressColor(budget.percentage_used)} opacity-80 transition-all`}
                                  style={{ width: `${barWidth}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2 text-xs font-bold text-white mix-blend-difference">
                                  {budget.percentage_used.toFixed(0)}% used • {formatCurrency(budget.spent_amount, 'VND')} / {formatCurrency(budget.budget_amount, 'VND')}
                                </div>
                              </div>

                              {budget.hasOverlap && (
                                <div className="mt-1 text-xs text-orange-700 font-semibold">
                                  +{budget.overlappingCount} overlap • Total: {formatCurrency(budget.totalBudgetWithOverlaps, 'VND')}
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEdit(budget)
                                }}
                                className="p-1 hover:bg-white rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDelete(budget.budget_id, budget.budget_name || 'Unnamed Budget')
                                }}
                                className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                                title="Delete"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // Expanded card view
                    return (
                      <Card
                        key={budget.budget_id}
                        className={`p-3 border-l-4 transition-all hover:shadow-lg hover:scale-[1.02] ${getHealthStatusColor(budget.budget_status)} ${
                          isActive ? 'opacity-100' : 'opacity-60'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base">
                                {budget.category_name}
                              </h4>
                              {budget.recurring_period !== 'one-time' && (
                                <Badge variant="secondary" className="text-xs">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {budget.recurring_period}
                                </Badge>
                              )}
                              {getHealthStatusIcon(budget.budget_status)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => onEdit(budget)}
                              className="p-1 hover:bg-white rounded transition-colors"
                              title="Edit"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onDelete(budget.budget_id, budget.budget_name)}
                              className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Duration Bar */}
                        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">
                            {format(new Date(budget.start_date), 'MMM d')} → {format(new Date(budget.end_date), 'MMM d, yyyy')}
                          </span>
                          <span>
                            ({duration}d)
                          </span>
                        </div>

                        {/* Budget Amounts */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Budget</p>
                            <p className="font-bold text-sm">
                              {formatCurrency(budget.budget_amount, 'VND')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Spent</p>
                            <p className="font-bold text-sm text-red-600">
                              {formatCurrency(budget.spent_amount, 'VND')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Remaining</p>
                            <p className="font-bold text-sm text-green-600">
                              {formatCurrency(budget.remaining_amount, 'VND')}
                            </p>
                          </div>
                        </div>

                        {/* Overlap Warning */}
                        {budget.hasOverlap && (
                          <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                            <div className="flex items-center gap-1 text-orange-800 font-bold">
                              <AlertTriangle className="h-3 w-3" />
                              <span>+{budget.overlappingCount} overlap</span>
                              <span className="ml-auto font-bold">Total: {formatCurrency(budget.totalBudgetWithOverlaps, 'VND')}</span>
                            </div>
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{budget.transaction_count} txn{budget.transaction_count !== 1 ? 's' : ''}</span>
                            <span className="font-bold text-sm">{budget.percentage_used.toFixed(1)}%</span>
                          </div>
                          <div className="relative">
                            <Progress
                              value={Math.min(budget.percentage_used, 100)}
                              className="h-2.5"
                            />
                            <div
                              className={`absolute top-0 left-0 h-2.5 rounded-full transition-all ${getProgressColor(budget.percentage_used)}`}
                              style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
