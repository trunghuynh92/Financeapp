"use client"

import { useState, useEffect } from "react"
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/account-utils"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
  entity_id: string
}

interface QuickMatchInvestmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: MainTransactionDetails | null
  onSuccess: () => void
}

export function QuickMatchInvestmentDialog({
  open,
  onOpenChange,
  sourceTransaction,
  onSuccess,
}: QuickMatchInvestmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [investmentAccounts, setInvestmentAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const isInvestmentContribution = sourceTransaction?.transaction_type_code === 'INV_CONTRIB'
  const isInvestmentWithdrawal = sourceTransaction?.transaction_type_code === 'INV_WITHDRAW'

  useEffect(() => {
    if (open && sourceTransaction) {
      fetchInvestmentAccounts()
    }
  }, [open, sourceTransaction])

  const fetchInvestmentAccounts = async () => {
    if (!sourceTransaction) return

    setLoading(true)
    try {
      const response = await fetch(`/api/accounts?entity_id=${sourceTransaction.entity_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch investment accounts")
      }

      const data = await response.json()

      // Filter to investment accounts only
      const filtered = (data.data || []).filter((acc: Account) =>
        acc.account_type === 'investment'
      )

      setInvestmentAccounts(filtered)
    } catch (error) {
      console.error("Error fetching investment accounts:", error)
      alert("Failed to load investment accounts")
    } finally {
      setLoading(false)
    }
  }

  const handleMatch = async () => {
    if (!sourceTransaction || !selectedAccountId) return

    setMatching(true)
    try {
      const investmentAccountId = parseInt(selectedAccountId)

      // Step 1: Get the correct transaction type ID
      const transactionTypeCode = isInvestmentWithdrawal ? 'INV_WITHDRAW' : 'INV_CONTRIB'
      const typesResponse = await fetch('/api/transaction-types')
      const typesData = await typesResponse.json()
      const types = typesData.data || typesData
      const transactionType = types.find((t: any) => t.type_code === transactionTypeCode)

      if (!transactionType) {
        throw new Error(`Transaction type ${transactionTypeCode} not found`)
      }

      // Step 2: Create paired transaction in investment account (via original_transaction)
      // The SQL trigger will automatically create the main_transaction
      // Determine amounts: contribution = credit to investment, withdrawal = debit from investment
      const debitAmount = isInvestmentWithdrawal ? sourceTransaction.amount : null
      const creditAmount = isInvestmentWithdrawal ? null : sourceTransaction.amount

      const createResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: investmentAccountId,
          transaction_date: sourceTransaction.transaction_date,
          description: sourceTransaction.description || (isInvestmentWithdrawal ? 'Investment withdrawal' : 'Investment contribution'),
          debit_amount: debitAmount,
          credit_amount: creditAmount,
          transaction_source: 'user_manual',
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create paired transaction')
      }

      const createData = await createResponse.json()

      // Step 3: Get the main_transaction_id from the created original_transaction
      const mainTxResponse = await fetch(`/api/main-transactions?raw_transaction_id=${createData.raw_transaction_id}`)
      const mainTxData = await mainTxResponse.json()
      const pairedTransactionId = mainTxData.data?.[0]?.main_transaction_id

      if (!pairedTransactionId) {
        throw new Error('Failed to get paired main transaction ID')
      }

      // Step 4: Update the transaction type to INV_CONTRIB or INV_WITHDRAW
      const updateResponse = await fetch(`/api/main-transactions/${pairedTransactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type_id: transactionType.transaction_type_id,
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || 'Failed to update transaction type')
      }

      // Step 5: Match the two transactions using transfer matching
      const matchResponse = await fetch('/api/transfers/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_out_id: sourceTransaction.main_transaction_id,
          transfer_in_id: pairedTransactionId,
        }),
      })

      if (!matchResponse.ok) {
        const errorData = await matchResponse.json()
        throw new Error(errorData.error || 'Failed to match transactions')
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error matching investment:", error)
      alert(error instanceof Error ? error.message : "Failed to match investment")
    } finally {
      setMatching(false)
    }
  }

  if (!sourceTransaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Match Investment {isInvestmentContribution ? 'Contribution' : 'Withdrawal'}
          </DialogTitle>
          <DialogDescription>
            Link this transaction to an investment account to create the paired transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Transaction Info */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="text-sm font-medium mb-2">Source Transaction</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
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
              <div>
                <span className="text-muted-foreground">Direction:</span>{" "}
                <Badge variant={sourceTransaction.transaction_direction === 'debit' ? 'destructive' : 'default'}>
                  {sourceTransaction.transaction_direction === 'debit' ? 'Money Out' : 'Money In'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Investment Account Selection */}
          <div className="space-y-3">
            <Label>Select Investment Account</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : investmentAccounts.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-900">No investment accounts found</div>
                  <div className="text-sm text-amber-700 mt-1">
                    Create an investment account first to match this transaction.
                  </div>
                </div>
              </div>
            ) : (
              <RadioGroup value={selectedAccountId || ""} onValueChange={setSelectedAccountId}>
                <div className="space-y-2">
                  {investmentAccounts.map((account) => (
                    <div
                      key={account.account_id}
                      className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer"
                      onClick={() => setSelectedAccountId(account.account_id.toString())}
                    >
                      <RadioGroupItem value={account.account_id.toString()} id={`account-${account.account_id}`} />
                      <Label
                        htmlFor={`account-${account.account_id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{account.account_name}</div>
                        {account.bank_name && (
                          <div className="text-sm text-muted-foreground">{account.bank_name}</div>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
          </div>

          {/* Help Text */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            <div className="font-medium mb-1">What happens when you match:</div>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>A paired transaction will be created in the selected investment account</li>
              <li>Both transactions will be linked together</li>
              <li>Green &quot;Matched Investment&quot; badges will appear on both</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={matching}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMatch}
            disabled={!selectedAccountId || matching || investmentAccounts.length === 0}
          >
            {matching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Matched Investment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
