"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/account-utils"
import { formatDate } from "@/lib/account-utils"
import { RecordDrawdownPaymentRequest, DrawdownWithDetails, getSubtypeLabel } from "@/types/debt"

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawdownId: number
  accountId: number
  onSuccess: () => void
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  drawdownId,
  accountId,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentWarning, setOverpaymentWarning] = useState<string | null>(null)
  const [drawdownDetails, setDrawdownDetails] = useState<DrawdownWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<RecordDrawdownPaymentRequest>({
    drawdown_id: drawdownId,
    account_id: accountId,
    transaction_date: new Date().toISOString().split('T')[0],
    amount: 0,
    transaction_subtype: 'principal',
    description: undefined,
    notes: undefined,
  })

  useEffect(() => {
    if (open) {
      fetchDrawdownDetails()
    }
  }, [open, drawdownId])

  async function fetchDrawdownDetails() {
    try {
      setLoading(true)
      const response = await fetch(`/api/drawdowns/${drawdownId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch drawdown details")
      }

      const data = await response.json()
      setDrawdownDetails(data.data)
    } catch (err) {
      console.error("Error fetching drawdown details:", err)
      setError(err instanceof Error ? err.message : "Failed to load drawdown details")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false)
      resetForm()
    }
  }

  function resetForm() {
    setFormData({
      drawdown_id: drawdownId,
      account_id: accountId,
      transaction_date: new Date().toISOString().split('T')[0],
      amount: 0,
      transaction_subtype: 'principal',
      description: undefined,
      notes: undefined,
    })
    setError(null)
    setOverpaymentWarning(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setOverpaymentWarning(null)

    try {
      // Validate amount
      if (formData.amount <= 0) {
        throw new Error("Amount must be greater than 0")
      }

      const response = await fetch(`/api/drawdowns/${drawdownId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to record payment")
      }

      // Check for overpayment warning
      if (data.warning && data.warning.type === 'overpayment') {
        setOverpaymentWarning(data.warning.message)
      }

      onSuccess()

      // Close after a brief delay if there was an overpayment warning
      if (data.warning) {
        setTimeout(() => {
          handleClose()
        }, 3000)
      } else {
        handleClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate if payment would cause overpayment (for principal only)
  const wouldOverpay = formData.transaction_subtype === 'principal' &&
    drawdownDetails &&
    formData.amount > Number(drawdownDetails.remaining_balance)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this drawdown
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Drawdown Info */}
              {drawdownDetails && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Reference:</span>
                        <span className="text-sm">{drawdownDetails.drawdown_reference}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Remaining Balance:</span>
                        <span className="text-sm font-bold">
                          {formatCurrency(drawdownDetails.remaining_balance, 'VND')}
                        </span>
                      </div>
                      {drawdownDetails.due_date && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Due Date:</span>
                          <span className="text-sm">{formatDate(drawdownDetails.due_date)}</span>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Alert (Overpayment Warning) */}
              {overpaymentWarning && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Payment recorded successfully!</p>
                      <p className="text-sm">{overpaymentWarning}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Payment Type */}
              <div className="space-y-2">
                <Label htmlFor="transaction_subtype">
                  Payment Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.transaction_subtype}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, transaction_subtype: value })
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">
                      {getSubtypeLabel('principal')}
                    </SelectItem>
                    <SelectItem value="interest">
                      {getSubtypeLabel('interest')}
                    </SelectItem>
                    <SelectItem value="fee">
                      {getSubtypeLabel('fee')}
                    </SelectItem>
                    <SelectItem value="penalty">
                      {getSubtypeLabel('penalty')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only principal payments reduce the remaining balance
                </p>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="transaction_date">
                  Payment Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) =>
                    setFormData({ ...formData, transaction_date: e.target.value })
                  }
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  disabled={isSubmitting}
                />
                {wouldOverpay && (
                  <p className="text-xs text-yellow-600">
                    This payment exceeds the remaining balance and will be recorded as an overpayment
                  </p>
                )}
              </div>

              {/* Description (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Payment via bank transfer"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value || undefined })
                  }
                  disabled={isSubmitting}
                />
              </div>

              {/* Notes (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value || undefined })
                  }
                  disabled={isSubmitting}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || loading}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
