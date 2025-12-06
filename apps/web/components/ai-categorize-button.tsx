"use client"

/**
 * AI Categorize Button Component
 *
 * Allows users to apply AI-powered categorization to selected transactions.
 * Uses Claude to analyze transaction descriptions and suggest types/categories.
 */

import { useState } from "react"
import { Sparkles, Loader2, Check, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatCurrency, formatDate } from "@/lib/account-utils"
import { Currency } from "@/types/account"
import { TransactionType, Category, MainTransactionDetails } from "@/types/main-transaction"

interface AICategorizeButtonProps {
  transactions: MainTransactionDetails[]
  transactionTypes: TransactionType[]
  categories: Category[]
  entityType: "business" | "personal"
  currency: Currency
  onApply: (updates: TransactionUpdate[]) => Promise<void>
  disabled?: boolean
}

interface TransactionUpdate {
  main_transaction_id: number
  transaction_type_id: number
  category_id: number | null
}

interface AICategorizationResult {
  transactionTypeCode: string
  transactionTypeName: string
  categoryCode: string | null
  categoryName: string | null
  confidence: number
  reasoning: string
  method: string
}

interface PendingCategorizationItem {
  transaction: MainTransactionDetails
  aiResult: AICategorizationResult
  selectedTypeId: number
  selectedCategoryId: number | null
  isSelected: boolean
}

