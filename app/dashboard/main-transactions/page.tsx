"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Edit, Search, Filter, X } from "lucide-react"
import { MainTransactionDetails, TransactionType, Category, Branch } from "@/types/main-transaction"
import { EditTransactionDialog } from "@/components/main-transactions/EditTransactionDialog"
import { InlineCombobox } from "@/components/main-transactions/InlineCombobox"

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MainTransactionsPage() {
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

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null)
  const [savingCell, setSavingCell] = useState<{row: number, field: string} | null>(null)

  // Fetch transaction types, categories, branches, accounts on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [typesRes, categoriesRes, branchesRes, accountsRes] = await Promise.all([
          fetch("/api/transaction-types"),
          fetch("/api/categories"),
          fetch("/api/branches"),
          fetch("/api/accounts"),
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
  }, [])

  // Fetch transactions when filters or pagination change
  useEffect(() => {
    fetchTransactions()
  }, [currentPage, itemsPerPage, selectedAccount, selectedType, selectedCategory, selectedBranch, selectedDirection, startDate, endDate, searchQuery])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Main Transactions</h1>
        <p className="text-muted-foreground">
          Categorized and analyzed transactions
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
          <CardTitle>
            Transactions ({pagination.total})
          </CardTitle>
          <CardDescription>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} transactions
          </CardDescription>
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

                      return (
                        <tr key={tx.main_transaction_id} className="border-b hover:bg-muted/50">
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
                                disabled={savingCell?.row === txIndex && savingCell?.field === 'description'}
                              />
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{tx.notes}</div>
                              )}
                              {tx.is_split && (
                                <Badge variant="outline" className="mt-1">Split</Badge>
                              )}
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
                              disabled={savingCell?.row === txIndex && savingCell?.field === 'transaction_type_id'}
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
                              disabled={savingCell?.row === txIndex && savingCell?.field === 'category_id'}
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
                              disabled={savingCell?.row === txIndex && savingCell?.field === 'branch_id'}
                            />
                          </td>

                          <td className={`py-3 px-4 text-right font-mono font-medium ${getDirectionColor(tx.transaction_direction)}`}>
                            {formatAmount(tx.amount, tx.transaction_direction)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTransaction(tx)}
                              title="Edit notes and other details"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
    </div>
  )
}
