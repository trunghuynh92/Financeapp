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
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && account) {
      setBalance(currentBalance.toString())
      // Set to today's date in YYYY-MM-DD format
      const today = new Date()
      setBalanceDate(today.toISOString().split('T')[0])
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

      const response = await fetch(`/api/accounts/${account.account_id}/balance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: newBalance,
          updated_date: new Date(balanceDate).toISOString()
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update balance")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error updating balance:", error)
      setError(error.message || "Failed to update balance. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Account Balance</DialogTitle>
          <DialogDescription>
            Update the balance for {account?.account_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Balance</Label>
            <div className="text-2xl font-bold text-muted-foreground">
              {account && formatCurrency(currentBalance, account.currency)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_balance">New Balance *</Label>
            <Input
              id="new_balance"
              type="number"
              step="0.01"
              placeholder="Enter new balance"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value)
                setError("")
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {account?.currency === "VND"
                ? "Enter the amount (no decimals for VND)"
                : "Enter the amount with up to 2 decimal places"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance_date">Balance Update Date</Label>
            <Input
              id="balance_date"
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              The date when this balance is effective
            </p>
          </div>

          {currentBalance !== parseFloat(balance || "0") && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-sm font-medium">Balance Change</p>
              <p className="text-xs text-muted-foreground">
                {parseFloat(balance || "0") > currentBalance ? "Increase" : "Decrease"} of{" "}
                {account && formatCurrency(Math.abs(parseFloat(balance || "0") - currentBalance), account.currency)}
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
                Updating...
              </>
            ) : (
              "Update Balance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