export function AICategorizeButton({
  transactions,
  transactionTypes,
  categories,
  entityType,
  currency,
  onApply,
  disabled,
}: AICategorizeButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [pendingItems, setPendingItems] = useState<PendingCategorizationItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filter transactions that need categorization (no category set)
  // Only include Income/Expense transactions without a category
  const uncategorizedTransactions = transactions.filter(
    (tx) => !tx.category_id && (tx.transaction_type_code === "EXP" || tx.transaction_type_code === "INC")
  )

  const handleAnalyze = async () => {
    if (uncategorizedTransactions.length === 0) return

    setIsAnalyzing(true)
    setError(null)
    setPendingItems([])

    try {
      // Prepare transactions for API
      const transactionsToAnalyze = uncategorizedTransactions.map((tx) => ({
        description: tx.description || "",
        amount: tx.amount,
        direction: tx.transaction_direction,
        entityType,
        transactionDate: tx.transaction_date,
      }))

      // Call AI categorization API
      const response = await fetch("/api/ai/categorize-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: transactionsToAnalyze,
          useQuickMatch: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to categorize transactions")
      }

      const result = await response.json()

      // Map AI results to pending items
      const items: PendingCategorizationItem[] = uncategorizedTransactions.map((tx, index) => {
        const aiResult = result.data[index] as AICategorizationResult

        // Find matching transaction type
        const matchedType = transactionTypes.find(
          (tt) => tt.type_code === aiResult.transactionTypeCode
        )

        // Find matching category
        const matchedCategory = categories.find(
          (c) => c.category_code === aiResult.categoryCode
        )

        return {
          transaction: tx,
          aiResult,
          selectedTypeId: matchedType?.transaction_type_id || tx.transaction_type_id,
          selectedCategoryId: matchedCategory?.category_id || null,
          isSelected: aiResult.confidence >= 0.7, // Auto-select high confidence
        }
      })

      setPendingItems(items)
      setIsDialogOpen(true)
    } catch (err: any) {
      setError(err.message || "Failed to analyze transactions")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleToggleItem = (index: number) => {
    setPendingItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isSelected: !item.isSelected } : item
      )
    )
  }

  const handleSelectAll = () => {
    const allSelected = pendingItems.every((item) => item.isSelected)
    setPendingItems((prev) =>
      prev.map((item) => ({ ...item, isSelected: !allSelected }))
    )
  }

  const handleChangeType = (index: number, typeId: number) => {
    setPendingItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selectedTypeId: typeId } : item
      )
    )
  }

  const handleChangeCategory = (index: number, categoryId: number | null) => {
    setPendingItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selectedCategoryId: categoryId } : item
      )
    )
  }

  const handleApply = async () => {
    const selectedItems = pendingItems.filter((item) => item.isSelected)
    if (selectedItems.length === 0) return

    setIsApplying(true)
    try {
      const updates: TransactionUpdate[] = selectedItems.map((item) => ({
        main_transaction_id: item.transaction.main_transaction_id,
        transaction_type_id: item.selectedTypeId,
        category_id: item.selectedCategoryId,
      }))

      await onApply(updates)
      setIsDialogOpen(false)
      setPendingItems([])
    } catch (err: any) {
      setError(err.message || "Failed to apply categorizations")
    } finally {
      setIsApplying(false)
    }
  }

  const selectedCount = pendingItems.filter((item) => item.isSelected).length

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-green-100 text-green-800">High</Badge>
    } else if (confidence >= 0.7) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Low</Badge>
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={disabled || isAnalyzing || uncategorizedTransactions.length === 0}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Categorize ({uncategorizedTransactions.length})
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Categorization Suggestions
            </DialogTitle>
            <DialogDescription>
              Review and apply AI-suggested categories to your transactions.
              {pendingItems.length > 0 && (
                <span className="ml-2">
                  ({selectedCount} of {pendingItems.length} selected)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <ScrollArea className="h-[50vh]">
            <div className="space-y-2">
              {/* Select All Header */}
              {pendingItems.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md sticky top-0 z-10">
                  <Checkbox
                    checked={pendingItems.every((item) => item.isSelected)}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </div>
              )}

              {/* Pending Items */}
              {pendingItems.map((item, index) => (
                <div
                  key={item.transaction.main_transaction_id}
                  className={`p-3 border rounded-lg ${
                    item.isSelected ? "border-primary bg-primary/5" : "border-muted"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.isSelected}
                      onCheckedChange={() => handleToggleItem(index)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Transaction Info */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(item.transaction.transaction_date)}
                        </span>
                        <span
                          className={`font-medium ${
                            item.transaction.transaction_direction === "credit"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {item.transaction.transaction_direction === "credit"
                            ? "+"
                            : "-"}
                          {formatCurrency(item.transaction.amount, currency)}
                        </span>
                        {getConfidenceBadge(item.aiResult.confidence)}
                      </div>

                      <p className="text-sm truncate mb-2">
                        {item.transaction.description || "No description"}
                      </p>

                      {/* AI Suggestion */}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Suggested:</span>

                        {/* Transaction Type Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              {transactionTypes.find(
                                (t) => t.transaction_type_id === item.selectedTypeId
                              )?.type_display_name || "Select Type"}
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {transactionTypes
                              .filter((t) => t.is_active)
                              .map((type) => (
                                <DropdownMenuItem
                                  key={type.transaction_type_id}
                                  onClick={() =>
                                    handleChangeType(index, type.transaction_type_id)
                                  }
                                >
                                  {type.type_display_name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Category Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              {categories.find(
                                (c) => c.category_id === item.selectedCategoryId
                              )?.category_name || "Select Category"}
                              <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-64 overflow-y-auto">
                            <DropdownMenuItem
                              onClick={() => handleChangeCategory(index, null)}
                            >
                              <span className="text-muted-foreground">
                                No category
                              </span>
                            </DropdownMenuItem>
                            {categories
                              .filter(
                                (c) =>
                                  c.is_active &&
                                  c.transaction_type_id === item.selectedTypeId
                              )
                              .map((cat) => (
                                <DropdownMenuItem
                                  key={cat.category_id}
                                  onClick={() =>
                                    handleChangeCategory(index, cat.category_id)
                                  }
                                >
                                  {cat.category_name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {item.aiResult.method === "quick_match" && (
                          <Badge variant="secondary" className="text-xs">
                            Rule-based
                          </Badge>
                        )}
                      </div>

                      {/* AI Reasoning */}
                      {item.aiResult.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.aiResult.reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {pendingItems.length === 0 && !isAnalyzing && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions to categorize
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedCount === 0 || isApplying}
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Apply {selectedCount} Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
