"use client"

import { AlertTriangle } from "lucide-react"
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
import { MainTransactionDetails } from "@/types/main-transaction"

interface DeleteSplitWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  splitTransactions: MainTransactionDetails[]
  onConfirmDelete: () => void
}

export function DeleteSplitWarningDialog({
  open,
  onOpenChange,
  splitTransactions,
  onConfirmDelete,
}: DeleteSplitWarningDialogProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount)
  }

  const totalAmount = splitTransactions.reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Split Transaction
          </DialogTitle>
          <DialogDescription>
            This transaction is part of a split. Deleting it will delete ALL related split transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-900">
              The following {splitTransactions.length} split transactions will be deleted:
            </p>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {splitTransactions.map((tx, index) => (
              <div
                key={tx.main_transaction_id}
                className="p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        Split {index + 1} of {splitTransactions.length}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {tx.transaction_type}
                      {tx.category_name && ` • ${tx.category_name}`}
                    </p>
                    {tx.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {tx.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className={`font-mono font-medium ${
                      tx.transaction_direction === 'debit'
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {tx.transaction_direction === 'debit' ? '-' : '+'}
                      {formatAmount(tx.amount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Amount:</span>
              <span className="font-mono font-bold text-lg">
                {formatAmount(totalAmount)}
              </span>
            </div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">
              <strong>Warning:</strong> This action cannot be undone. The original transaction
              will be permanently deleted along with all {splitTransactions.length} split transactions.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirmDelete()
              onOpenChange(false)
            }}
          >
            Delete All {splitTransactions.length} Splits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
