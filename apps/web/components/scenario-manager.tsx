"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  TrendingUp,
  TrendingDown,
  Repeat,
  Landmark,
  Percent,
  X,
  Layers,
  ChevronDown,
} from "lucide-react"
import { formatCurrency } from "@/lib/account-utils"
import {
  CashFlowScenario,
  ScenarioAdjustment,
  ScenarioWithAdjustments,
  ScenarioAdjustmentType,
  ADJUSTMENT_TYPE_CONFIG,
  SCENARIO_COLORS,
  DebtDrawdownMetadata,
} from "@/types/scenario"
import { format } from "date-fns"

interface CreditLineAccount {
  account_id: number
  account_name: string
  bank_name: string | null
  credit_limit: number
  available_credit: number
}

interface ScenarioManagerProps {
  entityId: string
  selectedScenarioId: number | null
  onScenarioChange: (scenarioId: number | null) => void
}

// Icon mapping
const ADJUSTMENT_ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  TrendingDown: <TrendingDown className="h-4 w-4" />,
  Repeat: <Repeat className="h-4 w-4" />,
  Landmark: <Landmark className="h-4 w-4" />,
  Percent: <Percent className="h-4 w-4" />,
  X: <X className="h-4 w-4" />,
}

export function ScenarioManager({
  entityId,
  selectedScenarioId,
  onScenarioChange,
}: ScenarioManagerProps) {
  const [scenarios, setScenarios] = useState<CashFlowScenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<ScenarioWithAdjustments | null>(null)
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scenarioToDelete, setScenarioToDelete] = useState<CashFlowScenario | null>(null)
  const [editingScenario, setEditingScenario] = useState<CashFlowScenario | null>(null)
  const [editingAdjustment, setEditingAdjustment] = useState<ScenarioAdjustment | null>(null)

  // Form states
  const [scenarioName, setScenarioName] = useState("")
  const [scenarioDescription, setScenarioDescription] = useState("")
  const [scenarioColor, setScenarioColor] = useState(SCENARIO_COLORS[0])

  // Adjustment form states
  const [adjustmentType, setAdjustmentType] = useState<ScenarioAdjustmentType>("one_time_expense")
  const [adjustmentName, setAdjustmentName] = useState("")
  const [adjustmentAmount, setAdjustmentAmount] = useState("")
  const [adjustmentPercentage, setAdjustmentPercentage] = useState("")
  const [adjustmentStartMonth, setAdjustmentStartMonth] = useState("")
  const [adjustmentEndMonth, setAdjustmentEndMonth] = useState("")

  // Debt drawdown specific fields
  const [repaymentMonth, setRepaymentMonth] = useState("")
  const [selectedCreditLineId, setSelectedCreditLineId] = useState<string>("")
  const [creditLineAccounts, setCreditLineAccounts] = useState<CreditLineAccount[]>([])

  useEffect(() => {
    fetchScenarios()
    fetchCreditLineAccounts()
  }, [entityId])

  useEffect(() => {
    if (selectedScenarioId) {
      fetchScenarioDetails(selectedScenarioId)
    } else {
      setSelectedScenario(null)
    }
  }, [selectedScenarioId])

  const fetchCreditLineAccounts = async () => {
    try {
      // Fetch cash-flow projection which contains credit line data
      const response = await fetch(`/api/cash-flow-projection?entity_id=${entityId}&months_ahead=1`)
      if (response.ok) {
        const result = await response.json()
        if (result.data?.credit_lines?.accounts) {
          setCreditLineAccounts(result.data.credit_lines.accounts)
        }
      }
    } catch (error) {
      console.error("Error fetching credit lines:", error)
    }
  }

  const fetchScenarios = async () => {
    try {
      const response = await fetch(`/api/scenarios?entity_id=${entityId}`)
      if (response.ok) {
        const result = await response.json()
        setScenarios(result.data || [])
      }
    } catch (error) {
      console.error("Error fetching scenarios:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchScenarioDetails = async (scenarioId: number) => {
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}`)
      if (response.ok) {
        const result = await response.json()
        setSelectedScenario(result.data)
      }
    } catch (error) {
      console.error("Error fetching scenario details:", error)
    }
  }

  const handleCreateScenario = async () => {
    try {
      const body = {
        entity_id: entityId,
        name: scenarioName,
        description: scenarioDescription || null,
        color: scenarioColor,
      }

      const response = editingScenario
        ? await fetch(`/api/scenarios/${editingScenario.scenario_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/scenarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })

      if (response.ok) {
        const result = await response.json()
        await fetchScenarios()
        if (!editingScenario) {
          onScenarioChange(result.data.scenario_id)
        }
        setCreateDialogOpen(false)
        resetScenarioForm()
      }
    } catch (error) {
      console.error("Error saving scenario:", error)
    }
  }

  const handleDeleteScenario = async () => {
    if (!scenarioToDelete) return

    try {
      const response = await fetch(`/api/scenarios/${scenarioToDelete.scenario_id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchScenarios()
        if (selectedScenarioId === scenarioToDelete.scenario_id) {
          onScenarioChange(null)
        }
        setDeleteDialogOpen(false)
        setScenarioToDelete(null)
      }
    } catch (error) {
      console.error("Error deleting scenario:", error)
    }
  }

  const handleCreateAdjustment = async () => {
    if (!selectedScenario) return

    const config = ADJUSTMENT_TYPE_CONFIG[adjustmentType]

    try {
      const body: Record<string, any> = {
        adjustment_type: adjustmentType,
        name: adjustmentName,
        start_month: adjustmentStartMonth || null,
        end_month: adjustmentEndMonth || null,
      }

      if (config.requiresAmount && adjustmentAmount) {
        body.amount = parseFloat(adjustmentAmount)
      }
      if (config.requiresPercentage && adjustmentPercentage) {
        body.percentage = parseFloat(adjustmentPercentage)
      }

      // Add metadata for debt_drawdown adjustments
      if (adjustmentType === 'debt_drawdown') {
        const metadata: DebtDrawdownMetadata = {}
        // Calculate actual repayment month from drawdown month + months offset
        if (repaymentMonth && adjustmentStartMonth) {
          const monthsOffset = parseInt(repaymentMonth)
          if (!isNaN(monthsOffset)) {
            // Parse the start month (YYYY-MM format) and add months
            const [year, month] = adjustmentStartMonth.split('-').map(Number)
            const startDate = new Date(year, month - 1, 1) // month is 0-indexed
            startDate.setMonth(startDate.getMonth() + monthsOffset)
            // Format back to YYYY-MM
            const repaymentYear = startDate.getFullYear()
            const repaymentMonthNum = String(startDate.getMonth() + 1).padStart(2, '0')
            metadata.repayment_month = `${repaymentYear}-${repaymentMonthNum}`
            metadata.repayment_months = monthsOffset // Also store the original selection
          }
        }
        if (selectedCreditLineId) {
          metadata.credit_line_account_id = parseInt(selectedCreditLineId)
        }
        body.metadata = metadata
        // Also set the account_id field for direct reference
        if (selectedCreditLineId) {
          body.account_id = parseInt(selectedCreditLineId)
        }
      }

      const response = editingAdjustment
        ? await fetch(
            `/api/scenarios/${selectedScenario.scenario_id}/adjustments/${editingAdjustment.adjustment_id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          )
        : await fetch(`/api/scenarios/${selectedScenario.scenario_id}/adjustments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })

      if (response.ok) {
        await fetchScenarioDetails(selectedScenario.scenario_id)
        setAdjustmentDialogOpen(false)
        resetAdjustmentForm()
      }
    } catch (error) {
      console.error("Error saving adjustment:", error)
    }
  }

  const handleDeleteAdjustment = async (adjustmentId: number) => {
    if (!selectedScenario) return

    try {
      const response = await fetch(
        `/api/scenarios/${selectedScenario.scenario_id}/adjustments/${adjustmentId}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        await fetchScenarioDetails(selectedScenario.scenario_id)
      }
    } catch (error) {
      console.error("Error deleting adjustment:", error)
    }
  }

  const resetScenarioForm = () => {
    setScenarioName("")
    setScenarioDescription("")
    setScenarioColor(SCENARIO_COLORS[0])
    setEditingScenario(null)
  }

  const resetAdjustmentForm = () => {
    setAdjustmentType("one_time_expense")
    setAdjustmentName("")
    setAdjustmentAmount("")
    setAdjustmentPercentage("")
    setAdjustmentStartMonth("")
    setAdjustmentEndMonth("")
    setRepaymentMonth("")
    setSelectedCreditLineId("")
    setEditingAdjustment(null)
  }

  const openEditScenario = (scenario: CashFlowScenario) => {
    setEditingScenario(scenario)
    setScenarioName(scenario.name)
    setScenarioDescription(scenario.description || "")
    setScenarioColor(scenario.color)
    setCreateDialogOpen(true)
  }

  const openEditAdjustment = (adjustment: ScenarioAdjustment) => {
    setEditingAdjustment(adjustment)
    setAdjustmentType(adjustment.adjustment_type)
    setAdjustmentName(adjustment.name)
    setAdjustmentAmount(adjustment.amount?.toString() || "")
    setAdjustmentPercentage(adjustment.percentage?.toString() || "")
    setAdjustmentStartMonth(adjustment.start_month || "")
    setAdjustmentEndMonth(adjustment.end_month || "")
    // Handle debt_drawdown metadata
    if (adjustment.adjustment_type === 'debt_drawdown' && adjustment.metadata) {
      const metadata = adjustment.metadata as DebtDrawdownMetadata
      // Use repayment_months (the user selection) if available, otherwise empty
      setRepaymentMonth(metadata.repayment_months?.toString() || "")
      setSelectedCreditLineId(metadata.credit_line_account_id?.toString() || adjustment.account_id?.toString() || "")
    } else {
      setRepaymentMonth("")
      setSelectedCreditLineId("")
    }
    setAdjustmentDialogOpen(true)
  }

  const currentConfig = ADJUSTMENT_TYPE_CONFIG[adjustmentType]

  return (
    <div className="space-y-4">
      {/* Scenario Selector */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {selectedScenario ? (
                  <>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedScenario.color }}
                    />
                    <span>{selectedScenario.name}</span>
                  </>
                ) : (
                  <span>Base Projection</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            <DropdownMenuItem onClick={() => onScenarioChange(null)}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                <span>Base Projection</span>
              </div>
            </DropdownMenuItem>
            {scenarios.length > 0 && <DropdownMenuSeparator />}
            {scenarios.map((scenario) => (
              <DropdownMenuItem
                key={scenario.scenario_id}
                onClick={() => onScenarioChange(scenario.scenario_id)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: scenario.color }}
                    />
                    <span>{scenario.name}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        openEditScenario(scenario)
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setScenarioToDelete(scenario)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                resetScenarioForm()
                setCreateDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Scenario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selected Scenario Details */}
      {selectedScenario && (
        <Card style={{ borderColor: selectedScenario.color }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedScenario.color }}
                />
                <CardTitle className="text-base">{selectedScenario.name}</CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetAdjustmentForm()
                  setAdjustmentDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Adjustment
              </Button>
            </div>
            {selectedScenario.description && (
              <CardDescription>{selectedScenario.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedScenario.adjustments?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No adjustments yet. Add adjustments to model different scenarios.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedScenario.adjustments?.map((adjustment) => {
                  const config = ADJUSTMENT_TYPE_CONFIG[adjustment.adjustment_type]
                  return (
                    <div
                      key={adjustment.adjustment_id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded bg-${config.color}-100 text-${config.color}-600`}>
                          {ADJUSTMENT_ICONS[config.icon]}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{adjustment.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                            {adjustment.amount && (
                              <span>{formatCurrency(adjustment.amount, "VND")}</span>
                            )}
                            {adjustment.percentage && <span>{adjustment.percentage}%</span>}
                            {adjustment.start_month && (
                              <span>
                                from {format(new Date(adjustment.start_month), "MMM yyyy")}
                              </span>
                            )}
                            {adjustment.end_month && (
                              <span>
                                to {format(new Date(adjustment.end_month), "MMM yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditAdjustment(adjustment)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteAdjustment(adjustment.adjustment_id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Scenario Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingScenario ? "Edit Scenario" : "Create New Scenario"}
            </DialogTitle>
            <DialogDescription>
              Create a what-if scenario to model different financial situations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Cost Reduction Plan"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe this scenario..."
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {SCENARIO_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-transform ${
                      scenarioColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setScenarioColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateScenario} disabled={!scenarioName.trim()}>
              {editingScenario ? "Save Changes" : "Create Scenario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAdjustment ? "Edit Adjustment" : "Add Adjustment"}
            </DialogTitle>
            <DialogDescription>
              Add a financial adjustment to this scenario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select
                value={adjustmentType}
                onValueChange={(value) => setAdjustmentType(value as ScenarioAdjustmentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADJUSTMENT_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {ADJUSTMENT_ICONS[config.icon]}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{currentConfig.description}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-name">Name</Label>
              <Input
                id="adj-name"
                placeholder="e.g., Equipment Purchase"
                value={adjustmentName}
                onChange={(e) => setAdjustmentName(e.target.value)}
              />
            </div>

            {currentConfig.requiresAmount && (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                />
              </div>
            )}

            {currentConfig.requiresPercentage && (
              <div className="space-y-2">
                <Label htmlFor="percentage">Percentage (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  placeholder="e.g., -20 for 20% reduction"
                  value={adjustmentPercentage}
                  onChange={(e) => setAdjustmentPercentage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use negative values for reductions, positive for increases.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-month">
                  {adjustmentType === 'debt_drawdown' ? "Drawdown Month" : (currentConfig.requiresDateRange ? "Start Month" : "Month")}
                </Label>
                <Input
                  id="start-month"
                  type="month"
                  value={adjustmentStartMonth}
                  onChange={(e) => setAdjustmentStartMonth(e.target.value)}
                />
              </div>
              {currentConfig.requiresDateRange && (
                <div className="space-y-2">
                  <Label htmlFor="end-month">End Month</Label>
                  <Input
                    id="end-month"
                    type="month"
                    value={adjustmentEndMonth}
                    onChange={(e) => setAdjustmentEndMonth(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Debt Drawdown specific fields */}
            {adjustmentType === 'debt_drawdown' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="credit-line">Credit Line (optional)</Label>
                  <Select
                    value={selectedCreditLineId || "none"}
                    onValueChange={(value) => setSelectedCreditLineId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit line to draw from" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific credit line</SelectItem>
                      {creditLineAccounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id.toString()}>
                          <div className="flex flex-col">
                            <span>{account.account_name}</span>
                            <span className="text-xs text-muted-foreground">
                              Available: {formatCurrency(account.available_credit, "VND")}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The credit line&apos;s available balance will be reduced in this scenario.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repayment-months">Repayment Term (optional)</Label>
                  <Select
                    value={repaymentMonth || "none"}
                    onValueChange={(value) => setRepaymentMonth(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When to repay this debt?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No repayment scheduled</SelectItem>
                      <SelectItem value="1">1 month after drawdown</SelectItem>
                      <SelectItem value="2">2 months after drawdown</SelectItem>
                      <SelectItem value="3">3 months after drawdown</SelectItem>
                      <SelectItem value="6">6 months after drawdown</SelectItem>
                      <SelectItem value="12">12 months after drawdown</SelectItem>
                      <SelectItem value="18">18 months after drawdown</SelectItem>
                      <SelectItem value="24">24 months after drawdown</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The debt repayment will show as a future expense in the selected month.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAdjustment}
              disabled={
                !adjustmentName.trim() ||
                (currentConfig.requiresAmount && !adjustmentAmount) ||
                (currentConfig.requiresPercentage && !adjustmentPercentage)
              }
            >
              {editingAdjustment ? "Save Changes" : "Add Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{scenarioToDelete?.name}&quot;? This will also delete all
              adjustments in this scenario. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScenario}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
