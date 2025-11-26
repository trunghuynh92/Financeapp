"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  Landmark,
  PiggyBank,
  Layers
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useEntity } from "@/contexts/EntityContext"
import { useUserPermissions } from "@/hooks/use-user-role"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList
} from "recharts"
import { ScenarioManager } from "@/components/scenario-manager"

interface MonthlyProjection {
  month: string
  month_label: string
  opening_balance: number
  projected_income: number
  base_income?: number // NEW in v3.1: Base income before scenario adjustments
  scenario_debt_drawdown?: number // NEW in v3.1: Debt drawdown from scenarios
  scenario_debt_repayment?: number // NEW: Debt repayment from scenarios (expense)
  scenario_income?: number // NEW in v3.1: Additional income from scenarios
  scenario_expense?: number // NEW in v3.1: Additional expense from scenarios
  scenario_items?: { name: string; amount: number; type: string }[] // NEW in v3.1
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

interface CreditLineAccount {
  account_id: number
  account_name: string
  bank_name: string | null
  credit_limit: number
  used_amount: number
  available_credit: number
  utilization_percent: number
}

interface CreditAvailabilityProjection {
  month: string
  month_label: string
  available_credit: number
  repayment_this_month: number
  scenario_drawdown_this_month?: number
  scenario_repayment_this_month?: number
  cumulative_repayments: number
  cumulative_scenario_drawdowns?: number
  cumulative_scenario_repayments?: number
}

interface CreditLinesData {
  accounts: CreditLineAccount[]
  total_limit: number
  total_used: number
  total_available: number
  overall_utilization: number
  availability_projection: CreditAvailabilityProjection[]
  scenario_debt_drawdown?: number
  scenario_adjusted_available?: number
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
  liquidity?: { // NEW in v3.0
    current_ratio: number
    quick_ratio: number
    cash_ratio: number
    working_capital: number
    total_liquid_assets: number
    total_investments: number
    investment_balance: number
    receivables_balance: number
  }
  runway?: { // NEW in v3.0
    will_run_out_of_cash: boolean
    months_of_runway: number | null
    runout_date: string | null
    cash_runway_months: number
    liquidity_runway_months: number
  }
  credit_lines?: CreditLinesData // NEW in v3.1
}

export default function CashFlowPage() {
  const { currentEntity } = useEntity()
  const { permissions, isLoading: permissionsLoading } = useUserPermissions(currentEntity?.id)
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthsAhead, setMonthsAhead] = useState('6')
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('chart')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cashflow_excluded_categories')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    }
    return new Set()
  })

  useEffect(() => {
    if (currentEntity) {
      fetchCashFlow()
    }
  }, [currentEntity?.id, monthsAhead, selectedScenarioId])

  // Save excluded categories to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cashflow_excluded_categories', JSON.stringify(Array.from(excludedCategories)))
    }
  }, [excludedCategories])

  const fetchCashFlow = async () => {
    if (!currentEntity) return

    setLoading(true)
    try {
      let url = `/api/cash-flow-projection?entity_id=${currentEntity.id}&months_ahead=${monthsAhead}`
      if (selectedScenarioId) {
        url += `&scenario_id=${selectedScenarioId}`
      }
      const response = await fetch(url)

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

  // Helper function to toggle category exclusion
  const toggleCategoryExclusion = (categoryName: string) => {
    setExcludedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  // Get all unique predicted expense categories across all months
  const getAllPredictedCategories = (): string[] => {
    if (!data?.projections) return []
    const categoriesSet = new Set<string>()
    data.projections.forEach(projection => {
      projection.predicted_expenses?.forEach(expense => {
        categoriesSet.add(expense.category_name)
      })
    })
    return Array.from(categoriesSet).sort()
  }

  // Filter projections to exclude selected categories
  const getFilteredProjections = () => {
    if (!data?.projections) return []

    let runningBalance = data.current_balance || 0

    return data.projections.map(projection => {
      const filtered_predicted = projection.predicted_expenses
        ?.filter(expense => !excludedCategories.has(expense.category_name))
        .reduce((sum, exp) => sum + exp.amount, 0) || 0

      const total_obligations = projection.total_debt + projection.total_scheduled + filtered_predicted + projection.total_budgets

      const opening_balance = runningBalance
      const closing_balance = opening_balance + (projection.projected_income || 0) - total_obligations
      runningBalance = closing_balance

      return {
        ...projection,
        predicted_expenses: projection.predicted_expenses?.filter(
          expense => !excludedCategories.has(expense.category_name)
        ) || [],
        total_predicted: filtered_predicted,
        total_obligations: total_obligations,
        opening_balance: opening_balance,
        closing_balance: closing_balance
      }
    })
  }

  const filteredProjections = getFilteredProjections()
  const allPredictedCategories = getAllPredictedCategories()

  // Calculate filtered summary totals
  const filteredSummary = {
    total_obligations: filteredProjections.reduce((sum, p) => sum + p.total_obligations, 0),
    total_projected_income: filteredProjections.reduce((sum, p) => sum + (p.projected_income || 0), 0),
    net_projected_change: filteredProjections.reduce((sum, p) => sum + ((p.projected_income || 0) - p.total_obligations), 0),
    lowest_projected_balance: Math.min(...filteredProjections.map(p => p.closing_balance)),
  }

  if (!currentEntity || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Check if user has permission to view cash flow
  if (!permissions.canViewCashFlow) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">
            You don&apos;t have permission to view Cash Flow projections.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact the account owner to request access.
          </p>
        </div>
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

      {/* Scenario Manager */}
      <ScenarioManager
        entityId={currentEntity?.id || ""}
        selectedScenarioId={selectedScenarioId}
        onScenarioChange={setSelectedScenarioId}
      />

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

          {/* Customize Prediction Panel */}
          {allPredictedCategories.length > 0 && (
            <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <CardTitle className="text-base">Customize Projection</CardTitle>
                        <Badge variant="outline" className="ml-2">
                          {excludedCategories.size} excluded
                        </Badge>
                      </div>
                      {customizeOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CardDescription>
                    Exclude categories with abnormal spending (e.g., one-time repairs) from predictions
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {allPredictedCategories.map(categoryName => (
                        <div key={categoryName} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${categoryName}`}
                            checked={!excludedCategories.has(categoryName)}
                            onCheckedChange={() => toggleCategoryExclusion(categoryName)}
                          />
                          <label
                            htmlFor={`category-${categoryName}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {categoryName}
                          </label>
                        </div>
                      ))}
                    </div>
                    {excludedCategories.size > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExcludedCategories(new Set())}
                        >
                          Reset All
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
                    {formatCurrency(filteredSummary.total_projected_income, 'VND')}
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
                  {formatCurrency(filteredSummary.total_obligations, 'VND')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Next {monthsAhead} months</p>
              </CardContent>
            </Card>

            {/* NEW in v2.0: Net Change */}
            {data.net_projected_change !== undefined && (
              <Card className={filteredSummary.net_projected_change >= 0 ? 'border-green-200' : 'border-red-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Net Change
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${filteredSummary.net_projected_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredSummary.net_projected_change >= 0 ? '+' : ''}{formatCurrency(filteredSummary.net_projected_change, 'VND')}
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
                          {data.runway.cash_runway_months === null || data.runway.cash_runway_months === undefined
                            ? "N/A"
                            : data.runway.cash_runway_months === Infinity
                              ? `${monthsAhead}+`
                              : `${data.runway.cash_runway_months.toFixed(1)}mo`}
                        </div>
                      </div>
                      {data.runway.liquidity_runway_months !== null &&
                       data.runway.liquidity_runway_months !== undefined &&
                       data.runway.liquidity_runway_months !== data.runway.cash_runway_months && (
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
            <>
              {/* Prepare aligned month labels for both charts */}
              {(() => {
                const monthLabels = filteredProjections.map(p => p.month_label.split(' ')[0])
                const hasCreditLines = data.credit_lines && data.credit_lines.accounts.length > 0

                return (
                  <div className="space-y-4">
                    {/* Cash Flow Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Cash Flow Projection</CardTitle>
                        <CardDescription>
                          {(data.version === '2.0' || data.version === '3.0')
                            ? 'Predicted income vs expenses with projected balance'
                            : 'Stacked expenses and projected balance over time'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <ComposedChart
                            data={filteredProjections.map(p => ({
                              month: p.month_label.split(' ')[0],
                              baseIncome: p.base_income || p.projected_income || 0,
                              debtDrawdown: p.scenario_debt_drawdown || 0,
                              scenarioIncome: p.scenario_income || 0,
                              debt: -p.total_debt,
                              scheduled: -p.total_scheduled,
                              predicted: -(p.total_predicted || 0),
                              budgets: -p.total_budgets,
                              debtRepayment: -(p.scenario_debt_repayment || 0),
                              balance: p.closing_balance,
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="month"
                              stroke="#6b7280"
                              style={{ fontSize: '12px' }}
                              tickLine={false}
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
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />

                            {(data.version === '2.0' || data.version === '3.0') && (
                              <>
                                <Bar dataKey="baseIncome" stackId="income" fill="#10b981" name="Projected Income" />
                                <Bar dataKey="debtDrawdown" stackId="income" fill="#06b6d4" name="Debt Drawdown (Scenario)" />
                                <Bar dataKey="scenarioIncome" stackId="income" fill="#84cc16" name="Scenario Income" radius={[4, 4, 0, 0]} />
                              </>
                            )}

                            <Bar dataKey="debt" stackId="expenses" fill="#ef4444" name="Debt Payments" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="scheduled" stackId="expenses" fill="#3b82f6" name="Scheduled Payments" />
                            {(data.version === '2.0' || data.version === '3.0') && (
                              <Bar dataKey="predicted" stackId="expenses" fill="#f97316" name="Predicted Expenses" />
                            )}
                            <Bar dataKey="budgets" stackId="expenses" fill="#a855f7" name="Budgets (unused)" />
                            <Bar dataKey="debtRepayment" stackId="expenses" fill="#0891b2" name="Debt Repayment (Scenario)" />

                            <Line
                              type="monotone"
                              dataKey="balance"
                              stroke="#0ea5e9"
                              strokeWidth={3}
                              name="Projected Balance"
                              dot={{ fill: '#0ea5e9', r: 5, strokeWidth: 2, stroke: '#fff' }}
                            >
                              <LabelList
                                dataKey="balance"
                                position="top"
                                offset={10}
                                formatter={(value: unknown) => {
                                  if (typeof value !== 'number') return ''
                                  const absValue = Math.abs(value)
                                  if (absValue >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
                                  if (absValue >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
                                  return `${(value / 1_000).toFixed(0)}K`
                                }}
                                style={{ fontSize: '11px', fontWeight: 600, fill: '#0ea5e9' }}
                              />
                            </Line>
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Credit Lines Chart - Aligned X-axis */}
                    {hasCreditLines && (
                      <Card className="border-yellow-200">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Landmark className="h-4 w-4 text-yellow-600" />
                                Credit Availability Projection
                              </CardTitle>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-yellow-600">
                                {formatCurrency(
                                  data.credit_lines!.scenario_adjusted_available ?? data.credit_lines!.total_available,
                                  'VND'
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                of {formatCurrency(data.credit_lines!.total_limit, 'VND')} limit
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart
                              data={filteredProjections.map((p, index) => {
                                const creditProjection = data.credit_lines!.availability_projection[index]
                                return {
                                  month: p.month_label.split(' ')[0],
                                  available: creditProjection?.available_credit ?? data.credit_lines!.total_available,
                                  used: data.credit_lines!.total_limit - (creditProjection?.available_credit ?? data.credit_lines!.total_available),
                                }
                              })}
                              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                dataKey="month"
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                                tickLine={false}
                              />
                              <YAxis
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                                tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                                domain={[0, data.credit_lines!.total_limit * 1.05]}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any) => formatCurrency(value, 'VND')}
                              />
                              <Legend wrapperStyle={{ fontSize: '12px' }} />
                              <ReferenceLine
                                y={data.credit_lines!.total_limit}
                                stroke="#94a3b8"
                                strokeDasharray="5 5"
                                label={{ value: 'Limit', position: 'right', fill: '#94a3b8', fontSize: 10 }}
                              />
                              <Bar
                                dataKey="used"
                                stackId="credit"
                                fill="#fecaca"
                                stroke="#ef4444"
                                name="Credit Used"
                              />
                              <Bar
                                dataKey="available"
                                stackId="credit"
                                fill="#bbf7d0"
                                stroke="#22c55e"
                                name="Credit Available"
                              />
                            </ComposedChart>
                          </ResponsiveContainer>

                          {/* Credit Lines Summary Cards - Compact */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                            {data.credit_lines!.accounts.map((account) => (
                              <div key={account.account_id} className="p-2 rounded-lg border bg-card">
                                <div className="flex items-center gap-1 mb-1">
                                  <PiggyBank className="h-3 w-3 text-yellow-600" />
                                  <span className="text-xs font-medium truncate">{account.account_name}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-green-600">{formatCurrency(account.available_credit, 'VND')}</span>
                                  <span className="text-muted-foreground">{account.utilization_percent.toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                  <div
                                    className={`h-full rounded-full ${
                                      account.utilization_percent > 80 ? 'bg-red-500' :
                                      account.utilization_percent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(account.utilization_percent, 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              })()}
            </>
          )}

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="space-y-4">
              {filteredProjections.map((projection, index) => (
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
                          <span className="flex-1">{payment.loan_name} - {payment.drawdown_reference || payment.borrower_name || payment.type}</span>
                          <span className="text-blue-600">{format(new Date(payment.due_date), 'MMM d')}</span>
                          <span className="font-medium">{formatCurrency(payment.amount, 'VND')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Priority 1: Scheduled Payments */}
                  {projection.scheduled_payments.length > 0 && (() => {
                    // Group scheduled payments by category
                    const groupedPayments = projection.scheduled_payments.reduce((acc: any, payment: any) => {
                      const categoryName = payment.category_name || 'Uncategorized'
                      if (!acc[categoryName]) {
                        acc[categoryName] = 0
                      }
                      acc[categoryName] += payment.amount
                      return acc
                    }, {})

                    return (
                      <div className="space-y-2 pl-4 border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Priority 1: Scheduled Payments</span>
                          <span className="font-semibold text-blue-600">
                            -{formatCurrency(projection.total_scheduled, 'VND')}
                          </span>
                        </div>
                        {Object.entries(groupedPayments).map(([categoryName, categoryTotal]: [string, any]) => (
                          <div key={categoryName} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                            <span className="flex-1">{categoryName}</span>
                            <span className="font-medium">{formatCurrency(categoryTotal, 'VND')}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Cash Flow 2.0: Priority 2: Predicted Expenses */}
                  {projection.predicted_expenses && projection.predicted_expenses.length > 0 && (
                    <TooltipProvider>
                      <div className="space-y-2 pl-4 border-l-4 border-l-orange-500">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Priority 2: Predicted Expenses</span>
                          <span className="font-semibold text-orange-600">
                            -{formatCurrency(projection.total_predicted || 0, 'VND')}
                          </span>
                        </div>
                        {projection.predicted_expenses.map((expense: any, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 flex-1">
                              <span>{expense.category_name}</span>
                              {expense.has_gap && (
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <AlertCircle className="h-3.5 w-3.5 text-orange-600 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-semibold mb-1">Gap Detected</p>
                                    <p className="text-xs">
                                      Historical average: {formatCurrency(expense.historical_average, 'VND')}
                                    </p>
                                    <p className="text-xs">
                                      Scheduled: {formatCurrency(expense.scheduled_amount, 'VND')}
                                    </p>
                                    <p className="text-xs mt-1">
                                      This {formatCurrency(expense.amount, 'VND')} represents the difference between your historical spending and scheduled payments for this category.
                                    </p>
                                  </TooltipContent>
                                </UITooltip>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">{expense.confidence}</Badge>
                            <span className="font-medium">{formatCurrency(expense.amount, 'VND')}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipProvider>
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

                  {/* Scenario Items (debt drawdowns, repayments, adjustments) */}
                  {projection.scenario_items && projection.scenario_items.length > 0 && (
                    <div className="space-y-2 pl-4 border-l-4 border-l-cyan-500 bg-cyan-50/30 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Scenario Adjustments
                        </span>
                      </div>
                      {projection.scenario_items.map((item: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                          <span className="flex-1">{item.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{item.type.replace('_', ' ')}</Badge>
                          <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, 'VND')}
                          </span>
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
