/**
 * TypeScript types for Bank Statement Import System
 * Handles CSV/Excel imports with automatic column detection and mapping
 */

// ==============================================================================
// Import Batch Types
// ==============================================================================

export interface ImportBatch {
  import_batch_id: number
  account_id: number
  import_file_name: string
  import_date: string
  imported_by_user_id: number | null
  total_records: number
  successful_records: number
  failed_records: number
  import_status: 'pending' | 'processing' | 'completed' | 'failed'
  error_log: string | null
  created_at: string
}

// ==============================================================================
// CSV/Excel Parsing Types
// ==============================================================================

export interface ParsedCSVRow {
  [key: string]: string | number | null
}

export interface ParsedCSVData {
  headers: string[]
  rows: ParsedCSVRow[]
  totalRows: number
  // Auto-detected metadata from CSV
  detectedHeaderRow?: number        // Row index where headers were found
  detectedStartDate?: string        // Earliest transaction date (ISO format)
  detectedEndDate?: string          // Latest transaction date (ISO format)
  detectedEndingBalance?: number    // Balance from last transaction row
}

// ==============================================================================
// Date Format Detection
// ==============================================================================

export type DateFormat =
  | 'dd/mm/yyyy'    // Vietnam, Europe (25/12/2024)
  | 'dd-mm-yyyy'    // Vietnam alternative (25-12-2024)
  | 'dd.mm.yyyy'    // Germany (25.12.2024)
  | 'mm/dd/yyyy'    // USA (12/25/2024)
  | 'yyyy-mm-dd'    // ISO (2024-12-25)
  | 'yyyy/mm/dd'    // Japan (2024/12/25)
  | 'dd MMM yyyy'   // Bank format (25 Dec 2024)
  | 'mm/dd/yy'      // USA 2-digit year (12/25/24)
  | 'dd/mm/yy'      // Europe/Vietnam 2-digit year (25/12/24)
  | 'm/d/yy'        // USA short format (6/30/25)
  | 'd/m/yy'        // Europe/Vietnam short format (6/3/25)
  | 'unknown'

export interface DateFormatDetectionResult {
  detectedFormat: DateFormat
  confidence: number // 0-1
  sampleValues: string[]
  warnings: string[]
}

// ==============================================================================
// Column Detection Types
// ==============================================================================

export type ColumnType =
  | 'transaction_date'
  | 'description'
  | 'debit_amount'
  | 'credit_amount'
  | 'amount'           // Single amount column (negative = debit)
  | 'balance'
  | 'reference'
  | 'ignore'

export interface ColumnDetectionResult {
  columnName: string          // Original CSV header
  suggestedType: ColumnType   // Auto-detected column type
  confidence: number          // 0-1
  sampleValues: (string | number | null)[]
  reasoning: string           // Why this column type was suggested
}

export interface ColumnMapping {
  csvColumn: string           // Original CSV header
  mappedTo: ColumnType        // User-selected or auto-detected mapping
  dateFormat?: DateFormat     // For date columns
  isNegativeDebit?: boolean   // If true, negative values = debit
}

// ==============================================================================
// Import Configuration
// ==============================================================================

export interface ImportConfig {
  accountId: number
  fileName: string
  statementStartDate: string  // ISO format
  statementEndDate: string    // ISO format
  statementEndingBalance: number
  columnMappings: ColumnMapping[]
  skipFirstRow: boolean       // Some CSVs have a header description
  dateFormat: DateFormat
  hasNegativeDebits: boolean  // If true, negative amounts = debits
}

// ==============================================================================
// Transaction Import Types
// ==============================================================================

export interface ImportedTransactionData {
  transaction_date: string  // ISO date string (YYYY-MM-DD)
  description: string | null
  debit_amount: number | null
  credit_amount: number | null
  balance: number | null
  bank_reference: string | null
}

export interface TransactionImportResult {
  success: boolean
  transaction_id?: string
  rowIndex: number
  data?: ImportedTransactionData
  error?: string
}

