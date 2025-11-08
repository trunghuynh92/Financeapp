"use client"

import { useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
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
import { formatCurrency } from "@/lib/account-utils"
import { CreateDrawdownRequest } from "@/types/debt"

interface CreateDrawdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  accountName: string
  availableCredit?: number | null
  onSuccess: () => void
}

export function CreateDrawdownDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  availableCredit,
  onSuccess,
}: CreateDrawdownDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateDrawdownRequest>({
    account_id: accountId,
    drawdown_reference: "",
    drawdown_date: new Date().toISOString().split('T')[0],
    original_amount: 0,
    due_date: null,
    interest_rate: null,
    notes: null,
  })

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false)
      resetForm()
    }
  }

  function resetForm() {
    setFormData({
      account_id: accountId,
      drawdown_reference: "",
      drawdown_date: new Date().toISOString().split('T')[0],
      original_amount: 0,
      due_date: null,
      interest_rate: null,
      notes: null,
    })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate amount
      if (formData.original_amount <= 0) {
        throw new Error("Amount must be greater than 0")
      }

      // Validate reference
      if (!formData.drawdown_reference.trim()) {
        throw new Error("Drawdown reference is required")
      }

      // Check available credit
      if (availableCredit !== null && availableCredit !== undefined) {
        if (formData.original_amount > availableCredit) {
          throw new Error(
            `Amount exceeds available credit of ${formatCurrency(availableCredit, 'VND')}`
          )
        }
      }

      const response = await fetch(`/api/accounts/${accountId}/drawdowns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create drawdown")
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Drawdown</DialogTitle>
          <DialogDescription>
            Record a new debt drawdown for {accountName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Available Credit Alert */}
            {availableCredit !== null && availableCredit !== undefined && (
              <Alert>
                <AlertDescription>
                  Available Credit: <strong>{formatCurrency(availableCredit, 'VND')}</strong>
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

            {/* Drawdown Reference */}
            <div className="space-y-2">
              <Label htmlFor="drawdown_reference">
                Reference Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="drawdown_reference"
                placeholder="e.g., DD-2024-001, Invoice #12345"
                value={formData.drawdown_reference}
                onChange={(e) =>
                  setFormData({ ...formData, drawdown_reference: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Drawdown Date */}
            <div className="space-y-2">
              <Label htmlFor="drawdown_date">
                Drawdown Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="drawdown_date"
                type="date"
                value={formData.drawdown_date}
                onChange={(e) =>
                  setFormData({ ...formData, drawdown_date: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Original Amount */}
            <div className="space-y-2">
              <Label htmlFor="original_amount">
                Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="original_amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.original_amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    original_amount: parseFloat(e.target.value) || 0,
                  })
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Due Date (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date (Optional)</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    due_date: e.target.value || null,
                  })
                }
                disabled={isSubmitting}
              />
            </div>

            {/* Interest Rate (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate % (Optional)</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                placeholder="e.g., 8.5"
                value={formData.interest_rate || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interest_rate: parseFloat(e.target.value) || null,
                  })
                }
                disabled={isSubmitting}
              />
            </div>

            {/* Notes (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional information about this drawdown..."
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
                }
                disabled={isSubmitting}
                rows={3}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Drawdown
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
