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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TransactionType, Category, Branch, Project, MainTransactionDetails } from "@/types/main-transaction"

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: Set<number>
  selectedTransactions: MainTransactionDetails[]
  onSuccess: () => void
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]
}

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedIds,
  selectedTransactions,
  onSuccess,
  transactionTypes,
  categories,
  branches,
  projects,
}: BulkEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    transaction_type_id: "unchanged",
    category_id: "unchanged",
    branch_id: "unchanged",
    project_id: "unchanged",
  })

  // Determine if all selected transactions are credit or debit
  const allCredit = selectedTransactions.every(tx => tx.transaction_direction === 'credit')
  const allDebit = selectedTransactions.every(tx => tx.transaction_direction === 'debit')
  const isMixed = !allCredit && !allDebit

  // Credit transaction type codes (money IN)
  const creditTypeCodes = ['INC', 'TRF_IN', 'DEBT_TAKE', 'LOAN_COLLECT', 'INV_WITHDRAW', 'CC_PAY', 'CAPITAL_IN']

  // Debit transaction type codes (money OUT)
  const debitTypeCodes = ['EXP', 'TRF_OUT', 'DEBT_PAY', 'LOAN_DISBURSE', 'CC_CHARGE', 'INV_CONTRIB', 'CAPITAL_OUT', 'DIVIDEND']

  // Filter transaction types based on selection
  const filteredTransactionTypes = isMixed
    ? [] // Don't allow any type selection for mixed transactions
    : allCredit
      ? transactionTypes.filter(t => creditTypeCodes.includes(t.type_code))
      : allDebit
        ? transactionTypes.filter(t => debitTypeCodes.includes(t.type_code))
        : transactionTypes

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        transaction_type_id: "unchanged",
        category_id: "unchanged",
        branch_id: "unchanged",
        project_id: "unchanged",
      })
    }
  }, [open])

  const handleSubmit = async () => {
    try {
      setLoading(true)

      // Prepare updates object with only fields that should change
      const updates: any = {}

      if (formData.transaction_type_id !== "unchanged") {
        updates.transaction_type_id = parseInt(formData.transaction_type_id)
        // Reset category when type changes
        updates.category_id = null
      }

      if (formData.category_id !== "unchanged") {
        if (formData.category_id === "none") {
          updates.category_id = null
        } else {
          updates.category_id = parseInt(formData.category_id)
        }
      }

      if (formData.branch_id !== "unchanged") {
        if (formData.branch_id === "none") {
          updates.branch_id = null
        } else {
          updates.branch_id = parseInt(formData.branch_id)
        }
      }

      if (formData.project_id !== "unchanged") {
        if (formData.project_id === "none") {
          updates.project_id = null
        } else {
          updates.project_id = parseInt(formData.project_id)
        }
      }

      // Only proceed if there are changes to make
      if (Object.keys(updates).length === 0) {
        alert("No changes selected. Please select at least one field to update.")
        return
      }

      // Update each selected transaction
      const updatePromises = Array.from(selectedIds).map(async (id) => {
        const response = await fetch(`/api/main-transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Failed to update transaction ${id}: ${error.error}`)
        }

        return response.json()
      })

      await Promise.all(updatePromises)

      alert(`Successfully updated ${selectedIds.size} transaction(s)`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error updating transactions:", error)
      alert(error.message || "Failed to update transactions. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Edit Transactions</DialogTitle>
          <DialogDescription>
            Update {selectedIds.size} selected transaction(s). Only fields set to a value will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning for mixed selection */}
          {isMixed && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm text-yellow-800">
                <strong>Mixed Selection:</strong> You have selected both credit (money in) and debit (money out) transactions.
                Transaction type editing is disabled. Please select only credit or only debit transactions to change their type.
              </p>
            </div>
          )}

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="bulk-type">Transaction Type</Label>
            <Select
              value={formData.transaction_type_id}
              onValueChange={(value) => {
                setFormData({
                  ...formData,
                  transaction_type_id: value,
                  // Reset category when type changes
                  category_id: value !== "unchanged" ? "unchanged" : formData.category_id
                })
              }}
              disabled={isMixed}
            >
              <SelectTrigger id="bulk-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">
                  <span className="text-muted-foreground">- No Change -</span>
                </SelectItem>
                {filteredTransactionTypes.map((type) => (
                  <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                    {type.type_display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isMixed
                ? "Transaction type editing disabled for mixed credit/debit selection"
                : allCredit
                  ? "Only credit (money in) transaction types available"
                  : allDebit
                    ? "Only debit (money out) transaction types available"
                    : "Leave as \"No Change\" to keep existing values"
              }
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="bulk-category">Category</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              disabled={formData.transaction_type_id === "unchanged"}
            >
              <SelectTrigger id="bulk-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">
                  <span className="text-muted-foreground">- No Change -</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (Clear category)</span>
                </SelectItem>
                {formData.transaction_type_id !== "unchanged" &&
                  categories
                    .filter(cat => cat.transaction_type_id === parseInt(formData.transaction_type_id))
                    .map((category) => (
                      <SelectItem key={category.category_id} value={category.category_id.toString()}>
                        {category.category_name}
                      </SelectItem>
                    ))
                }
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.transaction_type_id === "unchanged"
                ? "Select a transaction type first to enable category selection"
                : "Leave as \"No Change\" to keep existing values"
              }
            </p>
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label htmlFor="bulk-branch">Branch</Label>
            <Select
              value={formData.branch_id}
              onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
            >
              <SelectTrigger id="bulk-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">
                  <span className="text-muted-foreground">- No Change -</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (Clear branch)</span>
                </SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                    {branch.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave as &quot;No Change&quot; to keep existing values
            </p>
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="bulk-project">Project</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => setFormData({ ...formData, project_id: value })}
            >
              <SelectTrigger id="bulk-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">
                  <span className="text-muted-foreground">- No Change -</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (Clear project)</span>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.project_id} value={project.project_id.toString()}>
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave as &quot;No Change&quot; to keep existing values
            </p>
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
                Updating {selectedIds.size} transaction(s)...
              </>
            ) : (
              <>Update {selectedIds.size} Transaction(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
