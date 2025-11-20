"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Edit, Search, Filter, X, Split, Check, Link2, Plus, Trash2, Loader2, Info, CalendarIcon, Flag } from "lucide-react"
import { MainTransactionDetails, TransactionType, Category, Branch, Project } from "@/types/main-transaction"
import { EditTransactionDialog } from "@/components/main-transactions/EditTransactionDialog"
import { getFilteredTransactionTypes, AccountType, TransactionDirection } from "@/lib/transaction-type-rules"
import { SplitTransactionDialog } from "@/components/main-transactions/SplitTransactionDialog"
import { BulkEditDialog } from "@/components/main-transactions/BulkEditDialog"
import { QuickMatchTransferDialog } from "@/components/main-transactions/QuickMatchTransferDialog"
import { QuickMatchDebtDialog } from "@/components/main-transactions/QuickMatchDebtDialog"
import { QuickMatchLoanDialog } from "@/components/main-transactions/QuickMatchLoanDialog"
import { QuickMatchInvestmentDialog } from "@/components/main-transactions/QuickMatchInvestmentDialog"
import { UnmatchInvestmentDialog } from "@/components/main-transactions/UnmatchInvestmentDialog"
import { QuickPayCreditCardDialog } from "@/components/main-transactions/QuickPayCreditCardDialog"
import { SelectDrawdownDialog } from "@/components/main-transactions/SelectDrawdownDialog"
import { InlineCombobox } from "@/components/main-transactions/InlineCombobox"
import { AddTransactionDialog } from "@/components/main-transactions/AddTransactionDialog"
import { DeleteSplitWarningDialog } from "@/components/main-transactions/DeleteSplitWarningDialog"
import { useEntity } from "@/contexts/EntityContext"
import { useDebounce } from "@/hooks/useDebounce"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MainTransactionsPage() {
  const { currentEntity, loading: entityLoading } = useEntity()
  const { toast } = useToast()

  // Data state
  const [transactions, setTransactions] = useState<MainTransactionDetails[]>([])
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedDirection, setSelectedDirection] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })
  const [searchQuery, setSearchQuery] = useState("")
  const [amountOperator, setAmountOperator] = useState<string>("all")
  const [amountValue, setAmountValue] = useState<string>("")

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  // Column visibility state
  const [showBranchColumn, setShowBranchColumn] = useState(false)
  const [showProjectColumn, setShowProjectColumn] = useState(false)

  // Advanced mode state - false = simple mode (bank/cash only), true = advanced mode (all account types)
  const [advancedMode, setAdvancedMode] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Sorting state
  const [sortField, setSortField] = useState<string>('transaction_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<MainTransactionDetails | null>(null)

  // Split dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [splitTransaction, setSplitTransaction] = useState<MainTransactionDetails | null>(null)

  // Create category dialog state
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryType, setNewCategoryType] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [createCategoryContext, setCreateCategoryContext] = useState<{transactionId: number, transactionIndex: number} | null>(null)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null)
  const [savingCell, setSavingCell] = useState<{row: number, field: string} | null>(null)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false)

  // Quick match dialog state
  const [quickMatchDialogOpen, setQuickMatchDialogOpen] = useState(false)
  const [quickMatchDebtDialogOpen, setQuickMatchDebtDialogOpen] = useState(false)
  const [quickMatchLoanDialogOpen, setQuickMatchLoanDialogOpen] = useState(false)
  const [quickMatchInvestmentDialogOpen, setQuickMatchInvestmentDialogOpen] = useState(false)
  const [unmatchInvestmentDialogOpen, setUnmatchInvestmentDialogOpen] = useState(false)
  const [quickPayCreditCardDialogOpen, setQuickPayCreditCardDialogOpen] = useState(false)
  const [selectDrawdownDialogOpen, setSelectDrawdownDialogOpen] = useState(false)

  // Add transaction dialog state
  const [addTransactionDialogOpen, setAddTransactionDialogOpen] = useState(false)

  // Delete split warning dialog state
  const [deleteSplitWarningOpen, setDeleteSplitWarningOpen] = useState(false)
  const [splitTransactionsToDelete, setSplitTransactionsToDelete] = useState<MainTransactionDetails[]>([])
  const [pendingDeleteRawId, setPendingDeleteRawId] = useState<string | null>(null)

  // Filter persistence state
  const [filtersSaved, setFiltersSaved] = useState(false)
  const [savedPresets, setSavedPresets] = useState<Array<{name: string, filters: any}>>([])
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false)
  const [newPresetName, setNewPresetName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string>("")

  // Fetch transaction types, categories, branches, accounts on mount
  useEffect(() => {
    if (!currentEntity) return

    const fetchMetadata = async () => {
      try {
        const params = new URLSearchParams()
        params.set('entity_id', currentEntity.id)
        params.set('limit', '1000')

        const [typesRes, categoriesRes, branchesRes, projectsRes, accountsRes] = await Promise.all([
          fetch("/api/transaction-types"),
          fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true`),
          fetch("/api/branches"),
          fetch(`/api/projects?entity_id=${currentEntity.id}`),
          fetch(`/api/accounts?${params.toString()}`),
        ])

        if (typesRes.ok) {
          const typesData = await typesRes.json()
          setTransactionTypes(typesData.data || [])
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(categoriesData.data || [])
        }

        if (branchesRes.ok) {
          const branchesData = await branchesRes.json()
          setBranches(branchesData.data || [])
        }

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json()
          setProjects(projectsData.data || [])
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json()
          setAccounts(accountsData.data || [])
        }
      } catch (error) {
        console.error("Error fetching metadata:", error)
      }
    }

    fetchMetadata()
  }, [currentEntity?.id])

  // Load saved filter presets from localStorage on mount
  useEffect(() => {
    if (!currentEntity) return

    try {
      const savedPresetsData = localStorage.getItem(`filter_presets_${currentEntity.id}`)
      if (savedPresetsData) {
        const presets = JSON.parse(savedPresetsData)
        setSavedPresets(presets)
        console.log('Loaded filter presets from localStorage:', presets)
      }
    } catch (error) {
      console.error('Error loading filter presets:', error)
    }
  }, [currentEntity?.id])

  // Sync dateRange with startDate/endDate
  useEffect(() => {
    if (dateRange.from) {
      setStartDate(dateRange.from.toISOString().split('T')[0])
    } else {
      setStartDate("")
    }

    if (dateRange.to) {
      setEndDate(dateRange.to.toISOString().split('T')[0])
    } else {
      setEndDate("")
    }

    setCurrentPage(1)
  }, [dateRange])

  // Fetch transactions when filters or pagination or sorting change
  // Use debouncedSearchQuery instead of searchQuery to reduce API calls
  useEffect(() => {
    if (currentEntity) {
      fetchTransactions()
    }
  }, [currentEntity?.id, currentPage, itemsPerPage, selectedAccount, selectedType, selectedCategory, selectedBranch, selectedProject, selectedDirection, startDate, endDate, debouncedSearchQuery, amountOperator, amountValue, sortField, sortDirection, advancedMode])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      if (!currentEntity) return

      const params = new URLSearchParams()
      params.append("page", currentPage.toString())
      params.append("limit", itemsPerPage.toString())

      // CRITICAL: Always filter by current entity
      params.append("entity_id", currentEntity.id)

      // Sorting
      params.append("sort_field", sortField)
      params.append("sort_direction", sortDirection)

      if (selectedAccount !== "all") params.append("account_id", selectedAccount)
      if (selectedType !== "all") params.append("transaction_type_id", selectedType)
      if (selectedCategory !== "all") params.append("category_id", selectedCategory)
      if (selectedBranch !== "all") params.append("branch_id", selectedBranch)
      if (selectedProject !== "all") params.append("project_id", selectedProject)
      if (selectedDirection !== "all") params.append("transaction_direction", selectedDirection)
      if (startDate) params.append("start_date", startDate)
      if (endDate) params.append("end_date", endDate)
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery)
      if (amountOperator !== "all" && amountValue) {
        params.append("amount_operator", amountOperator)
        params.append("amount_value", amountValue)
      }

      // Simple mode: only show bank and cash accounts (user-friendly for non-accountants)
      // Advanced mode: show all account types including asset/liability accounts
      if (!advancedMode) {
        params.append("account_types", "bank,cash")
      }

      const response = await fetch(`/api/main-transactions?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()
      console.log('First transaction from API:', data.data?.[0])
      setTransactions(data.data || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field with default descending order
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const clearFilters = () => {
    setSelectedAccount("all")
    setSelectedType("all")
    setSelectedCategory("all")
    setSelectedBranch("all")
    setSelectedProject("all")
    setSelectedDirection("all")
    setStartDate("")
    setEndDate("")
    setDateRange({ from: undefined, to: undefined })
    setSearchQuery("")
    setAmountOperator("all")
    setAmountValue("")
    setCurrentPage(1)
    setSelectedPreset("")
  }

  const saveCurrentFiltersAsPreset = () => {
    if (!currentEntity || !newPresetName.trim()) {
      alert("Please enter a preset name")
      return
    }

    const filterData = {
      selectedAccount,
      selectedType,
      selectedCategory,
      selectedBranch,
      selectedProject,
      selectedDirection,
      startDate,
      endDate,
      searchQuery,
      amountOperator,
      amountValue,
      showBranchColumn,
      showProjectColumn,
    }

    const newPreset = { name: newPresetName.trim(), filters: filterData }
    const updatedPresets = [...savedPresets, newPreset]
    setSavedPresets(updatedPresets)

    try {
      localStorage.setItem(`filter_presets_${currentEntity.id}`, JSON.stringify(updatedPresets))
      setFiltersSaved(true)
      setSavePresetDialogOpen(false)
      setNewPresetName("")
      setSelectedPreset(newPresetName.trim())
      console.log('Saved filter preset:', newPresetName)
    } catch (error) {
      console.error('Error saving preset:', error)
      alert('Failed to save preset')
    }
  }

  const loadPreset = (presetName: string) => {
    const preset = savedPresets.find(p => p.name === presetName)
    if (!preset) return

    const { filters } = preset
    setSelectedAccount(filters.selectedAccount || 'all')
    setSelectedType(filters.selectedType || 'all')
    setSelectedCategory(filters.selectedCategory || 'all')
    setSelectedBranch(filters.selectedBranch || 'all')
    setSelectedProject(filters.selectedProject || 'all')
    setSelectedDirection(filters.selectedDirection || 'all')
    setStartDate(filters.startDate || '')
    setEndDate(filters.endDate || '')

    // Restore date range from string dates
    if (filters.startDate || filters.endDate) {
      setDateRange({
        from: filters.startDate ? new Date(filters.startDate) : undefined,
        to: filters.endDate ? new Date(filters.endDate) : undefined,
      })
    } else {
      setDateRange({ from: undefined, to: undefined })
    }

    setSearchQuery(filters.searchQuery || '')
    setAmountOperator(filters.amountOperator || 'all')
    setAmountValue(filters.amountValue || '')
    setShowBranchColumn(filters.showBranchColumn || false)
    setShowProjectColumn(filters.showProjectColumn || false)
    setSelectedPreset(presetName)
    setCurrentPage(1)
    console.log('Loaded preset:', presetName)
  }

  const deletePreset = (presetName: string) => {
    if (!currentEntity) return

    if (!confirm(`Delete preset "${presetName}"?`)) return

    const updatedPresets = savedPresets.filter(p => p.name !== presetName)
    setSavedPresets(updatedPresets)

    try {
      localStorage.setItem(`filter_presets_${currentEntity.id}`, JSON.stringify(updatedPresets))
      if (selectedPreset === presetName) {
        setSelectedPreset("")
      }
      console.log('Deleted preset:', presetName)
    } catch (error) {
      console.error('Error deleting preset:', error)
      alert('Failed to delete preset')
    }
  }

  const handleEditTransaction = (transaction: MainTransactionDetails) => {
    setSelectedTransaction(transaction)
    setEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    fetchTransactions() // Refresh the list
  }

  const handleSplitTransaction = (transaction: MainTransactionDetails) => {
    setSplitTransaction(transaction)
    setSplitDialogOpen(true)
  }

  const handleSplitSuccess = () => {
    fetchTransactions() // Refresh the list
  }

  const handleInlineUpdate = async (
    transactionId: number,
    field: string,
    value: string | number | null,
    rowIndex: number
  ) => {
    setSavingCell({ row: rowIndex, field })
    try {
      const updates: any = {}

      if (field === 'transaction_type_id') {
        updates.transaction_type_id = parseInt(value as string)
        // Reset category when type changes
        updates.category_id = null
      } else if (field === 'category_id') {
        updates.category_id = value === 'none' || !value ? null : parseInt(value as string)
      } else if (field === 'branch_id') {
        updates.branch_id = value === 'none' || !value ? null : parseInt(value as string)
      } else if (field === 'description') {
        updates.description = value || null
      } else if (field === 'notes') {
        updates.notes = value || null
      }

      const response = await fetch(`/api/main-transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      // Update local state with computed display values
      setTransactions(prev => prev.map((tx, idx) => {
        if (idx === rowIndex) {
          const updated = { ...tx, ...updates }

          // Update display fields for type
          if (field === 'transaction_type_id') {
            const type = transactionTypes.find(t => t.transaction_type_id === updates.transaction_type_id)
            if (type) {
              updated.transaction_type = type.type_display_name
              updated.transaction_type_code = type.type_code
              console.log('Updated transaction_type_code to:', type.type_code) // Debug log
            } else {
              console.warn('Transaction type not found for ID:', updates.transaction_type_id)
            }
            // Clear category when type changes
            updated.category_name = null
            updated.category_code = null
          }

          // Update display fields for category
          if (field === 'category_id' && updates.category_id) {
            const category = categories.find(c => c.category_id === updates.category_id)
            if (category) {
              updated.category_name = category.category_name
              updated.category_code = category.category_code
            }
          } else if (field === 'category_id' && !updates.category_id) {
            updated.category_name = null
            updated.category_code = null
          }

          // Update display fields for branch
          if (field === 'branch_id' && updates.branch_id) {
            const branch = branches.find(b => b.branch_id === updates.branch_id)
            if (branch) {
              updated.branch_name = branch.branch_name
              updated.branch_code = branch.branch_code
            }
          } else if (field === 'branch_id' && !updates.branch_id) {
            updated.branch_name = null
            updated.branch_code = null
          }

          // Update display fields for project
          if (field === 'project_id' && updates.project_id) {
            const project = projects.find(p => p.project_id === updates.project_id)
            if (project) {
              updated.project_name = project.project_name
              updated.project_code = project.project_code
              updated.project_status = project.status
            }
          } else if (field === 'project_id' && !updates.project_id) {
            updated.project_name = null
            updated.project_code = null
            updated.project_status = null
          }

          return updated
        }
        return tx
      }))
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction')
    } finally {
      setSavingCell(null)
      setEditingCell(null)
    }
  }

  const fetchCategories = async () => {
    if (!currentEntity) return

    try {
      const response = await fetch(`/api/categories?entity_id=${currentEntity.id}&include_custom=true`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryType) {
      alert("Please enter a category name and select a transaction type")
      return
    }

    setCreatingCategory(true)
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: currentEntity?.id,
          transaction_type_id: parseInt(newCategoryType),
          category_name: newCategoryName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create category')
      }

      const result = await response.json()
      const newCategoryId = result.data?.category_id

      // Refresh categories
      await fetchCategories()

      // If we have context (created from inline edit), apply the new category to that transaction
      if (createCategoryContext && newCategoryId) {
        await handleInlineUpdate(
          createCategoryContext.transactionId,
          'category_id',
          newCategoryId.toString(),
          createCategoryContext.transactionIndex
        )
      }

      // Close dialog and reset
      setCreateCategoryDialogOpen(false)
      setNewCategoryName("")
      setNewCategoryType("")
      setCreateCategoryContext(null)
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  const formatAmount = (amount: number, direction: string) => {
    const formatted = new Intl.NumberFormat("vi-VN").format(amount)
    return direction === "debit" ? `-${formatted}` : `+${formatted}`
  }

  const getDirectionColor = (direction: string) => {
    return direction === "debit" ? "text-red-600" : "text-green-600"
  }

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(transactions.map(tx => tx.main_transaction_id))
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
    setLastSelectedIndex(null)
  }

  const handleSelectRow = (id: number, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedIds)

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift-select: select range
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)

      for (let i = start; i <= end; i++) {
        if (transactions[i]) {
          newSelected.add(transactions[i].main_transaction_id)
        }
      }
    } else {
      // Regular click: toggle selection
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
    }

    setSelectedIds(newSelected)
    setLastSelectedIndex(index)
  }

  const handleBulkEdit = () => {
    if (selectedIds.size > 0) {
      setBulkEditDialogOpen(true)
    }
  }

  const handleBulkEditSuccess = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
    fetchTransactions()
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    // Check if any selected transactions are splits
    const selectedTransactions = transactions.filter(tx => selectedIds.has(tx.main_transaction_id))
    const hasSplits = selectedTransactions.some(tx => tx.is_split)

    if (hasSplits) {
      alert('Cannot bulk delete split transactions. Please delete them individually to see all related splits.')
      return
    }

    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}? This will delete the original transaction and cannot be undone.`
    if (!confirm(confirmMessage)) return

    try {
      setLoading(true)
      const deletePromises = Array.from(selectedIds).map(async (txId) => {
        const tx = transactions.find(t => t.main_transaction_id === txId)
        if (!tx) return

        // Delete the original transaction (this will cascade delete main transactions)
        const response = await fetch(`/api/transactions/${tx.raw_transaction_id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error(`Failed to delete transaction ${tx.raw_transaction_id}`)
        }
      })

      await Promise.all(deletePromises)

      // Clear selection and refresh
      setSelectedIds(new Set())
      setLastSelectedIndex(null)
      await fetchTransactions()
    } catch (error) {
      console.error('Error deleting transactions:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransaction = async (tx: MainTransactionDetails) => {
    // If it's a split transaction, show warning with all related splits
    if (tx.is_split) {
      // Find all transactions with the same raw_transaction_id
      const relatedSplits = transactions.filter(t => t.raw_transaction_id === tx.raw_transaction_id)

      if (relatedSplits.length > 1) {
        // Show warning dialog with all splits
        setSplitTransactionsToDelete(relatedSplits)
        setPendingDeleteRawId(tx.raw_transaction_id)
        setDeleteSplitWarningOpen(true)
        return
      }
    }

    // Not a split or only one transaction - show simple confirmation
    const confirmMessage = `Are you sure you want to delete this transaction?`
    if (!confirm(confirmMessage)) return

    await performDelete(tx.raw_transaction_id)
  }

  const performDelete = async (rawTransactionId: string) => {
    try {
      // Optimistically remove from UI
      const deletedTransactions = transactions.filter(t => t.raw_transaction_id === rawTransactionId)
      setTransactions(prev => prev.filter(t => t.raw_transaction_id !== rawTransactionId))

      const response = await fetch(`/api/transactions/${rawTransactionId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert optimistic update on error
        setTransactions(prev => [...prev, ...deletedTransactions])
        throw new Error(data.error || 'Failed to delete transaction')
      }

      // Show success toast with undo button
      const deletedTransaction = data.deletedTransaction
      const description = deletedTransactions[0]?.description || 'Transaction'

      toast({
        title: "Transaction deleted",
        description: `${description} has been deleted`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUndoDelete(deletedTransaction)}
          >
            Undo
          </Button>
        ),
        duration: 10000, // 10 seconds to undo
      })
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete transaction',
        variant: "destructive",
      })
    }
  }

  const handleUndoDelete = async (deletedTransaction: any) => {
    try {
      console.log('Attempting to restore transaction:', deletedTransaction)

      const response = await fetch('/api/transactions/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: deletedTransaction,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Restore failed with data:', data)
        throw new Error(data.error || 'Failed to restore transaction')
      }

      // Refresh transactions to show restored transaction
      await fetchTransactions()

      toast({
        title: "Transaction restored",
        description: "The transaction has been restored successfully",
      })
    } catch (error) {
      console.error('Error restoring transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to restore transaction',
        variant: "destructive",
      })
    }
  }

  const handleConfirmSplitDelete = () => {
    if (pendingDeleteRawId) {
      performDelete(pendingDeleteRawId)
      setPendingDeleteRawId(null)
      setSplitTransactionsToDelete([])
    }
  }

  const handleQuickMatchSuccess = () => {
    fetchTransactions()
  }

  const handleUnmatchTransfer = async (transaction: MainTransactionDetails) => {
    if (!confirm("Are you sure you want to unmatch this transfer? Both transactions will become unmatched.")) {
      return
    }

    try {
      const response = await fetch(`/api/transfers/unmatch/${transaction.main_transaction_id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to unmatch transfer")
      }

      alert("Transfer unmatched successfully!")
      fetchTransactions()
    } catch (error: any) {
      console.error("Error unmatching transfer:", error)
      alert(error.message || "Failed to unmatch transfer. Please try again.")
    }
  }

  const handleToggleFlag = async (transaction: MainTransactionDetails) => {
    const newFlagStatus = !transaction.is_flagged

    // Optimistic UI update - update immediately for instant feedback
    setTransactions(prev => prev.map(tx =>
      tx.main_transaction_id === transaction.main_transaction_id
        ? { ...tx, is_flagged: newFlagStatus, flagged_at: newFlagStatus ? new Date().toISOString() : null }
        : tx
    ))

    try {
      const response = await fetch(`/api/main-transactions/${transaction.main_transaction_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_flagged: newFlagStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update flag")
      }
    } catch (error: any) {
      console.error("Error toggling flag:", error)
      // Revert the optimistic update on error
      setTransactions(prev => prev.map(tx =>
        tx.main_transaction_id === transaction.main_transaction_id
          ? { ...tx, is_flagged: !newFlagStatus, flagged_at: transaction.flagged_at }
          : tx
      ))
      alert(error.message || "Failed to update flag. Please try again.")
    }
  }

  // Show loading while entity context is loading
  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Show empty state if no entity selected
  if (!currentEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="h-12 w-12 text-muted-foreground mb-4">
          <Filter className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Entity Selected</h2>
        <p className="text-muted-foreground mb-4">
          Please select an entity from the sidebar to view main transactions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Main Transactions</h1>
          <p className="text-muted-foreground">
            {currentEntity ? `Managing main transactions for ${currentEntity.name}` : 'Categorized and analyzed transactions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={advancedMode ? "default" : "outline"}
                  onClick={() => {
                    const newMode = !advancedMode
                    setAdvancedMode(newMode)
                    setCurrentPage(1) // Reset to first page when toggling

                    // If switching to simple mode and current selected account is not bank/cash, reset to "all"
                    if (!newMode && selectedAccount !== "all") {
                      const selectedAccountData = accounts.find(acc => acc.account_id.toString() === selectedAccount)
                      if (selectedAccountData && selectedAccountData.account_type !== 'bank' && selectedAccountData.account_type !== 'cash') {
                        setSelectedAccount("all")
                      }
                    }
                  }}
                  className="min-w-[140px]"
                >
                  <Info className="h-4 w-4 mr-2" />
                  {advancedMode ? "Advanced Mode" : "Simple Mode"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium mb-1">
                  {advancedMode ? "Advanced Mode" : "Simple Mode"}
                </p>
                <p className="text-xs">
                  {advancedMode
                    ? "Showing all account types including asset/liability accounts (loan_receivable, debt_payable, etc.) - for users familiar with accounting"
                    : "Showing only bank and cash account transactions (actual money movements) - recommended for most users"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts
                    .filter((account) => {
                      // In simple mode, only show bank and cash accounts
                      if (!advancedMode) {
                        return account.account_type === 'bank' || account.account_type === 'cash'
                      }
                      // In advanced mode, show all accounts
                      return true
                    })
                    .map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id.toString()}>
                        {account.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="none">None (Uncategorized)</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.category_id} value={category.category_id.toString()}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id.toString()}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Direction</label>
              <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="debit">Debit (Out)</SelectItem>
                  <SelectItem value="credit">Credit (In)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <div className="flex gap-2">
                <Select value={amountOperator} onValueChange={setAmountOperator}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="eq">Equal (=)</SelectItem>
                    <SelectItem value="gt">Greater (&gt;)</SelectItem>
                    <SelectItem value="lt">Less (&lt;)</SelectItem>
                    <SelectItem value="gte">Greater/Equal (≥)</SelectItem>
                    <SelectItem value="lte">Less/Equal (≤)</SelectItem>
                    <SelectItem value="neq">Not Equal (≠)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amountValue}
                  onChange={(e) => {
                    setAmountValue(e.target.value)
                    setCurrentPage(1)
                  }}
                  disabled={amountOperator === "all"}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Date Range Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                        </>
                      ) : (
                        dateRange.from.toLocaleDateString()
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
                  <div className="flex flex-col">
                    <div className="p-3">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range ? { from: range.from, to: range.to } : { from: undefined, to: undefined })
                        }}
                        numberOfMonths={2}
                        initialFocus
                        classNames={{
                          months: "flex gap-4",
                          month: "space-y-4",
                          button_previous: cn(
                            buttonVariants({ variant: "outline" }),
                            "absolute left-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                          ),
                          button_next: cn(
                            buttonVariants({ variant: "outline" }),
                            "absolute right-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                          )
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 border-t py-3 px-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                          setDateRange({ from: firstDay, to: today })
                        }}
                      >
                        This Month
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
                          setDateRange({ from: lastMonth, to: lastMonthEnd })
                        }}
                      >
                        Last Month
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
                          setDateRange({ from: threeMonthsAgo, to: today })
                        }}
                      >
                        Last 3 Months
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
                          setDateRange({ from: sixMonthsAgo, to: today })
                        }}
                      >
                        Last 6 Months
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const firstDayOfYear = new Date(today.getFullYear(), 0, 1)
                          setDateRange({ from: firstDayOfYear, to: today })
                        }}
                      >
                        This Year
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const today = new Date()
                          const lastYear = new Date(today.getFullYear() - 1, 0, 1)
                          const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31)
                          setDateRange({ from: lastYear, to: lastYearEnd })
                        }}
                      >
                        Last Year
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs col-span-2"
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined })
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Search */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search description or notes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-branch"
                  checked={showBranchColumn}
                  onCheckedChange={(checked) => setShowBranchColumn(checked as boolean)}
                />
                <label
                  htmlFor="show-branch"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Show Branch
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-project"
                  checked={showProjectColumn}
                  onCheckedChange={(checked) => setShowProjectColumn(checked as boolean)}
                />
                <label
                  htmlFor="show-project"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Show Project
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Presets Dropdown */}
              <Select value={selectedPreset} onValueChange={loadPreset}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Load filter preset..." />
                </SelectTrigger>
                <SelectContent>
                  {savedPresets.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No saved presets</div>
                  ) : (
                    savedPresets.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{preset.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Save Current Filters Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSavePresetDialogOpen(true)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save Preset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save current filters as a named preset</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Delete Preset Button */}
              {selectedPreset && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePreset(selectedPreset)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Transactions ({pagination.total})
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {pagination.total > 0 ? (
                  <>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} transactions</>
                ) : (
                  <>No transactions found</>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 ? (
                <>
                  <Badge variant="secondary" className="text-sm">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBulkEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedIds(new Set())
                      setLastSelectedIndex(null)
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setAddTransactionDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-3 px-4 w-12">
                        <Checkbox
                          checked={selectedIds.size === transactions.length && transactions.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('transaction_date')}
                      >
                        <div className="flex items-center gap-1">
                          Date
                          {sortField === 'transaction_date' && (
                            sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('description')}
                      >
                        <div className="flex items-center gap-1">
                          Description
                          {sortField === 'description' && (
                            sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      <th className="text-left py-3 px-4">
                        Type
                      </th>
                      <th
                        className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('category_name')}
                      >
                        <div className="flex items-center gap-1">
                          Category
                          {sortField === 'category_name' && (
                            sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      {showBranchColumn && (
                        <th
                          className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('branch_name')}
                        >
                          <div className="flex items-center gap-1">
                            Branch
                            {sortField === 'branch_name' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                      )}
                      {showProjectColumn && (
                        <th
                          className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('project_name')}
                        >
                          <div className="flex items-center gap-1">
                            Project
                            {sortField === 'project_name' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                      )}
                      <th
                        className="text-right py-3 px-4 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Amount
                          {sortField === 'amount' && (
                            sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, txIndex) => {
                      // Filter transaction types based on account type and direction
                      const filteredTransactionTypes = getFilteredTransactionTypes(
                        tx.account_type as AccountType,
                        tx.transaction_direction as TransactionDirection,
                        transactionTypes
                      )

                      const filteredCategories = categories.filter(cat =>
                        cat.transaction_type_id === tx.transaction_type_id
                      )
                      const filteredBranches = branches.filter(branch =>
                        branch.entity_id === tx.entity_id
                      )

                      const isBalanceAdjustment = tx.is_balance_adjustment === true

                      return (
                        <tr
                          key={tx.main_transaction_id}
                          className={`border-b hover:bg-muted/50 ${isBalanceAdjustment ? 'opacity-50 bg-muted/30' : ''}`}
                        >
                          <td className="text-center py-3 px-4">
                            <Checkbox
                              checked={selectedIds.has(tx.main_transaction_id)}
                              onCheckedChange={(checked) => {
                                const event = window.event as MouseEvent
                                handleSelectRow(tx.main_transaction_id, txIndex, event as any)
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              disabled={isBalanceAdjustment}
                              aria-label={`Select transaction ${tx.main_transaction_id}`}
                            />
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {new Date(tx.transaction_date).toLocaleDateString()}
                          </td>

                          {/* Description - Inline editable */}
                          <td className="py-3 px-4">
                            <div>
                              <Input
                                value={tx.description || ""}
                                onChange={(e) => {
                                  const newValue = e.target.value
                                  setTransactions(prev => prev.map((t, i) =>
                                    i === txIndex ? { ...t, description: newValue } : t
                                  ))
                                }}
                                onBlur={() => handleInlineUpdate(
                                  tx.main_transaction_id,
                                  'description',
                                  tx.description,
                                  txIndex
                                )}
                                className="h-8 text-sm"
                                placeholder="Description..."
                                disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'description')}
                              />
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{tx.notes}</div>
                              )}
                              <div className="flex gap-1 mt-1">
                                {tx.is_split && (
                                  <Badge variant="outline">Split</Badge>
                                )}
                                {isBalanceAdjustment && (
                                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                                    Balance Adjustment
                                  </Badge>
                                )}
                                {/* Matched transfer */}
                                {tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'TRF_OUT' || tx.transaction_type_code === 'TRF_IN') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this transfer"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Transfer
                                  </Badge>
                                )}
                                {/* Unmatched transfer */}
                                {!tx.transfer_matched_transaction_id && (tx.transaction_type_code === 'TRF_OUT' || tx.transaction_type_code === 'TRF_IN') && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchDialogOpen(true)
                                    }}
                                    title="Click to match with another transfer"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched
                                  </Badge>
                                )}
                                {/* Matched debt transaction */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'DEBT_TAKE' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this debt transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Debt
                                  </Badge>
                                )}
                                {/* Unmatched debt transaction */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'DEBT_TAKE' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchDebtDialogOpen(true)
                                    }}
                                    title="Click to match with corresponding debt transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Debt
                                  </Badge>
                                )}
                                {/* Matched debt payback */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'DEBT_PAY' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this debt payback"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Payback
                                  </Badge>
                                )}
                                {/* Unmatched debt payback - needs drawdown selection */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'DEBT_PAY' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setSelectDrawdownDialogOpen(true)
                                    }}
                                    title="Click to select which drawdown this payment is for"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Payback
                                  </Badge>
                                )}
                                {/* Matched credit card payment */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'CC_PAY' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this credit card payment"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched CC Payment
                                  </Badge>
                                )}
                                {/* Unmatched credit card payment */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'CC_PAY' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickPayCreditCardDialogOpen(true)
                                    }}
                                    title="Click to pay credit card"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched CC Payment
                                  </Badge>
                                )}
                                {/* Matched loan disbursement */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'LOAN_DISBURSE' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this loan disbursement"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Loan
                                  </Badge>
                                )}
                                {/* Unmatched loan disbursement */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'LOAN_DISBURSE' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchLoanDialogOpen(true)
                                    }}
                                    title="Click to match with a disbursement transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Loan
                                  </Badge>
                                )}
                                {/* Matched loan collection */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'LOAN_COLLECT' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    onClick={() => handleUnmatchTransfer(tx)}
                                    title="Click to unmatch this loan collection"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Collection
                                  </Badge>
                                )}
                                {/* Unmatched loan collection */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'LOAN_COLLECT' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setQuickMatchLoanDialogOpen(true)
                                    }}
                                    title="Click to match with a collection transaction"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Collection
                                  </Badge>
                                )}
                                {/* Matched investment contribution */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'INV_CONTRIB' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    title="Matched to investment contribution - Click to unmatch"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTransaction(tx)
                                      setUnmatchInvestmentDialogOpen(true)
                                    }}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Investment
                                  </Badge>
                                )}
                                {/* Unmatched investment contribution */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'INV_CONTRIB' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    title="Investment contribution not linked - Click to match"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTransaction(tx)
                                      setQuickMatchInvestmentDialogOpen(true)
                                    }}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Investment
                                  </Badge>
                                )}
                                {/* Matched investment withdrawal */}
                                {tx.transfer_matched_transaction_id && tx.transaction_type_code === 'INV_WITHDRAW' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200"
                                    title="Matched to investment withdrawal - Click to unmatch"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTransaction(tx)
                                      setUnmatchInvestmentDialogOpen(true)
                                    }}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Matched Withdrawal
                                  </Badge>
                                )}
                                {/* Unmatched investment withdrawal */}
                                {!tx.transfer_matched_transaction_id && tx.transaction_type_code === 'INV_WITHDRAW' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200"
                                    title="Investment withdrawal not linked - Click to match"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTransaction(tx)
                                      setQuickMatchInvestmentDialogOpen(true)
                                    }}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Unmatched Withdrawal
                                  </Badge>
                                )}
                                {/* Flagged transaction */}
                                {tx.is_flagged && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="secondary"
                                          className="bg-red-100 text-red-800 border-red-200 cursor-pointer hover:bg-red-200"
                                          onClick={() => handleToggleFlag(tx)}
                                        >
                                          <Flag className="h-3 w-3 mr-1" />
                                          Flagged
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Click to unflag</p>
                                        {tx.flagged_at && <p className="text-xs text-muted-foreground">Flagged: {new Date(tx.flagged_at).toLocaleString()}</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {/* Interest Payment - Link to Drawdown */}
                                {tx.category_code === 'INTEREST_PAY' && !tx.drawdown_id && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-orange-100 text-orange-800 border-orange-200 cursor-pointer hover:bg-orange-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setSelectDrawdownDialogOpen(true)
                                    }}
                                    title="Click to link this interest payment to a debt drawdown"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Link to Drawdown
                                  </Badge>
                                )}
                                {/* Interest Payment - Already linked */}
                                {tx.category_code === 'INTEREST_PAY' && tx.drawdown_id && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200"
                                    onClick={() => {
                                      setSelectedTransaction(tx)
                                      setSelectDrawdownDialogOpen(true)
                                    }}
                                    title="Linked to drawdown - click to change"
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Linked to Drawdown
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Type - Inline editable */}
                          <td className="py-3 px-4">
                            <InlineCombobox
                              value={tx.transaction_type_id?.toString() || ""}
                              options={filteredTransactionTypes.map((type) => ({
                                value: type.transaction_type_id.toString(),
                                label: type.type_display_name,
                              }))}
                              onSelect={(value) => handleInlineUpdate(
                                tx.main_transaction_id,
                                'transaction_type_id',
                                value,
                                txIndex
                              )}
                              placeholder="Select type"
                              disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'transaction_type_id')}
                            />
                          </td>

                          {/* Category - Inline editable */}
                          <td className="py-3 px-4">
                            <InlineCombobox
                              value={tx.category_id?.toString() || "none"}
                              options={[
                                { value: "none", label: "None" },
                                ...filteredCategories.map((category) => ({
                                  value: category.category_id.toString(),
                                  label: category.category_name,
                                })),
                              ]}
                              onSelect={(value) => handleInlineUpdate(
                                tx.main_transaction_id,
                                'category_id',
                                value,
                                txIndex
                              )}
                              placeholder="Select category"
                              disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'category_id')}
                              onCreate={(prefillName) => {
                                if (prefillName) setNewCategoryName(prefillName)
                                setCreateCategoryContext({
                                  transactionId: tx.main_transaction_id,
                                  transactionIndex: txIndex
                                })
                                setCreateCategoryDialogOpen(true)
                              }}
                              createLabel="Create new category"
                            />
                          </td>

                          {/* Branch - Inline editable */}
                          {showBranchColumn && (
                            <td className="py-3 px-4">
                              <InlineCombobox
                                value={tx.branch_id?.toString() || "none"}
                                options={[
                                  { value: "none", label: "None" },
                                  ...filteredBranches.map((branch) => ({
                                    value: branch.branch_id.toString(),
                                    label: branch.branch_name,
                                  })),
                                ]}
                                onSelect={(value) => handleInlineUpdate(
                                  tx.main_transaction_id,
                                  'branch_id',
                                  value,
                                  txIndex
                                )}
                                placeholder="Select branch"
                                disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'branch_id')}
                              />
                            </td>
                          )}

                          {/* Project - Inline editable */}
                          {showProjectColumn && (
                            <td className="py-3 px-4">
                              <InlineCombobox
                                value={tx.project_id?.toString() || "none"}
                                options={[
                                  { value: "none", label: "None" },
                                  ...projects.filter(p => p.entity_id === tx.entity_id).map((project) => ({
                                    value: project.project_id.toString(),
                                    label: project.project_name,
                                  })),
                                ]}
                                onSelect={(value) => handleInlineUpdate(
                                  tx.main_transaction_id,
                                  'project_id',
                                  value,
                                  txIndex
                                )}
                                placeholder="Select project"
                                disabled={isBalanceAdjustment || (savingCell?.row === txIndex && savingCell?.field === 'project_id')}
                              />
                            </td>
                          )}

                          <td className={`py-3 px-4 text-right font-mono font-medium ${getDirectionColor(tx.transaction_direction)}`}>
                            {formatAmount(tx.amount, tx.transaction_direction)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleFlag(tx)}
                                title={tx.is_flagged ? "Unflag transaction" : "Flag for investigation"}
                                className={tx.is_flagged ? "text-red-600 hover:text-red-700 hover:bg-red-50" : ""}
                              >
                                <Flag className={`h-4 w-4 ${tx.is_flagged ? 'fill-red-600' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSplitTransaction(tx)}
                                disabled={isBalanceAdjustment}
                                title={
                                  isBalanceAdjustment
                                    ? "Balance adjustment transactions cannot be split. Edit the checkpoint instead."
                                    : tx.is_split
                                    ? "Edit split"
                                    : "Split transaction"
                                }
                              >
                                <Split className={`h-4 w-4 ${tx.is_split ? 'text-blue-600' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTransaction(tx)}
                                disabled={isBalanceAdjustment}
                                title={
                                  isBalanceAdjustment
                                    ? "Balance adjustment transactions cannot be edited. Edit the checkpoint instead."
                                    : "Edit notes and other details"
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTransaction(tx)}
                                disabled={isBalanceAdjustment}
                                title={
                                  isBalanceAdjustment
                                    ? "Balance adjustment transactions cannot be deleted. Edit the checkpoint instead."
                                    : "Delete transaction"
                                }
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Rows per page:</span>
                      <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pagination.total > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} transactions
                      </div>
                    )}
                  </div>

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum: number
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-10"
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === pagination.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
        projects={projects}
      />

      {/* Split Transaction Dialog */}
      <SplitTransactionDialog
        transaction={splitTransaction}
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        onSuccess={handleSplitSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
        projects={projects}
      />

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedIds={selectedIds}
        onSuccess={handleBulkEditSuccess}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
        projects={projects}
      />

      {/* Quick Match Transfer Dialog */}
      <QuickMatchTransferDialog
        open={quickMatchDialogOpen}
        onOpenChange={setQuickMatchDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Quick Match Debt Dialog */}
      <QuickMatchDebtDialog
        open={quickMatchDebtDialogOpen}
        onOpenChange={setQuickMatchDebtDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Quick Match Loan Dialog */}
      <QuickMatchLoanDialog
        open={quickMatchLoanDialogOpen}
        onOpenChange={setQuickMatchLoanDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Quick Match Investment Dialog */}
      <QuickMatchInvestmentDialog
        open={quickMatchInvestmentDialogOpen}
        onOpenChange={setQuickMatchInvestmentDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Unmatch Investment Dialog */}
      <UnmatchInvestmentDialog
        open={unmatchInvestmentDialogOpen}
        onOpenChange={setUnmatchInvestmentDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      <QuickPayCreditCardDialog
        open={quickPayCreditCardDialogOpen}
        onOpenChange={setQuickPayCreditCardDialogOpen}
        sourceTransaction={selectedTransaction}
        onSuccess={handleQuickMatchSuccess}
      />

      {/* Select Drawdown Dialog for DEBT_PAYBACK and Interest Payment linking */}
      {selectedTransaction && (
        <SelectDrawdownDialog
          open={selectDrawdownDialogOpen}
          onOpenChange={setSelectDrawdownDialogOpen}
          // For DEBT_PAY matching mode
          {...(selectedTransaction.transaction_type_code === 'DEBT_PAY' && {
            paybackTransactionId: selectedTransaction.main_transaction_id,
            paybackAmount: selectedTransaction.amount,
            onSuccess: handleQuickMatchSuccess,
          })}
          // For Interest Payment linking mode
          {...(selectedTransaction.category_code === 'INTEREST_PAY' && {
            accountId: selectedTransaction.account_id,
            onSelectDrawdown: async (drawdown) => {
              try {
                // Update the transaction to link it to the drawdown
                const response = await fetch(`/api/main-transactions/${selectedTransaction.main_transaction_id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    drawdown_id: drawdown.drawdown_id,
                  }),
                })

                if (!response.ok) {
                  throw new Error('Failed to link transaction to drawdown')
                }

                toast({
                  title: "Success",
                  description: `Interest payment linked to drawdown ${drawdown.drawdown_reference}`,
                })

                fetchTransactions() // Refresh the list
              } catch (error) {
                console.error('Error linking to drawdown:', error)
                toast({
                  title: "Error",
                  description: error instanceof Error ? error.message : 'Failed to link to drawdown',
                  variant: "destructive",
                })
              }
            },
          })}
        />
      )}

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        open={addTransactionDialogOpen}
        onOpenChange={setAddTransactionDialogOpen}
        accounts={accounts.filter(acc => acc.account_type === 'bank' || acc.account_type === 'cash')}
        transactionTypes={transactionTypes}
        categories={categories}
        branches={branches}
        projects={projects}
        onSuccess={() => {
          setAddTransactionDialogOpen(false)
          fetchTransactions()
        }}
      />

      {/* Delete Split Warning Dialog */}
      <DeleteSplitWarningDialog
        open={deleteSplitWarningOpen}
        onOpenChange={setDeleteSplitWarningOpen}
        splitTransactions={splitTransactionsToDelete}
        onConfirmDelete={handleConfirmSplitDelete}
      />

      {/* Save Filter Preset Dialog */}
      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Give your current filter configuration a name so you can quickly load it later.
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                ⚠️ Note: Presets are saved locally on this device/browser only.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset_name">Preset Name *</Label>
              <Input
                id="preset_name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g., Monthly Expenses, Vendor Payments"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveCurrentFiltersAsPreset()
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Current filters:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {selectedAccount !== 'all' && <li>Account filter active</li>}
                {selectedType !== 'all' && <li>Transaction type filter active</li>}
                {selectedCategory !== 'all' && <li>Category filter active</li>}
                {selectedBranch !== 'all' && <li>Branch filter active</li>}
                {selectedProject !== 'all' && <li>Project filter active</li>}
                {selectedDirection !== 'all' && <li>Direction filter active</li>}
                {startDate && <li>Start date: {startDate}</li>}
                {endDate && <li>End date: {endDate}</li>}
                {searchQuery && <li>Search: &ldquo;{searchQuery}&rdquo;</li>}
                {(showBranchColumn || showProjectColumn) && <li>Column visibility settings</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFiltersAsPreset} disabled={!newPresetName.trim()}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={createCategoryDialogOpen} onOpenChange={setCreateCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new category for your transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transaction_type">Transaction Type *</Label>
              <Select value={newCategoryType} onValueChange={setNewCategoryType}>
                <SelectTrigger id="transaction_type">
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.transaction_type_id} value={type.transaction_type_id.toString()}>
                      {type.type_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category_name">Category Name *</Label>
              <Input
                id="category_name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCategoryDialogOpen(false)} disabled={creatingCategory}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim() || !newCategoryType}>
              {creatingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
