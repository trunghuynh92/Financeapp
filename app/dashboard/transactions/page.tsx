"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, Search, DollarSign, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
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
  account?: Account
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    fetchAccounts()
    fetchTransactions()
  }, [])

  async function fetchAccounts() {
    try {
      const response = await fetch('/api/accounts')
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

      const params = new URLSearchParams()
      if (selectedAccount !== "all") {
        params.append('account_id', selectedAccount)
      }
      if (selectedSource !== "all") {
        params.append('transaction_source', selectedSource)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/transactions?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch transactions')

      const result = await response.json()
      setTransactions(result.data || [])
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  // Refetch when filters change
  useEffect(() => {
    fetchTransactions()
  }, [selectedAccount, selectedSource, searchQuery])

  // Calculate totals
  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0)
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0)

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all original transactions
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
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDebit)}</div>
            <p className="text-xs text-muted-foreground">
              Money out
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredit)}</div>
            <p className="text-xs text-muted-foreground">
              Money in
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter transactions by account and source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Account Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
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
              <Select value={selectedSource} onValueChange={setSelectedSource}>
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

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAccount("all")
                  setSelectedSource("all")
                  setSearchQuery("")
                }}
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
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            A list of all original transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground">
                Get started by adding your first transaction
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
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
      <TransactionFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        transaction={selectedTransaction}
        accounts={accounts}
        onSuccess={fetchTransactions}
      />

      <TransactionDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        transaction={selectedTransaction}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}
