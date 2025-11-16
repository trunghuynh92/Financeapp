"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { BalanceCheckpoint } from "@/types/checkpoint"

interface Transaction {
  raw_transaction_id: string
  description: string
  debit_amount: number | null
  credit_amount: number | null
  balance: number | null
  is_balance_adjustment: boolean
}

interface Discrepancy {
  date: string
  checkpoint_balance: number
  calculated_balance: number
  difference: number
  checkpoint_source: string
  checkpoint_id: number
  transactions_on_date: Transaction[]
  transactions_count: number
  period_start_date: string | null
  period_start_balance: number
  transactions_in_period_count: number
  total_debits?: number
  total_credits?: number
  expected_change?: number
  actual_change?: number
}

interface InvestigateDiscrepancyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  accountName: string
  checkpoints: BalanceCheckpoint[]
}

export function InvestigateDiscrepancyDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  checkpoints,
}: InvestigateDiscrepancyDialogProps) {
  const [isInvestigating, setIsInvestigating] = useState(false)
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
  const [totalCheckpoints, setTotalCheckpoints] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<number | null>(null)

  const handleInvestigate = async () => {
    if (!selectedCheckpointId) {
      setError('Please select a checkpoint to investigate')
      return
    }

    setIsInvestigating(true)
    setError(null)

    try {
      const url = `/api/accounts/${accountId}/investigate-discrepancies?checkpoint_id=${selectedCheckpointId}`
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to investigate discrepancies')
      }

      setDiscrepancies(data.discrepancies || [])
      setTotalCheckpoints(data.total_checkpoints || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsInvestigating(false)
    }
  }

  const handleReset = () => {
    setDiscrepancies([])
    setTotalCheckpoints(0)
    setError(null)
    setExpandedDates(new Set())
    setSelectedCheckpointId(null)
  }

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Investigate Balance Discrepancies
          </DialogTitle>
          <DialogDescription>
            Compare calculated balances with checkpoint balances for {accountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isInvestigating && discrepancies.length === 0 && totalCheckpoints === 0 && (
            <div className="space-y-6">
              {checkpoints.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No checkpoints available to investigate
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="checkpoint-select">Select Checkpoint to Investigate</Label>
                    <Select
                      value={selectedCheckpointId?.toString() || ""}
                      onValueChange={(value) => setSelectedCheckpointId(parseInt(value))}
                    >
                      <SelectTrigger id="checkpoint-select">
                        <SelectValue placeholder="Choose a checkpoint..." />
                      </SelectTrigger>
                      <SelectContent>
                        {checkpoints.map((cp) => (
                          <SelectItem key={cp.checkpoint_id} value={cp.checkpoint_id.toString()}>
                            {formatDate(cp.checkpoint_date)} - {formatCurrency(cp.declared_balance)} ({cp.import_batch_id ? 'import' : 'manual'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Select a checkpoint to analyze all transactions up to that date
                    </p>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={handleInvestigate}
                      disabled={!selectedCheckpointId || isInvestigating}
                      className="gap-2"
                    >
                      <Search className="h-4 w-4" />
                      {isInvestigating ? 'Investigating...' : 'Start Investigation'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {isInvestigating && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
              <p className="text-muted-foreground">Analyzing checkpoints...</p>
            </div>
          )}

          {!isInvestigating && totalCheckpoints > 0 && (
            <>
              <Alert>
                <AlertDescription>
                  <strong>Analysis Complete:</strong> {totalCheckpoints} checkpoint(s) analyzed, {discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} found
                </AlertDescription>
              </Alert>

              {discrepancies.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-green-600 text-lg font-semibold mb-2">
                    ✓ No Discrepancies Found
                  </div>
                  <p className="text-muted-foreground">
                    All checkpoint balances match the calculated balances
                  </p>
                </div>
              )}

              {discrepancies.length > 0 && (
                <div className="space-y-3">
                  {discrepancies.map((discrepancy, index) => (
                    <Collapsible
                      key={index}
                      open={expandedDates.has(discrepancy.date)}
                      onOpenChange={() => toggleDate(discrepancy.date)}
                    >
                      <div className="border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              {expandedDates.has(discrepancy.date) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <div className="text-left">
                                <div className="font-semibold">{formatDate(discrepancy.date)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {discrepancy.transactions_count} transaction(s) on this date
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={discrepancy.difference > 0 ? "default" : "destructive"}>
                                {discrepancy.difference > 0 ? '+' : ''}{formatCurrency(discrepancy.difference)}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                Expected Balance: {formatCurrency(discrepancy.calculated_balance)}
                              </div>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t p-4 bg-gray-50 space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Starting Balance</div>
                                <div className="font-semibold">{formatCurrency(discrepancy.period_start_balance)}</div>
                              </div>
                              {discrepancy.total_credits !== undefined && (
                                <div>
                                  <div className="text-muted-foreground">Total Credits (In)</div>
                                  <div className="font-semibold text-green-600">+{formatCurrency(discrepancy.total_credits)}</div>
                                </div>
                              )}
                              {discrepancy.total_debits !== undefined && (
                                <div>
                                  <div className="text-muted-foreground">Total Debits (Out)</div>
                                  <div className="font-semibold text-red-600">-{formatCurrency(discrepancy.total_debits)}</div>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                              {discrepancy.expected_change !== undefined && (
                                <div>
                                  <div className="text-muted-foreground">Expected Change</div>
                                  <div className={`font-semibold ${discrepancy.expected_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {discrepancy.expected_change >= 0 ? '+' : ''}{formatCurrency(discrepancy.expected_change)}
                                  </div>
                                </div>
                              )}
                              {discrepancy.actual_change !== undefined && (
                                <div>
                                  <div className="text-muted-foreground">Actual Change</div>
                                  <div className={`font-semibold ${discrepancy.actual_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {discrepancy.actual_change >= 0 ? '+' : ''}{formatCurrency(discrepancy.actual_change)}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-muted-foreground">Discrepancy</div>
                                <div className={`font-semibold text-lg ${discrepancy.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {discrepancy.difference > 0 ? '+' : ''}{formatCurrency(discrepancy.difference)}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                              <div>
                                <div className="text-muted-foreground">Declared Balance (Bank)</div>
                                <div className="font-semibold">{formatCurrency(discrepancy.checkpoint_balance)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Expected Balance (Calculated)</div>
                                <div className="font-semibold">{formatCurrency(discrepancy.calculated_balance)}</div>
                              </div>
                            </div>

                            {discrepancy.period_start_date && (
                              <div className="text-sm">
                                <div className="text-muted-foreground">Period</div>
                                <div>
                                  {formatDate(discrepancy.period_start_date)} to {formatDate(discrepancy.date)}
                                  <span className="ml-2 text-muted-foreground">
                                    ({discrepancy.transactions_in_period_count} transactions in period)
                                  </span>
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="text-sm font-semibold mb-2">
                                Transactions on {formatDate(discrepancy.date)}:
                              </div>
                              {discrepancy.transactions_on_date.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No transactions on this date</p>
                              ) : (
                                <div className="space-y-2">
                                  {discrepancy.transactions_on_date.map((txn) => (
                                    <div
                                      key={txn.raw_transaction_id}
                                      className="bg-white p-3 rounded border text-sm"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium">{txn.description}</div>
                                          {txn.is_balance_adjustment && (
                                            <Badge variant="secondary" className="mt-1">
                                              Balance Adjustment
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-right ml-4">
                                          {txn.debit_amount && (
                                            <div className="text-red-600">-{formatCurrency(txn.debit_amount)}</div>
                                          )}
                                          {txn.credit_amount && (
                                            <div className="text-green-600">+{formatCurrency(txn.credit_amount)}</div>
                                          )}
                                          {txn.balance !== null && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Balance: {formatCurrency(txn.balance)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {!isInvestigating && totalCheckpoints > 0 && (
            <Button variant="outline" onClick={handleReset}>
              Analyze Different Checkpoint
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
