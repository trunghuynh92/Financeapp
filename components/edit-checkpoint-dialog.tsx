"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
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
import { BalanceCheckpoint } from "@/types/checkpoint"

interface EditCheckpointDialogProps {
  checkpoint: BalanceCheckpoint
  accountId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditCheckpointDialog({
  checkpoint,
  accountId,
  open,
  onOpenChange,
  onSuccess,
}: EditCheckpointDialogProps) {
  const [declaredBalance, setDeclaredBalance] = useState(checkpoint.declared_balance.toString())
  const [notes, setNotes] = useState(checkpoint.notes || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDeclaredBalance(checkpoint.declared_balance.toString())
      setNotes(checkpoint.notes || "")
      setError(null)
    }
  }, [open, checkpoint])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const balance = parseFloat(declaredBalance)
    if (isNaN(balance)) {
      setError("Please enter a valid balance amount")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/checkpoints/${checkpoint.checkpoint_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            declared_balance: balance,
            notes: notes.trim() || null,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update checkpoint")
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "Failed to update checkpoint")
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(value: string): string {
    const num = parseFloat(value.replace(/,/g, ""))
    if (isNaN(num)) return value
    return new Intl.NumberFormat("vi-VN").format(num)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Checkpoint</DialogTitle>
          <DialogDescription>
            Update the declared balance for this checkpoint. The calculated balance will be automatically recalculated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Checkpoint Date</Label>
              <Input
                id="date"
                type="text"
                value={new Date(checkpoint.checkpoint_date).toLocaleDateString()}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="declared">Declared Balance *</Label>
              <Input
                id="declared"
                type="text"
                value={formatCurrency(declaredBalance)}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, "")
                  setDeclaredBalance(rawValue)
                }}
                placeholder="Enter balance amount"
                required
              />
              <p className="text-xs text-muted-foreground">
                Current: {new Intl.NumberFormat("vi-VN").format(checkpoint.declared_balance)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calculated">Calculated Balance (Read-only)</Label>
              <Input
                id="calculated"
                type="text"
                value={new Intl.NumberFormat("vi-VN").format(checkpoint.calculated_balance)}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this checkpoint..."
                rows={3}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
