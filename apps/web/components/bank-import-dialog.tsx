"use client"

import { useState, useEffect } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, ArrowLeft, ArrowRight, X, Eye, Settings2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  parseCSVFile,
  detectColumnTypes,
  detectDateFormat,
  generateColumnMappings,
  parseDate,
  parseAmount,
} from "@/lib/csv-parser"
import { parseXLSXFile } from "@/lib/xlsx-parser"
import {
  ParsedCSVData,
  ColumnDetectionResult,
  ColumnMapping,
  ColumnType,
  DateFormat,
  ImportWithCheckpointResult,
} from "@/types/import"
import {
  getDateFormatExample,
  getColumnTypeLabel,
  getColumnTypeDescription,
} from "@/types/import"
import { formatDate } from "@/lib/account-utils"

interface BankImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: number
  accountName: string
  onSuccess: () => void
}

type ImportStep = 1 | 2 | 3 | 4

export function BankImportDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  onSuccess,
}: BankImportDialogProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: File upload and statement details
  const [file, setFile] = useState<File | null>(null)
  const [statementStartDate, setStatementStartDate] = useState("")
  const [statementEndDate, setStatementEndDate] = useState("")
  const [statementEndingBalance, setStatementEndingBalance] = useState("")
  const [selectedDateColumn, setSelectedDateColumn] = useState<string>("")
  const [availableDateColumns, setAvailableDateColumns] = useState<string[]>([])

  // Step 2: Column mapping
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null)
  const [columnDetections, setColumnDetections] = useState<ColumnDetectionResult[]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [dateFormat, setDateFormat] = useState<DateFormat>('dd/mm/yyyy')
  const [hasNegativeDebits, setHasNegativeDebits] = useState(false)

  // Saved import config
  const [savedConfig, setSavedConfig] = useState<any>(null)
  const [configApplied, setConfigApplied] = useState(false)

  // Step 4: Results
  const [importResult, setImportResult] = useState<ImportWithCheckpointResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)

  // Preview cleaned data dialog
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

  // Branch mapping state
  const [branchMappingDialogOpen, setBranchMappingDialogOpen] = useState(false)
  const [availableBranches, setAvailableBranches] = useState<Array<{ branch_id: number; branch_name: string }>>([])
  const [branchMappings, setBranchMappings] = useState<Record<string, number | null>>({}) // CSV branch name -> branch_id
  const [uniqueBranchNames, setUniqueBranchNames] = useState<string[]>([])

  // Fetch saved import config when dialog opens
  useEffect(() => {
    if (open && accountId) {
      fetchSavedConfig()
    }
  }, [open, accountId])

  async function fetchSavedConfig() {
    try {
      const response = await fetch(`/api/accounts/${accountId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.last_import_config) {
          setSavedConfig(data.last_import_config)
        }
      }
    } catch (err) {
      console.error('Failed to fetch saved import config:', err)
      // Don't show error to user, just skip auto-fill
    }
  }

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCurrentStep(1)
        setFile(null)
        setStatementStartDate("")
        setStatementEndDate("")
        setStatementEndingBalance("")
        setSelectedDateColumn("")
        setAvailableDateColumns([])
        setParsedData(null)
        setColumnDetections([])
        setColumnMappings([])
        setDateFormat('dd/mm/yyyy')
        setHasNegativeDebits(false)
        setImportResult(null)
        setError(null)
        setSavedConfig(null)
        setConfigApplied(false)
        setBranchMappings({})
        setUniqueBranchNames([])
        setAvailableBranches([])
      }, 200)
    }
  }, [open])

  // ===========================================================================
  // Step 1: File Upload
  // ===========================================================================

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (!selectedFile.name.match(/\.(csv|CSV|xlsx|xls|XLSX|XLS)$/)) {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls)")
      return
    }

    setFile(selectedFile)
    setError(null)

    // Auto-parse file for preview (CSV or XLSX)
    try {
      setLoading(true)
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()

      let parsed
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        // Parse Excel file
        parsed = await parseXLSXFile(selectedFile)
      } else {
        // Parse CSV file (default)
        parsed = await parseCSVFile(selectedFile)
      }

      setParsedData(parsed)

      // Auto-detect columns
      const detections = detectColumnTypes(parsed.headers, parsed.rows)
      setColumnDetections(detections)

      // Find all date columns
      const dateColumns = detections.filter(d => d.suggestedType === 'transaction_date')
      const dateColumnNames = dateColumns.map(d => d.columnName)
      setAvailableDateColumns(dateColumnNames)

      // Auto-select first date column
      if (dateColumnNames.length > 0) {
        setSelectedDateColumn(dateColumnNames[0])
      }

      // Auto-detect date format from first date column
      if (dateColumns.length > 0) {
        const dateDetection = detectDateFormat(dateColumns[0].sampleValues)
        if (dateDetection.detectedFormat !== 'unknown') {
          setDateFormat(dateDetection.detectedFormat)
        }
      }

      // Auto-detect negative debits
      const amountColumn = detections.find(d => d.suggestedType === 'amount')
      if (amountColumn) {
        setHasNegativeDebits(true)
      }

      // Auto-populate statement dates and ending balance from CSV
      if (parsed.detectedStartDate) {
        setStatementStartDate(parsed.detectedStartDate)
      }
      if (parsed.detectedEndDate) {
        setStatementEndDate(parsed.detectedEndDate)
      }
      if (parsed.detectedEndingBalance !== null && parsed.detectedEndingBalance !== undefined) {
        setStatementEndingBalance(parsed.detectedEndingBalance.toString())
      }

      // Generate initial mappings
      let mappings = generateColumnMappings(detections, dateFormat)

      // Try to apply saved config if available and headers match
      if (savedConfig && savedConfig.columnMappings && !configApplied) {
        const savedHeaders = savedConfig.columnMappings.map((m: any) => m.csvColumn)
        const currentHeaders = parsed.headers

        // Check if headers match (all saved headers exist in current file)
        const headersMatch = savedHeaders.every((h: string) => currentHeaders.includes(h))

        if (headersMatch) {
          // Apply saved mappings for matching columns
          mappings = currentHeaders.map(header => {
            const savedMapping = savedConfig.columnMappings.find((m: any) => m.csvColumn === header)
            if (savedMapping) {
              return {
                csvColumn: header,
                mappedTo: savedMapping.mappedTo,
                dateFormat: savedMapping.dateFormat || savedConfig.dateFormat,
                isNegativeDebit: savedMapping.isNegativeDebit ?? savedConfig.hasNegativeDebits,
              }
            }
            // For new columns not in saved config, use auto-detection
            const detection = detections.find(d => d.columnName === header)
            return {
              csvColumn: header,
              mappedTo: detection?.suggestedType || 'ignore',
            }
          })

          // Apply saved date format and negative debit setting
          if (savedConfig.dateFormat) {
            setDateFormat(savedConfig.dateFormat)
          }
          if (savedConfig.hasNegativeDebits !== undefined) {
            setHasNegativeDebits(savedConfig.hasNegativeDebits)
          }

          setConfigApplied(true)
        }
      }

      setColumnMappings(mappings)
    } catch (err: any) {
      setError(err.message || "Failed to parse CSV file")
    } finally {
      setLoading(false)
    }
  }

  // Recalculate balance based on selected end date
  function recalculateBalanceForDate(selectedDate: string) {
    console.log('🔧 recalculateBalanceForDate called with:', selectedDate)

    if (!parsedData || !selectedDate || !selectedDateColumn) {
      console.log('❌ Early exit: parsedData, selectedDate, or selectedDateColumn missing')
      console.log('   parsedData:', !!parsedData, 'selectedDate:', selectedDate, 'selectedDateColumn:', selectedDateColumn)
      return
    }

    try {
      // Find the balance column mapping
      const balanceMapping = columnMappings.find(m => m.mappedTo === 'balance')

      // Use the user-selected date column instead of auto-detected one
      const dateColumn = selectedDateColumn

      console.log('📋 Balance column:', balanceMapping?.csvColumn)
      console.log('📋 Date column (user-selected):', dateColumn)

      if (!balanceMapping || !dateColumn) {
        console.log('❌ Cannot recalculate: missing balance or date column mapping')
        return
      }

      const balanceColumn = balanceMapping.csvColumn

      console.log(`📊 parsedData.rows.length: ${parsedData.rows.length}`)

      // Parse the selected date (using date string format to avoid timezone issues)
      const selectedDateStr = selectedDate // Already in YYYY-MM-DD format from input

      // Parse dates using the date format - define this helper first
      const parseRowDate = (dateStr: string) => {
        const trimmed = dateStr.toString().trim()
        const spaceIndex = trimmed.indexOf(' ')
        const cleanDate = spaceIndex !== -1 ? trimmed.substring(0, spaceIndex) : trimmed
        return parseDate(cleanDate, dateFormat)
      }

      // Helper to convert Date to YYYY-MM-DD without timezone conversion
      const toLocalDateString = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      // Detect sort order (check first vs last row dates)
      if (parsedData.rows.length < 2) {
        console.log('❌ Not enough rows (need at least 2)')
        return
      }

      // Find first row with a PARSEABLE date
      let firstRowDate = null
      let firstDate = null
      for (const row of parsedData.rows) {
        const dateVal = row[dateColumn]
        if (dateVal !== null && dateVal !== undefined && dateVal !== '') {
          const parsed = parseRowDate(String(dateVal))
          if (parsed) {
            firstRowDate = dateVal
            firstDate = parsed
            break
          }
        }
      }

      // Find last row with a PARSEABLE date (search backwards)
      let lastRowDate = null
      let lastDate = null
      for (let i = parsedData.rows.length - 1; i >= 0; i--) {
        const dateVal = parsedData.rows[i][dateColumn]
        if (dateVal !== null && dateVal !== undefined && dateVal !== '') {
          const parsed = parseRowDate(String(dateVal))
          if (parsed) {
            lastRowDate = dateVal
            lastDate = parsed
            break
          }
        }
      }

      console.log(`📊 First parseable row [${dateColumn}]:`, firstRowDate)
      console.log(`📊 Last parseable row [${dateColumn}]:`, lastRowDate)
      console.log('📅 First row date:', firstRowDate, '→', firstDate)
      console.log('📅 Last row date:', lastRowDate, '→', lastDate)

      if (!firstDate || !lastDate) {
        console.log('❌ Could not find parseable dates in rows')
        return
      }

      const isDescending = firstDate > lastDate
      console.log(`📊 Recalculating balance for ${selectedDateStr}, order: ${isDescending ? 'DESCENDING' : 'ASCENDING'}`)
      console.log(`📊 Total rows to search: ${parsedData.rows.length}`)

      // Find the last transaction on the selected date
      let lastTransactionBalance = null
      let matchCount = 0

      console.log(`🔍 Looking for transactions on: ${selectedDateStr}`)

      if (isDescending) {
        // Newest first → find FIRST occurrence of selected date
        for (let i = 0; i < parsedData.rows.length; i++) {
          const row = parsedData.rows[i]
          const rowDateStr = row[dateColumn]?.toString().trim()
          if (!rowDateStr) continue

          const rowDate = parseRowDate(rowDateStr)
          if (!rowDate) continue

          const rowDateLocalStr = toLocalDateString(rowDate)
          if (rowDateLocalStr === selectedDateStr) {
            matchCount++
            const balance = row[balanceColumn]
            console.log(`   Match ${matchCount} at row ${i}:`)
            console.log(`      Raw date value: "${rowDateStr}"`)
            console.log(`      Parsed date: ${rowDate}`)
            console.log(`      Local date string: ${rowDateLocalStr}`)
            console.log(`      Balance: ${balance}`)
            if (balance !== null && balance !== undefined) {
              lastTransactionBalance = parseAmount(balance.toString())
              console.log(`   ✅ Using this balance: ${lastTransactionBalance}`)
              break
            }
          }
        }
      } else {
        // Oldest first → find LAST occurrence of selected date
        for (let i = parsedData.rows.length - 1; i >= 0; i--) {
          const row = parsedData.rows[i]
          const rowDateStr = row[dateColumn]?.toString().trim()
          if (!rowDateStr) continue

          const rowDate = parseRowDate(rowDateStr)
          if (!rowDate) continue

          const rowDateLocalStr = toLocalDateString(rowDate)
          if (rowDateLocalStr === selectedDateStr) {
            matchCount++
            const balance = row[balanceColumn]
            console.log(`   Match ${matchCount} at row ${i}:`)
            console.log(`      Raw date value: "${rowDateStr}"`)
            console.log(`      Parsed date: ${rowDate}`)
            console.log(`      Local date string: ${rowDateLocalStr}`)
            console.log(`      Balance: ${balance}`)
            if (balance !== null && balance !== undefined) {
              lastTransactionBalance = parseAmount(balance.toString())
              console.log(`   ✅ Using this balance: ${lastTransactionBalance}`)
              break
            }
          }
        }
      }

      console.log(`🔢 Total matches found: ${matchCount}`)

      if (lastTransactionBalance !== null && !isNaN(lastTransactionBalance)) {
        console.log(`✅ Found balance for ${selectedDateStr}: ${lastTransactionBalance}`)
        console.log(`💾 Updating statementEndingBalance to: ${lastTransactionBalance}`)
        setStatementEndingBalance(lastTransactionBalance.toString())
      } else {
        console.log(`⚠️ Could not find transaction with balance on ${selectedDateStr}`)
      }
    } catch (err) {
      console.error('Error recalculating balance:', err)
    }
  }

  function canProceedFromStep1(): boolean {
    return (
      file !== null &&
      statementStartDate !== "" &&
      statementEndDate !== "" &&
      statementEndingBalance !== "" &&
      !isNaN(parseFloat(statementEndingBalance))
    )
  }

  // ===========================================================================
  // Step 2: Column Mapping
  // ===========================================================================

  function updateColumnMapping(csvColumn: string, mappedTo: ColumnType) {
    setColumnMappings(prev =>
      prev.map(mapping => {
        if (mapping.csvColumn === csvColumn) {
          const updated: ColumnMapping = {
            ...mapping,
            mappedTo,
          }

          // Add date format for date columns
          if (mappedTo === 'transaction_date') {
            updated.dateFormat = dateFormat
          }

          // Add negative debit flag for amount columns
          if (mappedTo === 'amount') {
            updated.isNegativeDebit = hasNegativeDebits
          }

          return updated
        }
        return mapping
      })
    )
  }

  function canProceedFromStep2(): boolean {
    const hasDateColumn = columnMappings.some(m => m.mappedTo === 'transaction_date')
    const hasAmountColumn = columnMappings.some(
      m => m.mappedTo === 'debit_amount' || m.mappedTo === 'credit_amount' || m.mappedTo === 'amount'
    )
    return hasDateColumn && hasAmountColumn
  }

  // Check if branch column is mapped
  const hasBranchColumn = columnMappings.some(m => m.mappedTo === 'branch')
  const branchColumnName = columnMappings.find(m => m.mappedTo === 'branch')?.csvColumn

  // Open branch mapping dialog
  async function openBranchMappingDialog() {
    if (!parsedData || !branchColumnName) return

    // Extract unique branch names from the CSV data
    const branchSet = new Set<string>()
    for (const row of parsedData.rows) {
      const branchValue = row[branchColumnName]
      if (branchValue && typeof branchValue === 'string' && branchValue.trim()) {
        branchSet.add(branchValue.trim())
      }
    }
    const uniqueNames = Array.from(branchSet).sort()
    setUniqueBranchNames(uniqueNames)

    // Initialize branch mappings with null (unmapped)
    const initialMappings: Record<string, number | null> = {}
    for (const name of uniqueNames) {
      initialMappings[name] = branchMappings[name] ?? null
    }
    setBranchMappings(initialMappings)

    // Fetch available branches from the API
    try {
      // First get the entity_id from the account
      const accountResponse = await fetch(`/api/accounts/${accountId}`)
      if (!accountResponse.ok) throw new Error('Failed to fetch account')
      const accountData = await accountResponse.json()
      const entityId = accountData.entity_id

      // Fetch branches for this entity
      const branchResponse = await fetch(`/api/branches?entity_id=${entityId}`)
      if (!branchResponse.ok) throw new Error('Failed to fetch branches')
      const branchData = await branchResponse.json()
      setAvailableBranches(branchData.data || [])

      // Auto-match branches by name (case-insensitive)
      const autoMappings: Record<string, number | null> = { ...initialMappings }
      for (const csvBranchName of uniqueNames) {
        const matchedBranch = branchData.data?.find(
          (b: { branch_id: number; branch_name: string }) =>
            b.branch_name.toLowerCase() === csvBranchName.toLowerCase()
        )
        if (matchedBranch) {
          autoMappings[csvBranchName] = matchedBranch.branch_id
        }
      }
      setBranchMappings(autoMappings)
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }

    setBranchMappingDialogOpen(true)
  }

  // Update a single branch mapping
  function updateBranchMapping(csvBranchName: string, branchId: number | null) {
    setBranchMappings(prev => ({
      ...prev,
      [csvBranchName]: branchId
    }))
  }

  const validationErrors: string[] = []
  if (!columnMappings.some(m => m.mappedTo === 'transaction_date')) {
    validationErrors.push('Transaction Date column is required')
  }
  if (
    !columnMappings.some(
      m => m.mappedTo === 'debit_amount' || m.mappedTo === 'credit_amount' || m.mappedTo === 'amount'
    )
  ) {
    validationErrors.push('At least one amount column (Debit, Credit, or Amount) is required')
  }

  // ===========================================================================
  // Step 3: Preview
  // ===========================================================================

  // Filter rows by date range (same logic as backend import)
  const getFilteredRows = () => {
    if (!parsedData || !statementStartDate || !statementEndDate || !selectedDateColumn) {
      return parsedData?.rows || []
    }

    const startDateFilter = new Date(statementStartDate)
    const endDateFilter = new Date(statementEndDate)

    // Helper to parse date from row
    const parseRowDate = (dateStr: string) => {
      if (!dateStr) return null
      const trimmed = dateStr.toString().trim()
      const spaceIndex = trimmed.indexOf(' ')
      const cleanDate = spaceIndex !== -1 ? trimmed.substring(0, spaceIndex) : trimmed
      return parseDate(cleanDate, dateFormat)
    }

    return parsedData.rows.filter(row => {
      const dateValue = row[selectedDateColumn]
      if (!dateValue) return false

      const txDate = parseRowDate(String(dateValue))
      if (!txDate) return false

      // Include transactions within the date range (inclusive)
      return txDate >= startDateFilter && txDate <= endDateFilter
    })
  }

  const filteredRows = getFilteredRows()
  const previewRows = filteredRows.slice(0, 10)

  // ===========================================================================
  // Step 4: Import
  // ===========================================================================

  async function handleImport() {
    if (!parsedData || !file) return

    try {
      setLoading(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', accountId.toString())
      formData.append('statementStartDate', statementStartDate)
      formData.append('statementEndDate', statementEndDate)
      formData.append('statementEndingBalance', statementEndingBalance)
      formData.append('columnMappings', JSON.stringify(columnMappings))
      formData.append('dateFormat', dateFormat)
      formData.append('hasNegativeDebits', hasNegativeDebits.toString())

      // Include branch mappings if any have been configured
      if (Object.keys(branchMappings).length > 0) {
        formData.append('branchMappings', JSON.stringify(branchMappings))
      }

      const response = await fetch(`/api/accounts/${accountId}/import`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import transactions')
      }

      const result = await response.json()
      setImportResult(result.data)
      setCurrentStep(4)
    } catch (err: any) {
      setError(err.message || 'Failed to import transactions')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================================================
  // Rollback Import
  // ===========================================================================

  async function handleRollback() {
    if (!importResult) return

    try {
      setIsRollingBack(true)
      setError(null)

      const response = await fetch(`/api/import-batches/${importResult.importSummary.importBatchId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rollback import')
      }

      // Close dialog and refresh account data
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to rollback import')
      setRollbackConfirmOpen(false)
    } finally {
      setIsRollingBack(false)
    }
  }

  // ===========================================================================
  // Render Steps
  // ===========================================================================

  function renderStep() {
    switch (currentStep) {
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      case 4:
        return renderStep4()
    }
  }

  function renderStep1() {
    return (
      <div className="space-y-6">
        {/* Warning Message */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">Bank Statement Import</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Upload CSV or Excel (.xlsx) file from your bank statement</li>
                <li>System will auto-detect columns and date format</li>
                <li>Checkpoint created to verify against statement ending balance</li>
                <li>Flags duplicates and discrepancies automatically</li>
              </ul>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="file">Bank Statement File (CSV or Excel) *</Label>
          <div className="flex items-center gap-4">
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="flex-1"
            />
            {file && (
              <Badge variant="secondary" className="flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3" />
                {file.name}
              </Badge>
            )}
          </div>
          {parsedData && (
            <>
              <p className="text-sm text-muted-foreground">
                ✓ Parsed {parsedData.totalRows} transactions from {parsedData.headers.length} columns
                {parsedData.detectedHeaderRow !== undefined && parsedData.detectedHeaderRow > 0 &&
                  ` (header found at row ${parsedData.detectedHeaderRow + 1})`}
              </p>
              {(parsedData.detectedStartDate || parsedData.detectedEndDate || parsedData.detectedEndingBalance) && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-700 font-medium mb-1">Auto-Detected from CSV:</p>
                  <ul className="text-xs text-blue-600 space-y-0.5">
                    {parsedData.detectedStartDate && <li>• Start Date: {parsedData.detectedStartDate}</li>}
                    {parsedData.detectedEndDate && <li>• End Date: {parsedData.detectedEndDate}</li>}
                    {parsedData.detectedEndingBalance && <li>• Ending Balance: {parsedData.detectedEndingBalance.toLocaleString()}</li>}
                  </ul>
                  <p className="text-xs text-blue-600 mt-1">You can adjust these values if needed.</p>
                </div>
              )}
              {/* Preview Button for Excel files */}
              {file && file.name.match(/\.(xlsx|xls|XLSX|XLS)$/) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewDialogOpen(true)}
                  className="mt-2"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Cleaned Data
                </Button>
              )}
            </>
          )}
        </div>

        {/* Date Column Selection - Show when multiple date columns detected */}
        {parsedData && availableDateColumns.length > 1 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <div>
                  <p className="font-medium text-amber-900 mb-1">Multiple Date Columns Detected</p>
                  <p className="text-sm text-amber-700">
                    Your statement has {availableDateColumns.length} date columns. Please select which one to use for date filtering and balance calculation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateColumn" className="text-amber-900">
                    Date Column to Use *
                  </Label>
                  <select
                    id="dateColumn"
                    value={selectedDateColumn}
                    onChange={(e) => {
                      console.log('📅 Date column changed to:', e.target.value)
                      setSelectedDateColumn(e.target.value)
                      // Recalculate balance if end date is already set
                      if (statementEndDate && columnMappings.length > 0) {
                        console.log('🔄 Recalculating balance with new date column')
                        recalculateBalanceForDate(statementEndDate)
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                  >
                    {availableDateColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-600">
                    This column will be used for filtering transactions and extracting the checkpoint balance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show selected date column when only one is detected */}
        {parsedData && availableDateColumns.length === 1 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex gap-2 items-start">
              <div className="text-green-600 text-sm">
                ✓ <span className="font-medium">Date Column:</span> {availableDateColumns[0]}
              </div>
            </div>
          </div>
        )}

        {/* Statement Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Statement Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={statementStartDate}
              onChange={(e) => setStatementStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Statement End Date *</Label>
            <Input
              id="endDate"
              type="date"
              value={statementEndDate}
              onChange={(e) => {
                console.log('🔍 End date changed to:', e.target.value)
                console.log('   parsedData exists:', !!parsedData)
                console.log('   columnMappings length:', columnMappings.length)
                console.log('   columnMappings:', columnMappings.map(m => `${m.csvColumn} -> ${m.mappedTo}`))
                setStatementEndDate(e.target.value)
                // Auto-recalculate balance when end date changes
                if (e.target.value && parsedData && columnMappings.length > 0) {
                  console.log('✅ Calling recalculateBalanceForDate')
                  recalculateBalanceForDate(e.target.value)
                } else {
                  console.log('⚠️ Cannot recalculate - missing data')
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endingBalance">Statement Ending Balance *</Label>
          <Input
            id="endingBalance"
            type="number"
            step="0.01"
            placeholder="Balance at end of statement period"
            value={statementEndingBalance}
            onChange={(e) => setStatementEndingBalance(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This balance will be used to create a checkpoint and detect discrepancies
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    )
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        {/* Saved Config Applied Message */}
        {configApplied && savedConfig && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <p className="font-medium mb-1">Previous Configuration Loaded</p>
                <p>
                  Column mappings from your last import ({formatDate(savedConfig.lastImportDate)})
                  have been applied. You can still adjust them if needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Column Mapping</p>
              <p>
                {configApplied
                  ? 'Mappings loaded from your last import. Review and adjust if needed.'
                  : "We've auto-detected columns from your CSV. Review and adjust mappings below."
                }
                {' '}At minimum, you need Transaction Date and one Amount column.
              </p>
            </div>
          </div>
        </div>

        {/* Date Format Selection */}
        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select value={dateFormat} onValueChange={(value) => setDateFormat(value as DateFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dd/mm/yyyy">dd/mm/yyyy (25/12/2024) - Vietnam</SelectItem>
              <SelectItem value="dd-mm-yyyy">dd-mm-yyyy (25-12-2024) - Vietnam</SelectItem>
              <SelectItem value="dd.mm.yyyy">dd.mm.yyyy (25.12.2024) - Germany</SelectItem>
              <SelectItem value="mm/dd/yyyy">mm/dd/yyyy (12/25/2024) - USA</SelectItem>
              <SelectItem value="yyyy-mm-dd">yyyy-mm-dd (2024-12-25) - ISO</SelectItem>
              <SelectItem value="yyyy/mm/dd">yyyy/mm/dd (2024/12/25) - Japan</SelectItem>
              <SelectItem value="dd MMM yyyy">dd MMM yyyy (25 Dec 2024)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Example: {getDateFormatExample(dateFormat)}
          </p>
        </div>

        {/* Negative Debit Toggle */}
        <div className="space-y-2">
          <Label>Amount Column Format</Label>
          <Select
            value={hasNegativeDebits ? 'negative' : 'separate'}
            onValueChange={(value) => setHasNegativeDebits(value === 'negative')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="separate">Separate Debit and Credit columns</SelectItem>
              <SelectItem value="negative">Single Amount column (negative = debit)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {hasNegativeDebits
              ? 'Negative values will be treated as debits (money out)'
              : 'Debit and credit are in separate columns'}
          </p>
        </div>

        {/* Column Mapping Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CSV Column</TableHead>
                <TableHead>Sample Data</TableHead>
                <TableHead>Map To</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columnMappings.map((mapping, index) => {
                const detection = columnDetections[index]
                return (
                  <TableRow key={mapping.csvColumn}>
                    <TableCell className="font-medium">{mapping.csvColumn}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {detection.sampleValues.slice(0, 2).map((v, i) => (
                        <span key={i}>
                          {String(v || '—')}
                          {i < 1 && ', '}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={mapping.mappedTo}
                          onValueChange={(value) => updateColumnMapping(mapping.csvColumn, value as ColumnType)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transaction_date">
                              {getColumnTypeLabel('transaction_date')}
                            </SelectItem>
                            <SelectItem value="description">
                              {getColumnTypeLabel('description')}
                            </SelectItem>
                            <SelectItem value="debit_amount">
                              {getColumnTypeLabel('debit_amount')}
                            </SelectItem>
                            <SelectItem value="credit_amount">
                              {getColumnTypeLabel('credit_amount')}
                            </SelectItem>
                            <SelectItem value="amount">
                              {getColumnTypeLabel('amount')}
                            </SelectItem>
                            <SelectItem value="balance">
                              {getColumnTypeLabel('balance')}
                            </SelectItem>
                            <SelectItem value="reference">
                              {getColumnTypeLabel('reference')}
                            </SelectItem>
                            <SelectItem value="branch">
                              {getColumnTypeLabel('branch')}
                            </SelectItem>
                            <SelectItem value="ignore">
                              {getColumnTypeLabel('ignore')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {mapping.mappedTo === 'branch' && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 flex-shrink-0"
                            onClick={openBranchMappingDialog}
                            title="Map branches"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={detection.confidence > 0.7 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {Math.round(detection.confidence * 100)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm font-medium text-orange-900 mb-2">Required mappings:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-orange-700">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        {/* Info Message */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Preview First 10 Transactions</p>
              <p>
                Review the data below. If it looks correct, click Import to proceed.
              </p>
            </div>
          </div>
        </div>

        {/* Import Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold">{filteredRows.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Statement Period</p>
            <p className="text-sm font-medium">
              {formatDate(statementStartDate)} -{' '}
              {formatDate(statementEndDate)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Ending Balance</p>
            <p className="text-2xl font-bold">
              {parseFloat(statementEndingBalance).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Preview Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {columnMappings
                    .filter(m => m.mappedTo !== 'ignore')
                    .map(mapping => (
                      <TableHead key={mapping.csvColumn}>
                        {getColumnTypeLabel(mapping.mappedTo)}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                    {columnMappings
                      .filter(m => m.mappedTo !== 'ignore')
                      .map(mapping => (
                        <TableCell key={mapping.csvColumn} className="text-sm">
                          {String(row[mapping.csvColumn] || '—')}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  function renderStep4() {
    if (!importResult) return null

    const { importSummary, checkpoint } = importResult

    return (
      <div className="space-y-6">
        {/* Success Message */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-700">
              <p className="font-medium mb-1">Import Completed Successfully!</p>
              <p>
                {importSummary.successfulImports} of {importSummary.totalRows} transactions imported.
                Checkpoint created to verify balance.
              </p>
            </div>
          </div>
        </div>

        {/* Import Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground mb-2">Import Statistics</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Rows:</span>
                <span className="font-medium">{importSummary.totalRows}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Successful:</span>
                <span className="font-medium text-green-600">{importSummary.successfulImports}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Failed:</span>
                <span className="font-medium text-red-600">{importSummary.failedImports}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Duplicates:</span>
                <span className="font-medium text-orange-600">{importSummary.duplicatesDetected}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground mb-2">Checkpoint Status</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Declared Balance:</span>
                <span className="font-medium">{checkpoint.declared_balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Calculated Balance:</span>
                <span className="font-medium">{checkpoint.calculated_balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Adjustment:</span>
                <span className={`font-medium ${checkpoint.is_reconciled ? 'text-green-600' : 'text-orange-600'}`}>
                  {checkpoint.adjustment_amount.toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t">
                <Badge variant={checkpoint.is_reconciled ? 'default' : 'secondary'}>
                  {checkpoint.is_reconciled ? '✓ Reconciled' : '⚠ Discrepancy Flagged'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Recalculation Summary */}
        {importResult.recalculationSummary.checkpointsRecalculated > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Checkpoints Recalculated</p>
                <p>
                  {importResult.recalculationSummary.message}
                </p>
                <p className="mt-2 text-xs">
                  All affected checkpoints have been automatically updated to reflect the imported transactions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Adjustment Warning */}
        {!checkpoint.is_reconciled && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700">
                <p className="font-medium mb-1">Balance Discrepancy Detected</p>
                <p>
                  The statement ending balance ({checkpoint.declared_balance.toLocaleString()}) doesn&apos;t match
                  the calculated balance ({checkpoint.calculated_balance.toLocaleString()}).
                </p>
                <p className="mt-2">
                  <strong>Possible reasons:</strong>
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Duplicate transactions (check if you manually entered some already)</li>
                  <li>Missing transactions from the statement</li>
                  <li>Transactions from before the statement period</li>
                </ul>
                <p className="mt-2">
                  Review the checkpoint and flagged transactions to reconcile the difference.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {importSummary.errors.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Import Errors:</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {importSummary.errors.map((err, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  Row {err.rowIndex}: {err.error}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Rollback Button */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Need to undo this import?</p>
              <p className="text-xs text-gray-600 mt-1">
                This will delete all {importSummary.successfulImports} imported transactions.
                Checkpoints will automatically recalculate.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRollbackConfirmOpen(true)}
              disabled={isRollingBack}
            >
              {isRollingBack ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rolling back...
                </>
              ) : (
                'Rollback Import'
              )}
            </Button>
          </div>
        </div>

        {/* Rollback Confirmation Dialog */}
        {rollbackConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Confirm Rollback</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to rollback this import? This will permanently delete:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
                    <li><strong>{importSummary.successfulImports}</strong> imported transactions</li>
                    <li>Import batch record will be marked as &quot;rolled back&quot;</li>
                    <li>Related checkpoints will automatically recalculate</li>
                  </ul>
                  <p className="text-sm font-medium text-red-600">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setRollbackConfirmOpen(false)}
                  disabled={isRollingBack}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setRollbackConfirmOpen(false)
                    handleRollback()
                  }}
                  disabled={isRollingBack}
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rolling back...
                    </>
                  ) : (
                    'Yes, Rollback Import'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  function goBack() {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as ImportStep)
    }
  }

  function goNext() {
    if (currentStep === 1 && canProceedFromStep1()) {
      setCurrentStep(2)
    } else if (currentStep === 2 && canProceedFromStep2()) {
      setCurrentStep(3)
    } else if (currentStep === 3) {
      handleImport()
    }
  }

  function canGoNext(): boolean {
    switch (currentStep) {
      case 1:
        return canProceedFromStep1()
      case 2:
        return canProceedFromStep2()
      case 3:
        return true
      case 4:
        return false
      default:
        return false
    }
  }

  function getNextButtonLabel(): string {
    switch (currentStep) {
      case 1:
        return 'Next: Map Columns'
      case 2:
        return 'Next: Preview'
      case 3:
        return 'Import Transactions'
      case 4:
        return 'Done'
      default:
        return 'Next'
    }
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import Bank Statement - {accountName}
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 4: {
              currentStep === 1 ? 'Upload File' :
              currentStep === 2 ? 'Map Columns' :
              currentStep === 3 ? 'Preview & Confirm' :
              'Import Results'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step
                    ? 'bg-primary border-primary text-white'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {currentStep > step ? <CheckCircle className="h-5 w-5" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step ? 'bg-primary' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">
          {renderStep()}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {currentStep > 1 && currentStep < 4 && (
              <Button variant="outline" onClick={goBack} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep === 4 ? (
              <Button
                onClick={() => {
                  onSuccess()
                  onOpenChange(false)
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={goNext} disabled={!canGoNext() || loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {currentStep === 3 ? 'Importing...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      {getNextButtonLabel()}
                      {currentStep < 3 && <ArrowRight className="ml-2 h-4 w-4" />}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Preview Cleaned Data Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview Cleaned Excel Data</DialogTitle>
            <DialogDescription>
              Verify that merged cells were properly handled before importing
            </DialogDescription>
          </DialogHeader>

          {parsedData && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Data Summary */}
              <div className="rounded-lg border p-3 bg-muted flex-shrink-0">
                <p className="text-sm font-medium">Data Summary</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.totalRows} rows × {parsedData.headers.length} columns
                  {parsedData.detectedHeaderRow !== undefined && parsedData.detectedHeaderRow > 0 &&
                    ` (header found at row ${parsedData.detectedHeaderRow + 1})`}
                </p>
              </div>

              {/* Data Table Preview */}
              <div className="border rounded-lg overflow-auto flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      {parsedData.headers.map((header, i) => (
                        <TableHead key={i} className="min-w-[150px]">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.rows.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {i + 1}
                        </TableCell>
                        {parsedData.headers.map((header, j) => (
                          <TableCell key={j} className="font-mono text-xs">
                            {row[header] !== null && row[header] !== undefined && row[header] !== ''
                              ? String(row[header])
                              : <span className="text-muted-foreground italic">empty</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {parsedData.totalRows > 100 && (
                <p className="text-sm text-muted-foreground flex-shrink-0">
                  Showing first 100 of {parsedData.totalRows} rows
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0">
            <Button onClick={() => setPreviewDialogOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Mapping Dialog */}
      <Dialog open={branchMappingDialogOpen} onOpenChange={setBranchMappingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Map Branches</DialogTitle>
            <DialogDescription>
              Map branch names from your file to existing branches in the system.
              Unmatched branches will not have a branch assigned.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {uniqueBranchNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branch names found in the file.</p>
            ) : (
              <div className="space-y-3">
                {uniqueBranchNames.map((csvBranchName) => {
                  const mappedBranchId = branchMappings[csvBranchName]
                  const isAutoMatched = availableBranches.some(
                    b => b.branch_name.toLowerCase() === csvBranchName.toLowerCase()
                  )
                  return (
                    <div key={csvBranchName} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{csvBranchName}</p>
                        {isAutoMatched && mappedBranchId && (
                          <p className="text-xs text-green-600">Auto-matched</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 w-[200px]">
                        <Select
                          value={mappedBranchId?.toString() || 'unmapped'}
                          onValueChange={(value) => {
                            updateBranchMapping(
                              csvBranchName,
                              value === 'unmapped' ? null : parseInt(value, 10)
                            )
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">
                              <span className="text-muted-foreground">Not mapped</span>
                            </SelectItem>
                            {availableBranches.map((branch) => (
                              <SelectItem key={branch.branch_id} value={branch.branch_id.toString()}>
                                {branch.branch_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-muted-foreground">
                {Object.values(branchMappings).filter(v => v !== null).length} of {uniqueBranchNames.length} mapped
              </p>
              <Button onClick={() => setBranchMappingDialogOpen(false)}>
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
