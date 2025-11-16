"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { formatCurrency } from "@/lib/account-utils"
import { useEntity } from "@/contexts/EntityContext"
import { Currency } from "@/types/account"

interface IncomeExpenseData {
  period: string
  income: number
  expense: number
  net: number
}

interface AccountBalance {
  account_id: number
  account_name: string
  account_type: string
  current_balance: number
  currency: string
}

type Granularity = 'year' | 'month' | 'week'
type DateRange = '1m' | '3m' | '6m' | '1y' | 'all'

export default function ReportsPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const [data, setData] = useState<IncomeExpenseData[]>([])
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [dateRange, setDateRange] = useState<DateRange>('1y')

  // Debt and Asset positions
  const [debtAccounts, setDebtAccounts] = useState<AccountBalance[]>([])
  const [assetAccounts, setAssetAccounts] = useState<AccountBalance[]>([])
  const [loadingPositions, setLoadingPositions] = useState(true)

  useEffect(() => {
    if (currentEntity) {
      fetchIncomeExpenseData()
      fetchDebtAssetPositions()
    }
  }, [currentEntity?.id, granularity, dateRange])

  async function fetchIncomeExpenseData() {
    if (!currentEntity) return

    try {
      setLoading(true)

      // Calculate date range
      const endDate = new Date()
      let startDate = new Date()

      switch (dateRange) {
        case '1m':
          startDate.setMonth(endDate.getMonth() - 1)
          break
        case '3m':
          startDate.setMonth(endDate.getMonth() - 3)
          break
        case '6m':
          startDate.setMonth(endDate.getMonth() - 6)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
        case 'all':
          startDate = new Date('2020-01-01')
          break
      }

      const params = new URLSearchParams({
        entity_id: currentEntity.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        granularity,
      })

      const response = await fetch(`/api/reports/income-expense?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch income/expense data')

      const result = await response.json()
      setData(result.data || [])
    } catch (error) {
      console.error("Error fetching income/expense data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchDebtAssetPositions() {
    if (!currentEntity) return

    try {
      setLoadingPositions(true)

      // Fetch liability accounts (debt position)
      const debtResponse = await fetch(`/api/accounts?entity_id=${currentEntity.id}&account_type=credit_card,credit_line,term_loan,debt_payable&limit=1000`)
      if (debtResponse.ok) {
        const debtResult = await debtResponse.json()
        const debtData = debtResult.data || []
        setDebtAccounts(debtData.map((acc: any) => ({
          account_id: acc.account_id,
          account_name: acc.account_name,
          account_type: acc.account_type,
          current_balance: Array.isArray(acc.balance) ? (acc.balance[0]?.current_balance || 0) : (acc.balance?.current_balance || 0),
          currency: acc.currency
        })))
      }

      // Fetch asset accounts (asset position)
      const assetResponse = await fetch(`/api/accounts?entity_id=${currentEntity.id}&account_type=loan_receivable,investment&limit=1000`)
      if (assetResponse.ok) {
        const assetResult = await assetResponse.json()
        const assetData = assetResult.data || []
        setAssetAccounts(assetData.map((acc: any) => ({
          account_id: acc.account_id,
          account_name: acc.account_name,
          account_type: acc.account_type,
          current_balance: Array.isArray(acc.balance) ? (acc.balance[0]?.current_balance || 0) : (acc.balance?.current_balance || 0),
          currency: acc.currency
        })))
      }
    } catch (error) {
      console.error("Error fetching debt/asset positions:", error)
    } finally {
      setLoadingPositions(false)
    }
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expense: acc.expense + item.expense,
      net: acc.net + item.net,
    }),
    { income: 0, expense: 0, net: 0 }
  )

  // Calculate debt and asset totals
  const totalDebt = debtAccounts.reduce((sum, acc) => sum + Math.abs(acc.current_balance), 0)
  const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.current_balance, 0)

  // Format chart data for display
  const chartData = data.map(item => ({
    ...item,
    expense: -item.expense, // Make expense negative for visual representation
  }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground">
          Business operations income and expense analysis (excludes investment, loan, and credit line accounts)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.income, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              For selected period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.expense, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              For selected period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <DollarSign className={`h-4 w-4 ${totals.net >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totals.net, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              Income minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income/Expense Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>
                Income (bars up), Expenses (bars down), Net balance (line)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">Last Month</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
              No data available for the selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tickFormatter={(value) => formatPeriod(value, granularity)}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(Math.abs(value), "VND", true)}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    const absValue = Math.abs(value)
                    if (name === 'income') return [formatCurrency(absValue, "VND"), 'Income']
                    if (name === 'expense') return [formatCurrency(absValue, "VND"), 'Expenses']
                    if (name === 'net') return [formatCurrency(value, "VND"), 'Net Balance']
                    return [formatCurrency(value, "VND"), name]
                  }}
                  labelFormatter={(label) => formatPeriod(label, granularity, true)}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'income') return 'Income'
                    if (value === 'expense') return 'Expenses'
                    if (value === 'net') return 'Net Balance'
                    return value
                  }}
                />

                {/* Income bar (going up) */}
                <Bar
                  dataKey="income"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="income"
                />

                {/* Expense bar (going down) */}
                <Bar
                  dataKey="expense"
                  fill="#ef4444"
                  radius={[0, 0, 4, 4]}
                  name="expense"
                />

                {/* Net balance line */}
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="net"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Debt and Asset Positions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Debt Position */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-500" />
              Debt Position
            </CardTitle>
            <CardDescription>
              Current liabilities and outstanding debts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPositions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : debtAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No debt accounts
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm font-medium">Total Debt</span>
                  <span className="text-2xl font-bold text-red-600">
                    {formatCurrency(totalDebt, "VND")}
                  </span>
                </div>
                <div className="space-y-2">
                  {debtAccounts.map((account) => (
                    <div
                      key={account.account_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{account.account_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {account.account_type.replace('_', ' ')}
                        </p>
                      </div>
                      <span className="font-medium text-red-600">
                        {formatCurrency(Math.abs(account.current_balance), account.currency as Currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Position */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-500" />
              Asset Position
            </CardTitle>
            <CardDescription>
              Loans given and investments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPositions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : assetAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No asset accounts
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm font-medium">Total Assets</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalAssets, "VND")}
                  </span>
                </div>
                <div className="space-y-2">
                  {assetAccounts.map((account) => (
                    <div
                      key={account.account_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{account.account_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {account.account_type.replace('_', ' ')}
                        </p>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(account.current_balance, account.currency as Currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Format period for display
 */
function formatPeriod(period: string, granularity: Granularity, full: boolean = false): string {
  if (granularity === 'year') {
    return period
  }

  if (granularity === 'week') {
    const date = new Date(period)
    if (full) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // month format: YYYY-MM
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)

  if (full) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    })
  }

  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
