"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Calendar,
  DollarSign,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScheduledPaymentOverview } from "@/types/scheduled-payment"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"
import { PaymentInstanceList } from "./PaymentInstanceList"

interface ScheduledPaymentListProps {
  payments: ScheduledPaymentOverview[]
  onEdit: (payment: ScheduledPaymentOverview) => void
  onDelete: (paymentId: number, contractName: string) => void
  onRefresh?: () => void
}

export function ScheduledPaymentList({ payments, onEdit, onDelete, onRefresh }: ScheduledPaymentListProps) {
  const [expandedPaymentId, setExpandedPaymentId] = useState<number | null>(null)

  const toggleExpand = (paymentId: number) => {
    setExpandedPaymentId(expandedPaymentId === paymentId ? null : paymentId)
  }

  const getContractTypeBadgeColor = (type: string) => {
    switch (type) {
      case "lease":
        return "bg-blue-100 text-blue-800"
      case "service":
        return "bg-green-100 text-green-800"
      case "construction":
        return "bg-orange-100 text-orange-800"
      case "subscription":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getFrequencyLabel = (frequency: string | null) => {
    if (!frequency) return ""
    return frequency.charAt(0).toUpperCase() + frequency.slice(1)
  }

  return (
    <div className="space-y-4">
      {payments.map((payment) => {
        const isExpanded = expandedPaymentId === payment.scheduled_payment_id
        const completionPercentage = payment.total_instances > 0
          ? (payment.paid_count / payment.total_instances) * 100
          : 0

        return (
          <Card key={payment.scheduled_payment_id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{payment.contract_name}</CardTitle>
                    <Badge className={getContractTypeBadgeColor(payment.contract_type)}>
                      {payment.contract_type}
                    </Badge>
                    <Badge className={getStatusBadgeColor(payment.status)}>
                      {payment.status}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4">
                    <span>Payee: <strong>{payment.payee_name}</strong></span>
                    {payment.contract_number && (
                      <span className="text-xs">#{payment.contract_number}</span>
                    )}
                  </CardDescription>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(payment)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(payment.scheduled_payment_id, payment.contract_name)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Payment Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payment Amount</p>
                  <p className="font-semibold">{formatCurrency(payment.payment_amount, 'VND')}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Schedule</p>
                  <p className="font-semibold">
                    {payment.schedule_type === "recurring"
                      ? `${getFrequencyLabel(payment.frequency)} (Day ${payment.payment_day})`
                      : payment.schedule_type === "one_time"
                      ? "One Time"
                      : "Custom Dates"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Period</p>
                  <p className="font-semibold text-sm">
                    {format(new Date(payment.start_date), "MMM d, yyyy")}
                    {payment.end_date && (
                      <> - {format(new Date(payment.end_date), "MMM d, yyyy")}</>
                    )}
                    {!payment.end_date && <span className="text-muted-foreground"> (Ongoing)</span>}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <p className="font-semibold">{payment.category_name}</p>
                </div>
              </div>

              {/* Payment Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-semibold">{payment.paid_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="font-semibold">{payment.pending_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p className="font-semibold text-red-600">{payment.overdue_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="font-semibold">{formatCurrency(payment.total_paid, 'VND')}</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>
                    {payment.paid_count} / {payment.total_instances} payments (
                    {completionPercentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>

              {/* Next Payment */}
              {payment.next_due_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">
                      Next payment due: {format(new Date(payment.next_due_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {payment.notes && (
                <div className="text-sm text-muted-foreground pt-2 border-t">
                  <p className="font-medium mb-1">Notes:</p>
                  <p>{payment.notes}</p>
                </div>
              )}

              {/* Expand/Collapse Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleExpand(payment.scheduled_payment_id)}
                className="w-full"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Payment Timeline
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    View Payment Timeline ({payment.total_instances} payments)
                  </>
                )}
              </Button>

              {/* Payment Instances Timeline (Expanded) */}
              {isExpanded && (
                <div className="pt-4 border-t">
                  <PaymentInstanceList
                    scheduledPaymentId={payment.scheduled_payment_id}
                    onUpdate={onRefresh}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
