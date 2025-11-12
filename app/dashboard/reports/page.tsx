"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
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

interface IncomeExpenseData {
  period: string
  income: number
  expense: number
  net: number
}

type Granularity = 'year' | 'month' | 'week'
type DateRange = '1m' | '3m' | '6m' | '1y' | 'all'

export default function ReportsPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const [data, setData] = useState<IncomeExpenseData[]>([])
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [dateRange, setDateRange] = useState<DateRange>('1y')

  useEffect(() => {
    if (currentEntity) {
      fetchIncomeExpenseData()
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

  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expense: acc.expense + item.expense,
      net: acc.net + item.net,
    }),
    { income: 0, expense: 0, net: 0 }
  )

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
