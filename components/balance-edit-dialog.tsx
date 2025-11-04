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
import { DatePicker } from "@/components/ui/date-picker"
import type { Account } from "@/types/account"
import { formatCurrency } from "@/lib/account-utils"

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

  useEffect(() => {
    if (open && account) {
      setBalance(currentBalance.toString())
      // Set to today's date in YYYY-MM-DD format
      const today = new Date()
      setBalanceDate(today.toISOString().split('T')[0])
      setNotes("")
      setError("")
    }
  }, [open, account, currentBalance])

  async function handleSave() {
    if (!account) return

    const newBalance = parseFloat(balance)
    if (isNaN(newBalance)) {
      setError("Please enter a valid number")
      return
    }

    try {
      setLoading(true)
      setError("")

      // Create a checkpoint instead of directly updating balance
      const response = await fetch(`/api/accounts/${account.account_id}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint_date: new Date(balanceDate).toISOString(),
          declared_balance: newBalance,
          notes: notes || `Balance checkpoint set to ${newBalance}`
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create balance checkpoint")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error creating checkpoint:", error)
      setError(error.message || "Failed to create balance checkpoint. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Balance Checkpoint</DialogTitle>
          <DialogDescription>
            Declare the known balance for {account?.account_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900 font-medium mb-1">💡 Balance Checkpoint</p>
            <p className="text-xs text-blue-700">
              This creates a checkpoint to track your declared balance at a specific date.
              The system will automatically calculate adjustments based on your transactions.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Current Calculated Balance</Label>
            <div className="text-2xl font-bold text-muted-foreground">
              {account && formatCurrency(currentBalance, account.currency)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_balance">Declared Balance *</Label>
            <Input
              id="new_balance"
              type="number"
              step="0.01"
              placeholder="Enter known balance"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value)
                setError("")
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {account?.currency === "VND"
                ? "Enter the balance you know from bank statement (no decimals for VND)"
                : "Enter the balance you know from bank statement (up to 2 decimals)"}
            </p>
          </div>

          <div className="space-y-2">
            <DatePicker
              label="Checkpoint Date *"
              value={balanceDate}
              onChange={setBalanceDate}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              The date you know this balance (e.g., bank statement date)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., From December bank statement"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Document where this balance came from
            </p>
          </div>

          {currentBalance !== parseFloat(balance || "0") && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-sm font-medium text-amber-900">
                ⚠️ Adjustment Needed
              </p>
              <p className="text-xs text-amber-700">
                Difference of{" "}
                {account && formatCurrency(Math.abs(parseFloat(balance || "0") - currentBalance), account.currency)}
                {" "}will be tracked as a flagged adjustment transaction until reconciled with historical transactions.
              </p>
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
          <Button onClick={handleSave} disabled={loading || !balance}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Checkpoint...
              </>
            ) : (
              "Create Checkpoint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
