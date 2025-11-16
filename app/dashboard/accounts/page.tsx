"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2, Loader2, Search, Filter, Building2, Wallet, CreditCard, TrendingUp, LineChart, FileText, AlertTriangle, DollarSign } from "lucide-react"
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
import { useEntity } from "@/contexts/EntityContext"
import { cn } from "@/lib/utils"

// Icon mapping
const AccountTypeIcon = ({ type }: { type: AccountType }) => {
  const icons = {
    bank: Building2,
    cash: Wallet,
    credit_card: CreditCard,
    investment: TrendingUp,
    credit_line: LineChart,
    term_loan: FileText,
    loan_receivable: DollarSign,
  }
  const Icon = icons[type]
  return <Icon className="h-4 w-4" />
}

export default function AccountsPage() {
  const { currentEntity, entities: userEntities, loading: entityLoading } = useEntity()
  const [accounts, setAccounts] = useState<AccountWithEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<string>("current")
  const [selectedTypes, setSelectedTypes] = useState<AccountType[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  // Reset selectedEntity filter when currentEntity changes (from sidebar switcher)
  useEffect(() => {
    if (currentEntity) {
      setSelectedEntity("current")
    }
  }, [currentEntity?.id])

  // Fetch accounts when currentEntity loads or filters change
  useEffect(() => {
    if (currentEntity) {
      fetchAccounts()
    }
  }, [currentEntity?.id, selectedEntity, selectedTypes, statusFilter, searchQuery])

  async function fetchAccounts() {
    try {
      setLoading(true)
      if (!currentEntity) return

      // Build query parameters for API
      const params = new URLSearchParams()

      // Filter by selected entity (current or specific one from user's entities)
      if (selectedEntity === "current" || selectedEntity === "all") {
        params.set("entity_id", currentEntity.id)
      } else {
        // Ensure user has access to this entity
        const hasAccess = userEntities.some(e => e.id === selectedEntity)
        if (hasAccess) {
          params.set("entity_id", selectedEntity)
        } else {
          // Fallback to current entity if trying to access unauthorized entity
          params.set("entity_id", currentEntity.id)
        }
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


  // Calculate total balance
  const totalBalance = accounts.reduce((sum, account) => {
    const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
    const balance = balanceData?.current_balance || 0
    return sum + balance
  }, 0)

  const activeAccounts = accounts.filter(a => a.is_active).length

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
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Entity Selected</h2>
        <p className="text-muted-foreground mb-4">
          Please select an entity from the sidebar to view accounts
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            {currentEntity ? `Managing accounts for ${currentEntity.name}` : 'Manage all your financial accounts'}
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

      {/* Entity Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          <button
            onClick={() => setSelectedEntity("current")}
            className={cn(
              "border-b-2 py-3 px-1 text-sm font-medium transition-colors",
              selectedEntity === "current"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            {currentEntity.name}
          </button>
          {userEntities.length > 1 && userEntities
            .filter(e => e.id !== currentEntity.id)
            .map((entity) => (
              <button
                key={entity.id}
                onClick={() => setSelectedEntity(entity.id)}
                className={cn(
                  "border-b-2 py-3 px-1 text-sm font-medium transition-colors",
                  selectedEntity === entity.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                {entity.name}
              </button>
            ))}
        </div>
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
            <CardTitle className="text-sm font-medium">My Entities</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userEntities.length}</div>
            <p className="text-xs text-muted-foreground">
              Total access
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grouped by Category */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No accounts found</p>
              <p className="text-sm text-muted-foreground">
                Get started by adding your first account
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Banks & Cash */}
          {(() => {
            const bankCashAccounts = accounts.filter(a => a.account_type === 'bank' || a.account_type === 'cash')
            if (bankCashAccounts.length === 0) return null

            return (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Banks & Cash
                  </CardTitle>
                  <CardDescription>
                    Your primary operating accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                      {bankCashAccounts.map((account) => {
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
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-medium">
                                  {formatCurrency(balance, account.currency)}
                                </span>
                                {(account as any).unresolved_checkpoints_count > 0 && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {(account as any).unresolved_checkpoints_count} unresolved
                                  </Badge>
                                )}
                              </div>
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
                </CardContent>
              </Card>
            )
          })()}

          {/* Assets */}
          {(() => {
            const assetAccounts = accounts.filter(a => a.account_type === 'loan_receivable' || a.account_type === 'investment')
            if (assetAccounts.length === 0) return null

            return (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Assets
                  </CardTitle>
                  <CardDescription>
                    Loans given and investments
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                      {assetAccounts.map((account) => {
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
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-medium">
                                  {formatCurrency(balance, account.currency)}
                                </span>
                                {(account as any).unresolved_checkpoints_count > 0 && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {(account as any).unresolved_checkpoints_count} unresolved
                                  </Badge>
                                )}
                              </div>
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
                </CardContent>
              </Card>
            )
          })()}

          {/* Liabilities */}
          {(() => {
            const liabilityAccounts = accounts.filter(a =>
              a.account_type === 'credit_card' ||
              a.account_type === 'credit_line' ||
              a.account_type === 'term_loan'
            )
            if (liabilityAccounts.length === 0) return null

            return (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Liabilities
                  </CardTitle>
                  <CardDescription>
                    Credit cards, loans, and debts owed
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                      {liabilityAccounts.map((account) => {
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
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-medium">
                                  {formatCurrency(balance, account.currency)}
                                </span>
                                {(account as any).unresolved_checkpoints_count > 0 && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {(account as any).unresolved_checkpoints_count} unresolved
                                  </Badge>
                                )}
                              </div>
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
                </CardContent>
              </Card>
            )
          })()}
        </div>
      )}

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
