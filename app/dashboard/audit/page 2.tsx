"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Flag,
  AlertTriangle,
  Edit,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Coins,
  CreditCard,
  LayoutDashboard
} from "lucide-react"
import { MainTransactionDetails } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface UnmatchedData {
  transfersOut: MainTransactionDetails[]
  transfersIn: MainTransactionDetails[]
  debtTake: MainTransactionDetails[]
  debtPay: MainTransactionDetails[]
  loanDisburse: MainTransactionDetails[]
  loanCollect: MainTransactionDetails[]
  summary: {
    total: number
    transfers: number
    debts: number
    loans: number
  }
}

export default function AuditPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const { toast } = useToast()

  // Data state
  const [flaggedTransactions, setFlaggedTransactions] = useState<MainTransactionDetails[]>([])
  const [unmatchedData, setUnmatchedData] = useState<UnmatchedData>({
    transfersOut: [],
    transfersIn: [],
    debtTake: [],
    debtPay: [],
    loanDisburse: [],
    loanCollect: [],
    summary: { total: 0, transfers: 0, debts: 0, loans: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [flaggedCount, setFlaggedCount] = useState(0)

  // Dialog state
  const [flagNoteDialogOpen, setFlagNoteDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<MainTransactionDetails | null>(null)
  const [flagNote, setFlagNote] = useState("")
  const [savingFlagNote, setSavingFlagNote] = useState(false)

  // Fetch all audit data
  useEffect(() => {
    if (!currentEntity) return
    fetchAuditData()
  }, [currentEntity?.id])

  const fetchAuditData = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      // Fetch flagged transactions and unmatched items in parallel
      const [flaggedRes, unmatchedRes] = await Promise.all([
        fetch(`/api/flagged-transactions?entity_id=${currentEntity.id}&limit=1000`),
        fetch(`/api/transfers/unmatched?entity_id=${currentEntity.id}`)
      ])

      if (flaggedRes.ok) {
        const flaggedData = await flaggedRes.json()
        setFlaggedTransactions(flaggedData.data || [])
        setFlaggedCount(flaggedData.summary?.total || 0)
      }

      if (unmatchedRes.ok) {
        const unmatchedJson = await unmatchedRes.json()
        setUnmatchedData({
          transfersOut: unmatchedJson.transfersOut || [],
          transfersIn: unmatchedJson.transfersIn || [],
          debtTake: unmatchedJson.debtTake || [],
          debtPay: unmatchedJson.debtPay || [],
          loanDisburse: unmatchedJson.loanDisburse || [],
          loanCollect: unmatchedJson.loanCollect || [],
          summary: unmatchedJson.summary || { total: 0, transfers: 0, debts: 0, loans: 0 }
        })
      }
    } catch (error) {
      console.error("Error fetching audit data:", error)
      toast({
        title: "Error",
        description: "Failed to load audit data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewFlagNote = (transaction: MainTransactionDetails) => {
    setSelectedTransaction(transaction)
    setFlagNote(transaction.flag_note || "")
    setFlagNoteDialogOpen(true)
  }

  const handleSaveFlagNote = async () => {
    if (!selectedTransaction) return

    setSavingFlagNote(true)
    try {
      const response = await fetch(`/api/main-transactions/${selectedTransaction.main_transaction_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag_note: flagNote || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update flag note')
      }

      toast({
        title: "Success",
        description: "Flag note updated successfully",
      })

      // Update local state
      setFlaggedTransactions(prev => prev.map(tx =>
        tx.main_transaction_id === selectedTransaction.main_transaction_id
          ? { ...tx, flag_note: flagNote || null }
          : tx
      ))

      setFlagNoteDialogOpen(false)
    } catch (error) {
      console.error('Error updating flag note:', error)
      toast({
        title: "Error",
        description: "Failed to update flag note",
        variant: "destructive",
      })
    } finally {
      setSavingFlagNote(false)
    }
  }

  const formatCurrency = (amount: number | string, currency: string = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(num)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
  }

  const renderTransactionRow = (transaction: MainTransactionDetails, showActions: boolean = true) => (
    <tr key={transaction.main_transaction_id} className="border-b hover:bg-muted/50">
      <td className="p-2 text-sm">
        {formatDate(transaction.transaction_date)}
      </td>
      <td className="p-2 text-sm">
        <div className="font-medium">{transaction.account_name}</div>
        <div className="text-xs text-muted-foreground">{transaction.bank_name}</div>
      </td>
      <td className="p-2 text-sm max-w-xs truncate">
        {transaction.description || '-'}
      </td>
      <td className="p-2 text-sm text-right">
        <span className={cn(
          "font-medium",
          transaction.transaction_direction === 'debit' ? "text-red-600" : "text-green-600"
        )}>
          {transaction.transaction_direction === 'debit' ? '-' : '+'}
          {formatCurrency(transaction.amount, transaction.currency)}
        </span>
      </td>
      <td className="p-2 text-sm">
        <Badge variant="outline">
          {transaction.transaction_type || '-'}
        </Badge>
      </td>
      {showActions && (
        <td className="p-2">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewFlagNote(transaction)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  )

  if (entityLoading) {
    return <div className="flex items-center justify-center h-64">Loading entity...</div>
  }

  if (!currentEntity) {
    return <div className="flex items-center justify-center h-64">Please select an entity</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction Audit</h1>
        <p className="text-muted-foreground">
          Review and manage flagged transactions and unmatched items
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Flag className="h-4 w-4 mr-2" />
            Flagged ({flaggedCount})
          </TabsTrigger>
          <TabsTrigger value="transfers">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfers ({unmatchedData.summary.transfers})
          </TabsTrigger>
          <TabsTrigger value="loans">
            <Coins className="h-4 w-4 mr-2" />
            Loans ({unmatchedData.summary.loans})
          </TabsTrigger>
          <TabsTrigger value="debts">
            <CreditCard className="h-4 w-4 mr-2" />
            Debts ({unmatchedData.summary.debts})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged Transactions</CardTitle>
                <Flag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{flaggedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Transactions requiring review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unmatched Transfers</CardTitle>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unmatchedData.summary.transfers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {unmatchedData.transfersOut.length} out, {unmatchedData.transfersIn.length} in
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unmatched Loans</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unmatchedData.summary.loans}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {unmatchedData.loanDisburse.length} disbursed, {unmatchedData.loanCollect.length} collected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unmatched Debts</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unmatchedData.summary.debts}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {unmatchedData.debtTake.length} taken, {unmatchedData.debtPay.length} paid
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Summary</CardTitle>
              <CardDescription>
                Items that need your attention across all categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Total Items Requiring Attention</span>
                  </div>
                  <Badge variant="secondary" className="text-lg">
                    {flaggedCount + unmatchedData.summary.total}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flagged Transactions Tab */}
        <TabsContent value="flagged" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Transactions</CardTitle>
              <CardDescription>
                Transactions that have been flagged for review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : flaggedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Flag className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No flagged transactions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">Account</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-right p-2 font-medium">Amount</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-center p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedTransactions.map(tx => renderTransactionRow(tx, true))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unmatched Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Transfers Out ({unmatchedData.transfersOut.length})
                </CardTitle>
                <CardDescription>
                  Outgoing transfers without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.transfersOut.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched transfers out</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.transfersOut.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-red-600">
                              -{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Transfers In ({unmatchedData.transfersIn.length})
                </CardTitle>
                <CardDescription>
                  Incoming transfers without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.transfersIn.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched transfers in</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.transfersIn.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-green-600">
                              +{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Unmatched Loans Tab */}
        <TabsContent value="loans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                  Loans Disbursed ({unmatchedData.loanDisburse.length})
                </CardTitle>
                <CardDescription>
                  Loan disbursements without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.loanDisburse.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched loan disbursements</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.loanDisburse.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-red-600">
                              -{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Loans Collected ({unmatchedData.loanCollect.length})
                </CardTitle>
                <CardDescription>
                  Loan collections without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.loanCollect.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched loan collections</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.loanCollect.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-green-600">
                              +{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Unmatched Debts Tab */}
        <TabsContent value="debts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Debt Taken ({unmatchedData.debtTake.length})
                </CardTitle>
                <CardDescription>
                  Debt drawdowns without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.debtTake.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched debt taken</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.debtTake.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-green-600">
                              +{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Debt Paid ({unmatchedData.debtPay.length})
                </CardTitle>
                <CardDescription>
                  Debt payments without matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedData.debtPay.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No unmatched debt payments</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedData.debtPay.map(tx => (
                          <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
                            <td className="p-2 text-xs">{formatDate(tx.transaction_date)}</td>
                            <td className="p-2 text-xs">{tx.account_name}</td>
                            <td className="p-2 text-xs text-right text-red-600">
                              -{formatCurrency(tx.amount, tx.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Flag Note Dialog */}
      <Dialog open={flagNoteDialogOpen} onOpenChange={setFlagNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flag Note</DialogTitle>
            <DialogDescription>
              Update the note for this flagged transaction
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTransaction && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Date:</div>
                  <div>{formatDate(selectedTransaction.transaction_date)}</div>
                  <div className="text-muted-foreground">Account:</div>
                  <div>{selectedTransaction.account_name}</div>
                  <div className="text-muted-foreground">Amount:</div>
                  <div className={cn(
                    "font-medium",
                    selectedTransaction.transaction_direction === 'debit' ? "text-red-600" : "text-green-600"
                  )}>
                    {selectedTransaction.transaction_direction === 'debit' ? '-' : '+'}
                    {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                  </div>
                  <div className="text-muted-foreground">Description:</div>
                  <div>{selectedTransaction.description || '-'}</div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="flag_note">Flag Note</Label>
              <Textarea
                id="flag_note"
                placeholder="Enter reason for flagging or notes about this transaction..."
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFlagNote} disabled={savingFlagNote}>
              {savingFlagNote ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
