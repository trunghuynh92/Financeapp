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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Account {
  account_id: number
  account_name: string
  bank_name: string
  account_type: string
}

interface AssignReceivingAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawdownId: number
  drawdownReference: string
  creditLineAccountId: number
  onSuccess?: () => void
}

export function AssignReceivingAccountDialog({
  open,
  onOpenChange,
  drawdownId,
  drawdownReference,
  creditLineAccountId,
  onSuccess,
}: AssignReceivingAccountDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      fetchAccounts()
    }
  }, [open])

  async function fetchAccounts() {
    try {
      setLoading(true)
      const response = await fetch('/api/accounts')

      if (!response.ok) {
        throw new Error('Failed to fetch accounts')
      }

      const data = await response.json()

      // Filter out the credit line account itself
      const filteredAccounts = (data.data || []).filter(
        (account: Account) => account.account_id !== creditLineAccountId
      )

      setAccounts(filteredAccounts)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!selectedAccountId) {
      alert('Please select a receiving account')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch(`/api/drawdowns/${drawdownId}/assign-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiving_account_id: parseInt(selectedAccountId),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign receiving account')
      }

      onSuccess?.()
      onOpenChange(false)
      setSelectedAccountId("")
    } catch (error) {
      console.error('Error assigning receiving account:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign receiving account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Receiving Account</DialogTitle>
          <DialogDescription>
            Select which account received the funds from drawdown: {drawdownReference}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="receiving-account">Receiving Account</Label>
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              disabled={loading || submitting}
            >
              <SelectTrigger id="receiving-account">
                <SelectValue placeholder={loading ? "Loading accounts..." : "Select an account"} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id.toString()}>
                    {account.account_name} - {account.bank_name || account.account_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This will create a DEBT_ACQ transaction on the selected account that matches the drawdown.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAccountId || submitting}
          >
            {submitting ? "Assigning..." : "Assign Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
