"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, Edit, Search, Filter, X, Split, Check, Link2 } from "lucide-react"
import { MainTransactionDetails, TransactionType, Category, Branch } from "@/types/main-transaction"
import { EditTransactionDialog } from "@/components/main-transactions/EditTransactionDialog"
import { SplitTransactionDialog } from "@/components/main-transactions/SplitTransactionDialog"
import { BulkEditDialog } from "@/components/main-transactions/BulkEditDialog"
import { QuickMatchTransferDialog } from "@/components/main-transactions/QuickMatchTransferDialog"
import { QuickMatchDebtDialog } from "@/components/main-transactions/QuickMatchDebtDialog"
import { SelectDrawdownDialog } from "@/components/main-transactions/SelectDrawdownDialog"
import { InlineCombobox } from "@/components/main-transactions/InlineCombobox"
import { useEntity } from "@/contexts/EntityContext"

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MainTransactionsPage() {
  const { currentEntity, loading: entityLoading } = useEntity()

  // Data state
  const [transactions, setTransactions] = useState<MainTransactionDetails[]>([])
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [selectedDirection, setSelectedDirection] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<MainTransactionDetails | null>(null)

  // Split dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [splitTransaction, setSplitTransaction] = useState<MainTransactionDetails | null>(null)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null)
  const [savingCell, setSavingCell] = useState<{row: number, field: string} | null>(null)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false)

  // Quick match dialog state
  const [quickMatchDialogOpen, setQuickMatchDialogOpen] = useState(false)
  const [quickMatchDebtDialogOpen, setQuickMatchDebtDialogOpen] = useState(false)
  const [selectDrawdownDialogOpen, setSelectDrawdownDialogOpen] = useState(false)

  // Fetch transaction types, categories, branches, accounts on mount
  useEffect(() => {
    if (!currentEntity) return

    const fetchMetadata = async () => {
      try {
        const params = new URLSearchParams()
        params.set('entity_id', currentEntity.id)
        params.set('limit', '1000')

        const [typesRes, categoriesRes, branchesRes, accountsRes] = await Promise.all([
          fetch("/api/transaction-types"),
          fetch("/api/categories"),
          fetch("/api/branches"),
          fetch(`/api/accounts?${params.toString()}`),
        ])

        if (typesRes.ok) {
          const typesData = await typesRes.json()
          setTransactionTypes(typesData.data || [])
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(categoriesData.data || [])
        }

        if (branchesRes.ok) {
          const branchesData = await branchesRes.json()
          setBranches(branchesData.data || [])
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json()
          setAccounts(accountsData.data || [])
        }
      } catch (error) {
        console.error("Error fetching metadata:", error)
      }
    }

    fetchMetadata()
  }, [currentEntity?.id])

  // Fetch transactions when filters or pagination change
  useEffect(() => {
    if (currentEntity) {
      fetchTransactions()
    }
  }, [currentEntity?.id, currentPage, itemsPerPage, selectedAccount, selectedType, selectedCategory, selectedBranch, selectedDirection, startDate, endDate, searchQuery])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", currentPage.toString())
      params.append("limit", itemsPerPage.toString())

      if (selectedAccount !== "all") params.append("account_id", selectedAccount)
      if (selectedType !== "all") params.append("transaction_type_id", selectedType)
      if (selectedCategory !== "all") params.append("category_id", selectedCategory)
      if (selectedBranch !== "all") params.append("branch_id", selectedBranch)
      if (selectedDirection !== "all") params.append("transaction_direction", selectedDirection)
      if (startDate) params.append("start_date", startDate)
      if (endDate) params.append("end_date", endDate)
      if (searchQuery) params.append("search", searchQuery)

      const response = await fetch(`/api/main-transactions?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()
      console.log('First transaction from API:', data.data?.[0])
      setTransactions(data.data || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSelectedAccount("all")
    setSelectedType("all")
    setSelectedCategory("all")
    setSelectedBranch("all")
    setSelectedDirection("all")
    setStartDate("")
    setEndDate("")
    setSearchQuery("")
    setCurrentPage(1)
  }

  const handleEditTransaction = (transaction: MainTransactionDetails) => {
    setSelectedTransaction(transaction)
    setEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    fetchTransactions() // Refresh the list
  }

  const handleSplitTransaction = (transaction: MainTransactionDetails) => {
    setSplitTransaction(transaction)
    setSplitDialogOpen(true)
  }

  const handleSplitSuccess = () => {
    fetchTransactions() // Refresh the list
  }

  const handleInlineUpdate = async (
    transactionId: number,
    field: string,
    value: string | number | null,
    rowIndex: number
  ) => {
    setSavingCell({ row: rowIndex, field })
    try {
      const updates: any = {}

      if (field === 'transaction_type_id') {
        updates.transaction_type_id = parseInt(value as string)
        // Reset category when type changes
        updates.category_id = null
      } else if (field === 'category_id') {
        updates.category_id = value === 'none' || !value ? null : parseInt(value as string)
      } else if (field === 'branch_id') {
        updates.branch_id = value === 'none' || !value ? null : parseInt(value as string)
      } else if (field === 'description') {
        updates.description = value || null
      } else if (field === 'notes') {
        updates.notes = value || null
      }

      const response = await fetch(`/api/main-transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      // Update local state with computed display values
      setTransactions(prev => prev.map((tx, idx) => {
        if (idx === rowIndex) {
          const updated = { ...tx, ...updates }

          // Update display fields for type
          if (field === 'transaction_type_id') {
            const type = transactionTypes.find(t => t.transaction_type_id === updates.transaction_type_id)
            if (type) {
              updated.transaction_type = type.type_display_name
              updated.transaction_type_code = type.type_code
              console.log('Updated transaction_type_code to:', type.type_code) // Debug log
            } else {
              console.warn('Transaction type not found for ID:', updates.transaction_type_id)
            }
            // Clear category when type changes
            updated.category_name = null
            updated.category_code = null
          }

          // Update display fields for category
          if (field === 'category_id' && updates.category_id) {
            const category = categories.find(c => c.category_id === updates.category_id)
            if (category) {
              updated.category_name = category.category_name
              updated.category_code = category.category_code
            }
          } else if (field === 'category_id' && !updates.category_id) {
            updated.category_name = null
            updated.category_code = null
          }

          // Update display fields for branch
          if (field === 'branch_id' && updates.branch_id) {
            const branch = branches.find(b => b.branch_id === updates.branch_id)
            if (branch) {
              updated.branch_name = branch.branch_name
              updated.branch_code = branch.branch_code
            }
          } else if (field === 'branch_id' && !updates.branch_id) {
            updated.branch_name = null
            updated.branch_code = null
          }

          return updated
        }
        return tx
      }))
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction')
    } finally {
      setSavingCell(null)
      setEditingCell(null)
    }
  }

  const formatAmount = (amount: number, direction: string) => {
    const formatted = new Intl.NumberFormat("vi-VN").format(amount)
    return direction === "debit" ? `-${formatted}` : `+${formatted}`
  }

  const getDirectionColor = (direction: string) => {
    return direction === "debit" ? "text-red-600" : "text-green-600"
  }

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(transactions.map(tx => tx.main_transaction_id))
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
    setLastSelectedIndex(null)
  }

  const handleSelectRow = (id: number, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedIds)

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift-select: select range
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)

      for (let i = start; i <= end; i++) {
        if (transactions[i]) {
          newSelected.add(transactions[i].main_transaction_id)
        }
      }
    } else {
      // Regular click: toggle selection
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
    }

    setSelectedIds(newSelected)
    setLastSelectedIndex(index)
  }

  const handleBulkEdit = () => {
    if (selectedIds.size > 0) {
      setBulkEditDialogOpen(true)
    }
  }

  const handleBulkEditSuccess = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
    fetchTransactions()
  }

  const handleQuickMatchSuccess = () => {
    fetchTransactions()
  }

  const handleUnmatchTransfer = async (transaction: MainTransactionDetails) => {
    if (!confirm("Are you sure you want to unmatch this transfer? Both transactions will become unmatched.")) {
      return
    }

    try {
      const response = await fetch(`/api/transfers/unmatch/${transaction.main_transaction_id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to unmatch transfer")
      }

      alert("Transfer unmatched successfully!")
      fetchTransactions()
    } catch (error: any) {
      console.error("Error unmatching transfer:", error)
      alert(error.message || "Failed to unmatch transfer. Please try again.")
    }
  }

  // Show loading while entity context is loading
  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Show empty state if no entity selected
  if (!currentEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="h-12 w-12 text-muted-foreground mb-4">
          <Filter className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Entity Selected</h2>
        <p className="text-muted-foreground mb-4">
          Please select an entity from the sidebar to view main transactions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Main Transactions</h1>
        <p className="text-muted-foreground">
          {currentEntity ? `Managing main transactions for ${currentEntity.name}` : 'Categorized and analyzed transactions'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
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

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Direction</label>
              <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="debit">Debit (Out)</SelectItem>
                  <SelectItem value="credit">Credit (In)</SelectItem>
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

            {/* Search */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search description or notes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Transactions ({pagination.total})
              </CardTitle>
              <CardDescription>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} transactions
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm">
                  {selectedIds.size} selected
                </Badge>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkEdit}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedIds(new Set())
                    setLastSelectedIndex(null)
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-3 px-4 w-12">
                        <Checkbox
                          checked={selectedIds.size === transactions.length && transactions.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Description</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-left py-3 px-4">Branch</th>
                      <th className="text-right py-3 px-4">Amount</th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, txIndex) => {
                      const filteredCategories = categories.filter(cat =>
                        cat.transaction_type_id === tx.transaction_type_id
                      )
                      const filteredBranches = branches.filter(branch =>
                        branch.entity_id === tx.entity_id
                      )

                      const isBalanceAdjustment = tx.is_balance_adjustment === true

                      return (
                        <tr
                          key={tx.main_transaction_id}
                          className={`border-b hover:bg-muted/50 ${isBalanceAdjustment ? 'opacity-50 bg-muted/30' : ''}`}
                        >
                          <td className="text-center py-3 px-4">
                            <Checkbox
                              checked={selectedIds.has(tx.main_transaction_id)}
                              onCheckedChange={(checked) => {
                                const event = window.event as MouseEvent
                                handleSelectRow(tx.main_transaction_id, txIndex, event as any)
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              disabled={isBalanceAdjustment}
                              aria-label={`Select transaction ${tx.main_transaction_id}`}
                            />
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {new Date(tx.transaction_date).toLocaleDateString()}
                          </td>

                          {/* Description - Inline editable */}
                          <td className="py-3 px-4">
                            <div>
                              <Input
                                value={tx.description || ""}
                                onChange={(e) => {
                                  const newValue = e.target.value
                                  setTransactions(prev => prev.map((t, i) =>
                                    i === txIndex ? { ...t, description: newValue } : t
                                  ))
                                }}
                                onBlur={() => handleInlineUpdate(
                                  tx.main_transaction_id,
                                  'description',
                                  tx.description,
                                  txIndex
                                )}
                                className="h-8 text-sm"
                                placeholder="Description..."
                                disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'description')}
                              />
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{tx.notes}</div>
                              )}
                              <div className="flex gap-1 mt-1">
                                {tx.is_split && (
                                  <Badge variant="outline">Split</Badge>
                                )}
                                {isBalanceAdjustment && (
                                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                                    Balance Adjustment
                                  </Badge>
                                )}
                                {/* Matched transfer */}
                                {tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'TRF_OUT' || tx.transaction_type_code === 'TRF_IN') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this transfer"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Transfer
                                  </Badge>
                                )}
                                {/* Unmatched transfer */}
                                {!tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'TRF_OUT' || tx.transaction_type_code === 'TRF_IN') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchDialogOpen(true)
                                    }}
                                    title="Click to match with another transfer"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched
                                  </Badge>
                                )}
                                {/* Matched debt transaction */}
                                {tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'DEBT_DRAW' || tx.transaction_type_code === 'DEBT_ACQ') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this debt transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched {tx.transaction_type_code === 'DEBT_DRAW' ? 'Drawdown' : 'Debt Acquired'}
                                  </Badge>
                                )}
                                {/* Unmatched debt transaction */}
                                {!tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'DEBT_DRAW' || tx.transaction_type_code === 'DEBT_ACQ') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchDebtDialogOpen(true)
                                    }}
                                    title="Click to match with corresponding debt transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched {tx.transaction_type_code === 'DEBT_DRAW' ? 'Drawdown' : 'Debt Acquired'}
                                  </Badge>
                                )}
                                {/* Matched debt payback */}
                                {tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'DEBT_PAY' || tx.transaction_type_code === 'DEBT_SETTLE') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this debt payback"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched {tx.transaction_type_code === 'DEBT_PAY' ? 'Payback' : 'Settlement'}
                                  </Badge>
                                )}
                                {/* Unmatched debt payback - needs drawdown selection */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'DEBT_PAY' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setSelectDrawdownDialogOpen(true)
                                    }}
                                    title="Click to select which drawdown this payment is for"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Drawdown
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Type - Inline editable */}
                          <td className="py-3 px-4">
                            <InlineCombobox
                              value={tx.transaction_type_id?.toString() || ""}
                              options={transactionTypes.map((type) => ({
                                value: type.transaction_type_id.toString(),
                                label: type.type_display_name,
                              }))}
                              onSelect={(value) => handleInlineUpdate(
                                tx.main_transaction_id,
                                'transaction_type_id',
                                value,
                                txIndex
                              )}
                              placeholder="Select type"
                              disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'transaction_type_id')}
                            />
                          </td>

                          {/* Category - Inline editable */}
                          <td className="py-3 px-4">
                            <InlineCombobox
                              value={tx.category_id?.toString() || "none"}
                              options={[
                                { value: "none", label: "None" },
                                ...filteredCategories.map((category) => ({
                                  value: category.category_id.toString(),
                                  label: category.category_name,
                                })),
                              ]}
                              onSelect={(value) => handleInlineUpdate(
                                tx.main_transaction_id,
                                'category_id',
                                value,
                                txIndex
                              )}
                              placeholder="Select category"
                              disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'category_id')}
                            />
                          </td>

                          {/* Branch - Inline editable */}
                          <td className="py-3 px-4">
                            <InlineCombobox
                              value={tx.branch_id?.toString() || "none"}
                              options={[
                                { value: "none", label: "None" },
                                ...filteredBranches.map((branch) => ({
                                  value: branch.branch_id.toString(),
                                  label: branch.branch_name,
                                })),
                              ]}
                              onSelect={(value) => handleInlineUpdate(
                                tx.main_transaction_id,
                                'branch_id',
                                value,
                                txIndex
                              )}
                              placeholder="Select branch"
                              disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'branch_id')}
                            />
                          </td>

                          <td className={`py-3 px-4 text-right font-mono font-medium ${getDirectionColor(tx.transaction_direction)}`}>
                            {formatAmount(tx.amount, tx.transaction_direction)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSplitTransaction(tx)}
                                disabled={isBalanceAdjustment}
                                title={
                                  isBalanceAdjustment
                                    ? "Balance adjustment transactions cannot be split. Edit the checkpoint instead."
                                    : tx.is_split
                                    ? "Edit split"
                                    : "Split transaction"
                                }
                              >
                                <Split className={`h-4 w-4 ${tx.is_split ? 'text-blue-600' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTransaction(tx)}
                                disabled={isBalanceAdjustment}
                                title={
                                  isBalanceAdjustment
                                    ? "Balance adjustment transactions cannot be edited. Edit the checkpoint instead."
                                    : "Edit notes and other details"
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
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

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
      />

      {/* Split Transaction Dialog */}
      <SplitTransactionDialog
        transaction={splitTransaction}
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        onSuccess={handleSplitSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
      />

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedIds={selectedIds}
        onSuccess={handleBulkEditSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
      />

      {/* Quick Match Transfer Dialog */}
      <QuickMatchTransferDialog
        open={quickMatchDialogOpen}
        onOpenChange={setQuickMatchDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Quick Match Debt Dialog */}
      <QuickMatchDebtDialog
        open={quickMatchDebtDialogOpen}
        onOpenChange={setQuickMatchDebtDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Select Drawdown Dialog for DEBT_PAYBACK */}
      {selectedTransaction && (
        <SelectDrawdownDialog
          open={selectDrawdownDialogOpen}
          onOpenChange={setSelectDrawdownDialogOpen}
          paybackTransactionId={selectedTransaction.main_transaction_id}
          paybackAmount={selectedTransaction.amount}
          onSuccess={handleQuickMatchSuccess}
        />
      )}
    </div>
  )
}
