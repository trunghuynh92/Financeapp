"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertCircle } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { ContractOverview } from "@/types/contract"

interface CreateScheduledPaymentDialogProps {
  contract?: ContractOverview | null  // Optional for standalone payments
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  duplicateFrom?: any | null
}

export function CreateScheduledPaymentDialog({
  contract,
  open,
  onOpenChange,
  onSuccess,
  duplicateFrom
}: CreateScheduledPaymentDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<any[]>([])

  // Form state
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense")
  const [paymentType, setPaymentType] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [paymentDay, setPaymentDay] = useState("1")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [notes, setNotes] = useState("")

  // Fetch categories when dialog opens
  useEffect(() => {
    if (open && currentEntity) {
      fetchCategories()

      // If duplicating from existing schedule, pre-fill with its data
      if (duplicateFrom) {
        // Try to infer transaction type from category
        const category = categories.find(c => c.category_id === duplicateFrom.category_id)
        if (category?.transaction_types?.type_name) {
          setTransactionType(category.transaction_types.type_name as "income" | "expense")
        }
        setPaymentType(duplicateFrom.payment_type || "")
        setCategoryId(duplicateFrom.category_id || null)
        setPaymentAmount(duplicateFrom.payment_amount?.toString() || "")
        setFrequency(duplicateFrom.frequency || "monthly")
        setPaymentDay(duplicateFrom.payment_day?.toString() || "1")
        setStartDate(duplicateFrom.start_date || "")
        setEndDate(duplicateFrom.end_date || "")
        setNotes(duplicateFrom.notes || "")
      } else if (contract) {
        // Pre-fill dates from contract (if contract exists)
        setStartDate(contract.effective_date || "")
        setEndDate(contract.expiration_date || "")
      }
    }
  }, [open, currentEntity, contract, duplicateFrom])

  const fetchCategories = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/categories?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data.data || [])
      }
    } catch (err) {
      console.error("Error fetching categories:", err)
    }
  }

  const resetForm = () => {
    setTransactionType("expense")
    setPaymentType("")
    setCategoryId(null)
    setPaymentAmount("")
    setFrequency("monthly")
    setPaymentDay("1")
    setStartDate(contract?.effective_date || "")
    setEndDate(contract?.expiration_date || "")
    setNotes("")
    setError(null)
  }

  // Filter categories based on transaction type
  const filteredCategories = categories.filter(c =>
    c.transaction_types?.type_name === transactionType
  )

  // If no categories of selected type, show all as fallback
  const availableCategories = filteredCategories.length > 0 ? filteredCategories : categories

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentEntity) return

    // Validation
    if (!paymentType.trim()) {
      setError("Payment type is required (e.g., Year 1, Year 2, Rent, Utilities)")
      return
    }

    if (!categoryId) {
      setError("Category is required")
      return
    }

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setError("Payment amount must be greater than 0")
      return
    }

    if (!startDate) {
      setError("Start date is required")
      return
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be after start date")
      return
    }

    setLoading(true)

    try {
      const body = {
        entity_id: currentEntity.id,
        contract_id: contract?.contract_id || undefined,
        payment_type: paymentType.trim(),
        category_id: categoryId,
        contract_name: contract?.contract_name || undefined,
        contract_type: contract?.contract_type || undefined,
        payee_name: contract?.counterparty || undefined,
        payment_amount: parseFloat(paymentAmount),
        schedule_type: "recurring",
        frequency: frequency,
        payment_day: parseInt(paymentDay),
        start_date: startDate,
        end_date: endDate || undefined,
        notes: notes.trim() || undefined,
        generate_instances: true,
      }

      const response = await fetch("/api/scheduled-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        const error = await response.json()
        setError(error.error || "Failed to create payment schedule")
      }
    } catch (err) {
      console.error("Error creating payment schedule:", err)
      setError("Failed to create payment schedule")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {duplicateFrom
              ? "Duplicate Payment Schedule"
              : contract
                ? "Add Payment Schedule"
                : "Add Standalone Payment"
            }
          </DialogTitle>
          <DialogDescription>
            {duplicateFrom
              ? `Creating a copy of "${duplicateFrom.payment_type}"${contract ? ` for ${contract.contract_name}` : ""}`
              : contract
                ? `Create a payment schedule for ${contract.contract_name}`
                : "Create a recurring payment not linked to a contract"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Contract Info (read-only display) - Only show if linked to contract */}
          {contract && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">Contract: {contract.contract_name}</p>
              <p className="text-sm text-blue-800">Counterparty: {contract.counterparty}</p>
            </div>
          )}

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transactionType">Transaction Type *</Label>
            <Select value={transactionType} onValueChange={(v) => {
              setTransactionType(v as "income" | "expense")
              // Reset category when changing transaction type
              setCategoryId(null)
            }}>
              <SelectTrigger id="transactionType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">📤 Expense</SelectItem>
                <SelectItem value="income">📥 Income</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Is this a payment you make (expense) or receive (income)?
            </p>
          </div>

          {/* Schedule Name */}
          <div className="space-y-2">
            <Label htmlFor="paymentType">Schedule Name *</Label>
            <Input
              id="paymentType"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              placeholder="e.g., Year 1, Year 2, Rent, Utilities, Parking"
              required
            />
            <p className="text-xs text-muted-foreground">
              Give this payment schedule a descriptive name (e.g., "Year 1" for first year rent at 35mil)
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId?.toString() || ""} onValueChange={(v) => setCategoryId(parseInt(v))}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.length > 0 ? (
                  availableCategories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No {transactionType} categories found. Please create categories first.
                  </div>
                )}
              </SelectContent>
            </Select>
            {filteredCategories.length === 0 && categories.length > 0 && (
              <p className="text-xs text-amber-600">
                Note: No {transactionType} categories found. Showing all categories as fallback.
              </p>
            )}
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Payment Amount (VND) *</Label>
            <Input
              id="paymentAmount"
              type="number"
              step="1000"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="e.g., 35000000"
              required
            />
          </div>

          {/* Frequency and Payment Day */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDay">Payment Day of Month *</Label>
              <Input
                id="paymentDay"
                type="number"
                min="1"
                max="31"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Period Dates */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Payment Period</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="cursor-text"
                />
                <p className="text-xs text-muted-foreground">
                  Click to type or pick from calendar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="cursor-text"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for ongoing
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              For escalating contracts, create separate schedules for each period (e.g., Year 1: Nov 2025-Nov 2026 at 35mil, Year 2: Nov 2026-Nov 2027 at 38mil)
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this payment schedule..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                resetForm()
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Payment Schedule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
