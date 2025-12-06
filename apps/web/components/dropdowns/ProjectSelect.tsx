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

interface ProjectSelectProps {
  value: string
  onValueChange: (value: string) => void
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
  placeholder?: string
  disabled?: boolean
  className?: string
  allowNone?: boolean
  noneLabel?: string
  includeUnchanged?: boolean
}

export function ProjectSelect({
  value,
  onValueChange,
  status,
  placeholder = "Select project",
  disabled = false,
  className,
  allowNone = true,
  noneLabel = "None",
  includeUnchanged = false,
}: ProjectSelectProps) {
  const { getProjects, loading } = useTransactionData()

  const projects = useMemo(() => getProjects(status), [getProjects, status])

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

  // Don't render if no projects available
  if (projects.length === 0 && !allowNone) {
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
        {projects.map((project) => (
          <SelectItem key={project.project_id} value={project.project_id.toString()}>
            {project.project_name}
            {project.project_code && ` (${project.project_code})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
