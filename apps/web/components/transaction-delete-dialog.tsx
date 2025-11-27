"use client"

import { useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
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
import { Button } from "@/components/ui/button"

interface Transaction {
  raw_transaction_id: string
  description: string | null
  debit_amount: number | null
  credit_amount: number | null
  is_balance_adjustment?: boolean
  checkpoint_id?: number
}

interface TransactionDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  onSuccess: () => void
}

export function TransactionDeleteDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: TransactionDeleteDialogProps) {
  const [loading, setLoading] = useState(false)
  const isBalanceAdjustment = transaction?.is_balance_adjustment === true

  async function handleDelete() {
    if (!transaction) return

    // Prevent deletion of balance adjustment transactions
    if (isBalanceAdjustment) {
      alert("Cannot delete balance adjustment transactions. Please delete the associated checkpoint instead.")
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/transactions/${transaction.raw_transaction_id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || "Failed to delete transaction")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error deleting transaction:", error)
      alert(error.message || "Failed to delete transaction. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—"
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  const getTransactionAmount = () => {
    if (transaction?.debit_amount) {
      return `Debit: ${formatCurrency(transaction.debit_amount)}`
    } else if (transaction?.credit_amount) {
      return `Credit: ${formatCurrency(transaction.credit_amount)}`
    }
    return ''
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3 space-y-2">
            {isBalanceAdjustment ? (
              <>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm text-orange-700 font-medium mb-1">
                    System-Generated Balance Adjustment
                  </p>
                  <p className="text-sm text-orange-700">
                    This transaction was automatically created by the checkpoint system and cannot be deleted directly.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    <strong>To remove this adjustment:</strong> Delete the associated checkpoint instead.
                  </p>
                </div>
                {transaction && (
                  <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                    {transaction.description && (
                      <p className="font-medium">{transaction.description}</p>
                    )}
                    <p className="text-muted-foreground">{getTransactionAmount()}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>
                  Are you sure you want to delete this transaction?
                </p>
                {transaction && (
                  <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                    {transaction.description && (
                      <p className="font-medium">{transaction.description}</p>
                    )}
                    <p className="text-muted-foreground">{getTransactionAmount()}</p>
                  </div>
                )}
                <p className="text-destructive font-medium">
                  This action cannot be undone.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {isBalanceAdjustment ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!isBalanceAdjustment && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Transaction"
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
