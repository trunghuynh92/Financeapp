"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTransactionData, EntityType } from "@/contexts/TransactionDataContext"
import { Loader2 } from "lucide-react"

interface TransactionTypeSelectProps {
  value: string
  onValueChange: (value: string) => void
  accountType?: string
  direction?: 'debit' | 'credit'
  entityType?: EntityType
  placeholder?: string
  disabled?: boolean
  className?: string
  includeUnchanged?: boolean // For bulk edit dialogs
}

export function TransactionTypeSelect({
  value,
  onValueChange,
  accountType,
  direction,
  entityType,
  placeholder = "Select type",
  disabled = false,
  className,
  includeUnchanged = false,
}: TransactionTypeSelectProps) {
  const { getTransactionTypes, loading } = useTransactionData()

  const filteredTypes = useMemo(() => {
    return getTransactionTypes({ accountType, direction, entityType })
  }, [getTransactionTypes, accountType, direction, entityType])

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

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeUnchanged && (
          <SelectItem value="unchanged">-- Keep unchanged --</SelectItem>
        )}
        {filteredTypes.map((type) => (
          <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
            {type.type_display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
