"use client"

import { useState, useEffect } from "react"
import { Calendar, DollarSign, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/account-utils"

interface Checkpoint {
  checkpoint_id: number
  account_id: number
  checkpoint_date: string
  declared_balance: number
  calculated_balance: number
  adjustment_amount: number
  is_reconciled: boolean
  notes: string | null
  import_batch_id: number | null
  created_at: string
}

interface ViewCheckpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkpointId: number | null
  accountId: number | null
}

export function ViewCheckpointDialog({
  open,
  onOpenChange,
  checkpointId,
  accountId,
}: ViewCheckpointDialogProps) {
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && checkpointId && accountId) {
      fetchCheckpoint()
    }
  }, [open, checkpointId, accountId])

  async function fetchCheckpoint() {
    if (!accountId || !checkpointId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounts/${accountId}/checkpoints`)
      if (!response.ok) {
        throw new Error('Failed to fetch checkpoint')
      }

      const result = await response.json()
      const checkpoints = result.data || []
      const found = checkpoints.find((cp: Checkpoint) => cp.checkpoint_id === checkpointId)

      if (!found) {
        throw new Error('Checkpoint not found')
      }

      setCheckpoint(found)
    } catch (err: any) {
      setError(err.message || 'Failed to load checkpoint')
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Balance Checkpoint Details
          </DialogTitle>
          <DialogDescription>
            Information about this balance checkpoint and adjustment
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900">Error Loading Checkpoint</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : checkpoint ? (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-center">
              {checkpoint.is_reconciled ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 px-4 py-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Fully Reconciled
                </Badge>
              ) : (
                <Badge className="bg-orange-50 text-orange-700 border-orange-200 px-4 py-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Has Discrepancy
                </Badge>
              )}
            </div>

            <div className="border-t my-4"></div>

            {/* Checkpoint Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Checkpoint Date
              </div>
              <p className="text-lg font-semibold">{formatDate(checkpoint.checkpoint_date)}</p>
            </div>

            <div className="border-t my-4"></div>

            {/* Balance Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Balance Summary
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-blue-50 border-blue-200 p-3">
                  <p className="text-xs text-blue-600 font-medium mb-1">Declared Balance</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(checkpoint.declared_balance)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">From statement</p>
                </div>

                <div className="rounded-lg border bg-purple-50 border-purple-200 p-3">
                  <p className="text-xs text-purple-600 font-medium mb-1">Calculated Balance</p>
                  <p className="text-lg font-bold text-purple-900">
                    {formatCurrency(checkpoint.calculated_balance)}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">From transactions</p>
                </div>
              </div>

              {/* Adjustment Amount */}
              {!checkpoint.is_reconciled && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-900">Balance Adjustment</p>
                      <p className="text-xs text-orange-700 mt-1">
                        {checkpoint.adjustment_amount > 0
                          ? "Added as unexplained income"
                          : "Added as unexplained expense"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        checkpoint.adjustment_amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {checkpoint.adjustment_amount > 0 ? '+' : ''}
                        {formatCurrency(checkpoint.adjustment_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {checkpoint.notes && (
              <>
                <div className="border-t my-4"></div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Notes
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {checkpoint.notes}
                  </p>
                </div>
              </>
            )}

            {/* Import Info */}
            {checkpoint.import_batch_id && (
              <>
                <div className="border-t my-4"></div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="secondary">
                    Import Batch #{checkpoint.import_batch_id}
                  </Badge>
                </div>
              </>
            )}

            {/* Created Date */}
            <div className="border-t my-4"></div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Created</span>
              <span>{new Date(checkpoint.created_at).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No checkpoint data available
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
