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
import { Card } from "@/components/ui/card"
import { MainTransactionDetails, TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/account-utils"

interface SplitItem {
  id: string
  amount: string
  transaction_type_id: string
  category_id: string
  branch_id: string
  project_id: string
  description: string
  notes: string
}

interface SplitTransactionDialogProps {
  transaction: MainTransactionDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]
}

export function SplitTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
  transactionTypes,
  categories,
  branches,
  projects,
}: SplitTransactionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [splits, setSplits] = useState<SplitItem[]>([])
  const [error, setError] = useState<string>("")
  const [originalAmount, setOriginalAmount] = useState<number>(0)

  const fetchExistingSplits = async () => {
    if (!transaction) return

    try {
      // Fetch all main transactions with this raw_transaction_id
      const response = await fetch(`/api/main-transactions?raw_transaction_id=${transaction.raw_transaction_id}`)
      const data = await response.json()

      // Filter and sort splits for this raw_transaction_id
      const existingSplits = data.data
        .filter((tx: MainTransactionDetails) => tx.raw_transaction_id === transaction.raw_transaction_id && tx.is_split)
        .sort((a: MainTransactionDetails, b: MainTransactionDetails) => a.split_sequence - b.split_sequence)

      if (existingSplits.length > 0) {
        // Calculate total original amount from all splits
        const totalAmount = existingSplits.reduce((sum: number, split: MainTransactionDetails) => sum + split.amount, 0)
        setOriginalAmount(totalAmount)

        const loadedSplits = existingSplits.map((split: MainTransactionDetails, index: number) => ({
          id: `split-${index}`,
          amount: split.amount.toString(),
          transaction_type_id: split.transaction_type_id.toString(),
          category_id: split.category_id?.toString() || "none",
          branch_id: split.branch_id?.toString() || "none",
          project_id: split.project_id?.toString() || "none",
          description: split.description || "",
          notes: split.notes || "",
        }))

        // Auto-calculate last split amount to ensure accuracy
        if (loadedSplits.length >= 2) {
          const lastIndex = loadedSplits.length - 1
          const sumOfOthers = loadedSplits
            .slice(0, lastIndex)
            .reduce((sum: number, split: SplitItem) => sum + (parseFloat(split.amount) || 0), 0)

          const remaining = totalAmount - sumOfOthers
          loadedSplits[lastIndex].amount = Math.max(0, remaining).toFixed(2)
        }

        setSplits(loadedSplits)
      } else {
        initializeNewSplits()
      }
    } catch (error) {
      console.error('Error fetching existing splits:', error)
      initializeNewSplits()
    }
  }

  const initializeNewSplits = () => {
    if (!transaction) return

    const halfAmount = (transaction.amount / 2).toFixed(2)
    setSplits([
      {
        id: "split-1",
        amount: halfAmount,
        transaction_type_id: transaction.transaction_type_id.toString(),
        category_id: transaction.category_id?.toString() || "none",
        branch_id: transaction.branch_id?.toString() || "none",
        project_id: transaction.project_id?.toString() || "none",
        description: transaction.description || "",
        notes: "",
      },
      {
        id: "split-2",
        amount: halfAmount,
        transaction_type_id: transaction.transaction_type_id.toString(),
        category_id: transaction.category_id?.toString() || "none",
        branch_id: transaction.branch_id?.toString() || "none",
        project_id: transaction.project_id?.toString() || "none",
        description: transaction.description || "",
        notes: "",
      },
    ])
  }

  // Initialize splits when dialog opens
  useEffect(() => {
    if (transaction && open) {
      // If already split, load existing splits
      if (transaction.is_split) {
        fetchExistingSplits()
      } else {
        // Initialize with 2 empty splits for first-time split
        setOriginalAmount(transaction.amount)
        initializeNewSplits()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction, open])

  const addSplit = () => {
    setSplits((prevSplits) => {
      const newSplits = [
        ...prevSplits,
        {
          id: `split-${Date.now()}`,
          amount: "0",
          transaction_type_id: transaction?.transaction_type_id.toString() || "",
          category_id: "none",
          branch_id: "none",
          project_id: "none",
          description: transaction?.description || "",
          notes: "",
        },
      ]

      // Auto-calculate the last split amount
      if (newSplits.length >= 2) {
        const lastIndex = newSplits.length - 1
        const sumOfOthers = newSplits
          .slice(0, lastIndex)
          .reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0)

        const remaining = originalAmount - sumOfOthers
        newSplits[lastIndex].amount = Math.max(0, remaining).toFixed(2)
      }

      return newSplits
    })
  }

  const removeSplit = (id: string) => {
    if (splits.length <= 2) {
      setError("At least 2 splits are required")
      return
    }

    setSplits((prevSplits) => {
      const filtered = prevSplits.filter((split) => split.id !== id)

      // Auto-calculate the last split amount after removal
      if (filtered.length >= 2) {
        const lastIndex = filtered.length - 1
        const sumOfOthers = filtered
          .slice(0, lastIndex)
          .reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0)

        const remaining = originalAmount - sumOfOthers
        filtered[lastIndex] = {
          ...filtered[lastIndex],
          amount: Math.max(0, remaining).toFixed(2)
        }
      }

      return filtered
    })
    setError("")
  }

  const updateSplit = (id: string, field: keyof SplitItem, value: string) => {
    setSplits((prevSplits) => {
      const updated = prevSplits.map((split) =>
        split.id === id ? { ...split, [field]: value } : split
      )

      // Auto-calculate last split amount if we're updating amounts on other splits
      if (field === 'amount' && updated.length >= 2) {
        const lastSplitIndex = updated.length - 1
        const lastSplit = updated[lastSplitIndex]

        // Only auto-calculate if we're NOT updating the last split itself
        if (id !== lastSplit.id) {
          const sumOfOthers = updated
            .slice(0, lastSplitIndex)
            .reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0)

          const remaining = originalAmount - sumOfOthers
          updated[lastSplitIndex] = {
            ...lastSplit,
            amount: Math.max(0, remaining).toFixed(2)
          }
        }
      }

      return updated
    })
    setError("")
  }

  const calculateTotal = () => {
    return splits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0)
  }

  const validateSplits = () => {
    if (!transaction) return false

    // Check minimum splits
    if (splits.length < 2) {
      setError("At least 2 splits are required")
      return false
    }

    // Check all amounts are positive
    for (const split of splits) {
      const amount = parseFloat(split.amount)
      if (isNaN(amount) || amount <= 0) {
        setError("All split amounts must be positive numbers")
        return false
      }

      if (!split.transaction_type_id) {
        setError("All splits must have a transaction type")
        return false
      }
    }

    // Check total matches original
    const total = calculateTotal()
    const diff = Math.abs(total - originalAmount)
    if (diff > 0.01) {
      setError(`Split amounts must sum to ${originalAmount.toLocaleString()}. Current total: ${total.toLocaleString()}`)
      return false
    }

    setError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    if (!validateSplits()) return

    setLoading(true)
    try {
      const splitData = {
        raw_transaction_id: transaction.raw_transaction_id,
        splits: splits.map((split) => ({
          amount: parseFloat(split.amount),
          transaction_type_id: parseInt(split.transaction_type_id),
          category_id: split.category_id !== "none" ? parseInt(split.category_id) : undefined,
          branch_id: split.branch_id !== "none" ? parseInt(split.branch_id) : undefined,
          project_id: split.project_id !== "none" ? parseInt(split.project_id) : undefined,
          description: split.description || undefined,
          notes: split.notes || undefined,
        })),
      }

      const response = await fetch("/api/main-transactions/split", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(splitData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to split transaction")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error splitting transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to split transaction")
    } finally {
      setLoading(false)
    }
  }

  const handleUnsplit = async () => {
    if (!transaction || !transaction.is_split) return

    if (!confirm("Are you sure you want to unsplit this transaction?")) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/main-transactions/splits/${transaction.raw_transaction_id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to unsplit transaction")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error unsplitting transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to unsplit transaction")
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number, direction: string) => {
    const formatted = new Intl.NumberFormat("vi-VN").format(amount)
    return direction === "debit" ? `-${formatted}` : `+${formatted}`
  }

  const getDirectionColor = (direction: string) => {
    return direction === "debit" ? "text-red-600" : "text-green-600"
  }

  if (!transaction) return null

  const total = calculateTotal()
  const diff = Math.abs(total - originalAmount)
  const isBalanced = diff < 0.01

  // Filter branches by entity
  const filteredBranches = branches.filter((branch) => branch.entity_id === transaction.entity_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction.is_split ? "Edit Split Transaction" : "Split Transaction"}
          </DialogTitle>
          <DialogDescription>
            Divide this transaction into multiple parts with different categories
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Original transaction info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <p className="text-sm font-medium">
                  {formatDate(transaction.transaction_date)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Original Amount</Label>
                <p className={`text-sm font-mono font-bold ${getDirectionColor(transaction.transaction_direction)}`}>
                  {formatAmount(originalAmount, transaction.transaction_direction)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account</Label>
                <p className="text-sm font-medium">{transaction.account_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm font-medium">{transaction.description || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Split items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Split Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSplit}>
                <Plus className="h-4 w-4 mr-2" />
                Add Split
              </Button>
            </div>

            {splits.map((split, index) => {
              const filteredCategories = categories.filter(
                (cat) => cat.transaction_type_id.toString() === split.transaction_type_id
              )

              const isLastSplit = index === splits.length - 1

              return (
                <Card key={split.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Split {index + 1}</Badge>
                        {isLastSplit && (
                          <Badge variant="secondary" className="text-xs">Auto-calculated</Badge>
                        )}
                      </div>
                      {splits.length > 2 && !isLastSplit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSplit(split.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Amount */}
                      <div className="space-y-2">
                        <Label>
                          Amount <span className="text-red-500">*</span>
                          {isLastSplit && (
                            <span className="text-xs text-muted-foreground ml-2">(Remaining)</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={split.amount}
                          onChange={(e) => updateSplit(split.id, "amount", e.target.value)}
                          placeholder="0.00"
                          required
                          disabled={isLastSplit}
                          className={isLastSplit ? "bg-muted cursor-not-allowed" : ""}
                        />
                      </div>

                      {/* Transaction Type */}
                      <div className="space-y-2">
                        <Label>
                          Type <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={split.transaction_type_id}
                          onValueChange={(value) => {
                            updateSplit(split.id, "transaction_type_id", value)
                            updateSplit(split.id, "category_id", "none")
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {transactionTypes.map((type) => (
                              <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                                {type.type_display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Category */}
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={split.category_id}
                          onValueChange={(value) => updateSplit(split.id, "category_id", value)}
                          disabled={!split.transaction_type_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={split.transaction_type_id ? "Select category" : "Select type first"} />
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
                      </div>

                      {/* Branch */}
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Select
                          value={split.branch_id}
                          onValueChange={(value) => updateSplit(split.id, "branch_id", value)}
                        >
                          <SelectTrigger>
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
                        <Label>Project</Label>
                        <Select
                          value={split.project_id}
                          onValueChange={(value) => updateSplit(split.id, "project_id", value)}
                        >
                          <SelectTrigger>
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
                      <div className="space-y-2 col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={split.description}
                          onChange={(e) => updateSplit(split.id, "description", e.target.value)}
                          placeholder="Enter description"
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-2 col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={split.notes}
                          onChange={(e) => updateSplit(split.id, "notes", e.target.value)}
                          placeholder="Add notes (optional)"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Total Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total of splits:</span>
              <div className="flex items-center gap-4">
                <span className={`font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {total.toLocaleString()}
                </span>
                {isBalanced ? (
                  <Badge variant="default" className="bg-green-600">Balanced</Badge>
                ) : (
                  <Badge variant="destructive">
                    Off by {diff.toLocaleString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div>
              {transaction.is_split && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleUnsplit}
                  disabled={loading}
                >
                  Unsplit Transaction
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !isBalanced}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transaction.is_split ? "Update Splits" : "Split Transaction"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
