"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileImage, CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ReceiptPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptId: string
  entityId: string
  accountId: number
  onTransactionCreated?: (transactionId: number) => void
}

interface ReceiptData {
  receipt_id: string
  file_url: string
  ocr_merchant_name: string | null
  ocr_transaction_date: string | null
  ocr_total_amount: number | null
  ocr_currency: string
  ocr_confidence: number
  suggested_description: string | null
  suggested_category_code: string | null
  suggested_category_name: string | null
  processing_status: string
}

interface Category {
  category_id: number
  category_name: string
  category_code: string
  transaction_type_id: number
}

interface Account {
  account_id: number
  account_name: string
  bank_name: string | null
  account_type: string
}

export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  receiptId,
  entityId,
  accountId,
  onTransactionCreated,
}: ReceiptPreviewDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [transactionDate, setTransactionDate] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [notes, setNotes] = useState("")

  // Load receipt data
  useEffect(() => {
    if (open && receiptId) {
      loadReceiptData()
      loadCategories()
      loadAccounts()
    }
  }, [open, receiptId])

  // Set initial account selection
  useEffect(() => {
    if (accountId && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountId.toString())
    }
  }, [accountId, accounts, selectedAccountId])

  const loadReceiptData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/receipts/${receiptId}`)
      if (!response.ok) throw new Error("Failed to load receipt")

      const data = await response.json()
      setReceipt(data)

      // Pre-fill form with OCR data
      setDescription(data.suggested_description || data.ocr_merchant_name || "")
      setAmount(data.ocr_total_amount?.toString() || "")
      setTransactionDate(data.ocr_transaction_date || "")
      setNotes("")
    } catch (error) {
      console.error("Error loading receipt:", error)
      toast({
        title: "Error",
        description: "Failed to load receipt data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch(`/api/categories?entity_id=${entityId}&include_custom=true`)
      if (!response.ok) throw new Error("Failed to load categories")

      const result = await response.json()
      // Categories API returns { data: [...] }
      const categories = result.data || []
      setCategories(categories)
    } catch (error) {
      console.error("Error loading categories:", error)
      setCategories([])
    }
  }

  const loadAccounts = async () => {
    try {
      const response = await fetch(`/api/accounts?entity_id=${entityId}`)
      if (!response.ok) throw new Error("Failed to load accounts")

      const result = await response.json()
      // Accounts API returns { data: [...], pagination: {...} }
      const accountsData = result.data || []
      setAccounts(accountsData)
    } catch (error) {
      console.error("Error loading accounts:", error)
      setAccounts([])
    }
  }

  // Auto-select category when both receipt and categories are loaded
  useEffect(() => {
    if (receipt?.suggested_category_code && categories.length > 0 && !categoryId) {
      const matchingCategory = categories.find(
        (cat) => cat.category_code === receipt.suggested_category_code
      )
      if (matchingCategory) {
        setCategoryId(matchingCategory.category_id.toString())
      }
    }
  }, [receipt, categories, categoryId])

  const handleCreateTransaction = async () => {
    if (!amount || !transactionDate || !categoryId || !selectedAccountId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      const response = await fetch(`/api/receipts/${receiptId}/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: parseInt(selectedAccountId),
          entity_id: entityId,
          description,
          amount: parseFloat(amount),
          transaction_date: transactionDate,
          category_id: parseInt(categoryId),
          notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create transaction")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: "Transaction created from receipt",
      })

      onTransactionCreated?.(data.transaction_id)
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating transaction:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create transaction",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Review Receipt & Create Transaction
          </DialogTitle>
          <DialogDescription>
            Review the extracted data and create a transaction
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Receipt Image Preview */}
            {receipt?.file_url && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-medium mb-2">Receipt Image</div>
                <img
                  src={receipt.file_url}
                  alt="Receipt"
                  className="max-h-64 mx-auto rounded border"
                />
              </div>
            )}

            {/* Account Selection */}
            <div className="space-y-2">
              <Label htmlFor="account">
                Account <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts && accounts.length > 0 ? (
                    accounts.map((account) => (
                      <SelectItem
                        key={account.account_id}
                        value={account.account_id.toString()}
                      >
                        {account.account_name}
                        {account.bank_name && ` - ${account.bank_name}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading accounts...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* OCR Confidence Indicator */}
            {receipt && (
              <div className="flex items-center gap-2 text-sm">
                {receipt.ocr_confidence >= 0.8 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700">
                      High confidence ({Math.round(receipt.ocr_confidence * 100)}%)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-yellow-700">
                      Medium confidence ({Math.round(receipt.ocr_confidence * 100)}%) - Please verify
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Transaction Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Transaction description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Amount <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">
                    Transaction Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories && categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem
                            key={category.category_id}
                            value={category.category_id.toString()}
                          >
                            {category.category_name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          Loading categories...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {receipt?.suggested_category_name && (
                    <p className="text-xs text-gray-500">
                      AI suggested: {receipt.suggested_category_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateTransaction} disabled={loading || creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
