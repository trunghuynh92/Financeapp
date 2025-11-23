"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Calendar,
  Wallet,
  CreditCard,
  FileText,
  Target,
  ArrowRight,
  LayoutGrid,
  BarChart3
} from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts"

interface MonthlyProjection {
  month: string
  month_label: string
  opening_balance: number
  projected_income: number
  debt_payments: any[]
  scheduled_payments: any[]
  predicted_expenses: any[] // NEW in v2.0
  budgets: any[]
  total_debt: number
  total_scheduled: number
  total_predicted: number // NEW in v2.0
  total_budgets: number
  total_obligations: number
  closing_balance: number
  health: 'surplus' | 'tight' | 'deficit'
  income_breakdown: any[] // NEW in v2.0
  budget_warnings: any[] // NEW in v2.0
}

interface CashFlowData {
  current_balance: number
  months_ahead: number
  total_obligations: number
  total_projected_income: number // NEW in v2.0
  net_projected_change: number // NEW in v2.0
  lowest_projected_balance: number
  months_until_negative: number | null
  projections: MonthlyProjection[]
  version: string // NEW in v2.0
}

export default function CashFlowPage() {
  const { currentEntity } = useEntity()
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthsAhead, setMonthsAhead] = useState('6')
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('chart')

  useEffect(() => {
    if (currentEntity) {
      fetchCashFlow()
    }
  }, [currentEntity?.id, monthsAhead])

  const fetchCashFlow = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/cash-flow-projection?entity_id=${currentEntity.id}&months_ahead=${monthsAhead}`
      )

      if (response.ok) {
        const result = await response.json()
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching cash flow:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!currentEntity) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Flow Projection</h1>
          <p className="text-muted-foreground">
            Unified view of debt payments, scheduled payments, and budgets
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'chart' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Cards
            </Button>
          </div>

          <Select value={monthsAhead} onValueChange={setMonthsAhead}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Months</SelectItem>
              <SelectItem value="6">6 Months</SelectItem>
              <SelectItem value="12">12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground mt-2">Loading cash flow projection...</p>
        </div>
      ) : data ? (
        <>
          {/* Cash Flow 2.0 Badge */}
          {data.version === '2.0' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Cash Flow System 2.0</Badge>
              <span>With intelligent income & expense predictions</span>
            </div>
          )}

          {/* NEW in v3.0: Liquidity Position Alert */}
          {data.liquidity && data.runway && data.runway.will_run_out_of_cash && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Liquidity Buffer Available</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Cash will run low in <strong>{data.runway.cash_runway_months.toFixed(1)} months</strong>,
                    but you have <strong>{formatCurrency(data.liquidity.total_investments + data.liquidity.receivables_balance, 'VND')}</strong> in
                    investments and receivables that extend your runway to <strong>{data.runway.liquidity_runway_months.toFixed(1)} months</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.current_balance, 'VND')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Available now</p>
              </CardContent>
            </Card>

            {/* NEW in v3.0: Total Liquidity */}
            {data.liquidity && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    Total Liquidity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(data.liquidity.total_liquid_assets, 'VND')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cash + Investments + Receivables
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    {data.liquidity.investment_balance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Investments:</span>
                        <span className="font-medium">{formatCurrency(data.liquidity.investment_balance, 'VND')}</span>
                      </div>
                    )}
                    {data.liquidity.receivables_balance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Receivables:</span>
                        <span className="font-medium">{formatCurrency(data.liquidity.receivables_balance, 'VND')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* NEW in v2.0: Projected Income */}
            {data.total_projected_income !== undefined && (
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Projected Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.total_projected_income, 'VND')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Next {monthsAhead} months</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Total Obligations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.total_obligations, 'VND')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Next {monthsAhead} months</p>
              </CardContent>
            </Card>

            {/* NEW in v2.0: Net Change */}
            {data.net_projected_change !== undefined && (
              <Card className={data.net_projected_change >= 0 ? 'border-green-200' : 'border-red-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Net Change
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.net_projected_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.net_projected_change >= 0 ? '+' : ''}{formatCurrency(data.net_projected_change, 'VND')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Income - Expenses</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Runway Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.runway ? (
                  <>
                    <div className="space-y-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Cash Runway</div>
                        <div className="text-xl font-bold">
                          {data.runway.cash_runway_months === Infinity
                            ? `${monthsAhead}+`
                            : `${data.runway.cash_runway_months.toFixed(1)}mo`}
                        </div>
                      </div>
                      {data.runway.liquidity_runway_months !== data.runway.cash_runway_months && (
                        <div className="pt-2 border-t">
                          <div className="text-sm text-muted-foreground">With Liquidation</div>
                          <div className="text-xl font-bold text-blue-600">
                            {data.runway.liquidity_runway_months === Infinity
                              ? `${monthsAhead}+`
                              : `${data.runway.liquidity_runway_months.toFixed(1)}mo`}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {data.months_until_negative === null ? `${monthsAhead}+` : data.months_until_negative}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.months_until_negative === null ? 'Positive throughout' : 'Months until negative'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chart View */}
          {viewMode === 'chart' && (
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Projection Chart</CardTitle>
                <CardDescription>
                  {data.version === '2.0'
                    ? 'Predicted income vs expenses with projected balance'
                    : 'Stacked expenses and projected balance over time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart
                    data={data.projections.map(p => ({
                      month: p.month_label.split(' ')[0], // Short month name
                      income: p.projected_income || 0, // NEW in v2.0
                      debt: -p.total_debt,
                      scheduled: -p.total_scheduled,
                      predicted: -(p.total_predicted || 0), // NEW in v2.0
                      budgets: -p.total_budgets,
                      balance: p.closing_balance,
                      opening: p.opening_balance
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                      formatter={(value: any) => formatCurrency(Math.abs(value), 'VND')}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#374151"
                      strokeWidth={2}
                      label={{ value: 'Zero', position: 'right', fill: '#374151' }}
                    />

                    {/* Cash Flow 2.0: Income bar (going up) */}
                    {data.version === '2.0' && (
                      <Bar
                        dataKey="income"
                        fill="#10b981"
                        name="Projected Income"
                        radius={[4, 4, 0, 0]}
                      />
                    )}

                    {/* Stacked bars for expenses (going down) */}
                    <Bar
                      dataKey="debt"
                      stackId="expenses"
                      fill="#ef4444"
                      name="Debt Payments"
                      radius={[0, 0, 4, 4]}
                    />
                    <Bar
                      dataKey="scheduled"
                      stackId="expenses"
                      fill="#3b82f6"
                      name="Scheduled Payments"
                      radius={[0, 0, 0, 0]}
                    />
                    {/* Cash Flow 2.0: Predicted Expenses */}
                    {data.version === '2.0' && (
                      <Bar
                        dataKey="predicted"
                        stackId="expenses"
                        fill="#f97316"
                        name="Predicted Expenses"
                        radius={[0, 0, 0, 0]}
                      />
                    )}
                    <Bar
                      dataKey="budgets"
                      stackId="expenses"
                      fill="#a855f7"
                      name="Budgets (unused)"
                      radius={[0, 0, 0, 0]}
                    />

                    {/* Line for projected balance */}
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      name="Projected Balance"
                      dot={{ fill: '#0ea5e9', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="space-y-4">
              {data.projections.map((projection, index) => (
              <Card key={projection.month} className={
                projection.health === 'deficit' ? 'border-red-300' :
                projection.health === 'tight' ? 'border-yellow-300' :
                'border-green-300'
              }>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{projection.month_label}</CardTitle>
                    <Badge variant={
                      projection.health === 'deficit' ? 'destructive' :
                      projection.health === 'tight' ? 'default' :
                      'secondary'
                    }>
                      {projection.health}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Opening Balance */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Opening Balance</span>
                    <span className="font-semibold">{formatCurrency(projection.opening_balance, 'VND')}</span>
                  </div>

                  {/* Cash Flow 2.0: Projected Income */}
                  {projection.projected_income > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-green-500 bg-green-50/30 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Projected Income</span>
                        <span className="font-semibold text-green-600">
                          +{formatCurrency(projection.projected_income, 'VND')}
                        </span>
                      </div>
                      {projection.income_breakdown && projection.income_breakdown.length > 0 && (
                        projection.income_breakdown.map((income: any, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-center justify-between">
                            <span className="flex-1">{income.category_name}</span>
                            <Badge variant="outline" className="text-xs">{income.confidence}</Badge>
                            <span className="font-medium">{formatCurrency(income.amount, 'VND')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Priority 1: Debt Payments */}
                  {projection.debt_payments.length > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-red-500">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Priority 1: Debt Payments</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(projection.total_debt, 'VND')}
                        </span>
                      </div>
                      {projection.debt_payments.map((payment: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                          <span className="flex-1">{payment.loan_name} ({payment.type})</span>
                          <span className="text-blue-600">{format(new Date(payment.due_date), 'MMM d')}</span>
                          <span className="font-medium">{formatCurrency(payment.amount, 'VND')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Priority 1: Scheduled Payments */}
                  {projection.scheduled_payments.length > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-blue-500">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Priority 1: Scheduled Payments</span>
                        <span className="font-semibold text-blue-600">
                          -{formatCurrency(projection.total_scheduled, 'VND')}
                        </span>
                      </div>
                      {projection.scheduled_payments.map((payment: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                          <span className="flex-1">{payment.payment_type || payment.contract_name}</span>
                          <span className="text-blue-600">{format(new Date(payment.due_date), 'MMM d')}</span>
                          <span className="font-medium">{formatCurrency(payment.amount, 'VND')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cash Flow 2.0: Priority 2: Predicted Expenses */}
                  {projection.predicted_expenses && projection.predicted_expenses.length > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-orange-500">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Priority 2: Predicted Expenses</span>
                        <span className="font-semibold text-orange-600">
                          -{formatCurrency(projection.total_predicted || 0, 'VND')}
                        </span>
                      </div>
                      {projection.predicted_expenses.map((expense: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                          <span className="flex-1">{expense.category_name}</span>
                          <Badge variant="outline" className="text-xs">{expense.confidence}</Badge>
                          <span className="font-medium">{formatCurrency(expense.amount, 'VND')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Priority 3: Budgets (only unused categories in v2.0) */}
                  {projection.budgets.length > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-purple-500">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Priority 3: Budgets</span>
                        <span className="font-semibold text-purple-600">
                          -{formatCurrency(projection.total_budgets, 'VND')}
                        </span>
                      </div>
                      {projection.budgets.map((budget: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>{budget.category_name}</span>
                          <span>{formatCurrency(budget.estimated_spend, 'VND')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Closing Balance */}
                  <div className="flex items-center justify-between text-sm pt-4 border-t">
                    <span className="font-semibold">Closing Balance</span>
                    <span className={`font-bold text-lg ${
                      projection.closing_balance < 0 ? 'text-red-600' :
                      'text-green-600'
                    }`}>
                      {formatCurrency(projection.closing_balance, 'VND')}
                    </span>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No cash flow data available</p>
        </div>
      )}
    </div>
  )
}
