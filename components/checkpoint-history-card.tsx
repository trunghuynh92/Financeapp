"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, CheckCircle, AlertCircle, Upload, Edit2, Trash2, Filter, RotateCcw, Info, Search } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { BalanceCheckpoint } from "@/types/checkpoint"
import { EditCheckpointDialog } from "./edit-checkpoint-dialog"
import { InvestigateDiscrepancyDialog } from "./InvestigateDiscrepancyDialog"

interface CheckpointHistoryCardProps {
  accountId: number
  accountName?: string
  checkpoints: BalanceCheckpoint[]
  onRefresh: () => void
}

type FilterType = "all" | "manual" | "import" | "discrepancy"

export function CheckpointHistoryCard({
  accountId,
  accountName = "Account",
  checkpoints,
  onRefresh,
}: CheckpointHistoryCardProps) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [editingCheckpoint, setEditingCheckpoint] = useState<BalanceCheckpoint | null>(null)
  const [deletingCheckpoint, setDeletingCheckpoint] = useState<BalanceCheckpoint | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [rollingBackCheckpoint, setRollingBackCheckpoint] = useState<BalanceCheckpoint | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [investigateDialogOpen, setInvestigateDialogOpen] = useState(false)

  // Filter checkpoints
  const filteredCheckpoints = checkpoints.filter(cp => {
    switch (filter) {
      case "manual":
        return cp.import_batch_id === null
      case "import":
        return cp.import_batch_id !== null
      case "discrepancy":
        return !cp.is_reconciled
      default:
        return true
    }
  })

  // Sort by date (newest first), then by checkpoint_id as tiebreaker (for multiple imports on same date)
  const sortedCheckpoints = [...filteredCheckpoints].sort((a, b) => {
    const dateDiff = new Date(b.checkpoint_date).getTime() - new Date(a.checkpoint_date).getTime()
    if (dateDiff !== 0) return dateDiff
    // For same date, sort by checkpoint_id descending (newer imports first)
    return b.checkpoint_id - a.checkpoint_id
  })

  async function handleDelete() {
    if (!deletingCheckpoint) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/checkpoints/${deletingCheckpoint.checkpoint_id}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to delete checkpoint")
      }

      onRefresh()
      setDeletingCheckpoint(null)
    } catch (error) {
      console.error("Error deleting checkpoint:", error)
      alert(error instanceof Error ? error.message : "Failed to delete checkpoint")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRollback() {
    if (!rollingBackCheckpoint) return

    setIsRollingBack(true)
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/checkpoints/${rollingBackCheckpoint.checkpoint_id}/rollback`,
        { method: "POST" }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to rollback import")
      }

      const result = await response.json()
      onRefresh()
      setRollingBackCheckpoint(null)

      // Show success message
      alert(result.message || "Import rolled back successfully")
    } catch (error) {
      console.error("Error rolling back import:", error)
      alert(error instanceof Error ? error.message : "Failed to rollback import")
    } finally {
      setIsRollingBack(false)
    }
  }

  function getStatusBadge(checkpoint: BalanceCheckpoint) {
    if (checkpoint.is_reconciled) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Reconciled
        </Badge>
      )
    }

    const absAdjustment = Math.abs(checkpoint.adjustment_amount)
    if (absAdjustment >= 1000000) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Major Discrepancy
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Minor Discrepancy
        </Badge>
      )
    }
  }

  function getSourceBadge(checkpoint: BalanceCheckpoint) {
    if (checkpoint.import_batch_id !== null) {
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          <Upload className="h-3 w-3 mr-1" />
          Import #{checkpoint.import_batch_id}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">
        <Edit2 className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    )
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (checkpoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Checkpoint History
          </CardTitle>
          <CardDescription>Track balance accuracy over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Checkpoints Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Checkpoints help you track your balance accuracy over time.
              Create your first checkpoint by clicking &quot;Create Checkpoint&quot; or import a bank statement.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Checkpoint History
              </CardTitle>
              <CardDescription>
                {sortedCheckpoints.length} checkpoint{sortedCheckpoints.length !== 1 ? "s" : ""}
                {filter !== "all" && " (filtered)"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInvestigateDialogOpen(true)}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Investigate
              </Button>
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter checkpoints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Checkpoints</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="import">Import Only</SelectItem>
                  <SelectItem value="discrepancy">Discrepancies Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Understanding Balance Calculations</p>
                <p className="mb-2">
                  <span className="font-mono bg-white px-2 py-0.5 rounded">
                    Declared Balance = Calculated Balance + Adjustment
                  </span>
                </p>
                <ul className="space-y-1 text-blue-800">
                  <li>• <strong>Calculated Balance:</strong> Net change from your imported transactions (Credits - Debits)</li>
                  <li>• <strong>Adjustment:</strong> Usually represents your opening balance before the import period</li>
                  <li>• <strong>Tip:</strong> Large adjustments? Create a checkpoint on your first import date with the opening balance.</li>
                </ul>
              </div>
            </div>
          </div>
          <TooltipProvider>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          Declared Balance
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">From Bank Statement</p>
                          <p className="text-sm">The actual balance shown on your bank statement for this date.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          Calculated Balance
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Net change from all transactions</p>
                          <p className="text-sm">Net change from all transactions up to this checkpoint (Credits - Debits), including any previous balance adjustments.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          Adjustment
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Unexplained Difference</p>
                          <p className="text-sm mb-2">Difference = Declared - Calculated</p>
                          <p className="text-sm">Large adjustments often represent opening balances from before your import period. Create a checkpoint on your first import date to eliminate this.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {sortedCheckpoints.map((checkpoint) => (
                  <TableRow key={checkpoint.checkpoint_id}>
                    <TableCell className="font-medium">
                      {format(new Date(checkpoint.checkpoint_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(checkpoint.declared_balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(checkpoint.calculated_balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          checkpoint.adjustment_amount === 0
                            ? "text-green-600"
                            : Math.abs(checkpoint.adjustment_amount) >= 1000000
                            ? "text-red-600 font-semibold"
                            : "text-yellow-600"
                        }
                      >
                        {checkpoint.adjustment_amount === 0
                          ? "—"
                          : formatCurrency(checkpoint.adjustment_amount)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(checkpoint)}</TableCell>
                    <TableCell>{getSourceBadge(checkpoint)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {checkpoint.import_batch_id === null ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCheckpoint(checkpoint)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingCheckpoint(checkpoint)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRollingBackCheckpoint(checkpoint)}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Edit Checkpoint Dialog */}
      {editingCheckpoint && (
        <EditCheckpointDialog
          checkpoint={editingCheckpoint}
          accountId={accountId}
          open={!!editingCheckpoint}
          onOpenChange={(open) => !open && setEditingCheckpoint(null)}
          onSuccess={() => {
            setEditingCheckpoint(null)
            onRefresh()
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCheckpoint} onOpenChange={(open) => !open && setDeletingCheckpoint(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this checkpoint from{" "}
              {deletingCheckpoint && format(new Date(deletingCheckpoint.checkpoint_date), "MMMM dd, yyyy")}?
              <br />
              <br />
              This action cannot be undone. Other checkpoints will be automatically recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Checkpoint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={!!rollingBackCheckpoint} onOpenChange={(open) => !open && setRollingBackCheckpoint(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100">
                <RotateCcw className="h-5 w-5 text-orange-600" />
              </div>
              <AlertDialogTitle>Rollback Import?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-3 space-y-3">
              <p>
                Are you sure you want to rollback the import from{" "}
                {rollingBackCheckpoint && format(new Date(rollingBackCheckpoint.checkpoint_date), "MMMM dd, yyyy")}
                {rollingBackCheckpoint?.import_batch_id && ` (Import #${rollingBackCheckpoint.import_batch_id})`}?
              </p>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-sm text-orange-700 font-medium mb-1">
                  This will:
                </p>
                <ul className="text-sm text-orange-700 list-disc list-inside space-y-1">
                  <li>Delete the checkpoint and its balance adjustment</li>
                  <li>Delete all transactions from this import batch</li>
                  <li>Recalculate all remaining checkpoints</li>
                </ul>
              </div>
              <p className="text-destructive font-medium">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isRollingBack ? "Rolling back..." : "Rollback Import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Investigate Discrepancy Dialog */}
      <InvestigateDiscrepancyDialog
        open={investigateDialogOpen}
        onOpenChange={setInvestigateDialogOpen}
        accountId={accountId}
        accountName={accountName}
        checkpoints={checkpoints}
      />
    </>
  )
}
