"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, Edit, Trash2, ChevronDown, ChevronUp, Calendar } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, addMonths, isSameMonth, parseISO, differenceInDays } from "date-fns"
import { ScheduledPaymentOverview } from "@/types/scheduled-payment"

interface PaymentTimelineProps {
  payments: ScheduledPaymentOverview[]
  onEdit?: (payment: ScheduledPaymentOverview) => void
  onDelete?: (paymentId: number, contractName: string) => void
}

interface MonthGroup {
  month: Date
  schedules: ScheduledPaymentOverview[]
  total: number
}

export function PaymentTimeline({ payments, onEdit, onDelete }: PaymentTimelineProps) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  // Group payments by month (based on start date and end date overlap)
  const groupedByMonth: MonthGroup[] = []

  if (payments.length > 0) {
    const startDate = new Date()
    const endDate = addMonths(startDate, 12) // Show next 12 months

    const months = eachMonthOfInterval({ start: startDate, end: endDate })

    months.forEach(month => {
      const monthSchedules = payments.filter(payment => {
        const start = parseISO(payment.start_date)
        const end = payment.end_date ? parseISO(payment.end_date) : null
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)

        // Check if this schedule overlaps with this month
        return start <= monthEnd && (!end || end >= monthStart)
      })

      if (monthSchedules.length > 0) {
        const total = monthSchedules.reduce((sum, s) => sum + s.payment_amount, 0)
        groupedByMonth.push({
          month,
          schedules: monthSchedules,
          total
        })
      }
    })
  }

  const toggleMonth = (monthKey: string) => {
    const newCollapsed = new Set(collapsedMonths)
    if (newCollapsed.has(monthKey)) {
      newCollapsed.delete(monthKey)
    } else {
      newCollapsed.add(monthKey)
    }
    setCollapsedMonths(newCollapsed)
  }

  const getDuration = (startDate: string, endDate?: string | null) => {
    const start = parseISO(startDate)
    const end = endDate ? parseISO(endDate) : new Date(9999, 11, 31)
    const days = differenceInDays(end, start)
    return `${days}d`
  }

  const getStatusIcon = (schedule: ScheduledPayment) => {
    if (schedule.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if ((schedule.pending_count || 0) > 0 && new Date() > parseISO(schedule.start_date)) {
      return <AlertTriangle className="h-4 w-4 text-orange-600" />
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />
  }

  const getProgress = (schedule: ScheduledPayment) => {
    const paid = schedule.paid_count || 0
    const total = paid + (schedule.pending_count || 0)
    return total > 0 ? (paid / total) * 100 : 0
  }

  if (groupedByMonth.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No upcoming payments</p>
      </div>
    )
  }

  const today = new Date()

  // Check if all months are collapsed
  const allMonthKeys = groupedByMonth.map(g => format(g.month, 'yyyy-MM'))
  const allCollapsed = allMonthKeys.every(key => collapsedMonths.has(key))

  const toggleAllMonths = () => {
    if (allCollapsed) {
      setCollapsedMonths(new Set())
    } else {
      setCollapsedMonths(new Set(allMonthKeys))
    }
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {format(groupedByMonth[0].month, 'MMM d, yyyy')} - {format(groupedByMonth[groupedByMonth.length - 1].month, 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{groupedByMonth.length} month(s)</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAllMonths}
          >
            {allCollapsed ? 'Expand All' : 'Collapse'}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0 relative">
        {/* Timeline vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border -z-10" />

        {/* Today indicator */}
        <div
          className="absolute left-16 right-0 flex items-center gap-2 pointer-events-none"
          style={{ top: '20px' }}
        >
          <div className="h-px flex-1 bg-blue-600 border-t-2 border-dashed border-blue-600" />
          <Badge variant="default" className="bg-blue-600 pointer-events-auto">Today</Badge>
        </div>

        {groupedByMonth.map((group) => {
          const monthKey = format(group.month, 'yyyy-MM')
          const isCollapsed = collapsedMonths.has(monthKey)
          const isCurrentMonth = isSameMonth(group.month, today)

          return (
            <div key={monthKey} className="relative pl-16">
              {/* Month marker */}
              <div className="absolute left-0 top-4 flex items-center gap-2">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                    isCurrentMonth
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-background border-border'
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {format(group.month, 'MMM')}
                  </span>
                </div>
              </div>

              {/* Month header - clickable */}
              <button
                onClick={() => toggleMonth(monthKey)}
                className="flex items-center justify-between w-full hover:bg-accent/50 rounded-lg p-2 -ml-2 mb-2"
              >
                <h3 className="text-lg font-semibold">{format(group.month, 'MMMM yyyy')}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {group.schedules.length} schedule(s) • {group.total.toLocaleString()}₫
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </div>
              </button>

              {/* Payment schedules */}
              {!isCollapsed && (
                <div className="space-y-3 pb-6">
                  {group.schedules.map((schedule) => {
                    const progress = getProgress(schedule)
                    const remaining = schedule.payment_amount - (schedule.total_paid || 0)

                    return (
                      <Card
                        key={schedule.scheduled_payment_id}
                        className="border-l-4 border-l-green-500"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            {/* Left side - main info */}
                            <div className="flex-1 space-y-3">
                              {/* Title row */}
                              <div className="flex items-center gap-2">
                                {getStatusIcon(schedule)}
                                <h4 className="font-semibold">
                                  {schedule.payment_type || schedule.contract_name}
                                </h4>
                                <Badge variant="outline" className="capitalize">
                                  {schedule.status}
                                </Badge>
                              </div>

                              {/* Date and duration */}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {format(parseISO(schedule.start_date), 'MMM d')} → {' '}
                                  {schedule.end_date
                                    ? format(parseISO(schedule.end_date), 'MMM d, yyyy')
                                    : 'ongoing'
                                  }
                                  {' '}({getDuration(schedule.start_date, schedule.end_date)})
                                </span>
                              </div>

                              {/* Budget info row */}
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Budget</p>
                                  <p className="font-semibold">{schedule.payment_amount.toLocaleString()}₫</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Paid</p>
                                  <p className="font-semibold text-red-600">
                                    {(schedule.total_paid || 0).toLocaleString()}₫
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Remaining</p>
                                  <p className="font-semibold text-green-600">
                                    {remaining.toLocaleString()}₫
                                  </p>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{schedule.paid_count || 0} paid</span>
                                  <span>
                                    {schedule.paid_count || 0} / {(schedule.paid_count || 0) + (schedule.pending_count || 0)} payments ({progress.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-600 transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>

                              {/* Total row */}
                              <div className="flex items-center justify-end gap-2 text-sm pt-2 border-t">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-bold">{schedule.payment_amount.toLocaleString()}₫</span>
                              </div>
                            </div>

                            {/* Right side - actions */}
                            <div className="flex gap-2">
                              {onEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onEdit(schedule)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onDelete(schedule.scheduled_payment_id, schedule.contract_name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
