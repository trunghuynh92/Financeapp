"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, Calendar, BarChart3 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from "@/lib/account-utils"

interface Account {
  account_id: number
  account_name: string
  currency: string
  entity: {
    id: string
    name: string
  }
}

interface AccountBalance {
  account_id: number
  account_name: string
  currency: string
  entity: {
    id: string
    name: string
  }
  current_balance: number
  balance_change: number
  balance_change_percent: number
}

interface BalanceHistoryPoint {
  date: string
  balance: number
}

interface AccountBalanceHistory {
  account_id: number
  account_name: string
  currency: string
  entity: {
    id: string
    name: string
  }
  history: BalanceHistoryPoint[]
}

type Granularity = 'day' | 'week' | 'month' | 'year'

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

export default function ReportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [balanceHistory, setBalanceHistory] = useState<AccountBalanceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [dateRange, setDateRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('1y')

  useEffect(() => {
    fetchAccounts()
    fetchAccountBalances()
  }, [])

  useEffect(() => {
    if (accounts.length > 0) {
      fetchBalanceHistory()
    }
  }, [accounts, granularity, dateRange])

  async function fetchAccounts() {
    try {
      const response = await fetch('/api/accounts?limit=1000')
      if (!response.ok) throw new Error('Failed to fetch accounts')
      const result = await response.json()
      setAccounts(result.data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
    }
  }

  async function fetchAccountBalances() {
    try {
      setLoading(true)
      const response = await fetch('/api/accounts?limit=1000')
      if (!response.ok) throw new Error('Failed to fetch accounts')

      const result = await response.json()
      const accountsData = result.data || []

      // Calculate current balance and changes
      const balances: AccountBalance[] = accountsData.map((account: any) => {
        const balanceData = Array.isArray(account.balance) ? account.balance[0] : account.balance
        const currentBalance = balanceData?.current_balance || 0
        const entity = Array.isArray(account.entity) ? account.entity[0] : account.entity

        // TODO: Calculate actual balance change from historical data
        // For now, just show current balance
        return {
          account_id: account.account_id,
          account_name: account.account_name,
          currency: account.currency,
          entity,
          current_balance: currentBalance,
          balance_change: 0, // Will be calculated from history
          balance_change_percent: 0,
        }
      })

      setAccountBalances(balances)
    } catch (error) {
      console.error("Error fetching account balances:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBalanceHistory() {
    try {
      setChartLoading(true)

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
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        granularity,
      })

      const response = await fetch(`/api/reports/balance-history?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch balance history')

      const result = await response.json()
      setBalanceHistory(result.data || [])
    } catch (error) {
      console.error("Error fetching balance history:", error)
    } finally {
      setChartLoading(false)
    }
  }

  // Prepare chart data
  const chartData = prepareChartData(balanceHistory)

  // Calculate total balance
  const totalBalance = accountBalances.reduce((sum, acc) => sum + acc.current_balance, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Balance reports and financial insights
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance, "VND")}</div>
            <p className="text-xs text-muted-foreground">
              Across {accountBalances.length} accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(
                accountBalances.filter(a => a.current_balance > 0).reduce((sum, a) => sum + a.current_balance, 0),
                "VND"
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Positive balances
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liabilities</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                Math.abs(accountBalances.filter(a => a.current_balance < 0).reduce((sum, a) => sum + a.current_balance, 0)),
                "VND"
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Negative balances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Balance Trend</CardTitle>
              <CardDescription>
                Balance over time by account
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
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
                  <SelectValue placeholder="Granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available for the selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatChartDate(value, granularity)}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value, "VND", true)}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value, "VND")}
                  labelFormatter={(label) => formatChartDate(label, granularity, true)}
                />
                <Legend />
                {balanceHistory.map((account, index) => (
                  <Line
                    key={account.account_id}
                    type="monotone"
                    dataKey={`account_${account.account_id}`}
                    name={account.account_name}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Account Balances Table */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
          <CardDescription>
            Current balance for each account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : accountBalances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No accounts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountBalances.map((account) => (
                  <TableRow key={account.account_id}>
                    <TableCell className="font-medium">{account.account_name}</TableCell>
                    <TableCell>{account.entity?.name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className={account.current_balance >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {formatCurrency(account.current_balance, account.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {account.current_balance >= 0 ? (
                        <Badge className="bg-green-100 text-green-800">Asset</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Liability</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Prepare chart data from balance history
 */
function prepareChartData(balanceHistory: AccountBalanceHistory[]) {
  if (balanceHistory.length === 0) return []

  // Get all unique dates from all accounts
  const allDates = new Set<string>()
  balanceHistory.forEach(account => {
    account.history.forEach(point => {
      allDates.add(point.date)
    })
  })

  // Sort dates
  const sortedDates = Array.from(allDates).sort()

  // Build chart data
  return sortedDates.map(date => {
    const dataPoint: any = { date }

    balanceHistory.forEach(account => {
      const point = account.history.find(h => h.date === date)
      dataPoint[`account_${account.account_id}`] = point?.balance || 0
    })

    return dataPoint
  })
}

/**
 * Format date for chart display
 */
function formatChartDate(dateString: string, granularity: Granularity, full: boolean = false): string {
  const date = new Date(dateString)

  if (full) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  switch (granularity) {
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'week':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    case 'year':
      return date.toLocaleDateString('en-US', { year: 'numeric' })
    default:
      return date.toLocaleDateString('en-US')
  }
}
