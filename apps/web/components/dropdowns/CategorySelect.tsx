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

interface CategorySelectProps {
  value: string
  onValueChange: (value: string) => void
  typeId?: number
  entityType?: EntityType
  placeholder?: string
  disabled?: boolean
  className?: string
  allowNone?: boolean
  noneLabel?: string
  includeUnchanged?: boolean // For bulk edit dialogs
}

export function CategorySelect({
  value,
  onValueChange,
  typeId,
  entityType,
  placeholder = "Select category",
  disabled = false,
  className,
  allowNone = true,
  noneLabel = "None",
  includeUnchanged = false,
}: CategorySelectProps) {
  const { getCategories, loading } = useTransactionData()

  const filteredCategories = useMemo(() => {
    return getCategories({ typeId, entityType })
  }, [getCategories, typeId, entityType])

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
        {allowNone && (
          <SelectItem value="none">{noneLabel}</SelectItem>
        )}
        {filteredCategories.map((category) => (
          <SelectItem key={category.category_id} value={category.category_id.toString()}>
            {category.category_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
