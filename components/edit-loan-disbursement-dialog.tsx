"use client"

import { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UpdateLoanDisbursementInput, LOAN_CATEGORY_LABELS, LoanDisbursementWithAccount } from "@/types/loan"

interface EditLoanDisbursementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanDisbursementWithAccount | null
  onSuccess: () => void
}

export function EditLoanDisbursementDialog({
  open,
  onOpenChange,
  loan,
  onSuccess,
}: EditLoanDisbursementDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<UpdateLoanDisbursementInput>({
    loan_category: "short_term",
    due_date: null,
    term_months: null,
    interest_rate: null,
    notes: null,
  })

  // Initialize form when loan changes
  useEffect(() => {
    if (loan && open) {
      setFormData({
        loan_category: loan.loan_category,
        due_date: loan.due_date || null,
        term_months: loan.term_months || null,
        interest_rate: loan.interest_rate || null,
        notes: loan.notes || null,
      })
    }
  }, [loan, open])

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false)
      setError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!loan) {
        throw new Error("No loan selected")
      }

      const response = await fetch(`/api/loan-disbursements/${loan.loan_disbursement_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update loan disbursement")
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!loan) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Loan Disbursement</DialogTitle>
          <DialogDescription>
            Update loan details for {loan.borrower_name || 'Unknown Borrower'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loan Details */}
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="loan_category">Loan Category</Label>
                  <Select
                    value={formData.loan_category}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, loan_category: value })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOAN_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value || null })
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="term_months">Term (Months)</Label>
                  <Input
                    id="term_months"
                    type="number"
                    min="1"
                    value={formData.term_months || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        term_months: parseInt(e.target.value) || null,
                      })
                    }
                    placeholder="e.g., 12"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.interest_rate || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interest_rate: parseFloat(e.target.value) || null,
                      })
                    }
                    placeholder="e.g., 5.00"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    For reference only (not auto-calculated)
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
                }
                placeholder="Optional notes about this loan..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
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
              Update Loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
