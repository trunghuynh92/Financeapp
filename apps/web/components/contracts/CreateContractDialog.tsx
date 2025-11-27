"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, AlertCircle } from "lucide-react"
import { useEntity } from "@/contexts/EntityContext"
import { ContractType, ContractStatus } from "@/types/contract"
import { BusinessPartner, PARTNER_TYPE_LABELS } from "@/types/business-partner"
import { CreateBusinessPartnerDialog } from "@/components/business-partners/CreateBusinessPartnerDialog"

interface CreateContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingContract?: any | null
}

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
  editingContract
}: CreateContractDialogProps) {
  const { currentEntity } = useEntity()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Business partners state
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [createPartnerDialogOpen, setCreatePartnerDialogOpen] = useState(false)

  // Form state
  const [contractNumber, setContractNumber] = useState("")
  const [contractName, setContractName] = useState("")
  const [contractType, setContractType] = useState<ContractType>("lease")
  const [counterparty, setCounterparty] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [expirationDate, setExpirationDate] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [renewalTerms, setRenewalTerms] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ContractStatus>("draft")

  // Fetch business partners when dialog opens
  useEffect(() => {
    if (open && currentEntity) {
      fetchBusinessPartners()
    }
  }, [open, currentEntity])

  // Populate form when editing
  useEffect(() => {
    if (editingContract && open) {
      setContractNumber(editingContract.contract_number || "")
      setContractName(editingContract.contract_name || "")
      setContractType(editingContract.contract_type || "lease")
      setCounterparty(editingContract.counterparty || "")
      setEffectiveDate(editingContract.effective_date || "")
      setExpirationDate(editingContract.expiration_date || "")
      setPaymentTerms(editingContract.payment_terms || "")
      setRenewalTerms(editingContract.renewal_terms || "")
      setNotes(editingContract.notes || "")
      setStatus(editingContract.status || "draft")
    } else if (open) {
      resetForm()
    }
  }, [editingContract, open])

  const fetchBusinessPartners = async () => {
    if (!currentEntity) return

    setPartnersLoading(true)
    try {
      const response = await fetch(`/api/business-partners?entity_id=${currentEntity.id}&is_active=true`)
      if (response.ok) {
        const data = await response.json()
        setBusinessPartners(data.data || [])
      }
    } catch (err) {
      console.error("Error fetching business partners:", err)
    } finally {
      setPartnersLoading(false)
    }
  }

  const handlePartnerSelect = (partnerIdStr: string) => {
    if (partnerIdStr === "create-new") {
      setCreatePartnerDialogOpen(true)
      return
    }

    const partnerId = parseInt(partnerIdStr)
    const partner = businessPartners.find(p => p.partner_id === partnerId)
    if (partner) {
      setSelectedPartnerId(partnerId)
      setCounterparty(partner.partner_name)
    }
  }

  const handlePartnerCreated = () => {
    fetchBusinessPartners()
  }

  const resetForm = () => {
    setContractNumber("")
    setContractName("")
    setContractType("lease")
    setCounterparty("")
    setEffectiveDate("")
    setExpirationDate("")
    setPaymentTerms("")
    setRenewalTerms("")
    setNotes("")
    setStatus("draft")
    setError(null)
    setSelectedPartnerId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentEntity) return

    // Validation
    if (!contractNumber.trim()) {
      setError("Contract number is required")
      return
    }

    if (!contractName.trim()) {
      setError("Contract name is required")
      return
    }

    if (!counterparty.trim()) {
      setError("Counterparty is required")
      return
    }

    if (!effectiveDate) {
      setError("Effective date is required")
      return
    }

    if (expirationDate && new Date(expirationDate) < new Date(effectiveDate)) {
      setError("Expiration date must be after effective date")
      return
    }

    setLoading(true)

    try {
      const body: any = {
        entity_id: currentEntity.id,
        contract_number: contractNumber.trim(),
        contract_name: contractName.trim(),
        contract_type: contractType,
        counterparty: counterparty.trim(),
        effective_date: effectiveDate,
        expiration_date: expirationDate || undefined,
        payment_terms: paymentTerms.trim() || undefined,
        renewal_terms: renewalTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        status: status
      }

      const url = editingContract
        ? `/api/contracts/${editingContract.contract_id}`
        : `/api/contracts`

      const method = editingContract ? "PATCH" : "POST"

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
        setError(error.error || "Failed to save contract")
      }
    } catch (err) {
      console.error("Error saving contract:", err)
      setError("Failed to save contract")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingContract ? "Edit Contract" : "Create New Contract"}
          </DialogTitle>
          <DialogDescription>
            Create a master contract/agreement for tracking payments and amendments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractNumber">Contract Number *</Label>
                <Input
                  id="contractNumber"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="e.g., LEASE-2025-001"
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
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="supply">Supply</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractName">Contract Name *</Label>
              <Input
                id="contractName"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="e.g., Office Lease - 413 Le Van Sy"
                required
              />
            </div>
          </div>

          {/* Counterparty Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Counterparty</h3>

            <div className="space-y-2">
              <Label htmlFor="counterparty">Counterparty Name *</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedPartnerId?.toString() || ""}
                  onValueChange={handlePartnerSelect}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a business partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessPartners.map((partner) => (
                      <SelectItem key={partner.partner_id} value={partner.partner_id.toString()}>
                        {partner.partner_name} ({PARTNER_TYPE_LABELS[partner.partner_type]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCreatePartnerDialogOpen(true)}
                  title="Create new business partner"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contract Dates</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date *</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for indefinite
                </p>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Terms & Conditions</h3>

            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Textarea
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g., Net 30, Monthly in advance"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="renewalTerms">Renewal Terms</Label>
              <Textarea
                id="renewalTerms"
                value={renewalTerms}
                onChange={(e) => setRenewalTerms(e.target.value)}
                placeholder="e.g., Auto-renew for 1 year unless 90 days notice"
                rows={2}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_signature">Pending Signature</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
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
              ) : editingContract ? (
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

    {/* Create Business Partner Dialog */}
    <CreateBusinessPartnerDialog
      open={createPartnerDialogOpen}
      onOpenChange={setCreatePartnerDialogOpen}
      onSuccess={handlePartnerCreated}
    />
  </>
  )
}
