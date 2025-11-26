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
import { Loader2, AlertTriangle, Info, Link } from "lucide-react"
import { getFilteredTransactionTypes, AccountType, TransactionDirection } from "@/lib/transaction-type-rules"
import { SelectDrawdownDialog } from "./SelectDrawdownDialog"
import { useEntity } from "@/contexts/EntityContext"

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
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [drawdownDialogOpen, setDrawdownDialogOpen] = useState(false)
  const [selectedDrawdown, setSelectedDrawdown] = useState<any>(null)
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([])
  const [allAccounts, setAllAccounts] = useState<any[]>([])

  // Initialize formData from transaction if available
  const getInitialFormData = () => ({
    transaction_type_id: transaction?.transaction_type_id?.toString() || "",
    category_id: transaction?.category_id?.toString() || "none",
    branch_id: transaction?.branch_id?.toString() || "none",
    project_id: transaction?.project_id?.toString() || "none",
    description: transaction?.description || "",
    notes: transaction?.notes || "",
    drawdown_id: transaction?.drawdown_id?.toString() || "none",
    investment_account_id: transaction?.investment_contribution_id?.toString() || "none",
    // Manual transaction editable fields
    transaction_date: transaction?.transaction_date || "",
    amount: transaction?.amount?.toString() || "",
    account_id: transaction?.account_id?.toString() || "",
  })

  const [formData, setFormData] = useState(getInitialFormData())

  // Reset form when dialog opens or transaction changes
  useEffect(() => {
    if (transaction && open) {
      console.log('EditTransactionDialog - transaction:', {
        project_id: transaction.project_id,
        project_name: transaction.project_name,
        branch_id: transaction.branch_id,
        branch_name: transaction.branch_name,
        drawdown_id: transaction.drawdown_id,
        import_batch_id: transaction.import_batch_id
      })
      setFormData({
        transaction_type_id: transaction.transaction_type_id?.toString() || "",
        category_id: transaction.category_id?.toString() || "none",
        branch_id: transaction.branch_id?.toString() || "none",
        project_id: transaction.project_id?.toString() || "none",
        description: transaction.description || "",
        notes: transaction.notes || "",
        drawdown_id: transaction.drawdown_id?.toString() || "none",
        investment_account_id: transaction.investment_contribution_id?.toString() || "none",
        transaction_date: transaction.transaction_date || "",
        amount: transaction.amount?.toString() || "",
        account_id: transaction.account_id?.toString() || "",
      })
      setSelectedDrawdown(null) // Reset selected drawdown

      // Fetch investment accounts when dialog opens
      if (currentEntity) {
        fetchInvestmentAccounts()
      }
    }
  }, [transaction, open])

  // Filter transaction types based on account type and direction
  const filteredTransactionTypes = transaction?.account_type && transaction?.transaction_direction
    ? getFilteredTransactionTypes(
        transaction.account_type as AccountType,
        transaction.transaction_direction as TransactionDirection,
        transactionTypes
      )
    : transactionTypes

  // Check if transaction is manual (not imported)
  const isManualTransaction = transaction?.import_batch_id === null || transaction?.import_batch_id === undefined

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

  // Fetch investment accounts
  async function fetchInvestmentAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        const accounts = data.data || []
        const investAccs = accounts.filter((acc: any) => acc.account_type === 'investment')
        setInvestmentAccounts(investAccs)
        setAllAccounts(accounts) // Store all accounts for manual transaction editing
      }
    } catch (error) {
      console.error('Error fetching investment accounts:', error)
    }
  }

  // Check if this is investment contribution or withdrawal
  const selectedType = transactionTypes.find(t => t.transaction_type_id.toString() === formData.transaction_type_id)
  const isInvestmentContribution = selectedType?.type_code === 'INV_CONTRIB'
  const isInvestmentWithdrawal = selectedType?.type_code === 'INV_WITHDRAW'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    setLoading(true)
    try {
      // Handle investment contribution/withdrawal with investment account selected
      if ((isInvestmentContribution || isInvestmentWithdrawal) &&
          formData.investment_account_id &&
          formData.investment_account_id !== "none") {

        const investmentData = {
          source_account_id: transaction.account_id,
          investment_account_id: parseInt(formData.investment_account_id),
          contribution_amount: transaction.amount,
          contribution_date: transaction.transaction_date,
          notes: formData.description || formData.notes || null,
          existing_source_transaction_id: transaction.main_transaction_id,
        }

        const response = await fetch('/api/investment-contributions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(investmentData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create investment contribution')
        }

        onSuccess()
        onOpenChange(false)
        return
      }

      // Regular transaction update
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

      if (formData.drawdown_id && formData.drawdown_id !== "none") {
        updates.drawdown_id = parseInt(formData.drawdown_id)
      } else {
        updates.drawdown_id = null
      }

      updates.description = formData.description || null
      updates.notes = formData.notes || null

      // For manual transactions, include editable fields
      if (isManualTransaction) {
        if (formData.transaction_date) {
          updates.transaction_date = formData.transaction_date
        }
        if (formData.amount) {
          updates.amount = parseFloat(formData.amount)
        }
        if (formData.account_id && formData.account_id !== transaction.account_id?.toString()) {
          updates.account_id = parseInt(formData.account_id)
        }
      }

      console.log('EditTransactionDialog - Sending updates:', updates)
      console.log('EditTransactionDialog - formData.project_id:', formData.project_id)
      console.log('EditTransactionDialog - isManualTransaction:', isManualTransaction)

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

          {/* Transaction basic info - editable for manual, read-only for imported */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Date {isManualTransaction && <span className="text-red-500">*</span>}
                </Label>
                {isManualTransaction ? (
                  <Input
                    type="date"
                    value={formData.transaction_date.split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Amount {isManualTransaction && <span className="text-red-500">*</span>}
                </Label>
                {isManualTransaction ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className={`text-sm font-mono font-bold ${getDirectionColor(transaction.transaction_direction)}`}>
                    {formatAmount(transaction.amount, transaction.transaction_direction)}
                  </p>
                )}
              </div>

              {/* Account */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Account {isManualTransaction && <span className="text-red-500">*</span>}
                </Label>
                {isManualTransaction ? (
                  <Select
                    value={formData.account_id}
                    onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {allAccounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id.toString()}>
                          {account.account_name} ({account.account_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{transaction.account_name}</p>
                )}
              </div>

              {/* Entity - always read-only */}
              <div>
                <Label className="text-xs text-muted-foreground">Entity</Label>
                <p className="text-sm font-medium">{transaction.entity_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {transaction.is_split && (
                <Badge variant="outline">Split Transaction (Part {transaction.split_sequence})</Badge>
              )}
              {!isManualTransaction && (
                <Badge variant="secondary">Imported Transaction</Badge>
              )}
              {isManualTransaction && (
                <Badge variant="default">Manual Transaction</Badge>
              )}
            </div>
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

            {/* Investment Account Selection (for INV_CONTRIB and INV_WITHDRAW) */}
            {(isInvestmentContribution || isInvestmentWithdrawal) && (
              <div className="space-y-2">
                <Label htmlFor="investment_account_id">Investment Account</Label>
                <Select
                  value={formData.investment_account_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, investment_account_id: value })
                  }
                >
                  <SelectTrigger id="investment_account_id">
                    <SelectValue placeholder="Select investment account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {investmentAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isInvestmentContribution
                    ? "Select which investment account is receiving the funds"
                    : "Select which investment account is being withdrawn from"}
                </p>
                {investmentAccounts.length === 0 && (
                  <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                    No investment accounts found.
                  </p>
                )}
              </div>
            )}

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

              {/* Show drawdown link badge when Interest Payment is selected */}
              {(() => {
                const selectedCategory = categories.find(c => c.category_id.toString() === formData.category_id)
                return selectedCategory?.category_code === 'INTEREST_PAY' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setDrawdownDialogOpen(true)}
                    >
                      <Link className="h-3 w-3 mr-1" />
                      {formData.drawdown_id !== "none" ? "Change Debt Drawdown" : "Link to Debt Drawdown"}
                    </Badge>
                    {formData.drawdown_id !== "none" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, drawdown_id: "none" })}
                        className="h-6 px-2"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )
              })()}
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

      {/* Drawdown Selection Dialog for Interest Payments */}
      {transaction && transaction.account_id && (
        <SelectDrawdownDialog
          open={drawdownDialogOpen}
          onOpenChange={setDrawdownDialogOpen}
          accountId={transaction.account_id}
          onSelectDrawdown={(drawdown) => {
            setSelectedDrawdown(drawdown)
            setFormData({ ...formData, drawdown_id: drawdown.drawdown_id.toString() })
            setDrawdownDialogOpen(false)
          }}
        />
      )}
    </Dialog>
  )
}
