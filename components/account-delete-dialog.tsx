"use client"

import { useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Account } from "@/types/account"

interface AccountDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  onSuccess: () => void
}

export function AccountDeleteDialog({
  open,
  onOpenChange,
  account,
  onSuccess,
}: AccountDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!account) return

    try {
      setLoading(true)

      const response = await fetch(`/api/accounts/${account.account_id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete account")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error deleting account:", error)
      alert(error.message || "Failed to delete account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3 space-y-2">
            <p>
              Are you sure you want to delete <span className="font-semibold">{account?.account_name}</span>?
            </p>
            <p className="text-destructive">
              This will also delete all associated transactions (when implemented).
            </p>
            <p>
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
