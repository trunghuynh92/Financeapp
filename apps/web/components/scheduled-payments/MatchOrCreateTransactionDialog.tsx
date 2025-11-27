"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertCircle, Plus, Link2 } from "lucide-react"
import { ScheduledPaymentInstance } from "@/types/scheduled-payment"
import { MainTransactionDetails } from "@/types/main-transaction"
import { formatCurrency, formatDate } from "@/lib/account-utils"
import { useEntity } from "@/contexts/EntityContext"

interface MatchOrCreateTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance: ScheduledPaymentInstance
  scheduledPayment: any // Contains category_id, contract_name, payee_name
  onSuccess: () => void
}

export function MatchOrCreateTransactionDialog({
  open,
  onOpenChange,
  instance,
  scheduledPayment,
  onSuccess
}: MatchOrCreateTransactionDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'match' | 'create'>('match')

  // Match view state
  const [matchingTransactions, setMatchingTransactions] = useState<MainTransactionDetails[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null)

  // Create view state
  const [paidDate, setPaidDate] = useState("")
  const [paidAmount, setPaidAmount] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      setPaidDate(new Date().toISOString().split('T')[0])
      setPaidAmount(instance.amount.toString())
      setNotes("")
      setError(null)
      setView('match')
      setSelectedTransaction(null)
      setSelectedAccount(null)

      fetchMatchingTransactions()
      fetchAccounts()
    }
  }, [open, instance])

  const fetchMatchingTransactions = async () => {
    if (!currentEntity || !scheduledPayment) return

    setLoading(true)
    try {
      // Fetch all transaction IDs already used by payment instances
      const usedTransactionsResponse = await fetch(
        `/api/scheduled-payment-instances/used-transactions?entity_id=${currentEntity.id}`
      )

      let usedTransactionIds: number[] = []
      if (usedTransactionsResponse.ok) {
        const usedData = await usedTransactionsResponse.json()
        usedTransactionIds = usedData.transaction_ids || []
      }

      // Fetch unmatched transactions for the same category
      const response = await fetch(
        `/api/main-transactions?entity_id=${currentEntity.id}&category_id=${scheduledPayment.category_id}&limit=50&sort_field=transaction_date&sort_direction=desc&account_types=bank,cash`
      )

      if (!response.ok) throw new Error('Failed to fetch transactions')

      const data = await response.json()

      // Filter to unmatched debit transactions only (not used by transfers OR payment instances)
      const filtered = (data.data || []).filter((t: MainTransactionDetails) =>
        t.transaction_direction === 'debit' &&
        !t.transfer_matched_transaction_id && // Not matched to a transfer
        !usedTransactionIds.includes(t.main_transaction_id) // Not matched to a payment instance
      )

      // Sort by best match (amount + date proximity)
      filtered.sort((a: MainTransactionDetails, b: MainTransactionDetails) => {
        const amountDiffA = Math.abs(parseFloat(a.amount.toString()) - instance.amount)
        const amountDiffB = Math.abs(parseFloat(b.amount.toString()) - instance.amount)

        const dueDateMs = new Date(instance.due_date).getTime()
        const dateDiffA = Math.abs(new Date(a.transaction_date).getTime() - dueDateMs) / (1000 * 60 * 60 * 24)
        const dateDiffB = Math.abs(new Date(b.transaction_date).getTime() - dueDateMs) / (1000 * 60 * 60 * 24)

        // Prioritize exact amount matches
        if (amountDiffA < 0.01 && amountDiffB < 0.01) {
          return dateDiffA - dateDiffB
        } else if (amountDiffA < 0.01) {
          return -1
        } else if (amountDiffB < 0.01) {
          return 1
        } else {
          // Weighted score: amount 80%, date 20%
          const scoreA = (amountDiffA / instance.amount) * 0.8 + (dateDiffA / 30) * 0.2
          const scoreB = (amountDiffB / instance.amount) * 0.8 + (dateDiffB / 30) * 0.2
          return scoreA - scoreB
        }
      })

      setMatchingTransactions(filtered.slice(0, 10)) // Top 10 matches
    } catch (error) {
      console.error('Error fetching matching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}&account_type=bank,cash&limit=1000`)
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const handleTransactionSelect = (transactionId: number) => {
    setSelectedTransaction(transactionId)

    // Auto-fill paid amount and date with the selected transaction's details
    const selectedTxn = matchingTransactions.find(txn => txn.main_transaction_id === transactionId)
    if (selectedTxn) {
      setPaidAmount(selectedTxn.amount.toString())
      setPaidDate(new Date(selectedTxn.transaction_date).toISOString().split('T')[0])
    }
  }

  const handleMatchExisting = async () => {
    if (!selectedTransaction) {
      setError("Please select a transaction to match")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/scheduled-payment-instances/${instance.instance_id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: selectedTransaction,
          paid_date: paidDate,
          paid_amount: parseFloat(paidAmount),
          notes: notes.trim() || undefined
        })
      })

      if (response.ok) {
        onSuccess()
        onOpenChange(false)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to mark payment as paid')
      }
    } catch (err) {
      console.error('Error marking payment as paid:', err)
      setError('Failed to mark payment as paid')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateNew = async () => {
    if (!selectedAccount) {
      setError("Please select an account")
      return
    }

    const amount = parseFloat(paidAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Paid amount must be greater than 0")
      return
    }

    if (!paidDate) {
      setError("Paid date is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/scheduled-payment-instances/${instance.instance_id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_date: paidDate,
          paid_amount: amount,
          create_transaction: true,
          account_id: selectedAccount,
          notes: notes.trim() || undefined
        })
      })

      if (response.ok) {
        onSuccess()
        onOpenChange(false)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to create transaction and mark as paid')
      }
    } catch (err) {
      console.error('Error creating transaction:', err)
      setError('Failed to create transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Payment as Paid</DialogTitle>
          <DialogDescription>
            {view === 'match'
              ? "Select an existing transaction to match, or create a new one"
              : "Create a new transaction for this payment"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Payment Instance Info */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="text-sm font-medium mb-2">Payment Instance:</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Contract:</span> {scheduledPayment?.contract_name}
            </div>
            <div>
              <span className="text-muted-foreground">Payee:</span> {scheduledPayment?.payee_name}
            </div>
            <div>
              <span className="text-muted-foreground">Due Date:</span> {formatDate(instance.due_date)}
            </div>
            <div>
              <span className="text-muted-foreground">Due Amount:</span>{" "}
              <span className="font-mono font-medium">{formatCurrency(instance.amount, 'VND')}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-2 border-b">
          <Button
            variant={view === 'match' ? 'default' : 'ghost'}
            onClick={() => setView('match')}
            className="rounded-b-none"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Match Existing ({matchingTransactions.length})
          </Button>
          <Button
            variant={view === 'create' ? 'default' : 'ghost'}
            onClick={() => setView('create')}
            className="rounded-b-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Transaction
          </Button>
        </div>

        {/* Match Existing View */}
        {view === 'match' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading matching transactions...</p>
              </div>
            ) : matchingTransactions.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-muted-foreground">No matching transactions found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a new transaction using the button above
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
                      {matchingTransactions.map((txn) => {
                        const isSelected = selectedTransaction === txn.main_transaction_id
                        const amountMatch = Math.abs(parseFloat(txn.amount.toString()) - instance.amount) < 0.01

                        const dueDateMs = new Date(instance.due_date).getTime()
                        const txnDateMs = new Date(txn.transaction_date).getTime()
                        const dateDiffDays = Math.abs(txnDateMs - dueDateMs) / (1000 * 60 * 60 * 24)
                        const sameDay = dateDiffDays < 1

                        return (
                          <tr
                            key={txn.main_transaction_id}
                            className={`border-b hover:bg-muted/50 cursor-pointer ${
                              isSelected ? 'bg-primary/10 border-primary' : ''
                            }`}
                            onClick={() => handleTransactionSelect(txn.main_transaction_id)}
                          >
                            <td className="py-2 px-3">
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => handleTransactionSelect(txn.main_transaction_id)}
                              />
                            </td>
                            <td className="py-2 px-3 text-sm whitespace-nowrap">
                              <div>{formatDate(txn.transaction_date)}</div>
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
                              <div className="font-medium">{txn.account_name}</div>
                              {txn.bank_name && (
                                <div className="text-xs text-muted-foreground">{txn.bank_name}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm max-w-xs truncate">
                              {txn.description || <span className="text-muted-foreground italic">No description</span>}
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-mono font-medium">
                              {formatCurrency(txn.amount, 'VND')}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {amountMatch ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Exact Match
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Diff: {formatCurrency(Math.abs(parseFloat(txn.amount.toString()) - instance.amount), 'VND')}
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

            {/* Match Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matchPaidDate">Paid Date *</Label>
                <Input
                  id="matchPaidDate"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="matchPaidAmount">Paid Amount *</Label>
                <Input
                  id="matchPaidAmount"
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchNotes">Notes</Label>
              <Textarea
                id="matchNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this payment..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Create New View */}
        {view === 'create' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="createPaidDate">Paid Date *</Label>
                <Input
                  id="createPaidDate"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="createPaidAmount">Paid Amount *</Label>
                <Input
                  id="createPaidAmount"
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account *</Label>
              <Select
                value={selectedAccount?.toString() || ""}
                onValueChange={(v) => setSelectedAccount(parseInt(v))}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select account used for payment" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id.toString()}>
                      {account.account_name} - {formatCurrency(account.current_balance, 'VND')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the bank/cash account used to make this payment
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="createNotes">Notes</Label>
              <Textarea
                id="createNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this payment..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          {view === 'match' ? (
            <Button
              onClick={handleMatchExisting}
              disabled={!selectedTransaction || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Match & Mark as Paid
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleCreateNew}
              disabled={!selectedAccount || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create & Mark as Paid
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
