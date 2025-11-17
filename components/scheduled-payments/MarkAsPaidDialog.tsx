"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { ScheduledPaymentInstance } from "@/types/scheduled-payment"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"

interface MarkAsPaidDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: ScheduledPaymentInstance
  onSuccess: () => void
}

export function MarkAsPaidDialog({
  open,
  onOpenChange,
  instance,
  onSuccess
}: MarkAsPaidDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [paidDate, setPaidDate] = useState("")
  const [paidAmount, setPaidAmount] = useState("")
  const [createTransaction, setCreateTransaction] = useState(true)
  const [notes, setNotes] = useState("")

  // Initialize form with instance data
  useEffect(() => {
    if (open) {
      setPaidDate(new Date().toISOString().split('T')[0])
      setPaidAmount(instance.amount.toString())
      setCreateTransaction(true)
      setNotes("")
      setError(null)
    }
  }, [open, instance])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const amount = parseFloat(paidAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Paid amount must be greater than 0")
      return
    }

    if (!paidDate) {
      setError("Paid date is required")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/scheduled-payment-instances/${instance.instance_id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_date: paidDate,
          paid_amount: amount,
          create_transaction: createTransaction,
          notes: notes.trim() || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        onSuccess()
        onOpenChange(false)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to mark payment as paid')
      }
    } catch (err) {
      console.error('Error marking payment as paid:', err)
      setError('Failed to mark payment as paid')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Payment as Paid</DialogTitle>
          <DialogDescription>
            Record this payment instance as paid
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Payment Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-medium">
                  {format(new Date(instance.due_date), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Amount:</span>
                <span className="font-medium">
                  {formatCurrency(instance.amount, 'VND')}
                </span>
              </div>
            </div>
          </div>

          {/* Paid Date */}
          <div className="space-y-2">
            <Label htmlFor="paidDate">Paid Date *</Label>
            <Input
              id="paidDate"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
            />
          </div>

          {/* Paid Amount */}
          <div className="space-y-2">
            <Label htmlFor="paidAmount">Paid Amount *</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the actual amount paid (may differ from due amount)
            </p>
          </div>

          {/* Create Transaction */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="createTransaction"
              checked={createTransaction}
              onCheckedChange={(checked) => setCreateTransaction(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="createTransaction"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Create transaction record
              </label>
              <p className="text-xs text-muted-foreground">
                Automatically create a transaction for this payment
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this payment..."
              rows={3}
            />
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
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
