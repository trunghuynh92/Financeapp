"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
}

interface Transaction {
  raw_transaction_id: string
  account_id: number
  transaction_date: string
  description: string | null
  debit_amount: number | null
  credit_amount: number | null
  balance: number | null
  bank_reference: string | null
  transaction_source: 'imported_bank' | 'user_manual' | 'system_opening' | 'auto_adjustment'
}

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  accounts: Account[]
  onSuccess: () => void
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  onSuccess,
}: TransactionFormDialogProps) {
  const isEditing = !!transaction

  const [loading, setLoading] = useState(false)
  const [transactionType, setTransactionType] = useState<'debit' | 'credit'>('debit')

  const [formData, setFormData] = useState({
    account_id: "",
    transaction_date: "",
    description: "",
    amount: "",
    balance: "",
    bank_reference: "",
    transaction_source: "user_manual",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (transaction) {
        // Populate form for editing
        const type = transaction.debit_amount ? 'debit' : 'credit'
        const amount = transaction.debit_amount || transaction.credit_amount || 0

        setTransactionType(type)
        setFormData({
          account_id: transaction.account_id.toString(),
          transaction_date: transaction.transaction_date.split('T')[0],
          description: transaction.description || "",
          amount: amount.toString(),
          balance: transaction.balance?.toString() || "",
          bank_reference: transaction.bank_reference || "",
          transaction_source: transaction.transaction_source,
        })
      } else {
        // Reset form for adding
        setTransactionType('debit')
        setFormData({
          account_id: "",
          transaction_date: new Date().toISOString().split('T')[0],
          description: "",
          amount: "",
          balance: "",
          bank_reference: "",
          transaction_source: "user_manual",
        })
      }
      setErrors({})
    }
  }, [open, transaction])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!formData.account_id) {
      newErrors.account_id = "Please select an account"
    }
    if (!formData.transaction_date) {
      newErrors.transaction_date = "Transaction date is required"
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    try {
      setLoading(true)

      const requestData: any = {
        account_id: parseInt(formData.account_id),
        transaction_date: new Date(formData.transaction_date).toISOString(),
        description: formData.description || null,
        balance: formData.balance ? parseFloat(formData.balance) : null,
        bank_reference: formData.bank_reference || null,
        transaction_source: formData.transaction_source,
      }

      // Set debit or credit based on transaction type
      if (transactionType === 'debit') {
        requestData.debit_amount = parseFloat(formData.amount)
        requestData.credit_amount = null
      } else {
        requestData.credit_amount = parseFloat(formData.amount)
        requestData.debit_amount = null
      }

      if (isEditing) {
        // Update existing transaction
        const response = await fetch(`/api/transactions/${transaction!.raw_transaction_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update transaction")
        }
      } else {
        // Create new transaction
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create transaction")
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error saving transaction:", error)
      alert(error.message || "Failed to save transaction. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Transaction" : "Add New Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update transaction details" : "Create a new manual transaction"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account">Account *</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger id="account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id.toString()}>
                    {account.account_name} {account.bank_name ? `(${account.bank_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.account_id && (
              <p className="text-sm text-destructive">{errors.account_id}</p>
            )}
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Transaction Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            />
            {errors.transaction_date && (
              <p className="text-sm text-destructive">{errors.transaction_date}</p>
            )}
          </div>

          {/* Transaction Type (Debit/Credit) */}
          <div className="space-y-2">
            <Label>Transaction Type *</Label>
            <RadioGroup
              value={transactionType}
              onValueChange={(value: 'debit' | 'credit') => setTransactionType(value)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="debit"
                  id="debit"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="debit"
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted p-4 cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                >
                  <span className="text-2xl mb-2">↑</span>
                  <span className="font-medium">Debit (Money Out)</span>
                  <span className="text-xs text-muted-foreground mt-1">Payments, withdrawals</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="credit"
                  id="credit"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="credit"
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted p-4 cursor-pointer hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                >
                  <span className="text-2xl mb-2">↓</span>
                  <span className="font-medium">Credit (Money In)</span>
                  <span className="text-xs text-muted-foreground mt-1">Deposits, income</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Transaction description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Balance (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="balance">Balance After Transaction (Optional)</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              The account balance after this transaction
            </p>
          </div>

          {/* Bank Reference (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="bank_reference">Bank Reference (Optional)</Label>
            <Input
              id="bank_reference"
              placeholder="Reference number"
              value={formData.bank_reference}
              onChange={(e) => setFormData({ ...formData, bank_reference: e.target.value })}
              maxLength={100}
            />
          </div>

          {/* Transaction Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Transaction Source</Label>
            <Select
              value={formData.transaction_source}
              onValueChange={(value) => setFormData({ ...formData, transaction_source: value })}
            >
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_manual">Manual Entry</SelectItem>
                <SelectItem value="imported_bank">Imported from Bank</SelectItem>
                <SelectItem value="system_opening">Opening Balance</SelectItem>
                <SelectItem value="auto_adjustment">Auto Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{isEditing ? "Update Transaction" : "Create Transaction"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
