"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, Plus } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateLoanDisbursementInput, LOAN_CATEGORY_LABELS } from "@/types/loan"
import { BusinessPartner } from "@/types/business-partner"
import { CreateBusinessPartnerDialog } from "@/components/create-business-partner-dialog"
import { useEntity } from "@/contexts/EntityContext"

interface CreateLoanDisbursementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: number
  accountName?: string
  prefilledSourceAccountId?: number
  prefilledAmount?: number
  prefilledDate?: string
  existingSourceTransactionId?: number  // When matching, links to existing transaction
  onSuccess: () => void
}

export function CreateLoanDisbursementDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  prefilledSourceAccountId,
  prefilledAmount,
  prefilledDate,
  existingSourceTransactionId,
  onSuccess,
}: CreateLoanDisbursementDialogProps) {
  const { currentEntity } = useEntity()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [sourceAccounts, setSourceAccounts] = useState<any[]>([])
  const [loanAccounts, setLoanAccounts] = useState<any[]>([])
  const [isCreatePartnerOpen, setIsCreatePartnerOpen] = useState(false)

  const [formData, setFormData] = useState<CreateLoanDisbursementInput>({
    account_id: accountId || 0,
    source_account_id: prefilledSourceAccountId || 0,
    partner_id: 0,
    loan_category: "short_term",
    principal_amount: prefilledAmount || 0,
    disbursement_date: prefilledDate || new Date().toISOString().split('T')[0],
    due_date: null,
    term_months: null,
    interest_rate: null,
    notes: null,
  })

  // Fetch partners, source accounts, and loan accounts when dialog opens
  useEffect(() => {
    if (open && currentEntity) {
      fetchPartners()
      fetchSourceAccounts()
      fetchLoanAccounts()
    }
  }, [open, currentEntity])

  // Reset and initialize form when dialog opens with prefilled values
  useEffect(() => {
    if (open) {
      setFormData({
        account_id: accountId || 0,
        source_account_id: prefilledSourceAccountId || 0,
        partner_id: 0,
        loan_category: "short_term",
        principal_amount: prefilledAmount || 0,
        disbursement_date: prefilledDate || new Date().toISOString().split('T')[0],
        due_date: null,
        term_months: null,
        interest_rate: null,
        notes: null,
      })
    }
  }, [open, accountId, prefilledSourceAccountId, prefilledAmount, prefilledDate])

  async function fetchPartners() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/business-partners?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        setPartners(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    }
  }

  async function fetchSourceAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show bank, cash accounts (sources for disbursement)
        const validSources = (data.data || []).filter((acc: any) =>
          ['bank', 'cash'].includes(acc.account_type)
        )
        setSourceAccounts(validSources)
      }
    } catch (error) {
      console.error('Error fetching source accounts:', error)
    }
  }

  async function fetchLoanAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show loan_receivable accounts
        const validLoanAccounts = (data.data || []).filter((acc: any) =>
          acc.account_type === 'loan_receivable'
        )
        setLoanAccounts(validLoanAccounts)
      }
    } catch (error) {
      console.error('Error fetching loan accounts:', error)
    }
  }

  function handlePartnerCreated(partner: BusinessPartner) {
    setPartners([...partners, partner])
    setFormData({ ...formData, partner_id: partner.partner_id })
    setIsCreatePartnerOpen(false)
  }

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        account_id: accountId ?? 0,
        source_account_id: 0,
        partner_id: 0,
        loan_category: "short_term",
        principal_amount: 0,
        disbursement_date: new Date().toISOString().split('T')[0],
        due_date: null,
        term_months: null,
        interest_rate: null,
        notes: null,
      })
      setError(null)
    }
  }, [open, accountId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validation
      if (!formData.source_account_id) {
        setError("Please select a source account")
        return
      }
      if (!formData.partner_id) {
        setError("Please select a borrower")
        return
      }
      if (!formData.principal_amount || formData.principal_amount <= 0) {
        setError("Principal amount must be greater than 0")
        return
      }

      const requestBody = {
        ...formData,
        existing_source_transaction_id: existingSourceTransactionId,
      }

      console.log('=== CreateLoanDisbursementDialog - Submitting ===')
      console.log('existingSourceTransactionId prop:', existingSourceTransactionId)
      console.log('Request body:', requestBody)
      console.log('=================================================')

      const response = await fetch("/api/loan-disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create loan disbursement")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Loan Disbursement</DialogTitle>
          <DialogDescription>
            {accountName ? `Record a loan given from ${accountName}` : 'Record a new loan disbursement'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loan Account Selection - only show if accountId not provided */}
            {!accountId && (
              <div className="space-y-2">
                <Label htmlFor="account_id">Loan Receivable Account *</Label>
                <Select
                  value={formData.account_id ? formData.account_id.toString() : ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_id: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a loan receivable account" />
                  </SelectTrigger>
                  <SelectContent>
                    {loanAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Borrower Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Borrower Information</h3>

              <div className="space-y-2">
                <Label htmlFor="partner_id">Borrower *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.partner_id ? formData.partner_id.toString() : ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, partner_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a borrower" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((partner) => (
                        <SelectItem key={partner.partner_id} value={partner.partner_id.toString()}>
                          {partner.display_name || partner.partner_name} ({partner.partner_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreatePartnerOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select an existing contact or create a new one
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source_account_id">Source Account (Disburse From) *</Label>
                <Select
                  value={formData.source_account_id ? formData.source_account_id.toString() : ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, source_account_id: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name} ({account.account_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The bank or cash account that will disburse the loan funds
                </p>
              </div>
            </div>

            {/* Loan Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Loan Details</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="principal_amount">Principal Amount *</Label>
                  <Input
                    id="principal_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.principal_amount || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        principal_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loan_category">Loan Category *</Label>
                  <Select
                    value={formData.loan_category}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, loan_category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOAN_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disbursement_date">Disbursement Date *</Label>
                  <Input
                    id="disbursement_date"
                    type="date"
                    value={formData.disbursement_date}
                    onChange={(e) =>
                      setFormData({ ...formData, disbursement_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value || null })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="term_months">Term (Months)</Label>
                  <Input
                    id="term_months"
                    type="number"
                    min="1"
                    value={formData.term_months || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        term_months: parseInt(e.target.value) || null,
                      })
                    }
                    placeholder="e.g., 12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.interest_rate || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interest_rate: parseFloat(e.target.value) || null,
                      })
                    }
                    placeholder="e.g., 5.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    For reference only (not auto-calculated)
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
                }
                placeholder="Optional notes about this loan..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {currentEntity && (
        <CreateBusinessPartnerDialog
          open={isCreatePartnerOpen}
          onOpenChange={setIsCreatePartnerOpen}
          entityId={currentEntity.id}
          onSuccess={handlePartnerCreated}
          defaultPartnerType="other"
        />
      )}
    </Dialog>
  )
}
