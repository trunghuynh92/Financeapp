"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { useEntity } from "@/contexts/EntityContext"

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'company' | 'personal'

interface TransactionDataContextType {
  // Raw data
  transactionTypes: TransactionType[]
  categories: Category[]
  branches: Branch[]
  projects: Project[]

  // Loading states
  loading: boolean
  error: string | null

  // Refresh function
  refresh: () => Promise<void>

  // Filtered getters
  getTransactionTypes: (options?: {
    accountType?: string
    direction?: 'debit' | 'credit'
    entityType?: EntityType
  }) => TransactionType[]

  getCategories: (options?: {
    typeId?: number
    entityType?: EntityType
  }) => Category[]

  getBranches: () => Branch[]
  getProjects: (status?: string) => Project[]
}

const TransactionDataContext = createContext<TransactionDataContextType | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface TransactionDataProviderProps {
  children: ReactNode
}

export function TransactionDataProvider({ children }: TransactionDataProviderProps) {
  const { currentEntity } = useEntity()

  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all transaction data
  const fetchData = useCallback(async () => {
    if (!currentEntity) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch all data in parallel
      const [typesRes, categoriesRes, branchesRes, projectsRes] = await Promise.all([
        fetch('/api/transaction-types'),
        fetch(`/api/categories?entity_id=${currentEntity.id}`),
        fetch(`/api/branches?entity_id=${currentEntity.id}`),
        fetch(`/api/projects?entity_id=${currentEntity.id}`),
      ])

      if (!typesRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to fetch transaction data')
      }

      const [typesData, categoriesData, branchesData, projectsData] = await Promise.all([
        typesRes.json(),
        categoriesRes.json(),
        branchesRes.ok ? branchesRes.json() : { data: [] },
        projectsRes.ok ? projectsRes.json() : { data: [] },
      ])

      setTransactionTypes(typesData.data || [])
      setCategories(categoriesData.data || [])
      setBranches(branchesData.data || [])
      setProjects(projectsData.data || [])
    } catch (err) {
      console.error('Error fetching transaction data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [currentEntity?.id])

  // Fetch on mount and when entity changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ============================================================================
  // Filtered Getters
  // ============================================================================

  /**
   * Get filtered transaction types based on account type, direction, and entity type
   */
  const getTransactionTypes = useCallback((options?: {
    accountType?: string
    direction?: 'debit' | 'credit'
    entityType?: EntityType
  }) => {
    let filtered = transactionTypes.filter(t => t.is_active)

    // Filter by entity type (personal vs business)
    if (options?.entityType) {
      const entityTypeFilter = options.entityType === 'company' ? 'business' : 'personal'
      filtered = filtered.filter(t => {
        const typeEntityType = (t as any).entity_type || 'both'
        return typeEntityType === 'both' || typeEntityType === entityTypeFilter
      })
    }

    // Filter by account type and direction using rules
    if (options?.accountType && options?.direction) {
      const { getFilteredTransactionTypes } = require('@/lib/transaction-type-rules')
      filtered = getFilteredTransactionTypes(
        options.accountType,
        options.direction,
        filtered
      )
    }

    return filtered.sort((a, b) => a.display_order - b.display_order)
  }, [transactionTypes])

  /**
   * Get filtered categories based on transaction type and entity type
   */
  const getCategories = useCallback((options?: {
    typeId?: number
    entityType?: EntityType
  }) => {
    let filtered = categories.filter(c => c.is_active)

    // Filter by transaction type
    if (options?.typeId) {
      filtered = filtered.filter(c => c.transaction_type_id === options.typeId)
    }

    // Filter by entity type
    if (options?.entityType) {
      const entityTypeFilter = options.entityType === 'company' ? 'business' : 'personal'
      filtered = filtered.filter(c => {
        return c.entity_type === 'both' || c.entity_type === entityTypeFilter
      })
    }

    return filtered.sort((a, b) => a.display_order - b.display_order)
  }, [categories])

  /**
   * Get branches for current entity
   */
  const getBranches = useCallback(() => {
    return branches.filter(b => b.is_active).sort((a, b) =>
      a.branch_name.localeCompare(b.branch_name)
    )
  }, [branches])

  /**
   * Get projects, optionally filtered by status
   */
  const getProjects = useCallback((status?: string) => {
    let filtered = projects.filter(p => p.is_active)

    if (status) {
      filtered = filtered.filter(p => p.status === status)
    }

    return filtered.sort((a, b) => a.project_name.localeCompare(b.project_name))
  }, [projects])

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: TransactionDataContextType = {
    transactionTypes,
    categories,
    branches,
    projects,
    loading,
    error,
    refresh: fetchData,
    getTransactionTypes,
    getCategories,
    getBranches,
    getProjects,
  }

  return (
    <TransactionDataContext.Provider value={value}>
      {children}
    </TransactionDataContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useTransactionData() {
  const context = useContext(TransactionDataContext)
  if (!context) {
    throw new Error('useTransactionData must be used within a TransactionDataProvider')
  }
  return context
}