// ==============================================================================
// Import Results
// ==============================================================================

export interface ImportSummary {
  importBatchId: number
  totalRows: number
  successfulImports: number
  failedImports: number
  duplicatesDetected: number
  errors: Array<{
    rowIndex: number
    error: string
  }>
}

export interface ImportWithCheckpointResult {
  importSummary: ImportSummary
  checkpoint: {
    checkpoint_id: number
    declared_balance: number
    calculated_balance: number
    adjustment_amount: number
    is_reconciled: boolean
    checkpoint_date: string
  }
  recalculationSummary: {
    checkpointsRecalculated: number  // How many existing checkpoints were recalculated
    message: string                   // User-friendly message
  }
  duplicateWarnings: Array<{
    importedTransaction: ImportedTransactionData
    possibleDuplicate: {
      transaction_id: string
      transaction_date: string
      description: string
      amount: number
    }
  }>
}

// ==============================================================================
// UI State Types
// ==============================================================================

export interface ImportStep {
  step: 1 | 2 | 3 | 4 // 1=Upload, 2=Map Columns, 3=Preview, 4=Results
  canGoBack: boolean
  canGoNext: boolean
}

export interface ImportDialogState {
  currentStep: ImportStep
  file: File | null
  parsedData: ParsedCSVData | null
  columnDetections: ColumnDetectionResult[]
  columnMappings: ColumnMapping[]
  dateFormat: DateFormat
  hasNegativeDebits: boolean
  statementStartDate: string
  statementEndDate: string
  statementEndingBalance: number
  importResult: ImportWithCheckpointResult | null
  loading: boolean
  error: string | null
}

// ==============================================================================
// Utility Functions
// ==============================================================================

export function isValidDateFormat(format: string): format is DateFormat {
  return [
    'dd/mm/yyyy',
    'dd-mm-yyyy',
    'dd.mm.yyyy',
    'mm/dd/yyyy',
    'yyyy-mm-dd',
    'yyyy/mm/dd',
    'dd MMM yyyy',
    'mm/dd/yy',
    'dd/mm/yy',
    'm/d/yy',
    'd/m/yy',
  ].includes(format)
}

export function getDateFormatExample(format: DateFormat): string {
  const examples: Record<DateFormat, string> = {
    'dd/mm/yyyy': '25/12/2024',
    'dd-mm-yyyy': '25-12-2024',
    'dd.mm.yyyy': '25.12.2024',
    'mm/dd/yyyy': '12/25/2024',
    'yyyy-mm-dd': '2024-12-25',
    'yyyy/mm/dd': '2024/12/25',
    'dd MMM yyyy': '25 Dec 2024',
    'mm/dd/yy': '12/25/24',
    'dd/mm/yy': '25/12/24',
    'm/d/yy': '6/30/25',
    'd/m/yy': '6/3/25',
    'unknown': 'Unknown format',
  }
  return examples[format]
}

export function getColumnTypeLabel(columnType: ColumnType): string {
  const labels: Record<ColumnType, string> = {
    transaction_date: 'Transaction Date',
    description: 'Description',
    debit_amount: 'Debit (Money Out)',
    credit_amount: 'Credit (Money In)',
    amount: 'Amount (Combined)',
    balance: 'Balance After Transaction',
    reference: 'Bank Reference',
    ignore: 'Ignore Column',
  }
  return labels[columnType]
}

export function getColumnTypeDescription(columnType: ColumnType): string {
  const descriptions: Record<ColumnType, string> = {
    transaction_date: 'The date when the transaction occurred',
    description: 'Transaction description or memo',
    debit_amount: 'Money withdrawn/spent (always positive)',
    credit_amount: 'Money deposited/received (always positive)',
    amount: 'Single amount column where negative = debit, positive = credit',
    balance: 'Account balance after this transaction',
    reference: 'Bank reference number or transaction ID',
    ignore: 'This column will not be imported',
  }
  return descriptions[columnType]
}
