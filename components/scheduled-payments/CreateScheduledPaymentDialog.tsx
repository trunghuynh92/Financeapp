"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Loader2, Plus, AlertCircle } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { Category } from "@/types/main-transaction"
import { ScheduledPaymentOverview, ContractType, ScheduleType, PaymentFrequency } from "@/types/scheduled-payment"
import { formatCurrency } from "@/lib/account-utils"

interface CreateScheduledPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  categories: Category[]
  editingPayment?: ScheduledPaymentOverview | null
}

export function CreateScheduledPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
  categories,
  editingPayment
}: CreateScheduledPaymentDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [contractName, setContractName] = useState("")
  const [contractType, setContractType] = useState<ContractType>("service")
  const [payeeName, setPayeeName] = useState("")
  const [contractNumber, setContractNumber] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("recurring")
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly")
  const [paymentDay, setPaymentDay] = useState("1")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [customDates, setCustomDates] = useState("")
  const [notes, setNotes] = useState("")

  // Populate form when editing
  useEffect(() => {
    if (editingPayment) {
      setContractName(editingPayment.contract_name)
      setContractType(editingPayment.contract_type)
      setPayeeName(editingPayment.payee_name)
      setContractNumber(editingPayment.contract_number || "")
      setCategoryId(editingPayment.category_id)
      setPaymentAmount(editingPayment.payment_amount.toString())
      setScheduleType(editingPayment.schedule_type)
      setFrequency(editingPayment.frequency || "monthly")
      setPaymentDay(editingPayment.payment_day?.toString() || "1")
      setStartDate(editingPayment.start_date)
      setEndDate(editingPayment.end_date || "")
      setCustomDates(editingPayment.custom_schedule?.join(", ") || "")
      setNotes(editingPayment.notes || "")
    } else {
      resetForm()
    }
  }, [editingPayment, open])

  const resetForm = () => {
    setContractName("")
    setContractType("service")
    setPayeeName("")
    setContractNumber("")
    setCategoryId(null)
    setPaymentAmount("")
    setScheduleType("recurring")
    setFrequency("monthly")
    setPaymentDay("1")
    setStartDate("")
    setEndDate("")
    setCustomDates("")
    setNotes("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentEntity) return

    // Validation
    if (!contractName.trim()) {
      setError("Contract name is required")
      return
    }

    if (!payeeName.trim()) {
      setError("Payee name is required")
      return
    }

    if (!categoryId) {
      setError("Category is required")
      return
    }

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Payment amount must be greater than 0")
      return
    }

    if (!startDate) {
      setError("Start date is required")
      return
    }

    // Schedule-specific validation
    if (scheduleType === "recurring") {
      const day = parseInt(paymentDay)
      if (isNaN(day) || day < 1 || day > 31) {
        setError("Payment day must be between 1 and 31")
        return
      }
    }

    if (scheduleType === "custom_dates") {
      if (!customDates.trim()) {
        setError("Custom dates are required for custom schedule")
        return
      }
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be after start date")
      return
    }

    setLoading(true)

    try {
      const body: any = {
        entity_id: currentEntity.id,
        category_id: categoryId,
        contract_name: contractName.trim(),
        contract_type: contractType,
        payee_name: payeeName.trim(),
        payment_amount: amount,
        schedule_type: scheduleType,
        start_date: startDate,
        notes: notes.trim() || undefined,
        contract_number: contractNumber.trim() || undefined,
      }

      if (endDate) {
        body.end_date = endDate
      }

      if (scheduleType === "recurring") {
        body.frequency = frequency
        body.payment_day = parseInt(paymentDay)
      }

      if (scheduleType === "custom_dates") {
        // Parse comma-separated dates
        const dates = customDates.split(",").map(d => d.trim()).filter(d => d)
        body.custom_schedule = dates
      }

      const url = editingPayment
        ? `/api/scheduled-payments/${editingPayment.scheduled_payment_id}`
        : `/api/scheduled-payments`

      const method = editingPayment ? "PATCH" : "POST"

      if (editingPayment) {
        body.regenerate_instances = true
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        const error = await response.json()
        setError(error.error || "Failed to save scheduled payment")
      }
    } catch (err) {
      console.error("Error saving scheduled payment:", err)
      setError("Failed to save scheduled payment")
    } finally {
      setLoading(false)
    }
  }

  // Get expense categories only
  const expenseCategories = categories.filter(c => c.transaction_types?.type_name === "expense")

  // If no expense categories, show all categories as fallback
  const availableCategories = expenseCategories.length > 0 ? expenseCategories : categories

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPayment ? "Edit Scheduled Payment" : "Create Scheduled Payment"}
          </DialogTitle>
          <DialogDescription>
            Create a contract for recurring or scheduled payment obligations
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Contract Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contract Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractName">Contract Name *</Label>
                <Input
                  id="contractName"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="e.g., Office Lease Agreement"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractType">Contract Type *</Label>
                <Select value={contractType} onValueChange={(v) => setContractType(v as ContractType)}>
                  <SelectTrigger id="contractType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lease">Lease</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payeeName">Payee Name *</Label>
                <Input
                  id="payeeName"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g., ABC Property Management"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractNumber">Contract Number</Label>
                <Input
                  id="contractNumber"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="e.g., LEASE-2025-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  value={categoryId?.toString() || ""}
                  onValueChange={(v) => setCategoryId(parseInt(v))}
                >
                  <SelectTrigger id="categoryId">
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
                        No categories found. Please create categories first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {expenseCategories.length === 0 && categories.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Note: Some categories shown may not be expense type
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Schedule Configuration</h3>

            <div className="space-y-2">
              <Label htmlFor="scheduleType">Schedule Type *</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleType)}>
                <SelectTrigger id="scheduleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="custom_dates">Custom Dates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === "recurring" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as PaymentFrequency)}>
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
                  <Label htmlFor="paymentDay">Payment Day *</Label>
                  <Input
                    id="paymentDay"
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(e.target.value)}
                    placeholder="1-31"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Day of month (1-31)
                  </p>
                </div>
              </div>
            )}

            {scheduleType === "custom_dates" && (
              <div className="space-y-2">
                <Label htmlFor="customDates">Custom Dates *</Label>
                <Textarea
                  id="customDates"
                  value={customDates}
                  onChange={(e) => setCustomDates(e.target.value)}
                  placeholder="2025-02-05, 2025-02-25, 2025-03-15"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Enter dates in YYYY-MM-DD format, separated by commas
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional for indefinite contracts
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this contract..."
              rows={3}
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
                  Saving...
                </>
              ) : editingPayment ? (
                "Update Contract"
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
