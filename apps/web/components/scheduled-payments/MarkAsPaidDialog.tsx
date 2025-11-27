"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle, AlertCircle, Plus, Trash2, X } from "lucide-react"
import { ScheduledPaymentInstance } from "@/types/scheduled-payment"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"
import { useEntity } from "@/contexts/EntityContext"

interface MarkAsPaidDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: ScheduledPaymentInstance
  onSuccess: () => void
}

interface PaymentEntry {
  id: string
  account_id: number | null
  amount: string
  paid_date: string
  notes: string
}

export function MarkAsPaidDialog({
  open,
  onOpenChange,
  instance,
  onSuccess
}: MarkAsPaidDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])

  // Multiple payment entries
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([{
    id: '1',
    account_id: null,
    amount: '',
    paid_date: new Date().toISOString().split('T')[0],
    notes: ''
  }])

  // Initialize form
  useEffect(() => {
    if (open) {
      const defaultAmount = instance.amount.toString()
      setPaymentEntries([{
        id: '1',
        account_id: null,
        amount: defaultAmount,
        paid_date: new Date().toISOString().split('T')[0],
        notes: ''
      }])
      setError(null)
      fetchAccounts()
    }
  }, [open, instance])

  const fetchAccounts = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}&is_active=true`)
      if (response.ok) {
        const data = await response.json()
        // Filter to bank and cash accounts only
        const filtered = (data.data || []).filter((a: any) =>
          ['bank', 'cash'].includes(a.account_type)
        )
        setAccounts(filtered)
      }
    } catch (err) {
      console.error('Error fetching accounts:', err)
    }
  }

  const addPaymentEntry = () => {
    const newId = String(Date.now())
    setPaymentEntries([...paymentEntries, {
      id: newId,
      account_id: null,
      amount: '',
      paid_date: new Date().toISOString().split('T')[0],
      notes: ''
    }])
  }

  const removePaymentEntry = (id: string) => {
    if (paymentEntries.length === 1) {
      setError('You must have at least one payment entry')
      return
    }
    setPaymentEntries(paymentEntries.filter(e => e.id !== id))
  }

  const updatePaymentEntry = (id: string, field: keyof PaymentEntry, value: any) => {
    setPaymentEntries(paymentEntries.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ))
  }

  const calculateTotal = () => {
    return paymentEntries.reduce((sum, entry) => {
      const amount = parseFloat(entry.amount) || 0
      return sum + amount
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    for (const entry of paymentEntries) {
      if (!entry.account_id) {
        setError('All payment entries must have an account selected')
        return
      }
      const amount = parseFloat(entry.amount)
      if (isNaN(amount) || amount <= 0) {
        setError('All payment amounts must be greater than 0')
        return
      }
      if (!entry.paid_date) {
        setError('All payment entries must have a date')
        return
      }
    }

    const total = calculateTotal()
    if (total > instance.amount * 1.5) {
      if (!confirm(`Total payment (${formatCurrency(total, 'VND')}) is more than 50% over the due amount (${formatCurrency(instance.amount, 'VND')}). Are you sure?`)) {
        return
      }
    }

    setLoading(true)

    try {
      // Create transactions and link them to the payment instance
      const results = []

      for (const entry of paymentEntries) {
        const amount = parseFloat(entry.amount)

        // Call the mark-paid endpoint for each payment entry
        const response = await fetch(`/api/scheduled-payment-instances/${instance.instance_id}/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paid_date: entry.paid_date,
            paid_amount: amount,
            account_id: entry.account_id,
            create_transaction: true,
            notes: entry.notes.trim() || undefined
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to mark payment as paid')
        }

        const data = await response.json()
        results.push(data)
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error marking payment as paid:', err)
      setError(err.message || 'Failed to mark payment as paid')
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = calculateTotal()
  const remaining = instance.amount - totalAmount
  const isOverpaid = totalAmount > instance.amount
  const isUnderpaid = totalAmount < instance.amount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Payment as Paid</DialogTitle>
          <DialogDescription>
            Record one or multiple transactions for this payment
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

          {/* Payment Entries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Payment Transactions</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addPaymentEntry}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </div>

            {paymentEntries.map((entry, index) => (
              <div key={entry.id} className="border rounded-lg p-4 space-y-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Payment #{index + 1}</span>
                  {paymentEntries.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removePaymentEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Account */}
                  <div className="space-y-2">
                    <Label htmlFor={`account-${entry.id}`}>Account *</Label>
                    <Select
                      value={entry.account_id?.toString() || ""}
                      onValueChange={(v) => updatePaymentEntry(entry.id, 'account_id', parseInt(v))}
                    >
                      <SelectTrigger id={`account-${entry.id}`}>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.account_id} value={account.account_id.toString()}>
                            {account.account_name} ({account.account_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor={`amount-${entry.id}`}>Amount (VND) *</Label>
                    <Input
                      id={`amount-${entry.id}`}
                      type="number"
                      step="0.01"
                      value={entry.amount}
                      onChange={(e) => updatePaymentEntry(entry.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor={`date-${entry.id}`}>Paid Date *</Label>
                    <Input
                      id={`date-${entry.id}`}
                      type="date"
                      value={entry.paid_date}
                      onChange={(e) => updatePaymentEntry(entry.id, 'paid_date', e.target.value)}
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${entry.id}`}>Notes</Label>
                    <Input
                      id={`notes-${entry.id}`}
                      value={entry.notes}
                      onChange={(e) => updatePaymentEntry(entry.id, 'notes', e.target.value)}
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className={`border rounded-lg p-4 ${
            isOverpaid ? 'bg-orange-50 border-orange-200' :
            isUnderpaid ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Total Payment:</span>
                <span className="font-bold">{formatCurrency(totalAmount, 'VND')}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Due Amount:</span>
                <span>{formatCurrency(instance.amount, 'VND')}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">
                  {isOverpaid ? 'Overpaid:' : isUnderpaid ? 'Remaining:' : 'Status:'}
                </span>
                <span className={`font-bold ${
                  isOverpaid ? 'text-orange-600' :
                  isUnderpaid ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {isOverpaid ? `+${formatCurrency(Math.abs(remaining), 'VND')}` :
                   isUnderpaid ? formatCurrency(remaining, 'VND') :
                   'Fully Paid'}
                </span>
              </div>
            </div>
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
                  Saving {paymentEntries.length} Payment{paymentEntries.length > 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as {isUnderpaid ? 'Partially ' : ''}Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
