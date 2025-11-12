"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MainTransactionDetails, TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { Loader2, AlertTriangle, Info } from "lucide-react"
import { getFilteredTransactionTypes, AccountType, TransactionDirection } from "@/lib/transaction-type-rules"

interface EditTransactionDialogProps {
  transaction: MainTransactionDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]
}

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
  transactionTypes,
  categories,
  branches,
  projects,
}: EditTransactionDialogProps) {
  const [loading, setLoading] = useState(false)

  // Initialize formData from transaction if available
  const getInitialFormData = () => ({
    transaction_type_id: transaction?.transaction_type_id?.toString() || "",
    category_id: transaction?.category_id?.toString() || "none",
    branch_id: transaction?.branch_id?.toString() || "none",
    project_id: transaction?.project_id?.toString() || "none",
    description: transaction?.description || "",
    notes: transaction?.notes || "",
  })

  const [formData, setFormData] = useState(getInitialFormData())

  // Reset form when dialog opens or transaction changes
  useEffect(() => {
    if (transaction && open) {
      console.log('EditTransactionDialog - transaction:', {
        project_id: transaction.project_id,
        project_name: transaction.project_name,
        branch_id: transaction.branch_id,
        branch_name: transaction.branch_name
      })
      setFormData({
        transaction_type_id: transaction.transaction_type_id?.toString() || "",
        category_id: transaction.category_id?.toString() || "none",
        branch_id: transaction.branch_id?.toString() || "none",
        project_id: transaction.project_id?.toString() || "none",
        description: transaction.description || "",
        notes: transaction.notes || "",
      })
    }
  }, [transaction, open])

  // Filter transaction types based on account type and direction
  const filteredTransactionTypes = getFilteredTransactionTypes(
    transaction?.account_type as AccountType,
    transaction?.transaction_direction as TransactionDirection,
    transactionTypes
  )

  // Check if transaction is locked (matched or linked to drawdown/loan)
  const isTransactionLocked = !!(
    transaction?.transfer_matched_transaction_id ||
    transaction?.drawdown_id ||
    transaction?.loan_disbursement_id
  )

  // Filter categories by transaction type only
  const currentTypeId = formData.transaction_type_id || transaction?.transaction_type_id?.toString()
  const filteredCategories = categories.filter((cat) => {
    // Must match transaction type
    if (currentTypeId && cat.transaction_type_id.toString() !== currentTypeId) {
      return false
    }
    return true
  })

  // Filter branches by entity
  const filteredBranches = branches.filter((branch) => {
    return branch.entity_id === transaction?.entity_id
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    setLoading(true)
    try {
      const updates: any = {}

      if (formData.transaction_type_id) {
        updates.transaction_type_id = parseInt(formData.transaction_type_id)
      }

      if (formData.category_id && formData.category_id !== "none") {
        updates.category_id = parseInt(formData.category_id)
      } else {
        updates.category_id = null
      }

      if (formData.branch_id && formData.branch_id !== "none") {
        updates.branch_id = parseInt(formData.branch_id)
      } else {
        updates.branch_id = null
      }

      if (formData.project_id && formData.project_id !== "none") {
        updates.project_id = parseInt(formData.project_id)
      } else {
        updates.project_id = null
      }

      updates.description = formData.description || null
      updates.notes = formData.notes || null

      console.log('EditTransactionDialog - Sending updates:', updates)
      console.log('EditTransactionDialog - formData.project_id:', formData.project_id)

      const response = await fetch(`/api/main-transactions/${transaction.main_transaction_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update transaction")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating transaction:", error)
      alert(error instanceof Error ? error.message : "Failed to update transaction")
    } finally {
      setLoading(false)
    }
  }

  // Format amount with direction
  const formatAmount = (amount: number, direction: string) => {
    const formatted = new Intl.NumberFormat("vi-VN").format(amount)
    return direction === "debit" ? `-${formatted}` : `+${formatted}`
  }

  const getDirectionColor = (direction: string) => {
    return direction === "debit" ? "text-red-600" : "text-green-600"
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" key={transaction?.main_transaction_id}>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update transaction type, category, branch, and other details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warnings for locked transactions */}
          {isTransactionLocked && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Warning:</strong> This transaction is linked to other records:
                {transaction.transfer_matched_transaction_id && " • Matched with another transaction"}
                {transaction.drawdown_id && " • Linked to a debt drawdown"}
                {transaction.loan_disbursement_id && " • Linked to a loan disbursement"}
                <br />
                Changing the transaction type may cause issues. Unmatch or unlink first if needed.
              </AlertDescription>
            </Alert>
          )}

          {/* Info about filtered types */}
          {filteredTransactionTypes.length < transactionTypes.length && (
            <Alert variant="default" className="border-blue-500 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Only showing transaction types valid for <strong>{transaction.account_type}</strong> accounts with <strong>{transaction.transaction_direction}</strong> direction.
                ({filteredTransactionTypes.length} of {transactionTypes.length} types available)
              </AlertDescription>
            </Alert>
          )}

          {/* Read-only information */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <p className="text-sm font-medium">
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <p className={`text-sm font-mono font-bold ${getDirectionColor(transaction.transaction_direction)}`}>
                  {formatAmount(transaction.amount, transaction.transaction_direction)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account</Label>
                <p className="text-sm font-medium">{transaction.account_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Entity</Label>
                <p className="text-sm font-medium">{transaction.entity_name}</p>
              </div>
            </div>
            {transaction.is_split && (
              <Badge variant="outline">Split Transaction (Part {transaction.split_sequence})</Badge>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label htmlFor="transaction_type_id">
                Transaction Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.transaction_type_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, transaction_type_id: value, category_id: "none" })
                }}
              >
                <SelectTrigger id="transaction_type_id">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTransactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filtered based on account type ({transaction.account_type}) and direction ({transaction.transaction_direction})
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                disabled={!formData.transaction_type_id}
              >
                <SelectTrigger id="category_id">
                  <SelectValue placeholder={formData.transaction_type_id ? "Select category" : "Select type first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredCategories.length === 0 && formData.transaction_type_id && (
                <p className="text-xs text-muted-foreground">
                  No categories available for this transaction type
                </p>
              )}
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch / Store</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
              >
                <SelectTrigger id="branch_id">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredBranches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label htmlFor="project_id">Project</Label>
              <Select
                value={formData.project_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.filter(p => p.is_active).map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id.toString()}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
