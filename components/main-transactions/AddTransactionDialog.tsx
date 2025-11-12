"use client"

import { useState, useEffect } from "react"
import { Loader2, Plus } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { getFilteredTransactionTypes, AccountType, TransactionDirection } from "@/lib/transaction-type-rules"

interface Account {
  account_id: number
  account_name: string
  account_type: string
  bank_name?: string
  entity_id: string
}

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]
  onSuccess: () => void
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  accounts,
  transactionTypes,
  categories,
  branches,
  projects,
  onSuccess,
}: AddTransactionDialogProps) {
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    account_id: "",
    transaction_date: "",
    transaction_type_id: "",
    category_id: "",
    branch_id: "",
    project_id: "",
    amount: "",
    description: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [transactionDirection, setTransactionDirection] = useState<TransactionDirection>("debit")

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      const now = new Date()
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)

      setFormData({
        account_id: "",
        transaction_date: localDateTime,
        transaction_type_id: "",
        category_id: "",
        branch_id: "",
        project_id: "",
        amount: "",
        description: "",
      })
      setErrors({})
      setSelectedAccount(null)
      setTransactionDirection("debit")
    }
  }, [open])

  // Update selected account when account_id changes
  useEffect(() => {
    if (formData.account_id) {
      const account = accounts.find(a => a.account_id.toString() === formData.account_id)
      setSelectedAccount(account || null)
    } else {
      setSelectedAccount(null)
    }
  }, [formData.account_id, accounts])

  // Get filtered transaction types based on account type and direction
  const filteredTransactionTypes = selectedAccount
    ? getFilteredTransactionTypes(
        selectedAccount.account_type as AccountType,
        transactionDirection,
        transactionTypes
      )
    : []

  // Get filtered categories based on selected transaction type
  const selectedTransactionType = transactionTypes.find(
    t => t.transaction_type_id.toString() === formData.transaction_type_id
  )

  // Categories are filtered by transaction_type_id
  // For types like CC_CHARGE that share categories with EXP, we need to look up by type_code
  const filteredCategories = categories.filter(cat => {
    if (!selectedTransactionType) return false

    // Direct match by transaction_type_id
    if (cat.transaction_type_id === selectedTransactionType.transaction_type_id) {
      return true
    }

    // For CC_CHARGE, also show EXP categories (they share the same categories)
    if (selectedTransactionType.type_code === 'CC_CHARGE') {
      const expType = transactionTypes.find(t => t.type_code === 'EXP')
      if (expType && cat.transaction_type_id === expType.transaction_type_id) {
        return true
      }
    }

    return false
  })

  // Check if category is required (Income and Expense transactions require categories)
  const isCategoryRequired = selectedTransactionType?.type_code === 'INC' || selectedTransactionType?.type_code === 'EXP'

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!formData.account_id) {
      newErrors.account_id = "Please select an account"
    }
    if (!formData.transaction_date) {
      newErrors.transaction_date = "Transaction date is required"
    }
    if (!formData.transaction_type_id) {
      newErrors.transaction_type_id = "Please select a transaction type"
    }
    if (isCategoryRequired && !formData.category_id) {
      newErrors.category_id = "Category is required for this transaction type"
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

      const amountValue = parseFloat(formData.amount)

      // Use the optimized endpoint that handles all steps in one request
      const transactionData: any = {
        account_id: parseInt(formData.account_id),
        transaction_date: new Date(formData.transaction_date).toISOString(),
        description: formData.description || null,
        transaction_source: 'user_manual',
        transaction_type_id: parseInt(formData.transaction_type_id),
      }

      // Set debit or credit based on direction
      if (transactionDirection === 'debit') {
        transactionData.debit_amount = amountValue
      } else {
        transactionData.credit_amount = amountValue
      }

      // Add optional fields
      if (formData.category_id) {
        transactionData.category_id = parseInt(formData.category_id)
      }

      if (formData.branch_id) {
        transactionData.branch_id = parseInt(formData.branch_id)
      }

      if (formData.project_id) {
        transactionData.project_id = parseInt(formData.project_id)
      }

      const createResponse = await fetch('/api/main-transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create transaction')
      }

      // Success!
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating transaction:', error)
      alert(error instanceof Error ? error.message : 'Failed to create transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Transaction
          </DialogTitle>
          <DialogDescription>
            Create a new transaction with proper categorization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account_id">
              Account <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => {
                setFormData({ ...formData, account_id: value, transaction_type_id: "" })
              }}
            >
              <SelectTrigger id="account_id" className={errors.account_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id.toString()}>
                    {account.account_name} {account.bank_name && `(${account.bank_name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.account_id && (
              <p className="text-sm text-red-500">{errors.account_id}</p>
            )}
          </div>

          {/* Date-Time */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date">
              Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="transaction_date"
              type="datetime-local"
              value={formData.transaction_date}
              onChange={(e) =>
                setFormData({ ...formData, transaction_date: e.target.value })
              }
              className={errors.transaction_date ? "border-red-500" : ""}
            />
            {errors.transaction_date && (
              <p className="text-sm text-red-500">{errors.transaction_date}</p>
            )}
          </div>

          {/* Transaction Direction */}
          {selectedAccount && (
            <div className="space-y-2">
              <Label>Transaction Direction <span className="text-red-500">*</span></Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    value="debit"
                    checked={transactionDirection === "debit"}
                    onChange={(e) => {
                      setTransactionDirection(e.target.value as TransactionDirection)
                      setFormData({ ...formData, transaction_type_id: "" })
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    Debit <span className="text-red-600">(Money Out)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    value="credit"
                    checked={transactionDirection === "credit"}
                    onChange={(e) => {
                      setTransactionDirection(e.target.value as TransactionDirection)
                      setFormData({ ...formData, transaction_type_id: "" })
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    Credit <span className="text-green-600">(Money In)</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Transaction Type */}
          {selectedAccount && (
            <div className="space-y-2">
              <Label htmlFor="transaction_type_id">
                Transaction Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.transaction_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, transaction_type_id: value, category_id: "" })
                }
              >
                <SelectTrigger id="transaction_type_id" className={errors.transaction_type_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTransactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.transaction_type_id && (
                <p className="text-sm text-red-500">{errors.transaction_type_id}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Category */}
          {formData.transaction_type_id && (
            <div className="space-y-2">
              <Label htmlFor="category_id">
                Category {isCategoryRequired && <span className="text-red-500">*</span>}
              </Label>
              <Select
                value={formData.category_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="category_id" className={errors.category_id ? "border-red-500" : ""}>
                  <SelectValue placeholder={isCategoryRequired ? "Select category" : "None (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {!isCategoryRequired && (
                    <SelectItem value="none">None</SelectItem>
                  )}
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-sm text-red-500">{errors.category_id}</p>
              )}
            </div>
          )}

          {/* Branch (Optional) */}
          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch (optional)</Label>
              <Select
                value={formData.branch_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, branch_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="branch_id">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project (Optional) */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="project_id">Project (optional)</Label>
              <Select
                value={formData.project_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, project_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id.toString()}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter transaction description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Creating...' : 'Add Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
