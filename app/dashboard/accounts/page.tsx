"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2, Loader2, Search, Filter, Building2, Wallet, CreditCard, TrendingUp, LineChart, FileText } from "lucide-react"
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
import { supabase, type Entity } from "@/lib/supabase"
import type { AccountWithEntity, AccountType, Account } from "@/types/account"
import { ACCOUNT_TYPE_CONFIG } from "@/types/account"
import {
  formatCurrency,
  maskAccountNumber,
  getStatusColor,
  formatDate,
} from "@/lib/account-utils"
import { AccountFormDialog } from "@/components/account-form-dialog"
import { AccountDeleteDialog } from "@/components/account-delete-dialog"

// Icon mapping
const AccountTypeIcon = ({ type }: { type: AccountType }) => {
  const icons = {
    bank: Building2,
    cash: Wallet,
    credit_card: CreditCard,
    investment: TrendingUp,
    credit_line: LineChart,
    term_loan: FileText,
  }
  const Icon = icons[type]
  return <Icon className="h-4 w-4" />
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithEntity[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<string>("all")
  const [selectedTypes, setSelectedTypes] = useState<AccountType[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  useEffect(() => {
    fetchEntities()
    fetchAccounts()
  }, [])

  async function fetchEntities() {
    try {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .order("name")

      if (error) throw error
      setEntities(data || [])
    } catch (error) {
      console.error("Error fetching entities:", error)
    }
  }

  async function fetchAccounts() {
    try {
      setLoading(true)

      // Build query parameters for API
      const params = new URLSearchParams()

      if (selectedEntity !== "all") {
        params.set("entity_id", selectedEntity)
      }

      if (selectedTypes.length > 0) {
        params.set("account_type", selectedTypes.join(","))
      }

      if (statusFilter !== "all") {
        params.set("is_active", statusFilter === "active" ? "true" : "false")
      }

      if (searchQuery) {
        params.set("search", searchQuery)
      }

      // Use high limit to get all accounts (no pagination for UI)
      params.set("limit", "1000")

      // Fetch accounts with calculated balances from API
      const response = await fetch(`/api/accounts?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const result = await response.json()
      setAccounts(result.data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  // Refetch when filters change
  useEffect(() => {
    fetchAccounts()
  }, [selectedEntity, selectedTypes, statusFilter, searchQuery])

  // Calculate total balance
  const totalBalance = accounts.reduce((sum, account) => {
    const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
    const balance = balanceData?.current_balance || 0
    return sum + balance
  }, 0)

  const activeAccounts = accounts.filter(a => a.is_active).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage all your financial accounts
          </p>
        </div>
        <Button onClick={() => {
          setSelectedAccount(null)
          setIsFormDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance, "VND")}</div>
            <p className="text-xs text-muted-foreground">
              Across all accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAccounts}</div>
            <p className="text-xs text-muted-foreground">
              {accounts.length} total accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entities</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entities.length}</div>
            <p className="text-xs text-muted-foreground">
              Linked entities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter accounts by entity, type, and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Entity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity</label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedEntity("all")
                  setSelectedTypes([])
                  setStatusFilter("all")
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

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
          <CardDescription>
            A list of all your financial accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No accounts found</p>
              <p className="text-sm text-muted-foreground">
                Get started by adding your first account
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Type</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const config = ACCOUNT_TYPE_CONFIG[account.account_type]
                  const status = getStatusColor(account.is_active)
                  const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
                  const balance = balanceData?.current_balance || 0
                  const entity = Array.isArray(account.entity) ? account.entity[0] : account.entity

                  return (
                    <TableRow key={account.account_id}>
                      <TableCell>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor}`}>
                          <AccountTypeIcon type={account.account_type} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/accounts/${account.account_id}`}>
                          <div className="cursor-pointer hover:underline">
                            <p className="font-medium">{account.account_name}</p>
                            <Badge variant="outline" className={`${config.textColor} text-xs mt-1`}>
                              {config.label}
                            </Badge>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{entity?.name || '—'}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.bank_name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {maskAccountNumber(account.account_number)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(balance, account.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.bg} ${status.text}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAccount(account as Account)
                              setIsFormDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAccount(account as Account)
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
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AccountFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        account={selectedAccount}
        onSuccess={fetchAccounts}
      />

      <AccountDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        account={selectedAccount}
        onSuccess={fetchAccounts}
      />
    </div>
  )
}
