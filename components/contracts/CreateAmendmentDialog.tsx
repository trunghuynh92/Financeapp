"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { ContractOverview, AmendmentType, AmendmentStatus } from "@/types/contract"
import { formatCurrency } from "@/lib/account-utils"

interface CreateAmendmentDialogProps {
  contract: ContractOverview
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateAmendmentDialog({
  contract,
  open,
  onOpenChange,
  onSuccess
}: CreateAmendmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [affectedInstancesCount, setAffectedInstancesCount] = useState<number | null>(null)

  // Form state - only amount change supported for now
  const amendmentType = "amount_change" // Fixed to amount_change
  const [effectiveStartDate, setEffectiveStartDate] = useState("")
  const [effectiveEndDate, setEffectiveEndDate] = useState("")
  const [newPaymentAmount, setNewPaymentAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<AmendmentStatus>("draft")

  // Auto-calculated fields
  const currentAmount = contract.total_monthly_obligation || 0
  const newAmount = parseFloat(newPaymentAmount) || 0
  const estimatedImpact = newAmount - currentAmount
  const impactDirection = estimatedImpact > 0 ? "increase" : estimatedImpact < 0 ? "decrease" : "neutral"

  useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [open])

  // Preview affected instances when dates change
  useEffect(() => {
    if (open && effectiveStartDate && amendmentType === "amount_change") {
      previewAffectedInstances()
    }
  }, [effectiveStartDate, effectiveEndDate, open, amendmentType])

  const resetForm = () => {
    setEffectiveStartDate("")
    setEffectiveEndDate("")
    setNewPaymentAmount("")
    setNotes("")
    setStatus("draft")
    setError(null)
    setAffectedInstancesCount(null)
  }

  const previewAffectedInstances = async () => {
    if (!effectiveStartDate) return

    setPreviewLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: effectiveStartDate,
      })
      if (effectiveEndDate) {
        params.append("end_date", effectiveEndDate)
      }

      const response = await fetch(`/api/contracts/${contract.contract_id}/preview-amendment?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAffectedInstancesCount(data.affected_instances_count || 0)
      }
    } catch (err) {
      console.error("Error previewing affected instances:", err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!effectiveStartDate) {
      setError("Effective start date is required")
      return
    }

    if (!newPaymentAmount || newAmount <= 0) {
      setError("New payment amount is required")
      return
    }

    if (effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
      setError("Effective end date must be after start date")
      return
    }

    setLoading(true)

    try {
      // Generate title
      const title = `Amount Change - ${new Date(effectiveStartDate).toLocaleDateString()}`

      const body = {
        amendment_type: "amount_change",
        effective_start_date: effectiveStartDate,
        effective_end_date: effectiveEndDate || undefined,
        title: title,
        description: notes.trim() || `Amount change for ${contract.contract_name}`,
        reason: notes.trim() || undefined,
        status: status,
        new_payment_amount: newAmount,
        estimated_impact: estimatedImpact,
        impact_direction: impactDirection,
      }

      const response = await fetch(`/api/contracts/${contract.contract_id}/amendments`, {
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
        setError(error.error || "Failed to create amendment")
      }
    } catch (err) {
      console.error("Error creating amendment:", err)
      setError("Failed to create amendment")
    } finally {
      setLoading(false)
    }
  }

  const getImpactIcon = () => {
    switch (impactDirection) {
      case "increase":
        return <TrendingUp className="h-4 w-4 text-red-600" />
      case "decrease":
        return <TrendingDown className="h-4 w-4 text-green-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Amendment</DialogTitle>
          <DialogDescription>
            Create an amendment for {contract.contract_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this amendment (e.g., COVID relief, renegotiation)..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Title will be auto-generated from amendment type and date
            </p>
          </div>

          {/* Effective Dates */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Effective Period</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveStartDate">Start Date *</Label>
                <Input
                  id="effectiveStartDate"
                  type="date"
                  value={effectiveStartDate}
                  onChange={(e) => setEffectiveStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveEndDate">End Date</Label>
                <Input
                  id="effectiveEndDate"
                  type="date"
                  value={effectiveEndDate}
                  onChange={(e) => setEffectiveEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for indefinite
                </p>
              </div>
            </div>

            {/* Preview affected instances */}
            {effectiveStartDate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  {previewLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculating affected payments...
                    </span>
                  ) : affectedInstancesCount !== null ? (
                    <span className="font-medium">
                      This amendment will affect {affectedInstancesCount} pending payment{affectedInstancesCount !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                </p>
              </div>
            )}
          </div>

          {/* Amount Change Fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Amount Change</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentAmount">Current Amount</Label>
                <div className="text-sm font-mono p-2 bg-gray-50 rounded border">
                  {formatCurrency(contract.total_monthly_obligation, "VND")}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPaymentAmount">New Amount *</Label>
                <Input
                  id="newPaymentAmount"
                  type="number"
                  step="0.01"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  placeholder="e.g., 35000000"
                  required
                />
              </div>
            </div>

            {/* Auto-calculated impact display */}
            {newAmount > 0 && (
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Impact:</span>
                  <div className="flex items-center gap-2">
                    {getImpactIcon()}
                    <span className={`text-sm font-semibold ${
                      impactDirection === "increase" ? "text-red-600" :
                      impactDirection === "decrease" ? "text-green-600" :
                      "text-gray-600"
                    }`}>
                      {estimatedImpact > 0 ? "+" : ""}{formatCurrency(Math.abs(estimatedImpact), "VND")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AmendmentStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Approved amendments can be applied to payment instances
            </p>
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
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Amendment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
