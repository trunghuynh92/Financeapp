"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, X } from "lucide-react"
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
import { UpdateDrawdownRequest, DrawdownListItem } from "@/types/debt"

interface EditDrawdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  drawdown: DrawdownListItem | null
  onSuccess: () => void
}

export function EditDrawdownDialog({
  open,
  onOpenChange,
  accountId,
  drawdown,
  onSuccess,
}: EditDrawdownDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<UpdateDrawdownRequest>({
    drawdown_reference: "",
    due_date: null,
    interest_rate: null,
    notes: null,
  })

  // Initialize form when drawdown changes
  useEffect(() => {
    if (drawdown && open) {
      setFormData({
        drawdown_reference: drawdown.drawdown_reference || "",
        due_date: drawdown.due_date || null,
        interest_rate: drawdown.interest_rate || null,
        notes: drawdown.notes || null,
      })
    }
  }, [drawdown, open])

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
      if (!drawdown) {
        throw new Error("No drawdown selected")
      }

      // Validate reference
      if (!formData.drawdown_reference?.trim()) {
        throw new Error("Drawdown reference is required")
      }

      const response = await fetch(
        `/api/accounts/${accountId}/drawdowns?drawdown_id=${drawdown.drawdown_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update drawdown")
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!drawdown) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Drawdown</DialogTitle>
          <DialogDescription>
            Update drawdown details for {drawdown.drawdown_reference}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
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
                value={formData.drawdown_reference || ""}
                onChange={(e) =>
                  setFormData({ ...formData, drawdown_reference: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Due Date (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date (Optional)</Label>

              {/* Quick Duration Buttons */}
              <div className="flex gap-2 flex-wrap mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dueDate = new Date()
                    dueDate.setMonth(dueDate.getMonth() + 1)
                    setFormData({
                      ...formData,
                      due_date: dueDate.toISOString().split('T')[0],
                    })
                  }}
                  disabled={isSubmitting}
                >
                  1 Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dueDate = new Date()
                    dueDate.setMonth(dueDate.getMonth() + 3)
                    setFormData({
                      ...formData,
                      due_date: dueDate.toISOString().split('T')[0],
                    })
                  }}
                  disabled={isSubmitting}
                >
                  3 Months
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dueDate = new Date()
                    dueDate.setMonth(dueDate.getMonth() + 6)
                    setFormData({
                      ...formData,
                      due_date: dueDate.toISOString().split('T')[0],
                    })
                  }}
                  disabled={isSubmitting}
                >
                  6 Months
                </Button>
                {formData.due_date && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        due_date: null,
                      })
                    }}
                    disabled={isSubmitting}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

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
              Update Drawdown
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
