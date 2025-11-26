"use client"

import { useState } from "react"
import { Loader2, AlertTriangle, Unlink } from "lucide-react"
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
import { MainTransactionDetails } from "@/types/main-transaction"
import { formatDate } from "@/lib/account-utils"

interface UnmatchInvestmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

export function UnmatchInvestmentDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: UnmatchInvestmentDialogProps) {
  const [unmatching, setUnmatching] = useState(false)

  const isInvestmentContribution = sourceTransaction?.transaction_type_code === 'INV_CONTRIB'
  const isInvestmentWithdrawal = sourceTransaction?.transaction_type_code === 'INV_WITHDRAW'

  const handleUnmatch = async () => {
    if (!sourceTransaction?.transfer_matched_transaction_id) return

    setUnmatching(true)
    try {
      const response = await fetch(
        `/api/transfers/unmatch/${sourceTransaction.main_transaction_id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to unmatch investment')
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error unmatching investment:", error)
      alert(error instanceof Error ? error.message : "Failed to unmatch investment")
    } finally {
      setUnmatching(false)
    }
  }

  if (!sourceTransaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlink className="h-5 w-5 text-orange-600" />
            Unmatch Investment {isInvestmentContribution ? 'Contribution' : 'Withdrawal'}
          </DialogTitle>
          <DialogDescription>
            This will remove the link between transactions and delete the investment contribution record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">This action will:</div>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Remove the matched link between transactions</li>
                <li>Delete the paired transaction in the investment account</li>
                <li>Keep the source transaction as unmatched</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Transaction Info */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="text-sm font-medium mb-2">Source Transaction</div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Account:</span>{" "}
                <span className="font-medium">{sourceTransaction.account_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span>{" "}
                <span className="font-medium">
                  {new Intl.NumberFormat('vi-VN').format(sourceTransaction.amount)} VND
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium">
                  {formatDate(sourceTransaction.transaction_date)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={unmatching}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleUnmatch}
            disabled={unmatching}
          >
            {unmatching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Unmatch Investment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
