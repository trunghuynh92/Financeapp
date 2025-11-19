"use client"

import { useState, useEffect } from "react"
import { Plus, DollarSign, TrendingUp, Calendar, Pencil, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/account-utils"
import { Currency } from "@/types/account"
import {
  InvestmentContributionWithAccounts,
  INVESTMENT_STATUS_LABELS,
  INVESTMENT_STATUS_COLORS,
} from "@/types/investment"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateInvestmentContributionDialog } from "@/components/create-investment-contribution-dialog"

interface InvestmentContributionListCardProps {
  accountId: number
  accountName: string
  currency: string
  onRefresh?: () => void
}

interface InvestmentStats {
  total_contributions: number
  active_contributions: number
  total_invested: number
  latest_contribution_date: string | null
}

export function InvestmentContributionListCard({
  accountId,
  accountName,
  currency,
  onRefresh,
}: InvestmentContributionListCardProps) {
  const [contributions, setContributions] = useState<InvestmentContributionWithAccounts[]>([])
  const [stats, setStats] = useState<InvestmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] = useState(false)
  const [contributionTransactions, setContributionTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [selectedContributionId, setSelectedContributionId] = useState<number | null>(null)

  useEffect(() => {
    fetchContributions()
  }, [accountId, statusFilter])

  async function fetchContributions() {
    try {
      setLoading(true)
      const response = await fetch(`/api/investment-contributions?account_id=${accountId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch investment contributions")
      }

      const data = await response.json()
      let allContributions = data.data || []

      // Apply status filter
      if (statusFilter !== 'all') {
        allContributions = allContributions.filter((c: InvestmentContributionWithAccounts) => c.status === statusFilter)
      }

      setContributions(allContributions)

      // Calculate stats
      if (allContributions.length > 0) {
        const activeContributions = allContributions.filter((c: InvestmentContributionWithAccounts) =>
          c.status === 'active' || c.status === 'partial_withdrawal'
        )
        const totalInvested = allContributions.reduce((sum: number, c: InvestmentContributionWithAccounts) =>
          sum + Number(c.contribution_amount), 0
        )

        // Find latest contribution date
        const latestDate = allContributions
          .map((c: InvestmentContributionWithAccounts) => c.contribution_date)
          .sort()
          .reverse()[0] || null

        setStats({
          total_contributions: allContributions.length,
          active_contributions: activeContributions.length,
          total_invested: totalInvested,
          latest_contribution_date: latestDate,
        })
      } else {
        setStats(null)
      }
    } catch (error) {
      console.error("Error fetching investment contributions:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreateSuccess() {
    fetchContributions()
    setIsCreateDialogOpen(false)
    onRefresh?.()
  }

  async function fetchContributionTransactions(contributionId: number) {
    try {
      setLoadingTransactions(true)
      setSelectedContributionId(contributionId)

      // Fetch all transactions for this contribution from main_transaction_details view
      // This would need to be implemented in the API
      const response = await fetch(`/api/main-transactions?contribution_id=${contributionId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()

      // Filter to only show bank/cash account transactions (actual money movements)
      const cashFlowTransactions = (data.data || []).filter((tx: any) =>
        tx.account_type === 'bank' || tx.account_type === 'cash'
      )

      setContributionTransactions(cashFlowTransactions)
      setIsTransactionsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching contribution transactions:", error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const filteredContributions = contributions

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Investment Contributions</CardTitle>
              <CardDescription>
                Track investments made from bank/cash accounts
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Contribution
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Summary */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invested</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.total_invested, currency as Currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Contributions</p>
                  <p className="text-2xl font-bold">
                    {stats.active_contributions} / {stats.total_contributions}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latest Contribution</p>
                  <p className="text-2xl font-bold">
                    {stats.latest_contribution_date ? formatDate(stats.latest_contribution_date) : 'None'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="partial_withdrawal">Partially Withdrawn</SelectItem>
                  <SelectItem value="fully_withdrawn">Fully Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contributions Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading investment contributions...
            </div>
          ) : filteredContributions.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {statusFilter === 'all'
                  ? 'No investment contributions yet. Create your first investment to get started.'
                  : `No ${statusFilter} contributions found.`}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribution Date</TableHead>
                    <TableHead>Source Account</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContributions.map((contribution) => {
                    return (
                      <TableRow key={contribution.contribution_id}>
                        <TableCell className="font-medium">
                          {formatDate(contribution.contribution_date)}
                        </TableCell>
                        <TableCell>
                          {(contribution as any).source_account?.account_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(contribution.contribution_amount, currency as Currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={INVESTMENT_STATUS_COLORS[contribution.status]}>
                            {INVESTMENT_STATUS_LABELS[contribution.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contribution.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchContributionTransactions(contribution.contribution_id)}
                              disabled={loadingTransactions}
                              title="View transactions"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateInvestmentContributionDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        accountId={accountId}
        accountName={accountName}
        onSuccess={handleCreateSuccess}
      />

      {/* Transactions Dialog */}
      <Dialog open={isTransactionsDialogOpen} onOpenChange={setIsTransactionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cash Flow Transactions - Contribution #{selectedContributionId}</DialogTitle>
            <DialogDescription>
              Showing only bank and cash account transactions (money in/out)
            </DialogDescription>
          </DialogHeader>

          {loadingTransactions ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : contributionTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cash flow transactions found for this contribution
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributionTransactions.map((tx) => (
                    <TableRow key={tx.main_transaction_id}>
                      <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="font-medium">{tx.account_name}</TableCell>
                      <TableCell>{tx.description || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.transaction_type || '—'}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        tx.transaction_direction === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.transaction_direction === 'credit' ? '+' : '-'}
                        {formatCurrency(tx.amount, currency as Currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
