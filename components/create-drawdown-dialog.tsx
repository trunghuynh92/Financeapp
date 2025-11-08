"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, Info, X } from "lucide-react"
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
import { formatCurrency } from "@/lib/account-utils"
import { CreateDrawdownRequest } from "@/types/debt"

interface CreateDrawdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: number // Now optional
  accountName?: string // Now optional
  availableCredit?: number | null
  prefilledAmount?: number // New: prefill from DEBT_ACQ
  prefilledDate?: string // New: prefill from DEBT_ACQ
  onSuccess: () => void
}

export function CreateDrawdownDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  availableCredit,
  prefilledAmount,
  prefilledDate,
  onSuccess,
}: CreateDrawdownDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debtAccounts, setDebtAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(accountId || null)
  const [selectedAccountCredit, setSelectedAccountCredit] = useState<number | null>(null)

  const [formData, setFormData] = useState<CreateDrawdownRequest>({
    account_id: accountId || 0,
    drawdown_reference: "",
    drawdown_date: prefilledDate || new Date().toISOString().split('T')[0],
    original_amount: prefilledAmount || 0,
    due_date: null,
    interest_rate: null,
    notes: null,
  })

  // Fetch debt accounts if accountId is not provided
  useEffect(() => {
    if (!accountId && open) {
      fetchDebtAccounts()
    }
  }, [accountId, open])

  // Update form when prefilled values change
  useEffect(() => {
    if (prefilledAmount !== undefined) {
      setFormData(prev => ({ ...prev, original_amount: prefilledAmount }))
    }
    if (prefilledDate !== undefined) {
      setFormData(prev => ({ ...prev, drawdown_date: prefilledDate }))
    }
  }, [prefilledAmount, prefilledDate])

  async function fetchDebtAccounts() {
    try {
      const response = await fetch('/api/accounts')
      if (response.ok) {
        const data = await response.json()
        // Filter for only credit_line and term_loan accounts
        const filtered = (data.data || []).filter((acc: any) =>
          acc.account_type === 'credit_line' || acc.account_type === 'term_loan'
        )
        setDebtAccounts(filtered)
      }
    } catch (error) {
      console.error('Error fetching debt accounts:', error)
    }
  }

  function handleAccountChange(value: string) {
    const selectedId = parseInt(value)
    setSelectedAccountId(selectedId)
    setFormData({ ...formData, account_id: selectedId })

    // Fetch available credit for this account
    fetchAvailableCredit(selectedId)
  }

  async function fetchAvailableCredit(accId: number) {
    try {
      const response = await fetch(`/api/accounts/${accId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedAccountCredit(data.data?.available_credit || null)
      }
    } catch (error) {
      console.error('Error fetching available credit:', error)
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
      account_id: accountId || 0,
      drawdown_reference: "",
      drawdown_date: prefilledDate || new Date().toISOString().split('T')[0],
      original_amount: prefilledAmount || 0,
      due_date: null,
      interest_rate: null,
      notes: null,
    })
    setSelectedAccountId(accountId || null)
    setSelectedAccountCredit(null)
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

      // Validate account selection when accountId is not provided
      if (!accountId && !selectedAccountId) {
        throw new Error("Please select a debt account")
      }

      const targetAccountId = accountId || selectedAccountId!

      // Check available credit
      const creditToCheck = availableCredit !== null && availableCredit !== undefined
        ? availableCredit
        : selectedAccountCredit

      if (creditToCheck !== null && creditToCheck !== undefined) {
        if (formData.original_amount > creditToCheck) {
          throw new Error(
            `Amount exceeds available credit of ${formatCurrency(creditToCheck, 'VND')}`
          )
        }
      }

      const response = await fetch(`/api/accounts/${targetAccountId}/drawdowns`, {
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
            {accountName
              ? `Record a new debt drawdown for ${accountName}`
              : 'Select a debt account and record a new drawdown'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Debt Account Selector (only when accountId not provided) */}
            {!accountId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="account_selector">
                    Debt Account <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedAccountId?.toString() || ""}
                    onValueChange={handleAccountChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="account_selector">
                      <SelectValue placeholder="Select a credit line or term loan account" />
                    </SelectTrigger>
                    <SelectContent>
                      {debtAccounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id.toString()}>
                          {account.account_name} - {account.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Info Alert about creating accounts */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Can&apos;t find the debt account? Create one in the <strong>Accounts Page</strong>
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Available Credit Alert */}
            {(availableCredit !== null && availableCredit !== undefined) && (
              <Alert>
                <AlertDescription>
                  Available Credit: <strong>{formatCurrency(availableCredit, 'VND')}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Selected Account Available Credit */}
            {!accountId && selectedAccountCredit !== null && (
              <Alert>
                <AlertDescription>
                  Available Credit: <strong>{formatCurrency(selectedAccountCredit, 'VND')}</strong>
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

              {/* Quick Duration Buttons */}
              <div className="flex gap-2 flex-wrap mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dueDate = new Date(formData.drawdown_date)
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
                    const dueDate = new Date(formData.drawdown_date)
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
                    const dueDate = new Date(formData.drawdown_date)
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dueDate = new Date(formData.drawdown_date)
                    dueDate.setMonth(dueDate.getMonth() + 12)
                    setFormData({
                      ...formData,
                      due_date: dueDate.toISOString().split('T')[0],
                    })
                  }}
                  disabled={isSubmitting}
                >
                  12 Months
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
              Create Drawdown
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
