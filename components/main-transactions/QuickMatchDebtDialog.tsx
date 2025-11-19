"use client"

import { useState, useEffect } from "react"
import { Loader2, Link2, CreditCard, Link2Off, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MainTransactionDetails } from "@/types/main-transaction"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
  entity_id: string
}

interface QuickMatchDebtDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

export function QuickMatchDebtDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: QuickMatchDebtDialogProps) {
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [unmatching, setUnmatching] = useState(false)
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null)
  const [currentMatch, setCurrentMatch] = useState<MainTransactionDetails | null>(null)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)

  // Drawdown fields
  const [drawdownReference, setDrawdownReference] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [interestRate, setInterestRate] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCurrentMatch()
      fetchAvailableAccounts()
      // Auto-generate drawdown reference
      const ref = `DWN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      setDrawdownReference(ref)
    }
  }, [open, sourceTransaction])

  const fetchCurrentMatch = async () => {
    if (!sourceTransaction?.transfer_matched_transaction_id) {
      setCurrentMatch(null)
      setShowUnmatchConfirm(false)
      return
    }

    try {
      const response = await fetch(`/api/main-transactions/${sourceTransaction.transfer_matched_transaction_id}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentMatch(data.data)
        setShowUnmatchConfirm(false)
      }
    } catch (error) {
      console.error("Error fetching current match:", error)
    }
  }

  const fetchAvailableAccounts = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      const response = await fetch(`/api/accounts?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const result = await response.json()
      const data = result.data || result

      // Filter to debt_payable accounts (credit_line, term_loan, credit_card)
      const filtered = Array.isArray(data)
        ? data.filter((acc: Account) =>
            ['credit_line', 'term_loan', 'credit_card'].includes(acc.account_type)
          )
        : []

      setAvailableAccounts(filtered)
    } catch (error) {
      console.error("Error fetching available debt payable accounts:", error)
      alert("Failed to load available debt payable accounts")
    } finally {
      setLoading(false)
    }
  }

  const handleUnmatch = async () => {
    if (!sourceTransaction) return

    setUnmatching(true)
    try {
      const response = await fetch(`/api/transfers/unmatch/${sourceTransaction.main_transaction_id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to unmatch debt transaction")
      }

      // Clear current match and reset to allow new selection
      setCurrentMatch(null)
      setShowUnmatchConfirm(false)
      setSelectedAccount(null)

      // Refresh available accounts
      await fetchAvailableAccounts()

      alert("Debt drawdown unmatched successfully! The drawdown record and paired transaction were auto-deleted.")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error unmatching debt transaction:", error)
      alert(error.message || "Failed to unmatch debt transaction. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  const handleMatch = async () => {
    if (!selectedAccount || !sourceTransaction || !drawdownReference) return

    // Validation
    if (!drawdownReference.trim()) {
      alert("Please enter a drawdown reference")
      return
    }

    setMatching(true)
    try {
      const response = await fetch(
        `/api/main-transactions/${sourceTransaction.main_transaction_id}/match-debt-drawdown`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            debt_payable_account_id: selectedAccount,
            drawdown_reference: drawdownReference,
            due_date: dueDate || null,
            interest_rate: interestRate ? parseFloat(interestRate) : null,
            notes: notes || null,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create debt drawdown")
      }

      alert("Debt drawdown created and matched successfully!")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error matching debt drawdown:", error)
      alert(error.message || "Failed to create debt drawdown. Please try again.")
    } finally {
      setMatching(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (!sourceTransaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentMatch ? 'Change Debt Match' : 'Match Debt Drawdown'}</DialogTitle>
          <DialogDescription>
            {currentMatch && !showUnmatchConfirm ? (
              <>This debt transaction is currently matched. Click &quot;Change Match&quot; to unmatch and select a different account.</>
            ) : (
              <>
                Select a debt payable account (credit line, term loan, or credit card) to create a new debt drawdown record.
                The system will automatically create the paired transaction on the selected account.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Source Transaction Info */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="text-sm font-medium mb-2">Source Transaction:</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Account:</span> {sourceTransaction.account_name}
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span> {formatDate(sourceTransaction.transaction_date)}
            </div>
            <div>
              <span className="text-muted-foreground">Amount:</span>{" "}
              <span className="font-mono font-medium">{formatAmount(sourceTransaction.amount)}</span>
            </div>
            <div>
              <Badge variant="default">
                <CreditCard className="h-3 w-3 mr-1" />
                Debt Taken
              </Badge>
            </div>
          </div>
          {sourceTransaction.description && (
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Description:</span> {sourceTransaction.description}
            </div>
          )}
        </div>

        {/* Current Match Info */}
        {currentMatch && !showUnmatchConfirm && (
          <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-green-700" />
                <div className="text-sm font-medium text-green-900">Currently Matched With:</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnmatchConfirm(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Link2Off className="h-4 w-4 mr-1" />
                Change Match
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Account:</span> {currentMatch.account_name}
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span> {formatDate(currentMatch.transaction_date)}
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span>{" "}
                <span className="font-mono font-medium">{formatAmount(currentMatch.amount)}</span>
              </div>
              <div>
                <Badge variant="default">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Debt Payable Account
                </Badge>
              </div>
            </div>
            {currentMatch.description && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Description:</span> {currentMatch.description}
              </div>
            )}
          </div>
        )}

        {/* Unmatch Confirmation */}
        {currentMatch && showUnmatchConfirm && (
          <div className="p-4 border-2 border-yellow-500 rounded-lg bg-yellow-50">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-700 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-900 mb-1">
                  Confirm Unmatch & Delete Drawdown
                </div>
                <div className="text-xs text-yellow-800">
                  This will unmatch the current debt transaction and automatically delete the debt_drawdown record and paired transaction.
                  This action maintains proper bookkeeping - if it&apos;s no longer a debt, the records should be removed.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnmatchConfirm(false)}
                disabled={unmatching}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnmatch}
                disabled={unmatching}
              >
                {unmatching ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Unmatching...
                  </>
                ) : (
                  <>
                    <Link2Off className="mr-2 h-3 w-3" />
                    Unmatch Current Transaction
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Account Selection & Drawdown Fields */}
        {(!currentMatch || showUnmatchConfirm) && (
          <div className="space-y-4">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Select Debt Payable Account <span className="text-red-500">*</span>
              </Label>
              {loading ? (
                <div className="text-center py-4 border rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading accounts...</p>
                </div>
              ) : availableAccounts.length === 0 ? (
                <div className="text-center py-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">No debt payable accounts available</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a credit line, term loan, or credit card account first</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {availableAccounts.map((account) => (
                    <div
                      key={account.account_id}
                      className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                        selectedAccount === account.account_id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                      }`}
                      onClick={() => setSelectedAccount(account.account_id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <input
                            type="radio"
                            checked={selectedAccount === account.account_id}
                            onChange={() => setSelectedAccount(account.account_id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{account.account_name}</div>
                            {account.bank_name && (
                              <div className="text-xs text-muted-foreground">{account.bank_name}</div>
                            )}
                            <Badge variant="outline" className="mt-1 text-xs">
                              {account.account_type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawdown Fields */}
            {selectedAccount && (
              <div className="space-y-3 border-t pt-4">
                <div className="text-sm font-medium mb-2">Drawdown Details</div>

                {/* Drawdown Reference */}
                <div className="space-y-1">
                  <Label htmlFor="drawdown-reference" className="text-sm">
                    Drawdown Reference <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="drawdown-reference"
                    value={drawdownReference}
                    onChange={(e) => setDrawdownReference(e.target.value)}
                    placeholder="e.g., DWN-2025-001"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <Label htmlFor="due-date" className="text-sm">Due Date (optional)</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                {/* Interest Rate */}
                <div className="space-y-1">
                  <Label htmlFor="interest-rate" className="text-sm">Interest Rate % (optional)</Label>
                  <Input
                    id="interest-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="e.g., 12.5"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this drawdown..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full justify-end items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={matching || unmatching}
            >
              {currentMatch && !showUnmatchConfirm ? 'Close' : 'Cancel'}
            </Button>
            {(!currentMatch || showUnmatchConfirm) && (
              <Button
                onClick={handleMatch}
                disabled={!selectedAccount || !drawdownReference || matching}
              >
                {matching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Create Debt Drawdown
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
