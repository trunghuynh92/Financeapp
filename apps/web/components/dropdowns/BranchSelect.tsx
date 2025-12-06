"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTransactionData } from "@/contexts/TransactionDataContext"
import { Loader2 } from "lucide-react"

interface BranchSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowNone?: boolean
  noneLabel?: string
  includeUnchanged?: boolean
}

export function BranchSelect({
  value,
  onValueChange,
  placeholder = "Select branch",
  disabled = false,
  className,
  allowNone = true,
  noneLabel = "None",
  includeUnchanged = false,
}: BranchSelectProps) {
  const { getBranches, loading } = useTransactionData()

  const branches = useMemo(() => getBranches(), [getBranches])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    )
  }

  // Don't render if no branches available
  if (branches.length === 0 && !allowNone) {
    return null
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeUnchanged && (
          <SelectItem value="unchanged">-- Keep unchanged --</SelectItem>
        )}
        {allowNone && (
          <SelectItem value="none">{noneLabel}</SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
            {branch.branch_name}
            {branch.branch_code && ` (${branch.branch_code})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
