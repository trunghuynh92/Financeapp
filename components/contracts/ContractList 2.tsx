"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  FileText,
  Building,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Edit,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react"
import { ContractOverview } from "@/types/contract"
import { formatCurrency } from "@/lib/account-utils"
import { format } from "date-fns"
import { ContractDetailDialog } from "./ContractDetailDialog"
import { CreateAmendmentDialog } from "./CreateAmendmentDialog"

interface ContractListProps {
  contracts: ContractOverview[]
  onContractUpdated: () => void
}

export function ContractList({ contracts, onContractUpdated }: ContractListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailDialogContract, setDetailDialogContract] = useState<ContractOverview | null>(null)
  const [amendmentDialogContract, setAmendmentDialogContract] = useState<ContractOverview | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "expiring_soon":
        return <AlertCircle className="h-5 w-5 text-orange-600" />
      case "expired":
        return <XCircle className="h-5 w-5 text-red-600" />
      case "draft":
        return <FileText className="h-5 w-5 text-gray-400" />
      case "pending_signature":
        return <Clock className="h-5 w-5 text-blue-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "expiring_soon":
        return "bg-orange-100 text-orange-800"
      case "expired":
        return "bg-red-100 text-red-800"
      case "draft":
        return "bg-gray-100 text-gray-800"
      case "pending_signature":
        return "bg-blue-100 text-blue-800"
      case "terminated":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatContractType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ")
  }

  return (
    <>
      <div className="space-y-4">
        {contracts.map((contract) => {
          const isExpanded = expandedId === contract.contract_id
          const displayStatus = contract.derived_status || contract.status

          return (
            <Card key={contract.contract_id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(displayStatus)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{contract.contract_name}</CardTitle>
                        <Badge className={getStatusBadgeColor(displayStatus)}>
                          {formatContractType(displayStatus)}
                        </Badge>
                        {contract.amendments_count > 0 && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            {contract.amendments_count} {contract.amendments_count === 1 ? "Amendment" : "Amendments"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {contract.contract_number}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {contract.counterparty}
                          </span>
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {formatContractType(contract.contract_type)}
                            </Badge>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailDialogContract(contract)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedId(open ? contract.contract_id : null)}>
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Summary Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Effective Date</p>
                    <p className="text-sm font-medium">
                      {format(new Date(contract.effective_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Expiration</p>
                    <p className="text-sm font-medium">
                      {contract.expiration_date
                        ? format(new Date(contract.expiration_date), "MMM d, yyyy")
                        : "Indefinite"}
                    </p>
                    {contract.days_until_expiration !== null && contract.days_until_expiration < 90 && contract.days_until_expiration >= 0 && (
                      <p className="text-xs text-orange-600">{contract.days_until_expiration} days left</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Monthly Obligation</p>
                    <p className="text-sm font-medium font-mono">
                      {formatCurrency(contract.total_monthly_obligation, 'VND')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Schedules</p>
                    <p className="text-sm font-medium">{contract.payment_schedules_count}</p>
                  </div>
                </div>

                {/* Expandable Details */}
                <Collapsible open={isExpanded}>
                  <CollapsibleContent className="space-y-4 pt-4 border-t">
                    {/* Contract Details */}
                    {(contract.payment_terms || contract.notes) && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Contract Details</h4>
                        {contract.payment_terms && (
                          <div className="text-sm mb-2">
                            <span className="text-muted-foreground">Payment Terms:</span> {contract.payment_terms}
                          </div>
                        )}
                        {contract.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Notes:</span> {contract.notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAmendmentDialogContract(contract)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Amendment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailDialogContract(contract)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialogs */}
      {detailDialogContract && (
        <ContractDetailDialog
          contract={detailDialogContract}
          open={!!detailDialogContract}
          onOpenChange={(open) => !open && setDetailDialogContract(null)}
          onSuccess={onContractUpdated}
        />
      )}

      {amendmentDialogContract && (
        <CreateAmendmentDialog
          contract={amendmentDialogContract}
          open={!!amendmentDialogContract}
          onOpenChange={(open) => !open && setAmendmentDialogContract(null)}
          onSuccess={onContractUpdated}
        />
      )}
    </>
  )
}
