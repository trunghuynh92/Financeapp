"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, TrendingDown, Calendar, DollarSign, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from "@/lib/account-utils"
import { Currency } from "@/types/account"
import { useEntity } from "@/contexts/EntityContext"

interface CashFlowSummary {
  operating_activities: number
  investing_activities: number
  financing_activities: number
  net_change_in_cash: number
  uncategorized: number
}

interface CashFlowTransaction {
  transaction_id: number
  date: string
  description: string
  category_name: string
  amount: number
  cash_flow: number
  transaction_type: string
}

interface CashFlowDetails {
  operating: CashFlowTransaction[]
  investing: CashFlowTransaction[]
  financing: CashFlowTransaction[]
  uncategorized: CashFlowTransaction[]
}

interface PeriodData {
  period: string
  operating: number
  investing: number
  financing: number
  uncategorized: number
}

interface CashFlowData {
  summary: CashFlowSummary
  details: CashFlowDetails
  period_data: PeriodData[]
}

type DateRange = '1m' | '3m' | '6m' | 'ytd' | '1y' | 'all'
type Granularity = 'month' | 'quarter' | 'year'

export default function CashFlowReportPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('ytd')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [expandedSections, setExpandedSections] = useState({
    operating: false,
    investing: false,
    financing: false,
    uncategorized: false,
  })

  useEffect(() => {
    if (currentEntity) {
      fetchCashFlow()
    }
  }, [currentEntity?.id, dateRange, granularity])

  async function fetchCashFlow() {
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
        case 'ytd':
          startDate = new Date(endDate.getFullYear(), 0, 1) // January 1st
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

      const response = await fetch(`/api/reports/cash-flow?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch cash flow data')

      const result = await response.json()
      setCashFlowData(result.data)
    } catch (error) {
      console.error("Error fetching cash flow:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  if (loading || !cashFlowData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { summary, details, period_data } = cashFlowData

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Flow Statement</h1>
          <p className="text-muted-foreground">
            Track cash movements from operating, investing, and financing activities
          </p>
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
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Granularity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Activities</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.operating_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.operating_activities, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              Day-to-day business operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investing Activities</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.investing_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.investing_activities, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              Asset purchases and sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financing Activities</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.financing_activities >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.financing_activities, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              Loans and equity transactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Change in Cash</CardTitle>
            {summary.net_change_in_cash >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.net_change_in_cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.net_change_in_cash, "VND")}
            </div>
            <p className="text-xs text-muted-foreground">
              Total cash flow for period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Trend</CardTitle>
          <CardDescription>
            Cash flow breakdown by period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {period_data.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={period_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => formatCurrency(value, "VND", true)} />
                <Tooltip formatter={(value: any) => formatCurrency(value, "VND")} />
                <Legend />
                <ReferenceLine y={0} stroke="#000" />
                <Bar dataKey="operating" name="Operating" fill="#10b981" stackId="a" />
                <Bar dataKey="investing" name="Investing" fill="#f59e0b" stackId="a" />
                <Bar dataKey="financing" name="Financing" fill="#3b82f6" stackId="a" />
                <Bar dataKey="uncategorized" name="Uncategorized" fill="#94a3b8" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No period data available. Check console for details.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <div className="space-y-4">
        {/* Operating Activities */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('operating')}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Operating Activities</CardTitle>
                <CardDescription>
                  {details.operating.length} transactions • {formatCurrency(summary.operating_activities, "VND")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {expandedSections.operating ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardHeader>
          {expandedSections.operating && (
            <CardContent>
              <TransactionTable transactions={details.operating} />
            </CardContent>
          )}
        </Card>

        {/* Investing Activities */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('investing')}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Investing Activities</CardTitle>
                <CardDescription>
                  {details.investing.length} transactions • {formatCurrency(summary.investing_activities, "VND")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {expandedSections.investing ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardHeader>
          {expandedSections.investing && (
            <CardContent>
              <TransactionTable transactions={details.investing} />
            </CardContent>
          )}
        </Card>

        {/* Financing Activities */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('financing')}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Financing Activities</CardTitle>
                <CardDescription>
                  {details.financing.length} transactions • {formatCurrency(summary.financing_activities, "VND")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {expandedSections.financing ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardHeader>
          {expandedSections.financing && (
            <CardContent>
              <TransactionTable transactions={details.financing} />
            </CardContent>
          )}
        </Card>

        {/* Uncategorized (if any) */}
        {details.uncategorized.length > 0 && (
          <Card className="border-yellow-200">
            <CardHeader className="cursor-pointer" onClick={() => toggleSection('uncategorized')}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Uncategorized Transactions
                    <Badge variant="outline" className="bg-yellow-50">Needs Attention</Badge>
                  </CardTitle>
                  <CardDescription>
                    {details.uncategorized.length} transactions without cash flow classification
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  {expandedSections.uncategorized ? 'Hide' : 'Show'} Details
                </Button>
              </div>
            </CardHeader>
            {expandedSections.uncategorized && (
              <CardContent>
                <TransactionTable transactions={details.uncategorized} />
                <p className="text-sm text-muted-foreground mt-4">
                  💡 Tip: Set cash flow types for categories in Settings to categorize these transactions.
                </p>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function TransactionTable({ transactions }: { transactions: CashFlowTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions in this category
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Cash Flow</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.transaction_id}>
            <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
            <TableCell className="font-medium">{tx.description || '—'}</TableCell>
            <TableCell>
              <Badge variant="outline">{tx.category_name}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{tx.transaction_type}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(tx.amount, "VND" as Currency)}
            </TableCell>
            <TableCell className={`text-right font-semibold ${tx.cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {tx.cash_flow >= 0 ? '+' : ''}{formatCurrency(tx.cash_flow, "VND" as Currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
