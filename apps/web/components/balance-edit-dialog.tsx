"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
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
import { DatePicker } from "@/components/ui/date-picker"
import type { Account } from "@/types/account"
import { formatCurrency, formatDate } from "@/lib/account-utils"

interface BalanceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  currentBalance: number
  onSuccess: () => void
}

export function BalanceEditDialog({
  open,
  onOpenChange,
  account,
  currentBalance,
  onSuccess,
}: BalanceEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState("")
  const [balanceDate, setBalanceDate] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (open && account) {
      setBalance(currentBalance.toString())
      setNotes("")
      // Set to today's date in YYYY-MM-DD format
      const today = new Date()
      setBalanceDate(today.toISOString().split('T')[0])
      setError("")
      setSuccessMessage("")
    }
  }, [open, account, currentBalance])

  async function handleSave() {
    if (!account) return

    const declaredBalance = parseFloat(balance)
    if (isNaN(declaredBalance)) {
      setError("Please enter a valid number")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccessMessage("")

      // Create checkpoint instead of direct balance update
      const response = await fetch(`/api/accounts/${account.account_id}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint_date: balanceDate,
          declared_balance: declaredBalance,
          notes: notes || `Balance checkpoint created on ${formatDate(new Date())}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create checkpoint")
      }

      const result = await response.json()
      const checkpoint = result.data

      // Show success message with adjustment info
      if (checkpoint.is_reconciled) {
        setSuccessMessage(
          `✅ Checkpoint created! Your balance is fully reconciled - all transactions accounted for.`
        )
      } else {
        const adjustmentAmount = Math.abs(checkpoint.adjustment_amount)
        const adjustmentType = checkpoint.adjustment_amount > 0 ? "unexplained income" : "unexplained expenses"

        setSuccessMessage(
          `✅ Checkpoint created!\n\n` +
          `Declared: ${formatCurrency(checkpoint.declared_balance, account.currency)}\n` +
          `Calculated: ${formatCurrency(checkpoint.calculated_balance, account.currency)}\n` +
          `Adjustment: ${formatCurrency(adjustmentAmount, account.currency)} (${adjustmentType})\n\n` +
          `💡 Add historical transactions to reconcile this amount.`
        )
      }

      // Refresh account data after a short delay to show the message
      setTimeout(() => {
        onSuccess()
        onOpenChange(false)
      }, 3000)

    } catch (error: any) {
      console.error("Error creating checkpoint:", error)
      setError(error.message || "Failed to create checkpoint. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Balance Checkpoint</DialogTitle>
          <DialogDescription>
            Create a balance checkpoint for {account?.account_name} to track reconciliation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning about checkpoint system */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900">Balance Checkpoint System</p>
                <p className="text-blue-700">
                  When you create a checkpoint, the system:
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Compares your declared balance to calculated balance from transactions</li>
                  <li>Flags any unexplained difference as a balance adjustment</li>
                  <li>Encourages you to add historical transactions to reconcile</li>
                </ul>
                <p className="text-blue-700 font-medium">
                  This ensures all money has a documented origin.
                </p>
              </div>
            </div>
          </div>

          {/* Current balance display */}
          <div className="space-y-2">
            <Label>Current Balance</Label>
            <div className="text-2xl font-bold text-muted-foreground">
              {account && formatCurrency(currentBalance, account.currency)}
            </div>
          </div>

          {/* Declared balance input */}
          <div className="space-y-2">
            <Label htmlFor="declared_balance">Declared Balance *</Label>
            <Input
              id="declared_balance"
              type="number"
              step="0.01"
              placeholder="Enter the balance you know"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value)
                setError("")
              }}
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {account?.currency === "VND"
                ? "The balance amount from your bank statement or records"
                : "The balance amount with up to 2 decimal places"}
            </p>
          </div>

          {/* Checkpoint date */}
          <DatePicker
            label="Checkpoint Date *"
            value={balanceDate}
            onChange={setBalanceDate}
            max={new Date().toISOString().split('T')[0]}
          />
          <div className="space-y-1 -mt-2">
            <p className="text-xs text-muted-foreground">
              The date you know this balance (e.g., bank statement date)
            </p>
            <p className="text-xs text-amber-600 font-medium">
              ⓘ Checkpoints are always set to end of day. If you meant to create a checkpoint at the start of a day, use the previous date instead.
            </p>
          </div>

          {/* Notes field */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., From November 2025 bank statement"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Document where this balance came from for audit trail
            </p>
          </div>

          {/* Balance change preview */}
          {currentBalance !== parseFloat(balance || "0") && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-sm font-medium">Balance Change</p>
              <p className="text-xs text-muted-foreground">
                {parseFloat(balance || "0") > currentBalance ? "Increase" : "Decrease"} of{" "}
                {account && formatCurrency(Math.abs(parseFloat(balance || "0") - currentBalance), account.currency)}
              </p>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <pre className="text-sm text-green-800 whitespace-pre-wrap font-sans">
                {successMessage}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !balance || successMessage !== ""}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Checkpoint...
              </>
            ) : successMessage ? (
              "✓ Checkpoint Created"
            ) : (
              "Create Checkpoint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
