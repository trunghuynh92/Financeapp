"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Plus, DollarSign, Calendar, AlertCircle, TrendingUp, User, Receipt, Pencil, Trash2, ChevronRight, ChevronDown, Users } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CreateLoanDisbursementDialog } from "@/components/create-loan-disbursement-dialog"
import { EditLoanDisbursementDialog } from "@/components/edit-loan-disbursement-dialog"
import { RecordLoanPaymentDialog } from "@/components/record-loan-payment-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<LoanDisbursementWithAccount | null>(null)
  const [selectedDisbursementId, setSelectedDisbursementId] = useState<number | null>(null)
  const [selectedBorrowerName, setSelectedBorrowerName] = useState<string>("")
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] = useState(false)
  const [loanTransactions, setLoanTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [selectedLoanRef, setSelectedLoanRef] = useState<string>("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingLoan, setDeletingLoan] = useState<LoanDisbursementWithAccount | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [groupByBorrower, setGroupByBorrower] = useState(false)
  const [expandedBorrowers, setExpandedBorrowers] = useState<Set<string>>(new Set())

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

  function handleEditSuccess() {
    fetchDisbursements()
    setIsEditDialogOpen(false)
    onRefresh?.()
  }

  function handlePaymentSuccess() {
    fetchDisbursements()
    setIsPaymentDialogOpen(false)
    onRefresh?.()
  }

  function openEditDialog(loan: LoanDisbursementWithAccount) {
    setSelectedLoan(loan)
    setIsEditDialogOpen(true)
  }

  function handleRecordPayment(disbursementId: number, borrowerName: string) {
    setSelectedDisbursementId(disbursementId)
    setSelectedBorrowerName(borrowerName)
    setIsPaymentDialogOpen(true)
  }

  async function fetchLoanTransactions(loanDisbursementId: number, loanRef: string) {
    try {
      setLoadingTransactions(true)
      setSelectedDisbursementId(loanDisbursementId)
      setSelectedLoanRef(loanRef)

      // Fetch all transactions for this loan from main_transaction_details view
      const response = await fetch(`/api/main-transactions?loan_disbursement_id=${loanDisbursementId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()

      // Filter to only show bank/cash account transactions (actual money movements)
      // Exclude loan_receivable account transactions (asset bookkeeping)
      const cashFlowTransactions = (data.data || []).filter((tx: any) =>
        tx.account_type === 'bank' || tx.account_type === 'cash'
      )

      setLoanTransactions(cashFlowTransactions)
      setIsTransactionsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching loan transactions:", error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  function openDeleteDialog(loan: LoanDisbursementWithAccount) {
    setDeletingLoan(loan)
    setIsDeleteDialogOpen(true)
  }

  async function handleDeleteLoan() {
    if (!deletingLoan) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/loan-disbursements/${deletingLoan.loan_disbursement_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete loan disbursement')
      }

      // Success - refresh the list
      await fetchDisbursements()
      setIsDeleteDialogOpen(false)
      setDeletingLoan(null)
      onRefresh?.()
    } catch (error: any) {
      console.error('Error deleting loan disbursement:', error)
      alert(error.message || 'Failed to delete loan disbursement. Please try again.')
    } finally {
      setIsDeleting(false)
    }
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

  // Group disbursements by borrower
  const groupedByBorrower = useMemo(() => {
    const groups = new Map<string, {
      borrowerName: string
      partnerType: string | null
      loans: LoanDisbursementWithAccount[]
      totalPrincipal: number
      totalRemaining: number
      loanCount: number
      hasOverdue: boolean
    }>()

    filteredDisbursements.forEach(loan => {
      const borrowerName = (loan as any).partner?.partner_name || loan.borrower_name || 'Unknown'
      const key = borrowerName.toLowerCase()

      if (!groups.has(key)) {
        groups.set(key, {
          borrowerName,
          partnerType: (loan as any).partner?.partner_type || null,
          loans: [],
          totalPrincipal: 0,
          totalRemaining: 0,
          loanCount: 0,
          hasOverdue: false,
        })
      }

      const group = groups.get(key)!
      group.loans.push(loan)
      group.totalPrincipal += Number(loan.principal_amount)
      group.totalRemaining += Number(loan.remaining_balance)
      group.loanCount += 1
      if (loan.due_date && isOverdue(loan.due_date) && (loan.status === 'active' || loan.status === 'overdue')) {
        group.hasOverdue = true
      }
    })

    // Sort by total remaining (highest first)
    return Array.from(groups.values()).sort((a, b) => b.totalRemaining - a.totalRemaining)
  }, [filteredDisbursements])

  const toggleBorrowerExpanded = (borrowerName: string) => {
    const key = borrowerName.toLowerCase()
    setExpandedBorrowers(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const isBorrowerExpanded = (borrowerName: string) => {
    return expandedBorrowers.has(borrowerName.toLowerCase())
  }

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
          <div className="flex items-center justify-between gap-4">
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

            <div className="flex items-center gap-2">
              <Switch
                id="group-by-borrower"
                checked={groupByBorrower}
                onCheckedChange={setGroupByBorrower}
              />
              <Label htmlFor="group-by-borrower" className="text-sm cursor-pointer flex items-center gap-1">
                <Users className="h-4 w-4" />
                Group by Borrower
              </Label>
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
          ) : groupByBorrower ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Loans</TableHead>
                    <TableHead>Total Principal</TableHead>
                    <TableHead>Total Remaining</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedByBorrower.map((group) => {
                    const isExpanded = isBorrowerExpanded(group.borrowerName)
                    const progress = calculatePaymentProgress(group.totalPrincipal, group.totalRemaining)
                    const paidAmount = group.totalPrincipal - group.totalRemaining

                    return (
                      <React.Fragment key={`group-${group.borrowerName}`}>
                        {/* Borrower Summary Row */}
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleBorrowerExpanded(group.borrowerName)}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {group.borrowerName}
                            </div>
                          </TableCell>
                          <TableCell>
                            {group.partnerType && (
                              <Badge variant="outline">
                                {PARTNER_TYPE_LABELS[group.partnerType as PartnerType] || group.partnerType}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{group.loanCount} loan{group.loanCount > 1 ? 's' : ''}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(group.totalPrincipal, currency as Currency)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(group.totalRemaining, currency as Currency)}
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
                            {group.hasOverdue ? (
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Has Overdue
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Loan Details */}
                        {isExpanded && group.loans.map((loan) => {
                          const loanProgress = calculatePaymentProgress(
                            Number(loan.principal_amount),
                            Number(loan.remaining_balance)
                          )
                          const loanPaidAmount = Number(loan.principal_amount) - Number(loan.remaining_balance)
                          const overdueFlag = loan.due_date && isOverdue(loan.due_date)
                          const dueSoonFlag = loan.due_date && isDueWithinDays(loan.due_date, 7)

                          return (
                            <TableRow key={loan.loan_disbursement_id} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="pl-8">
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(loan.disbursement_date)}
                                  {loan.interest_rate && ` • ${loan.interest_rate}% interest`}
                                </div>
                              </TableCell>
                              <TableCell>
                                {loan.due_date ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    Due: {formatDate(loan.due_date)}
                                    {overdueFlag && <AlertCircle className="h-3 w-3 text-red-500" />}
                                    {!overdueFlag && dueSoonFlag && <AlertCircle className="h-3 w-3 text-orange-500" />}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No due date</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={LOAN_STATUS_COLORS[loan.status]}>
                                  {LOAN_STATUS_LABELS[loan.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(loan.principal_amount, currency as Currency)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(loan.remaining_balance, currency as Currency)}
                              </TableCell>
                              <TableCell>
                                <div className="text-xs text-muted-foreground">
                                  {loanProgress.toFixed(0)}% repaid
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      fetchLoanTransactions(
                                        loan.loan_disbursement_id,
                                        `Loan to ${loan.borrower_name || 'Unknown'}`
                                      )
                                    }}
                                    disabled={loadingTransactions}
                                    title="View transactions"
                                  >
                                    <Receipt className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEditDialog(loan)
                                    }}
                                    title="Edit loan"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openDeleteDialog(loan)
                                    }}
                                    title="Delete loan"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchLoanTransactions(
                                loan.loan_disbursement_id,
                                `Loan to ${loan.borrower_name || 'Unknown'}`
                              )}
                              disabled={loadingTransactions}
                              title="View transactions"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(loan)}
                              title="Edit loan details"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(loan)}
                              title="Delete loan disbursement"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
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
                        currency as Currency
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

      <EditLoanDisbursementDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        loan={selectedLoan}
        onSuccess={handleEditSuccess}
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

      {/* Transactions Dialog */}
      <Dialog open={isTransactionsDialogOpen} onOpenChange={setIsTransactionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cash Flow Transactions - {selectedLoanRef}</DialogTitle>
            <DialogDescription>
              Showing only bank and cash account transactions (money in/out)
            </DialogDescription>
          </DialogHeader>

          {loadingTransactions ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : loanTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cash flow transactions found for this loan
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
                  {loanTransactions.map((tx) => (
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Loan Disbursement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this loan disbursement?
            </DialogDescription>
          </DialogHeader>

          {deletingLoan && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Borrower:</span>
                  <span className="font-medium">{deletingLoan.borrower_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Principal Amount:</span>
                  <span className="font-medium">{formatCurrency(deletingLoan.principal_amount, currency as Currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Disbursement Date:</span>
                  <span className="font-medium">{formatDate(deletingLoan.disbursement_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={LOAN_STATUS_COLORS[deletingLoan.status]}>
                    {LOAN_STATUS_LABELS[deletingLoan.status]}
                  </Badge>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will delete the loan disbursement record and all linked transactions in the Loan Receivable account.
                  The source bank transaction will be unlinked but kept.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLoan}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Loan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
