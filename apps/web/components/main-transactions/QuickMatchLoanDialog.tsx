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
import { formatDate } from "@/lib/account-utils"

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
  const [availableDisbursements, setAvailableDisbursements] = useState<any[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([])
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null)
  const [selectedDisbursement, setSelectedDisbursement] = useState<number | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null)
  const [currentMatch, setCurrentMatch] = useState<MainTransactionDetails | null>(null)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)
  const [createDisbursementDialogOpen, setCreateLoanDisbursementDialogOpen] = useState(false)

  // Additional fields for creating disbursement when matching with account
  const [partnerId, setPartnerId] = useState<number | null>(null)
  const [loanCategory, setLoanCategory] = useState<string>('short_term')
  const [businessPartners, setBusinessPartners] = useState<any[]>([])

  const isLoanCollection = sourceTransaction?.transaction_type_code === 'LOAN_COLLECT'
  const isLoanDisbursement = sourceTransaction?.transaction_type_code === 'LOAN_DISBURSE'

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchCurrentMatch()
      if (isLoanCollection) {
        fetchAvailableDisbursements()
      } else if (isLoanDisbursement) {
        fetchAvailableAccounts()
        fetchBusinessPartners()
      } else {
        fetchAvailableLoans()
      }
    }
  }, [open, sourceTransaction, isLoanCollection, isLoanDisbursement])

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

      // Filter to same type - match with same transaction type on different account
      // LOAN_DISBURSE matches with LOAN_DISBURSE, LOAN_COLLECT matches with LOAN_COLLECT
      const sourceTypeCode = sourceTransaction.transaction_type_code
      const filtered = data.data.filter((t: MainTransactionDetails) =>
        t.transaction_type_code === sourceTypeCode &&
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

  const fetchAvailableDisbursements = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch loan disbursements for the entity
      const response = await fetch(`/api/loan-disbursements?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch loan disbursements")
      }

      const data = await response.json()

      // Filter to active/unpaid disbursements only
      const filtered = data.data.filter((d: any) =>
        d.status !== 'repaid' &&
        d.status !== 'written_off' &&
        d.remaining_balance > 0
      )

      // Sort by best match (amount + date proximity)
      filtered.sort((a: any, b: any) => {
        // Calculate amount difference (compare with remaining balance)
        const amountDiffA = Math.abs(a.remaining_balance - sourceTransaction.amount)
        const amountDiffB = Math.abs(b.remaining_balance - sourceTransaction.amount)

        // Calculate date difference in days
        const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
        const dateDiffA = Math.abs(new Date(a.disbursement_date).getTime() - sourceDateMs) / (1000 * 60 * 60 * 24)
        const dateDiffB = Math.abs(new Date(b.disbursement_date).getTime() - sourceDateMs) / (1000 * 60 * 60 * 24)

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

      setAvailableDisbursements(filtered)
    } catch (error) {
      console.error("Error fetching available loan disbursements:", error)
      alert("Failed to load available loan disbursements")
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableAccounts = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      // Fetch loan_receivable accounts for the entity
      const response = await fetch(`/api/accounts?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const result = await response.json()
      const data = result.data || result // Handle both {data: [...]} and direct array responses

      // Filter to loan_receivable accounts only
      const filtered = Array.isArray(data)
        ? data.filter((acc: any) => acc.account_type === 'loan_receivable')
        : []

      setAvailableAccounts(filtered)
    } catch (error) {
      console.error("Error fetching available loan receivable accounts:", error)
      alert("Failed to load available loan receivable accounts")
    } finally {
      setLoading(false)
    }
  }

  const fetchBusinessPartners = async () => {
    if (!sourceTransaction) return

    try {
      // Fetch business partners for the entity
      const response = await fetch(`/api/business-partners?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch business partners")
      }

      const data = await response.json()
      setBusinessPartners(data.data || [])
    } catch (error) {
      console.error("Error fetching business partners:", error)
      alert("Failed to load business partners")
    }
  }

  const handleUnmatch = async () => {
    if (!sourceTransaction) return

    setUnmatching(true)
    try {
      // Unmatch the transaction
      // Database trigger will automatically delete the loan disbursement and paired transaction
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
      if (isLoanDisbursement) {
        await fetchAvailableAccounts()
      } else {
        await fetchAvailableLoans()
      }

      onSuccess() // Refresh parent component

      alert("Loan transaction unmatched successfully! The disbursement record has been automatically deleted.")
    } catch (error: any) {
      console.error("Error unmatching loan transaction:", error)
      alert(error.message || "Failed to unmatch loan transaction. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  const handleMatch = async () => {
    if (!sourceTransaction) return
    if (isLoanCollection && !selectedDisbursement) return
    if (isLoanDisbursement && (!selectedAccount || !partnerId)) return
    if (!isLoanCollection && !isLoanDisbursement && !selectedLoan) return

    setMatching(true)
    try {
      if (isLoanCollection) {
        // For LOAN_COLLECT: Match to a loan disbursement
        const response = await fetch(`/api/loan-disbursements/${selectedDisbursement}/match-collection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cash_transaction_id: sourceTransaction.main_transaction_id,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to match loan collection")
        }

        // Show warning if overpayment
        if (data.warning) {
          alert(`⚠️ ${data.warning.message}\n\n${data.message}`)
        } else {
          alert("Loan collection matched successfully!")
        }
      } else if (isLoanDisbursement) {
        // For LOAN_DISBURSE: Match with a loan_receivable account (creates new disbursement)
        const response = await fetch(`/api/main-transactions/${sourceTransaction.main_transaction_id}/match-loan-disbursement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loan_receivable_account_id: selectedAccount,
            partner_id: partnerId,
            loan_category: loanCategory,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to match loan disbursement")
        }

        alert("Loan disbursement created and matched successfully!")
      } else {
        // For other types: Match with another transaction
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
      }

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

  if (!sourceTransaction) return null

  const isSourceDisbursement = false // Both sides use LOAN_DISBURSE now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentMatch ? 'Change Loan Match' : isLoanCollection ? 'Match Loan Collection' : 'Match Loan Transaction'}</DialogTitle>
          <DialogDescription>
            {currentMatch && !showUnmatchConfirm ? (
              <>This loan transaction is currently matched. Click &quot;Change Match&quot; to unmatch and select a different transaction.</>
            ) : isLoanCollection ? (
              <>
                Select a loan disbursement to match with this collection.
                This will create the receivable-side transaction and update the loan balance.
                Suggestions are sorted by best match (remaining balance + date proximity).
              </>
            ) : isLoanDisbursement ? (
              <>
                Select a loan receivable account to match with this disbursement.
                This will create a new loan disbursement record and the receivable-side transaction.
                You must also select the borrower and loan category.
              </>
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
                  {sourceTransaction?.loan_disbursement_id && (
                    <>
                      <br /><br />
                      <strong>Note:</strong> The loan disbursement record and paired transaction will be automatically deleted.
                    </>
                  )}
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

        {/* Available Loan Transactions or Disbursements or Accounts */}
        {(!currentMatch || showUnmatchConfirm) && (
          <div className="space-y-4">
            {/* For LOAN_DISBURSE: Show partner and category selection first */}
            {isLoanDisbursement && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium">Loan Details</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Borrower *</label>
                    <select
                      className="w-full p-2 border rounded text-sm"
                      value={partnerId || ''}
                      onChange={(e) => setPartnerId(Number(e.target.value))}
                    >
                      <option value="">Select borrower...</option>
                      {businessPartners.map((partner: any) => (
                        <option key={partner.partner_id} value={partner.partner_id}>
                          {partner.partner_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Loan Category *</label>
                    <select
                      className="w-full p-2 border rounded text-sm"
                      value={loanCategory}
                      onChange={(e) => setLoanCategory(e.target.value)}
                    >
                      <option value="short_term">Short Term</option>
                      <option value="long_term">Long Term</option>
                      <option value="advance">Advance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm font-medium">
              {isLoanCollection
                ? `Available Loan Disbursements (${availableDisbursements.length})`
                : isLoanDisbursement
                ? `Available Loan Receivable Accounts (${availableAccounts.length})`
                : `Available ${isSourceDisbursement ? 'Loan Acquired' : 'Loan Disbursements'} (${availableLoans.length})`
              }
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading available {isLoanCollection ? 'loan disbursements' : isLoanDisbursement ? 'loan receivable accounts' : 'loan transactions'}...
                </p>
              </div>
            ) : isLoanDisbursement ? (
              // Show accounts for LOAN_DISBURSE
              availableAccounts.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-muted-foreground">No loan receivable accounts available</p>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800 text-left">
                        <p className="font-medium mb-1">No loan receivable accounts found</p>
                        <p>A loan receivable account will be automatically created when you proceed with matching.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 w-8"></th>
                          <th className="text-left py-2 px-3">Account Name</th>
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-left py-2 px-3">Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableAccounts.map((account: any) => {
                          const isSelected = selectedAccount === account.account_id
                          return (
                            <tr
                              key={account.account_id}
                              className={`border-b hover:bg-muted/50 cursor-pointer ${
                                isSelected ? 'bg-primary/10 border-primary' : ''
                              }`}
                              onClick={() => setSelectedAccount(account.account_id)}
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => setSelectedAccount(account.account_id)}
                                />
                              </td>
                              <td className="py-2 px-3 text-sm font-medium">
                                {account.account_name}
                              </td>
                              <td className="py-2 px-3 text-sm text-muted-foreground">
                                Loan Receivable
                              </td>
                              <td className="py-2 px-3 text-sm text-muted-foreground">
                                {account.currency || 'VND'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : isLoanCollection ? (
              // Show disbursements for LOAN_COLLECT
              availableDisbursements.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-muted-foreground">No loan disbursements available</p>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800 text-left">
                        <p className="font-medium mb-1">No active loan disbursements found</p>
                        <p>To match this loan collection, please first create a loan disbursement in your loan receivable account.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 w-8"></th>
                          <th className="text-left py-2 px-3">Disbursement Date</th>
                          <th className="text-left py-2 px-3">Borrower</th>
                          <th className="text-left py-2 px-3">Principal</th>
                          <th className="text-right py-2 px-3">Remaining Balance</th>
                          <th className="text-center py-2 px-3">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableDisbursements.map((disbursement: any) => {
                          const isSelected = selectedDisbursement === disbursement.loan_disbursement_id
                          const amountMatch = Math.abs(disbursement.remaining_balance - sourceTransaction.amount) < 0.01

                          // Calculate date difference in days
                          const sourceDateMs = new Date(sourceTransaction.transaction_date).getTime()
                          const disbursementDateMs = new Date(disbursement.disbursement_date).getTime()
                          const dateDiffDays = Math.abs(disbursementDateMs - sourceDateMs) / (1000 * 60 * 60 * 24)
                          const sameDay = dateDiffDays < 1

                          return (
                            <tr
                              key={disbursement.loan_disbursement_id}
                              className={`border-b hover:bg-muted/50 cursor-pointer ${
                                isSelected ? 'bg-primary/10 border-primary' : ''
                              }`}
                              onClick={() => setSelectedDisbursement(disbursement.loan_disbursement_id)}
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => setSelectedDisbursement(disbursement.loan_disbursement_id)}
                                />
                              </td>
                              <td className="py-2 px-3 text-sm whitespace-nowrap">
                                <div>{formatDate(disbursement.disbursement_date)}</div>
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
                                <div className="font-medium">
                                  {disbursement.partner?.partner_name || disbursement.borrower_name || 'Unknown'}
                                </div>
                                {disbursement.notes && (
                                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                                    {disbursement.notes}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-sm font-mono">
                                {formatAmount(disbursement.principal_amount)}
                              </td>
                              <td className="py-2 px-3 text-sm text-right font-mono font-medium">
                                {formatAmount(disbursement.remaining_balance)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {amountMatch ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Exact Match
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Diff: {formatAmount(Math.abs(disbursement.remaining_balance - sourceTransaction.amount))}
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
              )
            ) : (
              // Show transactions for LOAN_DISBURSE
              availableLoans.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-muted-foreground">No matching loan transactions available</p>
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
              )
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
                  disabled={
                    isLoanCollection
                      ? !selectedDisbursement
                      : isLoanDisbursement
                      ? (!selectedAccount || !partnerId)
                      : !selectedLoan || matching
                  }
                >
                  {matching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      {isLoanCollection
                        ? 'Match to Loan Disbursement'
                        : isLoanDisbursement
                        ? 'Create & Match Loan Disbursement'
                        : 'Match Loan Transactions'}
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
