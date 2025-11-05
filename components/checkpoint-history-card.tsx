"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, CheckCircle, AlertCircle, Upload, Edit2, Trash2, Filter } from "lucide-react"
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

interface CheckpointHistoryCardProps {
  accountId: number
  checkpoints: BalanceCheckpoint[]
  onRefresh: () => void
}

type FilterType = "all" | "manual" | "import" | "discrepancy"

export function CheckpointHistoryCard({
  accountId,
  checkpoints,
  onRefresh,
}: CheckpointHistoryCardProps) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [editingCheckpoint, setEditingCheckpoint] = useState<BalanceCheckpoint | null>(null)
  const [deletingCheckpoint, setDeletingCheckpoint] = useState<BalanceCheckpoint | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Sort by date (newest first)
  const sortedCheckpoints = [...filteredCheckpoints].sort(
    (a, b) => new Date(b.checkpoint_date).getTime() - new Date(a.checkpoint_date).getTime()
  )

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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Declared Balance</TableHead>
                  <TableHead className="text-right">Calculated Balance</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
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
                          <span className="text-xs text-muted-foreground">Import-managed</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
    </>
  )
}
