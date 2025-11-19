"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
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
import { CreateInvestmentContributionInput } from "@/types/investment"
import { useEntity } from "@/contexts/EntityContext"

interface CreateInvestmentContributionDialogProps {
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

export function CreateInvestmentContributionDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  prefilledSourceAccountId,
  prefilledAmount,
  prefilledDate,
  existingSourceTransactionId,
  onSuccess,
}: CreateInvestmentContributionDialogProps) {
  const { currentEntity } = useEntity()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceAccounts, setSourceAccounts] = useState<any[]>([])
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([])

  const [formData, setFormData] = useState<CreateInvestmentContributionInput>({
    investment_account_id: accountId || 0,
    source_account_id: prefilledSourceAccountId || 0,
    contribution_amount: prefilledAmount || 0,
    contribution_date: prefilledDate || new Date().toISOString().split('T')[0],
    notes: null,
  })

  // Fetch source accounts and investment accounts when dialog opens
  useEffect(() => {
    if (open && currentEntity) {
      fetchSourceAccounts()
      fetchInvestmentAccounts()
    }
  }, [open, currentEntity])

  // Reset and initialize form when dialog opens with prefilled values
  useEffect(() => {
    if (open) {
      setFormData({
        investment_account_id: accountId || 0,
        source_account_id: prefilledSourceAccountId || 0,
        contribution_amount: prefilledAmount || 0,
        contribution_date: prefilledDate || new Date().toISOString().split('T')[0],
        notes: null,
      })
    }
  }, [open, accountId, prefilledSourceAccountId, prefilledAmount, prefilledDate])

  async function fetchSourceAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show bank, cash accounts (sources for contribution)
        const validSources = (data.data || []).filter((acc: any) =>
          ['bank', 'cash'].includes(acc.account_type)
        )
        setSourceAccounts(validSources)
      }
    } catch (error) {
      console.error('Error fetching source accounts:', error)
    }
  }

  async function fetchInvestmentAccounts() {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/accounts?entity_id=${currentEntity.id}`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show investment accounts
        const validInvestmentAccounts = (data.data || []).filter((acc: any) =>
          acc.account_type === 'investment'
        )
        setInvestmentAccounts(validInvestmentAccounts)
      }
    } catch (error) {
      console.error('Error fetching investment accounts:', error)
    }
  }

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        investment_account_id: accountId ?? 0,
        source_account_id: 0,
        contribution_amount: 0,
        contribution_date: new Date().toISOString().split('T')[0],
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
      if (!formData.contribution_amount || formData.contribution_amount <= 0) {
        setError("Contribution amount must be greater than 0")
        return
      }

      // Prepare request body - omit investment_account_id if it's 0 (auto-create)
      const requestBody: any = {
        ...formData,
        existing_source_transaction_id: existingSourceTransactionId,
      }

      // If account_id is 0 or undefined, remove it to trigger auto-creation
      if (!requestBody.investment_account_id) {
        delete requestBody.investment_account_id
      }

      const response = await fetch('/api/investment-contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create investment contribution')
      }

      // Success! Call onSuccess callback
      onSuccess()

      // Show success message if account was auto-created
      if (result.account_auto_created) {
        console.log('Investment account auto-created:', result.investment_account_id)
      }
    } catch (err) {
      console.error('Error creating investment contribution:', err)
      setError(err instanceof Error ? err.message : 'Failed to create investment contribution')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedSourceAccount = sourceAccounts.find(
    (acc) => acc.account_id === formData.source_account_id
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Investment Contribution</DialogTitle>
          <DialogDescription>
            {existingSourceTransactionId
              ? 'Link this transaction to a new investment contribution'
              : 'Record a new investment contribution from your bank/cash account'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Source Account */}
            <div className="grid gap-2">
              <Label htmlFor="source_account_id">
                Source Account <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.source_account_id.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, source_account_id: parseInt(value, 10) })
                }
                disabled={!!prefilledSourceAccountId || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source account..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={acc.account_id.toString()}>
                      {acc.account_name} ({acc.account_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The bank or cash account providing the funds
              </p>
            </div>

            {/* Investment Account (Optional) */}
            <div className="grid gap-2">
              <Label htmlFor="investment_account_id">
                Investment Account <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Select
                value={formData.investment_account_id?.toString() || "0"}
                onValueChange={(value) =>
                  setFormData({ ...formData, investment_account_id: parseInt(value, 10) })
                }
                disabled={!!accountId || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto-create if not selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Auto-create Investment account</SelectItem>
                  {investmentAccounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={acc.account_id.toString()}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-create an Investment account
              </p>
            </div>

            {/* Contribution Amount */}
            <div className="grid gap-2">
              <Label htmlFor="contribution_amount">
                Contribution Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contribution_amount"
                type="number"
                step="0.01"
                value={formData.contribution_amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contribution_amount: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={!!prefilledAmount || isSubmitting}
                required
              />
            </div>

            {/* Contribution Date */}
            <div className="grid gap-2">
              <Label htmlFor="contribution_date">
                Contribution Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contribution_date"
                type="date"
                value={formData.contribution_date}
                onChange={(e) =>
                  setFormData({ ...formData, contribution_date: e.target.value })
                }
                disabled={!!prefilledDate || isSubmitting}
                required
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
                }
                disabled={isSubmitting}
                placeholder="Optional notes about this investment..."
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
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
              {isSubmitting ? 'Creating...' : 'Create Contribution'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
