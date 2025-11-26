"use client"

import { useState, useEffect } from "react"
import { Loader2, Link2, ArrowUp, ArrowDown, Link2Off, AlertTriangle } from "lucide-react"
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
import { formatDate } from "@/lib/account-utils"

interface QuickMatchTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

export function QuickMatchTransferDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: QuickMatchTransferDialogProps) {
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [unmatching, setUnmatching] = useState(false)
  const [availableTransfers, setAvailableTransfers] = useState<MainTransactionDetails[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null)
  const [currentMatch, setCurrentMatch] = useState<MainTransactionDetails | null>(null)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCurrentMatch()
      fetchAvailableTransfers()
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

  const fetchAvailableTransfers = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch unmatched transfers
      const response = await fetch(`/api/transfers/unmatched?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch transfers")
      }

      const data = await response.json()

      // Filter to matching type and exclude the source transaction
      // Support opposite types (TRF_OUT/TRF_IN) and same types (DEBT_PAY/DEBT_PAY, CC_PAY/CC_PAY)
      let matchingTypes: string[]

      if (sourceTransaction.transaction_type_code === 'TRF_OUT') {
        matchingTypes = ['TRF_IN']
      } else if (sourceTransaction.transaction_type_code === 'TRF_IN') {
        matchingTypes = ['TRF_OUT']
      } else if (sourceTransaction.transaction_type_code === 'CC_PAY') {
        matchingTypes = ['CC_PAY']  // CC_PAY matches CC_PAY (bank → credit card)
      } else if (sourceTransaction.transaction_type_code === 'DEBT_PAY') {
        matchingTypes = ['DEBT_PAY']  // Same type matching for debt payments
      } else if (sourceTransaction.transaction_type_code === 'DEBT_DRAW') {
        matchingTypes = ['DEBT_ACQ']
      } else if (sourceTransaction.transaction_type_code === 'DEBT_ACQ') {
        matchingTypes = ['DEBT_DRAW']
      } else {
        matchingTypes = []
      }

      const filtered = data.data.filter((t: MainTransactionDetails) =>
        matchingTypes.includes(t.transaction_type_code) &&
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

      setAvailableTransfers(filtered)
    } catch (error) {
      console.error("Error fetching available transfers:", error)
      alert("Failed to load available transfers")
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
        throw new Error(data.error || "Failed to unmatch transfer")
      }

      // Clear current match and reset to allow new selection
      setCurrentMatch(null)
      setShowUnmatchConfirm(false)
      setSelectedTransfer(null)

      // Refresh available transfers
      await fetchAvailableTransfers()

      alert("Transfer unmatched successfully! You can now select a new match.")
    } catch (error: any) {
      console.error("Error unmatching transfer:", error)
      alert(error.message || "Failed to unmatch transfer. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  const handleMatch = async () => {
    if (!selectedTransfer || !sourceTransaction) return

    setMatching(true)
    try {
      const isSourceOut = sourceTransaction.transaction_type_code === 'TRF_OUT'

      const response = await fetch("/api/transfers/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transfer_out_id: isSourceOut ? sourceTransaction.main_transaction_id : selectedTransfer,
          transfer_in_id: isSourceOut ? selectedTransfer : sourceTransaction.main_transaction_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to match transfers")
      }

      alert("Transfers matched successfully!")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error matching transfers:", error)
      alert(error.message || "Failed to match transfers. Please try again.")
    } finally {
      setMatching(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount)
  }

  if (!sourceTransaction) return null

  const isSourceOut = sourceTransaction.transaction_type_code === 'TRF_OUT'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentMatch ? 'Change Transfer Match' : 'Match Transfer'}</DialogTitle>
          <DialogDescription>
            {currentMatch && !showUnmatchConfirm ? (
              <>This transfer is currently matched. Click &quot;Change Match&quot; to unmatch and select a different transfer.</>
            ) : (
              <>
                Select a {isSourceOut ? 'Transfer In' : 'Transfer Out'} transaction to match with this transfer.
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
              <Badge variant={isSourceOut ? 'destructive' : 'default'}>
                {isSourceOut ? (
                  <>
                    <ArrowUp className="h-3 w-3 mr-1" />
                    Transfer Out
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3 w-3 mr-1" />
                    Transfer In
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
                <Badge variant={currentMatch.transaction_type_code === 'TRF_OUT' ? 'destructive' : 'default'}>
                  {currentMatch.transaction_type_code === 'TRF_OUT' ? (
                    <>
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Transfer Out
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-3 w-3 mr-1" />
                      Transfer In
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
                  This will unmatch the current transfer so you can select a new one.
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
                    Unmatch Current Transfer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Available Transfers */}
        {(!currentMatch || showUnmatchConfirm) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Available {isSourceOut ? 'Transfers In' : 'Transfers Out'} ({availableTransfers.length})
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading available transfers...</p>
              </div>
            ) : availableTransfers.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-muted-foreground">No matching transfers available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure there&apos;s a {isSourceOut ? 'Transfer In' : 'Transfer Out'} from a different account
              </p>
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
                    {availableTransfers.map((transfer) => {
                      const isSelected = selectedTransfer === transfer.main_transaction_id
                      const amountMatch = Math.abs(transfer.amount - sourceTransaction.amount) < 0.01

                      // Calculate date difference in days
                      const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
                      const transferDateMs = new Date(transfer.transaction_date).getTime()
                      const dateDiffDays = Math.abs(transferDateMs - sourceDateMs) / (1000 * 60 * 60 * 24)
                      const sameDay = dateDiffDays < 1

                      return (
                        <tr
                          key={transfer.main_transaction_id}
                          className={`border-b hover:bg-muted/50 cursor-pointer ${
                            isSelected ? 'bg-primary/10 border-primary' : ''
                          }`}
                          onClick={() => setSelectedTransfer(transfer.main_transaction_id)}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => setSelectedTransfer(transfer.main_transaction_id)}
                            />
                          </td>
                          <td className="py-2 px-3 text-sm whitespace-nowrap">
                            <div>{formatDate(transfer.transaction_date)}</div>
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
                            <div className="font-medium">{transfer.account_name}</div>
                            {transfer.bank_name && (
                              <div className="text-xs text-muted-foreground">{transfer.bank_name}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {transfer.description || <span className="text-muted-foreground italic">No description</span>}
                          </td>
                          <td className="py-2 px-3 text-sm text-right font-mono font-medium">
                            {formatAmount(transfer.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {amountMatch ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Exact Match
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Diff: {formatAmount(Math.abs(transfer.amount - sourceTransaction.amount))}
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
              disabled={!selectedTransfer || matching}
            >
              {matching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Match Transfers
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
