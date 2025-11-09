"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, Search, DollarSign, ArrowUpCircle, ArrowDownCircle, Eye, ChevronLeft, ChevronRight, List, ListCollapse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TransactionFormDialog } from "@/components/transaction-form-dialog"
import { TransactionDeleteDialog } from "@/components/transaction-delete-dialog"
import { ViewCheckpointDialog } from "@/components/view-checkpoint-dialog"
import { useEntity } from "@/contexts/EntityContext"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
}

interface Transaction {
  raw_transaction_id: string
  account_id: number
  transaction_date: string
  description: string | null
  debit_amount: number | null
  credit_amount: number | null
  balance: number | null
  bank_reference: string | null
  transaction_source: 'imported_bank' | 'user_manual' | 'system_opening' | 'auto_adjustment'
  import_batch_id: number | null
  imported_at: string
  import_file_name: string | null
  created_by_user_id: number | null
  updated_at: string | null
  updated_by_user_id: number | null
  is_balance_adjustment: boolean
  checkpoint_id: number | null
  account?: Account
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface GroupedTransaction {
  transaction_source: string
  import_batch_id: number | null
  transaction_count: number
  total_debit: number
  total_credit: number
}

export default function TransactionsPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isGroupedView, setIsGroupedView] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCheckpointDialogOpen, setIsCheckpointDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    if (currentEntity) {
      fetchAccounts()
    }
  }, [currentEntity?.id])

  useEffect(() => {
    if (currentEntity) {
      if (isGroupedView) {
        fetchGroupedTransactions()
      } else {
        fetchTransactions()
      }
    }
  }, [currentEntity?.id, currentPage, itemsPerPage, selectedAccount, selectedSource, searchQuery, startDate, endDate, isGroupedView])

  async function fetchAccounts() {
    try {
      if (!currentEntity) return

      const params = new URLSearchParams()
      params.set('entity_id', currentEntity.id)
      params.set('limit', '1000') // Get all accounts for the entity

      const response = await fetch(`/api/accounts?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch accounts')
      const result = await response.json()
      setAccounts(result.data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
    }
  }

  async function fetchTransactions() {
    try {
      setLoading(true)

      if (!currentEntity) return

      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())

      // Always filter by current entity
      params.append('entity_id', currentEntity.id)

      if (selectedAccount !== "all") {
        params.append('account_id', selectedAccount)
      }
      if (selectedSource !== "all") {
        params.append('transaction_source', selectedSource)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }

      const response = await fetch(`/api/transactions?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch transactions')

      const result = await response.json()
      setTransactions(result.data || [])
      setPagination(result.pagination)
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchGroupedTransactions() {
    try {
      setLoading(true)

      if (!currentEntity) return

      const params = new URLSearchParams()

      // Always filter by current entity
      params.append('entity_id', currentEntity.id)

      if (selectedAccount !== "all") {
        params.append('account_id', selectedAccount)
      }
      if (selectedSource !== "all") {
        params.append('transaction_source', selectedSource)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }

      const response = await fetch(`/api/transactions/grouped?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch grouped transactions')

      const result = await response.json()
      setGroupedTransactions(result.data || [])

      // Update pagination for grouped view
      setPagination({
        page: 1,
        limit: result.count,
        total: result.count,
        totalPages: 1,
      })
    } catch (error) {
      console.error("Error fetching grouped transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals from current page or grouped data
  const totalDebit = isGroupedView
    ? groupedTransactions.reduce((sum, g) => sum + g.total_debit, 0)
    : transactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0)

  const totalCredit = isGroupedView
    ? groupedTransactions.reduce((sum, g) => sum + g.total_credit, 0)
    : transactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0)

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—"
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSourceBadge = (source: string) => {
    const config = {
      imported_bank: { label: 'Imported', color: 'bg-blue-100 text-blue-800' },
      user_manual: { label: 'Manual', color: 'bg-green-100 text-green-800' },
      system_opening: { label: 'Opening', color: 'bg-purple-100 text-purple-800' },
      auto_adjustment: { label: 'Adjustment', color: 'bg-orange-100 text-orange-800' },
    }
    return config[source as keyof typeof config] || { label: source, color: 'bg-gray-100 text-gray-800' }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const clearFilters = () => {
    setSelectedAccount("all")
    setSelectedSource("all")
    setSearchQuery("")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  // Show loading while entity context is loading
  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show empty state if no entity selected
  if (!currentEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Entity Selected</h2>
        <p className="text-muted-foreground mb-4">
          Please select an entity from the sidebar to view transactions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            {currentEntity ? `Managing transactions for ${currentEntity.name}` : 'View and manage all original transactions'}
          </p>
        </div>
        <Button onClick={() => {
          setSelectedTransaction(null)
          setIsFormDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-muted-foreground">
              Filtered results
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debit {isGroupedView ? '(All)' : '(Page)'}</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDebit)}</div>
            <p className="text-xs text-muted-foreground">
              {isGroupedView ? 'All filtered results' : 'Current page'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit {isGroupedView ? '(All)' : '(Page)'}</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredit)}</div>
            <p className="text-xs text-muted-foreground">
              {isGroupedView ? 'All filtered results' : 'Current page'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter transactions by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Account Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={(value) => {
                setSelectedAccount(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id.toString()}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Source</label>
              <Select value={selectedSource} onValueChange={(value) => {
                setSelectedSource(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="imported_bank">Imported</SelectItem>
                  <SelectItem value="user_manual">Manual</SelectItem>
                  <SelectItem value="system_opening">Opening</SelectItem>
                  <SelectItem value="auto_adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>
                {isGroupedView
                  ? `Showing ${groupedTransactions.length} source groups`
                  : `Showing ${transactions.length} of ${pagination.total} transactions`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <Button
                  variant={isGroupedView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsGroupedView(!isGroupedView)}
                  className="gap-2"
                >
                  {isGroupedView ? (
                    <>
                      <ListCollapse className="h-4 w-4" />
                      Grouped
                    </>
                  ) : (
                    <>
                      <List className="h-4 w-4" />
                      Normal
                    </>
                  )}
                </Button>
              </div>

              {/* Items per page - only show in normal view */}
              {!isGroupedView && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (isGroupedView ? groupedTransactions.length === 0 : transactions.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or add your first transaction
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isGroupedView && <TableHead>Date</TableHead>}
                      {!isGroupedView && <TableHead>Account</TableHead>}
                      {!isGroupedView && <TableHead>Description</TableHead>}
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      {!isGroupedView && <TableHead className="text-right">Balance</TableHead>}
                      <TableHead>Source</TableHead>
                      {isGroupedView && <TableHead className="text-right">Count</TableHead>}
                      {!isGroupedView && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isGroupedView ? (
                      // Grouped view - show one row per source
                      groupedTransactions.map((group, index) => {
                        const sourceBadge = getSourceBadge(group.transaction_source)
                        const sourceLabel = group.import_batch_id
                          ? `Import #${group.import_batch_id}`
                          : sourceBadge.label

                        return (
                          <TableRow key={`${group.transaction_source}_${group.import_batch_id || 'null'}_${index}`}>
                            <TableCell className="text-right">
                              <span className="font-medium text-red-600">
                                {formatCurrency(group.total_debit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium text-green-600">
                                {formatCurrency(group.total_credit)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={sourceBadge.color}>
                                {sourceLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {group.transaction_count.toLocaleString()} transaction{group.transaction_count !== 1 ? 's' : ''}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      // Normal view - show individual transactions
                      transactions.map((transaction) => {
                      const sourceBadge = getSourceBadge(transaction.transaction_source)
                      const account = transaction.account

                      return (
                        <TableRow key={transaction.raw_transaction_id}>
                          <TableCell className="text-sm">
                            {formatDate(transaction.transaction_date)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{account?.account_name || '—'}</p>
                              {account?.bank_name && (
                                <p className="text-xs text-muted-foreground">{account.bank_name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-sm truncate">{transaction.description || '—'}</p>
                              {transaction.bank_reference && (
                                <p className="text-xs text-muted-foreground">Ref: {transaction.bank_reference}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.debit_amount ? (
                              <span className="font-medium text-red-600">
                                {formatCurrency(transaction.debit_amount)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.credit_amount ? (
                              <span className="font-medium text-green-600">
                                {formatCurrency(transaction.credit_amount)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(transaction.balance)}
                          </TableCell>
                          <TableCell>
                            <Badge className={sourceBadge.color}>
                              {sourceBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {transaction.is_balance_adjustment ? (
                                // Balance adjustment: Show "View Checkpoint" button only
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaction(transaction)
                                    setIsCheckpointDialogOpen(true)
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Checkpoint
                                </Button>
                              ) : (
                                // Regular transaction: Show edit/delete buttons
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedTransaction(transaction)
                                      setIsFormDialogOpen(true)
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedTransaction(transaction)
                                      setIsDeleteDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls - only show in normal view */}
              {!isGroupedView && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum: number
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <TransactionFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        transaction={selectedTransaction}
        accounts={accounts}
        onSuccess={() => {
          if (isGroupedView) {
            fetchGroupedTransactions()
          } else {
            fetchTransactions()
          }
        }}
      />

      <TransactionDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        transaction={selectedTransaction}
        onSuccess={() => {
          if (isGroupedView) {
            fetchGroupedTransactions()
          } else {
            fetchTransactions()
          }
        }}
      />

      <ViewCheckpointDialog
        open={isCheckpointDialogOpen}
        onOpenChange={setIsCheckpointDialogOpen}
        checkpointId={selectedTransaction?.checkpoint_id || null}
        accountId={selectedTransaction?.account_id || null}
      />
    </div>
  )
}
