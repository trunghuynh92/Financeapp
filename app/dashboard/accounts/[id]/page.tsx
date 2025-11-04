"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Trash2, Loader2, Building2, Wallet, CreditCard, TrendingUp, LineChart, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AccountWithEntity, Account, AccountType } from "@/types/account"
import { ACCOUNT_TYPE_CONFIG } from "@/types/account"
import {
  formatCurrency,
  maskAccountNumber,
  getStatusColor,
  formatDate,
  formatDateTime,
  calculateAvailableCredit,
  calculateCreditUtilization,
  isCreditAccount,
} from "@/lib/account-utils"
import { AccountFormDialog } from "@/components/account-form-dialog"
import { AccountDeleteDialog } from "@/components/account-delete-dialog"
import { BalanceEditDialog } from "@/components/balance-edit-dialog"

const AccountTypeIcon = ({ type, className }: { type: AccountType; className?: string }) => {
  const icons = {
    bank: Building2,
    cash: Wallet,
    credit_card: CreditCard,
    investment: TrendingUp,
    credit_line: LineChart,
    term_loan: FileText,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [account, setAccount] = useState<AccountWithEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBalanceEditDialogOpen, setIsBalanceEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchAccount()
  }, [params.id])

  async function fetchAccount() {
    try {
      setLoading(true)
      const response = await fetch(`/api/accounts/${params.id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch account")
      }

      const data = await response.json()
      setAccount(data)
    } catch (error) {
      console.error("Error fetching account:", error)
      alert("Failed to load account. Redirecting to accounts list.")
      router.push("/dashboard/accounts")
    } finally {
      setLoading(false)
    }
  }

  function handleDeleteSuccess() {
    router.push("/dashboard/accounts")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!account) {
    return null
  }

  const config = ACCOUNT_TYPE_CONFIG[account.account_type]
  const status = getStatusColor(account.is_active)
  const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
  const balance = balanceData?.current_balance || 0
  const entity = Array.isArray(account.entity) ? account.entity[0] : account.entity

  const isCreditType = isCreditAccount(account.account_type)
  const availableCredit = isCreditType ? calculateAvailableCredit(account.credit_limit, balance) : 0
  const creditUtilization = isCreditType ? calculateCreditUtilization(account.credit_limit, balance) : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/accounts")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{account.account_name}</h1>
            <p className="text-muted-foreground">
              Account details and information
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFormDialogOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {/* Account Icon */}
            <div className={`flex items-center justify-center w-20 h-20 rounded-full ${config.bgColor}`}>
              <AccountTypeIcon type={account.account_type} className="h-10 w-10" />
            </div>

            {/* Account Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`${config.textColor}`}>
                  {config.label}
                </Badge>
                <Badge className={`${status.bg} ${status.text}`}>
                  {status.label}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Entity</p>
                  <p className="text-lg font-medium">{entity?.name || '—'}</p>
                </div>
                {account.bank_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bank</p>
                    <p className="text-lg font-medium">{account.bank_name}</p>
                  </div>
                )}
                {account.account_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="text-lg font-medium">{maskAccountNumber(account.account_number)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Currency</p>
                  <p className="text-lg font-medium">{account.currency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-lg font-medium">{formatDate(account.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-lg font-medium">{formatDate(account.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Balance</CardTitle>
              <CardDescription>
                {balanceData?.last_updated
                  ? `Last updated: ${formatDateTime(balanceData.last_updated)}`
                  : "No recent updates"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBalanceEditDialogOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Balance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold mb-6">
            {formatCurrency(balance, account.currency)}
          </div>

          {isCreditType && account.credit_limit && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Credit Utilization</span>
                  <span className="font-medium">{creditUtilization.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      creditUtilization > 80
                        ? "bg-red-500"
                        : creditUtilization > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Credit Limit</p>
                  <p className="text-xl font-medium">
                    {formatCurrency(account.credit_limit, account.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Credit</p>
                  <p className="text-xl font-medium">
                    {formatCurrency(availableCredit, account.currency)}
                  </p>
                </div>
              </div>

              {account.loan_reference && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Loan Reference</p>
                  <p className="text-lg font-medium">{account.loan_reference}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Preview (Placeholder for Week 3) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Transaction history will be available in Week 3</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Transaction management will be implemented in Week 3
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AccountFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        account={account as Account}
        onSuccess={fetchAccount}
      />

      <AccountDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        account={account as Account}
        onSuccess={handleDeleteSuccess}
      />

      <BalanceEditDialog
        open={isBalanceEditDialogOpen}
        onOpenChange={setIsBalanceEditDialogOpen}
        account={account as Account}
        currentBalance={balance}
        onSuccess={fetchAccount}
      />
    </div>
  )
}
