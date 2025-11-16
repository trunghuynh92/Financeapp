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
import { CreateLoanDisbursementDialog } from "@/components/create-loan-disbursement-dialog"

interface QuickMatchLoanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

export function QuickMatchLoanDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: QuickMatchLoanDialogProps) {
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [unmatching, setUnmatching] = useState(false)
  const [availableLoans, setAvailableLoans] = useState<MainTransactionDetails[]>([])
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null)
  const [currentMatch, setCurrentMatch] = useState<MainTransactionDetails | null>(null)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)
  const [createDisbursementDialogOpen, setCreateLoanDisbursementDialogOpen] = useState(false)

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCurrentMatch()
      fetchAvailableLoans()
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

  const fetchAvailableLoans = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch unmatched loan transactions
      const response = await fetch(`/api/transfers/unmatched?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch loan transactions")
      }

      const data = await response.json()

      // Filter to same type (LOAN_DISBURSE matches with LOAN_DISBURSE on different account)
      // Both sides of loan transaction use the same type in the new simplified system
      const filtered = data.data.filter((t: MainTransactionDetails) =>
        t.transaction_type_code === 'LOAN_DISBURSE' &&
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

      setAvailableLoans(filtered)
    } catch (error) {
      console.error("Error fetching available loan transactions:", error)
      alert("Failed to load available loan transactions")
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
        throw new Error(data.error || "Failed to unmatch loan transaction")
      }

      // Clear current match and reset to allow new selection
      setCurrentMatch(null)
      setShowUnmatchConfirm(false)
      setSelectedLoan(null)

      // Refresh available loans
      await fetchAvailableLoans()

      alert("Loan transaction unmatched successfully! You can now select a new match.")
    } catch (error: any) {
      console.error("Error unmatching loan transaction:", error)
      alert(error.message || "Failed to unmatch loan transaction. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  const handleMatch = async () => {
    if (!selectedLoan || !sourceTransaction) return

    setMatching(true)
    try {
      // Not needed anymore - both sides use LOAN_DISBURSE
      const isSourceDisbursement = false // Legacy variable kept for compatibility

      const response = await fetch("/api/transfers/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transfer_out_id: isSourceDisbursement ? sourceTransaction.main_transaction_id : selectedLoan,
          transfer_in_id: isSourceDisbursement ? selectedLoan : sourceTransaction.main_transaction_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to match loan transactions")
      }

      alert("Loan transactions matched successfully!")
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error matching loan transactions:", error)
      alert(error.message || "Failed to match loan transactions. Please try again.")
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

  const isSourceDisbursement = false // Both sides use LOAN_DISBURSE now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentMatch ? 'Change Loan Match' : 'Match Loan Transaction'}</DialogTitle>
          <DialogDescription>
            {currentMatch && !showUnmatchConfirm ? (
              <>This loan transaction is currently matched. Click &quot;Change Match&quot; to unmatch and select a different transaction.</>
            ) : (
              <>
                Select a {isSourceDisbursement ? 'Loan Acquired' : 'Loan Disbursement'} transaction to match with this {isSourceDisbursement ? 'disbursement' : 'loan acquisition'}.
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
              <Badge variant={isSourceDisbursement ? 'destructive' : 'default'}>
                {isSourceDisbursement ? (
                  <>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Loan Disbursement
                  </>
                ) : (
                  <>
                    <Wallet className="h-3 w-3 mr-1" />
                    Loan Acquired
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
                      Loan Disbursement
                    </>
                  ) : (
                    <>
                      <Wallet className="h-3 w-3 mr-1" />
                      Loan Acquired
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
                  This will unmatch the current loan transaction so you can select a new one.
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

        {/* Available Loan Transactions */}
        {(!currentMatch || showUnmatchConfirm) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Available {isSourceDisbursement ? 'Loan Acquired' : 'Loan Disbursements'} ({availableLoans.length})
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading available loan transactions...</p>
              </div>
            ) : availableLoans.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-muted-foreground">No matching loan transactions available</p>

              {sourceTransaction.transaction_type_code === 'LOAN_COLLECT' ? (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-xs text-yellow-800 text-left">
                      <p className="font-medium mb-1">No loan disbursement found</p>
                      <p>To match this loan collection, please first create a loan disbursement in your credit/loan account.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    Make sure there&apos;s a {isSourceDisbursement ? 'Loan Acquired' : 'Loan Disbursement'} transaction from a different account
                  </p>
                  {!isSourceDisbursement && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setCreateLoanDisbursementDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Disbursement
                    </Button>
                  )}
                </>
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
                    {availableLoans.map((loan) => {
                      const isSelected = selectedLoan === loan.main_transaction_id
                      const amountMatch = Math.abs(loan.amount - sourceTransaction.amount) < 0.01

                      // Calculate date difference in days
                      const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
                      const loanDateMs = new Date(loan.transaction_date).getTime()
                      const dateDiffDays = Math.abs(loanDateMs - sourceDateMs) / (1000 * 60 * 60 * 24)
                      const sameDay = dateDiffDays < 1

                      return (
                        <tr
                          key={loan.main_transaction_id}
                          className={`border-b hover:bg-muted/50 cursor-pointer ${
                            isSelected ? 'bg-primary/10 border-primary' : ''
                          }`}
                          onClick={() => setSelectedLoan(loan.main_transaction_id)}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => setSelectedLoan(loan.main_transaction_id)}
                            />
                          </td>
                          <td className="py-2 px-3 text-sm whitespace-nowrap">
                            <div>{formatDate(loan.transaction_date)}</div>
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
                            <div className="font-medium">{loan.account_name}</div>
                            {loan.bank_name && (
                              <div className="text-xs text-muted-foreground">{loan.bank_name}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {loan.description || <span className="text-muted-foreground italic">No description</span>}
                          </td>
                          <td className="py-2 px-3 text-sm text-right font-mono font-medium">
                            {formatAmount(loan.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {amountMatch ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Exact Match
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Diff: {formatAmount(Math.abs(loan.amount - sourceTransaction.amount))}
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
            {/* Left side: Create New Disbursement button (only for DEBT_ACQ source, not for LOAN_COLLECT) */}
            <div>
              {!isSourceDisbursement &&
               sourceTransaction.transaction_type_code !== 'LOAN_COLLECT' &&
               (!currentMatch || showUnmatchConfirm) && (
                <Button
                  variant="outline"
                  onClick={() => setCreateLoanDisbursementDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Disbursement
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
                  disabled={!selectedLoan || matching}
                >
                  {matching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Match Loan Transactions
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Create Disbursement Dialog */}
      <CreateLoanDisbursementDialog
        open={createDisbursementDialogOpen}
        onOpenChange={setCreateLoanDisbursementDialogOpen}
        prefilledSourceAccountId={sourceTransaction?.account_id}
        prefilledAmount={sourceTransaction?.amount}
        prefilledDate={sourceTransaction?.transaction_date ? new Date(sourceTransaction.transaction_date).toISOString().split('T')[0] : undefined}
        existingSourceTransactionId={sourceTransaction?.main_transaction_id}
        onSuccess={() => {
          setCreateLoanDisbursementDialogOpen(false)
          fetchAvailableLoans() // Refresh the list
          onSuccess() // Refresh parent
        }}
      />
    </Dialog>
  )
}
