"use client"

import { useState, useEffect } from "react"
import { Plus, DollarSign, Calendar, AlertCircle, TrendingDown, Link2 } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/account-utils"
import { formatDate } from "@/lib/account-utils"
import { Currency } from "@/types/account"
import {
  DrawdownListItem,
  DrawdownStats,
  getDrawdownStatusColor,
  getDrawdownStatusLabel,
  calculatePaymentProgress,
  isDueWithinDays,
  isOverdue,
} from "@/types/debt"
import { CreateDrawdownDialog } from "@/components/create-drawdown-dialog"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { AssignReceivingAccountDialog } from "@/components/assign-receiving-account-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DrawdownListCardProps {
  accountId: number
  accountName: string
  currency: string
  creditLimit?: number | null
  onRefresh?: () => void
}

export function DrawdownListCard({
  accountId,
  accountName,
  currency,
  creditLimit,
  onRefresh,
}: DrawdownListCardProps) {
  const [drawdowns, setDrawdowns] = useState<DrawdownListItem[]>([])
  const [stats, setStats] = useState<DrawdownStats | null>(null)
  const [availableCredit, setAvailableCredit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [selectedDrawdownId, setSelectedDrawdownId] = useState<number | null>(null)
  const [selectedDrawdownRef, setSelectedDrawdownRef] = useState<string>("")

  useEffect(() => {
    fetchDrawdowns()
    fetchAvailableCredit()
  }, [accountId, statusFilter])

  async function fetchDrawdowns() {
    try {
      setLoading(true)
      // Fetch drawdowns with status filter
      const statusParam = statusFilter === 'all' ? 'all' : statusFilter
      const response = await fetch(`/api/accounts/${accountId}/drawdowns?status=${statusParam}`)

      if (!response.ok) {
        throw new Error("Failed to fetch drawdowns")
      }

      const data = await response.json()
      setDrawdowns(data.data || [])

      // Calculate stats
      if (data.data && data.data.length > 0) {
        // Include both active and overdue drawdowns in calculations
        const outstandingDrawdowns = data.data.filter((d: DrawdownListItem) =>
          d.status === 'active' || d.status === 'overdue'
        )
        const totalOutstanding = outstandingDrawdowns.reduce((sum: number, d: DrawdownListItem) => sum + Number(d.remaining_balance), 0)
        const totalInterest = outstandingDrawdowns.reduce((sum: number, d: DrawdownListItem) => sum + Number(d.total_interest_paid), 0)
        const totalFees = outstandingDrawdowns.reduce((sum: number, d: DrawdownListItem) => sum + Number(d.total_fees_paid), 0)

        // Calculate average interest rate (weighted by balance)
        const totalWeightedRate = outstandingDrawdowns.reduce((sum: number, d: DrawdownListItem) => {
          const rate = d.interest_rate || 0
          const balance = Number(d.remaining_balance)
          return sum + (rate * balance)
        }, 0)
        const avgInterestRate = totalOutstanding > 0 ? totalWeightedRate / totalOutstanding : null

        // Find next due date
        const dueDates = outstandingDrawdowns
          .filter((d: DrawdownListItem) => d.due_date && !isOverdue(d.due_date))
          .map((d: DrawdownListItem) => d.due_date)
          .sort()
        const nextDueDate = dueDates.length > 0 ? dueDates[0] : null

        setStats({
          total_drawdowns: data.data.length,
          active_drawdowns: data.data.filter((d: DrawdownListItem) => d.status === 'active').length,
          total_outstanding: totalOutstanding,
          total_interest_paid: totalInterest,
          total_fees_paid: totalFees,
          average_interest_rate: avgInterestRate,
          next_due_date: nextDueDate,
        })
      } else {
        setStats(null)
      }
    } catch (error) {
      console.error("Error fetching drawdowns:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAvailableCredit() {
    if (!creditLimit) return

    try {
      const response = await fetch(`/api/accounts/${accountId}/available-credit`)

      if (response.ok) {
        const data = await response.json()
        setAvailableCredit(data.data?.available_credit || 0)
      }
    } catch (error) {
      console.error("Error fetching available credit:", error)
    }
  }

  function handleCreateSuccess() {
    fetchDrawdowns()
    fetchAvailableCredit()
    onRefresh?.()
  }

  function handlePaymentSuccess() {
    fetchDrawdowns()
    fetchAvailableCredit()
    onRefresh?.()
  }

  function openPaymentDialog(drawdownId: number) {
    setSelectedDrawdownId(drawdownId)
    setIsPaymentDialogOpen(true)
  }

  function openAssignDialog(drawdownId: number, drawdownRef: string) {
    setSelectedDrawdownId(drawdownId)
    setSelectedDrawdownRef(drawdownRef)
    setIsAssignDialogOpen(true)
  }

  function handleAssignSuccess() {
    fetchDrawdowns()
    onRefresh?.()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Debt Drawdowns</CardTitle>
              <CardDescription>
                Track individual drawdowns and payments
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Drawdown
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Summary */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Active Drawdowns</p>
                <p className="text-2xl font-bold">{stats.active_drawdowns}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.total_outstanding, currency as Currency)}</p>
              </div>
              {creditLimit && availableCredit !== null && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Available Credit</p>
                  <p className="text-2xl font-bold">{formatCurrency(availableCredit, currency as Currency)}</p>
                </div>
              )}
              {stats.average_interest_rate !== null && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Interest Rate</p>
                  <p className="text-2xl font-bold">{stats.average_interest_rate.toFixed(2)}%</p>
                </div>
              )}
            </div>
          )}

          {/* Next Due Date Alert */}
          {stats && stats.next_due_date && isDueWithinDays(stats.next_due_date, 7) && (
            <Alert className="mb-6">
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Next payment due on {formatDate(stats.next_due_date)}
              </AlertDescription>
            </Alert>
          )}

          {/* Drawdowns Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading drawdowns...</div>
          ) : drawdowns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingDown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {statusFilter === 'all' ? 'No drawdowns' : `No ${statusFilter} drawdowns`}
              </p>
              <p className="text-sm text-muted-foreground">
                {statusFilter === 'all'
                  ? 'Create a drawdown to start tracking debt payments'
                  : 'Try selecting a different status filter'
                }
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawdowns.map((drawdown) => {
                    const progress = calculatePaymentProgress(
                      Number(drawdown.original_amount),
                      Number(drawdown.remaining_balance)
                    )
                    const isNearDue = drawdown.due_date && isDueWithinDays(drawdown.due_date, 7)
                    const isLate = drawdown.due_date && isOverdue(drawdown.due_date)

                    return (
                      <TableRow key={drawdown.drawdown_id}>
                        <TableCell className="font-medium">
                          {drawdown.drawdown_reference}
                        </TableCell>
                        <TableCell>{formatDate(drawdown.drawdown_date)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(drawdown.original_amount, currency as Currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(drawdown.remaining_balance, currency as Currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {drawdown.due_date ? (
                            <div className="flex items-center gap-2">
                              <span className={isLate ? "text-red-600 font-medium" : ""}>
                                {formatDate(drawdown.due_date)}
                              </span>
                              {isNearDue && !isLate && (
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                              )}
                              {isLate && (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getDrawdownStatusColor(drawdown.status)}>
                            {getDrawdownStatusLabel(drawdown.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignDialog(drawdown.drawdown_id, drawdown.drawdown_reference)}
                              title="Assign receiving account"
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPaymentDialog(drawdown.drawdown_id)}
                            >
                              <DollarSign className="mr-1 h-3 w-3" />
                              Pay
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

      {/* Dialogs */}
      <CreateDrawdownDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        accountId={accountId}
        accountName={accountName}
        availableCredit={availableCredit}
        onSuccess={handleCreateSuccess}
      />

      {selectedDrawdownId && (
        <RecordPaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          drawdownId={selectedDrawdownId}
          accountId={accountId}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {selectedDrawdownId && (
        <AssignReceivingAccountDialog
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          drawdownId={selectedDrawdownId}
          drawdownReference={selectedDrawdownRef}
          creditLineAccountId={accountId}
          onSuccess={handleAssignSuccess}
        />
      )}
    </>
  )
}
