"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  DollarSign
} from "lucide-react"
import { ScheduledPaymentInstance } from "@/types/scheduled-payment"
import { formatCurrency } from "@/lib/account-utils"
import { format, isPast, isFuture } from "date-fns"
import { MarkAsPaidDialog } from "./MarkAsPaidDialog"

interface PaymentInstanceListProps {
  scheduledPaymentId: number
}

export function PaymentInstanceList({ scheduledPaymentId }: PaymentInstanceListProps) {
  const [instances, setInstances] = useState<ScheduledPaymentInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [markingPaidInstance, setMarkingPaidInstance] = useState<ScheduledPaymentInstance | null>(null)

  useEffect(() => {
    fetchInstances()
  }, [scheduledPaymentId])

  const fetchInstances = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/scheduled-payments/${scheduledPaymentId}`)
      if (response.ok) {
        const data = await response.json()
        setInstances(data.data.instances || [])
      }
    } catch (error) {
      console.error('Error fetching payment instances:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (instance: ScheduledPaymentInstance) => {
    switch (instance.status) {
      case "paid":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "overdue":
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case "cancelled":
        return <XCircle className="h-5 w-5 text-gray-400" />
      default:
        return <Clock className="h-5 w-5 text-blue-600" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      case "cancelled":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  const isInstanceOverdue = (instance: ScheduledPaymentInstance) => {
    return instance.status === "pending" && isPast(new Date(instance.due_date))
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading payment timeline...</p>
      </div>
    )
  }

  if (instances.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No payment instances found</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <h4 className="font-semibold text-sm mb-4">Payment Timeline</h4>

        {instances.map((instance, index) => {
          const isOverdue = isInstanceOverdue(instance)

          return (
            <div
              key={instance.instance_id}
              className={`border rounded-lg p-4 ${
                isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Timeline Line */}
                <div className="flex flex-col items-center">
                  {getStatusIcon(instance)}
                  {index < instances.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-200 my-1" />
                  )}
                </div>

                {/* Instance Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">
                          Due: {format(new Date(instance.due_date), "MMMM d, yyyy")}
                        </p>
                        <Badge className={getStatusBadgeColor(instance.status)}>
                          {instance.status}
                        </Badge>
                        {isOverdue && (
                          <Badge className="bg-red-100 text-red-800">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Amount: {formatCurrency(instance.amount, 'VND')}
                      </p>
                    </div>

                    {/* Mark as Paid Button */}
                    {instance.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => setMarkingPaidInstance(instance)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Paid
                      </Button>
                    )}
                  </div>

                  {/* Payment Details (if paid) */}
                  {instance.status === "paid" && instance.paid_date && (
                    <div className="bg-green-50 border border-green-200 rounded p-3 mt-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Paid Date:</p>
                          <p className="font-medium">
                            {format(new Date(instance.paid_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Paid Amount:</p>
                          <p className="font-medium">
                            {formatCurrency(instance.paid_amount || instance.amount, 'VND')}
                          </p>
                        </div>
                      </div>
                      {instance.transaction_id && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Transaction ID: #{instance.transaction_id}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {instance.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p className="font-medium">Notes:</p>
                      <p>{instance.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mark as Paid Dialog */}
      {markingPaidInstance && (
        <MarkAsPaidDialog
          open={!!markingPaidInstance}
          onOpenChange={(open) => {
            if (!open) setMarkingPaidInstance(null)
          }}
          instance={markingPaidInstance}
          onSuccess={() => {
            fetchInstances()
            setMarkingPaidInstance(null)
          }}
        />
      )}
    </>
  )
}
