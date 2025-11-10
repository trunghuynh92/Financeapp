"use client"

import { useState, useEffect } from "react"
import { Loader2, Link2, CreditCard, Wallet, Link2Off, AlertTriangle, Plus } from "lucide-react"
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
import { MainTransactionDetails } from "@/types/main-transaction"
import { CreateDrawdownDialog } from "@/components/create-drawdown-dialog"

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
  const [availableDebts, setAvailableDebts] = useState<MainTransactionDetails[]>([])
  const [selectedDebt, setSelectedDebt] = useState<number | null>(null)
  const [currentMatch, setCurrentMatch] = useState<MainTransactionDetails | null>(null)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)
  const [createDrawdownDialogOpen, setCreateDrawdownDialogOpen] = useState(false)

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCurrentMatch()
      fetchAvailableDebts()
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

  const fetchAvailableDebts = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch unmatched debt transactions
      const response = await fetch(`/api/transfers/unmatched?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch debt transactions")
      }

      const data = await response.json()

      // Filter to same type (DEBT_TAKE matches with DEBT_TAKE on different account)
      // Both sides of debt transaction use the same type in the new simplified system
      const filtered = data.data.filter((t: MainTransactionDetails) =>
        t.transaction_type_code === 'DEBT_TAKE' &&
        t.main_transaction_id !== sourceTransaction.main_transaction_id &&
        t.account_id !== sourceTransaction.account_id // Different account
      )

      // Sort by best match (amount + date proximity)
      filtered.sort((a: MainTransactionDetails, b: MainTransactionDetails) => {
        // Calculate amount difference
        const amountDiffA = Math.abs(a.amount - sourceTransaction.amount)
        const amountDiffB = Math.abs(b.amount - sourceTransaction.amount)

        // Calculate date difference in days
        const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
        const dateDiffA = Math.abs(new Date(a.transaction_date).getTime() - sourceDateMs) / (1000 * 60 * 60 * 24)
        const dateDiffB = Math.abs(new Date(b.transaction_date).getTime() - sourceDateMs) / (1000 * 60 * 60 * 24)

        // Prioritize exact amount matches, then consider date
        if (amountDiffA < 0.01 && amountDiffB < 0.01) {
          // Both are exact amount matches - sort by date proximity
          return dateDiffA - dateDiffB
        } else if (amountDiffA < 0.01) {
          // A is exact match - prioritize it
          return -1
        } else if (amountDiffB < 0.01) {
          // B is exact match - prioritize it
          return 1
        } else {
          // Neither is exact - use weighted score (amount is 80%, date is 20%)
          const scoreA = (amountDiffA / sourceTransaction.amount) * 0.8 + (dateDiffA / 30) * 0.2
          const scoreB = (amountDiffB / sourceTransaction.amount) * 0.8 + (dateDiffB / 30) * 0.2
          return scoreA - scoreB
        }
      })

      setAvailableDebts(filtered)
    } catch (error) {
      console.error("Error fetching available debt transactions:", error)
      alert("Failed to load available debt transactions")
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
      setSelectedDebt(null)

      // Refresh available debts
      await fetchAvailableDebts()

      alert("Debt transaction unmatched successfully! You can now select a new match.")
    } catch (error: any) {
      console.error("Error unmatching debt transaction:", error)
      alert(error.message || "Failed to unmatch debt transaction. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  const handleMatch = async () => {
    if (!selectedDebt || !sourceTransaction) return

    setMatching(true)
    try {
      // Not needed anymore - both sides use DEBT_TAKE
      const isSourceDrawdown = false // Legacy variable kept for compatibility

      const response = await fetch("/api/transfers/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transfer_out_id: isSourceDrawdown ? sourceTransaction.main_transaction_id : selectedDebt,
          transfer_in_id: isSourceDrawdown ? selectedDebt : sourceTransaction.main_transaction_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to match debt transactions")
      }

      alert("Debt transactions matched successfully!")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error matching debt transactions:", error)
      alert(error.message || "Failed to match debt transactions. Please try again.")
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

  const isSourceDrawdown = false // Both sides use DEBT_TAKE now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentMatch ? 'Change Debt Match' : 'Match Debt Transaction'}</DialogTitle>
          <DialogDescription>
            {currentMatch && !showUnmatchConfirm ? (
              <>This debt transaction is currently matched. Click &quot;Change Match&quot; to unmatch and select a different transaction.</>
            ) : (
              <>
                Select a {isSourceDrawdown ? 'Debt Acquired' : 'Debt Drawdown'} transaction to match with this {isSourceDrawdown ? 'drawdown' : 'debt acquisition'}.
                Suggestions are sorted by best match (amount + date proximity).
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
              <Badge variant={isSourceDrawdown ? 'destructive' : 'default'}>
                {isSourceDrawdown ? (
                  <>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Debt Drawdown
                  </>
                ) : (
                  <>
                    <Wallet className="h-3 w-3 mr-1" />
                    Debt Acquired
                  </>
                )}
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
                <Badge variant={currentMatch.transaction_type_code === 'DEBT_DRAW' ? 'destructive' : 'default'}>
                  {currentMatch.transaction_type_code === 'DEBT_DRAW' ? (
                    <>
                      <CreditCard className="h-3 w-3 mr-1" />
                      Debt Drawdown
                    </>
                  ) : (
                    <>
                      <Wallet className="h-3 w-3 mr-1" />
                      Debt Acquired
                    </>
                  )}
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
                  Confirm Match Change
                </div>
                <div className="text-xs text-yellow-800">
                  This will unmatch the current debt transaction so you can select a new one.
                  Both transactions will become unmatched until you select and confirm a new match.
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

        {/* Available Debt Transactions */}
        {(!currentMatch || showUnmatchConfirm) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Available {isSourceDrawdown ? 'Debt Acquired' : 'Debt Drawdowns'} ({availableDebts.length})
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading available debt transactions...</p>
              </div>
            ) : availableDebts.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-muted-foreground">No matching debt transactions available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure there&apos;s a {isSourceDrawdown ? 'Debt Acquired' : 'Debt Drawdown'} transaction from a different account
              </p>
              {!isSourceDrawdown && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setCreateDrawdownDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Drawdown
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 w-8"></th>
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Account</th>
                      <th className="text-left py-2 px-3">Description</th>
                      <th className="text-right py-2 px-3">Amount</th>
                      <th className="text-center py-2 px-3">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableDebts.map((debt) => {
                      const isSelected = selectedDebt === debt.main_transaction_id
                      const amountMatch = Math.abs(debt.amount - sourceTransaction.amount) < 0.01

                      // Calculate date difference in days
                      const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
                      const debtDateMs = new Date(debt.transaction_date).getTime()
                      const dateDiffDays = Math.abs(debtDateMs - sourceDateMs) / (1000 * 60 * 60 * 24)
                      const sameDay = dateDiffDays < 1

                      return (
                        <tr
                          key={debt.main_transaction_id}
                          className={`border-b hover:bg-muted/50 cursor-pointer ${
                            isSelected ? 'bg-primary/10 border-primary' : ''
                          }`}
                          onClick={() => setSelectedDebt(debt.main_transaction_id)}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => setSelectedDebt(debt.main_transaction_id)}
                            />
                          </td>
                          <td className="py-2 px-3 text-sm whitespace-nowrap">
                            <div>{formatDate(debt.transaction_date)}</div>
                            {sameDay ? (
                              <div className="text-xs text-green-600 font-medium">Same day</div>
                            ) : dateDiffDays < 3 ? (
                              <div className="text-xs text-blue-600">
                                {Math.round(dateDiffDays)} {Math.round(dateDiffDays) === 1 ? 'day' : 'days'} apart
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {Math.round(dateDiffDays)} days apart
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            <div className="font-medium">{debt.account_name}</div>
                            {debt.bank_name && (
                              <div className="text-xs text-muted-foreground">{debt.bank_name}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {debt.description || <span className="text-muted-foreground italic">No description</span>}
                          </td>
                          <td className="py-2 px-3 text-sm text-right font-mono font-medium">
                            {formatAmount(debt.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {amountMatch ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Exact Match
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Diff: {formatAmount(Math.abs(debt.amount - sourceTransaction.amount))}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full justify-between items-center">
            {/* Left side: Create New Drawdown button (only for DEBT_ACQ source) */}
            <div>
              {!isSourceDrawdown && (!currentMatch || showUnmatchConfirm) && (
                <Button
                  variant="outline"
                  onClick={() => setCreateDrawdownDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Drawdown
                </Button>
              )}
            </div>

            {/* Right side: Cancel/Close and Match buttons */}
            <div className="flex gap-2">
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
                  disabled={!selectedDebt || matching}
                >
                  {matching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Match Debt Transactions
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Create Drawdown Dialog */}
      <CreateDrawdownDialog
        open={createDrawdownDialogOpen}
        onOpenChange={setCreateDrawdownDialogOpen}
        prefilledAmount={sourceTransaction?.amount}
        prefilledDate={sourceTransaction?.transaction_date ? new Date(sourceTransaction.transaction_date).toISOString().split('T')[0] : undefined}
        onSuccess={() => {
          setCreateDrawdownDialogOpen(false)
          fetchAvailableDebts() // Refresh the list
          onSuccess() // Refresh parent
        }}
      />
    </Dialog>
  )
}
