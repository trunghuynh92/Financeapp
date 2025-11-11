"use client"

import { useState, useEffect } from "react"
import { Plus, DollarSign, Calendar, AlertCircle, TrendingUp, User } from "lucide-react"
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
import { formatCurrency, formatDate } from "@/lib/account-utils"
import { Currency } from "@/types/account"
import {
  LoanDisbursementWithAccount,
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
} from "@/types/loan"
import { PARTNER_TYPE_LABELS, PartnerType } from "@/types/business-partner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateLoanDisbursementDialog } from "@/components/create-loan-disbursement-dialog"
import { RecordLoanPaymentDialog } from "@/components/record-loan-payment-dialog"

interface LoanDisbursementListCardProps {
  accountId: number
  accountName: string
  currency: string
  onRefresh?: () => void
}

interface LoanStats {
  total_disbursements: number
  active_disbursements: number
  total_outstanding: number
  next_due_date: string | null
}

export function LoanDisbursementListCard({
  accountId,
  accountName,
  currency,
  onRefresh,
}: LoanDisbursementListCardProps) {
  const [disbursements, setDisbursements] = useState<LoanDisbursementWithAccount[]>([])
  const [stats, setStats] = useState<LoanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedDisbursementId, setSelectedDisbursementId] = useState<number | null>(null)
  const [selectedBorrowerName, setSelectedBorrowerName] = useState<string>("")

  useEffect(() => {
    fetchDisbursements()
  }, [accountId, statusFilter])

  async function fetchDisbursements() {
    try {
      setLoading(true)
      const response = await fetch(`/api/loan-disbursements?account_id=${accountId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch loan disbursements")
      }

      const data = await response.json()
      let allDisbursements = data.data || []

      // Apply status filter
      if (statusFilter !== 'all') {
        allDisbursements = allDisbursements.filter((d: LoanDisbursementWithAccount) => d.status === statusFilter)
      }

      setDisbursements(allDisbursements)

      // Calculate stats
      if (allDisbursements.length > 0) {
        const activeDisbursements = allDisbursements.filter((d: LoanDisbursementWithAccount) =>
          d.status === 'active' || d.status === 'overdue'
        )
        const totalOutstanding = activeDisbursements.reduce((sum: number, d: LoanDisbursementWithAccount) =>
          sum + Number(d.remaining_balance), 0
        )

        // Find next due date
        const dueDates = activeDisbursements
          .filter((d: LoanDisbursementWithAccount) => d.due_date && new Date(d.due_date) >= new Date())
          .map((d: LoanDisbursementWithAccount) => d.due_date)
          .sort()
        const nextDueDate = dueDates.length > 0 ? dueDates[0] : null

        setStats({
          total_disbursements: allDisbursements.length,
          active_disbursements: activeDisbursements.length,
          total_outstanding: totalOutstanding,
          next_due_date: nextDueDate,
        })
      } else {
        setStats(null)
      }
    } catch (error) {
      console.error("Error fetching loan disbursements:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreateSuccess() {
    fetchDisbursements()
    setIsCreateDialogOpen(false)
    onRefresh?.()
  }

  function handlePaymentSuccess() {
    fetchDisbursements()
    setIsPaymentDialogOpen(false)
    onRefresh?.()
  }

  function handleRecordPayment(disbursementId: number, borrowerName: string) {
    setSelectedDisbursementId(disbursementId)
    setSelectedBorrowerName(borrowerName)
    setIsPaymentDialogOpen(true)
  }

  function calculatePaymentProgress(principal: number, remaining: number): number {
    if (principal === 0) return 0
    return ((principal - remaining) / principal) * 100
  }

  function isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  function isDueWithinDays(dueDate: string | null, days: number): boolean {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= days && diff >= 0
  }

  const filteredDisbursements = disbursements

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Disbursements</CardTitle>
              <CardDescription>
                Track loans given to owners, employees, partners, and customers
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Loan
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
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.total_outstanding, currency as Currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Loans</p>
                  <p className="text-2xl font-bold">
                    {stats.active_disbursements} / {stats.total_disbursements}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Due Date</p>
                  <p className="text-2xl font-bold">
                    {stats.next_due_date ? formatDate(stats.next_due_date) : 'None'}
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
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="repaid">Repaid</SelectItem>
                  <SelectItem value="partially_written_off">Partially Written Off</SelectItem>
                  <SelectItem value="written_off">Written Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Disbursements Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading loan disbursements...
            </div>
          ) : filteredDisbursements.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {statusFilter === 'all'
                  ? 'No loan disbursements yet. Create your first loan to get started.'
                  : `No ${statusFilter} loans found.`}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Disbursed Date</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDisbursements.map((loan) => {
                    const progress = calculatePaymentProgress(
                      Number(loan.principal_amount),
                      Number(loan.remaining_balance)
                    )
                    const paidAmount = Number(loan.principal_amount) - Number(loan.remaining_balance)
                    const overdueFlag = loan.due_date && isOverdue(loan.due_date)
                    const dueSoonFlag = loan.due_date && isDueWithinDays(loan.due_date, 7)

                    return (
                      <TableRow key={loan.loan_disbursement_id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{(loan as any).partner?.partner_name || loan.borrower_name || 'Unknown'}</div>
                            {loan.interest_rate && (
                              <div className="text-sm text-muted-foreground">
                                {loan.interest_rate}% interest
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(loan as any).partner?.partner_type && (
                            <Badge variant="outline">
                              {PARTNER_TYPE_LABELS[(loan as any).partner.partner_type as PartnerType] || (loan as any).partner.partner_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(loan.disbursement_date)}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(loan.principal_amount, currency as Currency)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(loan.remaining_balance, currency as Currency)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {progress.toFixed(0)}% ({formatCurrency(paidAmount, currency as Currency)} received)
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {loan.due_date ? (
                            <div className="flex items-center gap-2">
                              {formatDate(loan.due_date)}
                              {overdueFlag && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              {!overdueFlag && dueSoonFlag && (
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={LOAN_STATUS_COLORS[loan.status]}>
                            {LOAN_STATUS_LABELS[loan.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {loan.status !== 'repaid' && loan.status !== 'written_off' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecordPayment(loan.loan_disbursement_id, loan.borrower_name)}
                            >
                              Record Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Overdue Loans Alert */}
          {stats && stats.active_disbursements > 0 && (
            (() => {
              const overdueDisbursements = disbursements.filter((d) =>
                d.due_date && isOverdue(d.due_date) && (d.status === 'active' || d.status === 'overdue')
              )
              if (overdueDisbursements.length > 0) {
                return (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {overdueDisbursements.length} loan{overdueDisbursements.length > 1 ? 's are' : ' is'} overdue.
                      Total overdue amount: {formatCurrency(
                        overdueDisbursements.reduce((sum, d) => sum + Number(d.remaining_balance), 0),
                        currency
                      )}
                    </AlertDescription>
                  </Alert>
                )
              }
              return null
            })()
          )}
        </CardContent>
      </Card>

      <CreateLoanDisbursementDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        accountId={accountId}
        accountName={accountName}
        onSuccess={handleCreateSuccess}
      />

      {selectedDisbursementId && (
        <RecordLoanPaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          disbursementId={selectedDisbursementId}
          borrowerName={selectedBorrowerName}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}
