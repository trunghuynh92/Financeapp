"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, Info } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoanPaymentInput } from "@/types/loan"

interface RecordLoanPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  disbursementId: number
  borrowerName: string
  onSuccess: () => void
}

export function RecordLoanPaymentDialog({
  open,
  onOpenChange,
  disbursementId,
  borrowerName,
  onSuccess,
}: RecordLoanPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const [formData, setFormData] = useState<LoanPaymentInput>({
    loan_disbursement_id: disbursementId,
    payment_amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    notes: "",
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        loan_disbursement_id: disbursementId,
        payment_amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        notes: "",
      })
      setError(null)
      setWarning(null)
    }
  }, [open, disbursementId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setWarning(null)

    try {
      // Validation
      if (!formData.payment_amount || formData.payment_amount <= 0) {
        setError("Payment amount must be greater than 0")
        return
      }

      const response = await fetch(`/api/loan-disbursements/${disbursementId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to record payment")
      }

      // Check for overpayment warning
      if (data.warning && data.warning.type === 'overpayment') {
        setWarning(data.warning.message)
      }

      // Still call onSuccess even with warning
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Loan Payment</DialogTitle>
          <DialogDescription>
            Record a payment received from {borrowerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {warning && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="payment_amount">Payment Amount *</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.payment_amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes about this payment..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
