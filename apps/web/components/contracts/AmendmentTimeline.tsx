"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  PlayCircle,
  RotateCcw,
  Plus,
  Loader2
} from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/account-utils"
import { CreateAmendmentDialog } from "./CreateAmendmentDialog"
import { ContractOverview } from "@/types/contract"

interface Amendment {
  amendment_id: number
  amendment_number: number
  amendment_date: string
  effective_start_date: string
  effective_end_date: string | null
  amendment_type: string
  new_payment_amount: number | null
  new_frequency: string | null
  new_expiration_date: string | null
  title: string
  description: string
  reason: string | null
  estimated_impact: number | null
  impact_direction: "increase" | "decrease" | "neutral" | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

interface AmendmentTimelineProps {
  contractId: number
  amendments: Amendment[]
  onAmendmentUpdated: () => void
}

export function AmendmentTimeline({
  contractId,
  amendments,
  onAmendmentUpdated
}: AmendmentTimelineProps) {
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [contractData, setContractData] = useState<ContractOverview | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />
      case "pending_approval":
        return <Clock className="h-5 w-5 text-blue-600" />
      case "draft":
        return <FileText className="h-5 w-5 text-gray-400" />
      case "superseded":
        return <AlertCircle className="h-5 w-5 text-gray-400" />
      default:
        return <FileText className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "pending_approval":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "superseded":
        return "bg-gray-100 text-gray-600 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getImpactIcon = (direction: string | null) => {
    switch (direction) {
      case "increase":
        return <TrendingUp className="h-4 w-4 text-red-600" />
      case "decrease":
        return <TrendingDown className="h-4 w-4 text-green-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const formatAmendmentType = (type: string) => {
    return type
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const handleApplyAmendment = async (amendmentId: number) => {
    setApplyingId(amendmentId)
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/amendments/${amendmentId}/apply`,
        { method: "POST" }
      )

      if (response.ok) {
        const data = await response.json()
        alert(
          `Amendment applied successfully!\n\n` +
          `Instances updated: ${data.data.instances_updated}\n` +
          `Financial impact: ${formatCurrency(data.data.financial_impact, "VND")}`
        )
        onAmendmentUpdated()
      } else {
        const error = await response.json()
        alert(`Failed to apply amendment: ${error.error}`)
      }
    } catch (err) {
      console.error("Error applying amendment:", err)
      alert("Failed to apply amendment")
    } finally {
      setApplyingId(null)
    }
  }

  const handleRevertAmendment = async (amendmentId: number) => {
    if (!confirm("Are you sure you want to revert this amendment? This will restore original payment amounts.")) {
      return
    }

    setRevertingId(amendmentId)
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/amendments/${amendmentId}/revert`,
        { method: "POST" }
      )

      if (response.ok) {
        const data = await response.json()
        alert(
          `Amendment reverted successfully!\n\n` +
          `Instances reverted: ${data.data.instances_reverted}`
        )
        onAmendmentUpdated()
      } else {
        const error = await response.json()
        alert(`Failed to revert amendment: ${error.error}`)
      }
    } catch (err) {
      console.error("Error reverting amendment:", err)
      alert("Failed to revert amendment")
    } finally {
      setRevertingId(null)
    }
  }

  const handleApproveAmendment = async (amendmentId: number) => {
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/amendments/${amendmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" })
        }
      )

      if (response.ok) {
        alert("Amendment approved successfully!")
        onAmendmentUpdated()
      } else {
        const error = await response.json()
        alert(`Failed to approve amendment: ${error.error}`)
      }
    } catch (err) {
      console.error("Error approving amendment:", err)
      alert("Failed to approve amendment")
    }
  }

  const handleOpenCreateDialog = async () => {
    // Fetch contract data for the create dialog
    try {
      const response = await fetch(`/api/contracts/${contractId}`)
      if (response.ok) {
        const data = await response.json()
        setContractData(data.data)
        setCreateDialogOpen(true)
      }
    } catch (err) {
      console.error("Error fetching contract:", err)
      alert("Failed to load contract data")
    }
  }

  if (amendments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-4">No amendments yet</p>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Amendment
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Create Amendment Button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Amendment
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {amendments.map((amendment, index) => (
          <Card key={amendment.amendment_id} className="relative ml-14">
            {/* Timeline dot */}
            <div className="absolute -left-[3.25rem] top-6">
              {getStatusIcon(amendment.status)}
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-base">{amendment.title}</CardTitle>
                    <Badge className={getStatusBadgeColor(amendment.status)}>
                      {formatAmendmentType(amendment.status)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      #{amendment.amendment_number}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(amendment.amendment_date), "MMM d, yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {formatAmendmentType(amendment.amendment_type)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Description */}
              <div>
                <p className="text-sm text-muted-foreground">{amendment.description}</p>
                {amendment.reason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Reason:</span> {amendment.reason}
                  </p>
                )}
              </div>

              {/* Effective Period */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">Effective Period</p>
                <p className="text-muted-foreground">
                  {format(new Date(amendment.effective_start_date), "MMM d, yyyy")}
                  {amendment.effective_end_date && (
                    <> → {format(new Date(amendment.effective_end_date), "MMM d, yyyy")}</>
                  )}
                  {!amendment.effective_end_date && <> → Indefinite</>}
                </p>
              </div>

              {/* Amendment Details */}
              {amendment.amendment_type === "amount_change" && amendment.new_payment_amount && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">New Payment Amount</p>
                      <p className="text-lg font-mono font-bold text-blue-900">
                        {formatCurrency(amendment.new_payment_amount, "VND")}
                      </p>
                    </div>
                    {amendment.impact_direction && (
                      <div className="flex items-center gap-2">
                        {getImpactIcon(amendment.impact_direction)}
                        {amendment.estimated_impact && (
                          <span className="text-sm font-medium">
                            {formatCurrency(Math.abs(amendment.estimated_impact), "VND")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {amendment.amendment_type === "payment_schedule_change" && amendment.new_frequency && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-purple-900">New Frequency</p>
                  <p className="text-lg font-medium text-purple-900 capitalize">
                    {amendment.new_frequency}
                  </p>
                </div>
              )}

              {(amendment.amendment_type === "term_extension" || amendment.amendment_type === "term_reduction") &&
                amendment.new_expiration_date && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-900">New Expiration Date</p>
                    <p className="text-lg font-medium text-orange-900">
                      {format(new Date(amendment.new_expiration_date), "MMM d, yyyy")}
                    </p>
                  </div>
                )}

              {/* Approval Info */}
              {amendment.status === "approved" && amendment.approved_at && (
                <div className="text-xs text-muted-foreground">
                  Approved on {format(new Date(amendment.approved_at), "MMM d, yyyy 'at' HH:mm")}
                </div>
              )}

              {amendment.status === "rejected" && amendment.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-900">Rejection Reason</p>
                  <p className="text-sm text-red-800">{amendment.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {amendment.status === "pending_approval" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproveAmendment(amendment.amendment_id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                )}

                {amendment.status === "approved" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleApplyAmendment(amendment.amendment_id)}
                      disabled={applyingId === amendment.amendment_id}
                    >
                      {applyingId === amendment.amendment_id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Apply to Payments
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevertAmendment(amendment.amendment_id)}
                      disabled={revertingId === amendment.amendment_id}
                    >
                      {revertingId === amendment.amendment_id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Reverting...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Revert
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Amendment Dialog */}
      {contractData && (
        <CreateAmendmentDialog
          contract={contractData}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={onAmendmentUpdated}
        />
      )}
    </div>
  )
}
