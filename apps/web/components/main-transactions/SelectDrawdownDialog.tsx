"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, DollarSign, Calendar, TrendingDown } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/account-utils"
import { formatDate } from "@/lib/account-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Drawdown {
  drawdown_id: number
  drawdown_reference: string
  drawdown_date: string
  original_amount: number
  remaining_balance: number
  due_date: string | null
  status: string
  account_id: number
  account_name: string
  account_type: string
}

interface SelectDrawdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // For DEBT_PAY matching mode
  paybackTransactionId?: number
  paybackAmount?: number
  onSuccess?: () => void
  // For Interest Payment linking mode
  accountId?: number
  onSelectDrawdown?: (drawdown: Drawdown) => void
}

export function SelectDrawdownDialog({
  open,
  onOpenChange,
  paybackTransactionId,
  paybackAmount,
  onSuccess,
  accountId,
  onSelectDrawdown,
}: SelectDrawdownDialogProps) {
  // Determine mode: if onSelectDrawdown is provided, we're in "link" mode for interest payments
  // Otherwise we're in "match" mode for debt payback
  const isLinkMode = !!onSelectDrawdown
  const [drawdowns, setDrawdowns] = useState<Drawdown[]>([])
  const [loading, setLoading] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDrawdownId, setSelectedDrawdownId] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      fetchDrawdowns()
    }
  }, [open])

  async function fetchDrawdowns() {
    try {
      setLoading(true)
      setError(null)

      // Fetch all active and overdue drawdowns from credit lines and term loans
      const response = await fetch('/api/accounts')
      if (!response.ok) {
        throw new Error('Failed to fetch accounts')
      }

      const accountsData = await response.json()
      const debtAccounts = (accountsData.data || []).filter(
        (acc: any) => acc.account_type === 'credit_line' || acc.account_type === 'term_loan'
      )

      // Fetch drawdowns for all debt accounts
      const drawdownPromises = debtAccounts.map(async (account: any) => {
        const response = await fetch(`/api/accounts/${account.account_id}/drawdowns`)
        if (response.ok) {
          const data = await response.json()
          return (data.data || [])
            .filter((dd: any) => dd.status === 'active' || dd.status === 'overdue')
            .map((dd: any) => ({
              ...dd,
              account_name: account.account_name,
              account_type: account.account_type,
            }))
        }
        return []
      })

      const results = await Promise.all(drawdownPromises)
      const allDrawdowns = results.flat()

      setDrawdowns(allDrawdowns)
    } catch (err) {
      console.error('Error fetching drawdowns:', err)
      setError(err instanceof Error ? err.message : 'Failed to load drawdowns')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!isMatching) {
      onOpenChange(false)
      setSelectedDrawdownId(null)
      setError(null)
    }
  }

  async function handleMatch() {
    if (!selectedDrawdownId) {
      setError('Please select a drawdown')
      return
    }

    setIsMatching(true)
    setError(null)

    try {
      if (isLinkMode) {
        // Link mode: just return the selected drawdown for interest payments
        const selectedDrawdown = drawdowns.find(dd => dd.drawdown_id === selectedDrawdownId)
        if (selectedDrawdown && onSelectDrawdown) {
          onSelectDrawdown(selectedDrawdown)
          handleClose()
        }
      } else {
        // Match mode: match debt payback transaction
        const response = await fetch('/api/debt/match-payback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payback_transaction_id: paybackTransactionId,
            drawdown_id: selectedDrawdownId,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to match payback')
        }

        // Show success message if overpaid
        if (data.is_overpaid) {
          alert(`Success! Overpayment detected: ${formatCurrency(data.overpayment_amount, 'VND')}. Credit memo created.`)
        }

        if (onSuccess) onSuccess()
        handleClose()
      }
    } catch (err) {
      console.error('Error matching payback:', err)
      setError(err instanceof Error ? err.message : 'Failed to match payback')
    } finally {
      setIsMatching(false)
    }
  }

  const selectedDrawdown = drawdowns.find(dd => dd.drawdown_id === selectedDrawdownId)
  const willOverpay = !isLinkMode && selectedDrawdown && paybackAmount && paybackAmount > selectedDrawdown.remaining_balance
  const overpaymentAmount = willOverpay ? paybackAmount! - selectedDrawdown.remaining_balance : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isLinkMode ? 'Link to Drawdown' : 'Select Drawdown to Pay Back'}
          </DialogTitle>
          <DialogDescription>
            {isLinkMode
              ? 'Choose which drawdown this interest payment relates to'
              : `Choose which drawdown this payment of ${formatCurrency(paybackAmount || 0, 'VND')} should be applied to`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Overpayment Warning */}
          {willOverpay && (
            <Alert>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <strong>Overpayment Warning:</strong> Payment amount ({formatCurrency(paybackAmount, 'VND')}) exceeds
                remaining balance ({formatCurrency(selectedDrawdown.remaining_balance, 'VND')}).
                A credit memo of {formatCurrency(overpaymentAmount, 'VND')} will be created automatically.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading drawdowns...</span>
            </div>
          ) : drawdowns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingDown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active drawdowns found</p>
              <p className="text-sm text-muted-foreground">
                Create a drawdown on a Credit Line or Term Loan account first
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawdowns.map((drawdown) => {
                    const isSelected = selectedDrawdownId === drawdown.drawdown_id
                    const isOverdue = drawdown.status === 'overdue'

                    return (
                      <TableRow
                        key={drawdown.drawdown_id}
                        className={`cursor-pointer ${isSelected ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedDrawdownId(drawdown.drawdown_id)}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedDrawdownId(drawdown.drawdown_id)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{drawdown.account_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {drawdown.account_type === 'credit_line' ? 'Credit Line' : 'Term Loan'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{drawdown.drawdown_reference}</TableCell>
                        <TableCell>{formatDate(drawdown.drawdown_date)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(drawdown.original_amount, 'VND')}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(drawdown.remaining_balance, 'VND')}
                        </TableCell>
                        <TableCell>
                          {drawdown.due_date ? (
                            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                              {formatDate(drawdown.due_date)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOverdue ? 'destructive' : 'default'}>
                            {drawdown.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isMatching}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleMatch}
            disabled={isMatching || !selectedDrawdownId || loading}
          >
            {isMatching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLinkMode
              ? 'Link to Drawdown'
              : willOverpay
              ? 'Confirm Overpayment'
              : 'Match Payback'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
