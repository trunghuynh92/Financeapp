/**
 * XLSX/Excel Parser
 * Converts Excel files to the same format as CSV parser for unified import pipeline
 */

import * as XLSX from 'xlsx'
import {
  ParsedCSVData,
  ParsedCSVRow,
  DateFormat,
} from '@/types/import'
import { detectDateFormat, parseDate, parseAmount } from './csv-parser'

// ==============================================================================
// Main XLSX Parsing Functions
// ==============================================================================

/**
 * Parse XLSX file and convert to same format as CSV parser
 * This allows reusing all existing import logic
 */
export async function parseXLSXFile(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          throw new Error('Failed to read file')
        }

        // Parse the Excel file
        const workbook = XLSX.read(data, {
          type: 'binary',
          cellDates: true,  // Auto-convert Excel dates to JS Date objects
          cellNF: false,    // Don't include number format
          cellText: false,  // Use calculated values, not formatted text
        })

        // Get the first sheet (or let user choose later)
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          throw new Error('Excel file has no sheets')
        }

        const worksheet = workbook.Sheets[firstSheetName]

        // Convert sheet to array of arrays
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,  // Return array of arrays instead of objects
          raw: false, // Use formatted text values to preserve thousand separators
          defval: null, // Use null for empty cells
        }) as (string | number | null)[][]

        // Parse the data similar to CSV
        const parsed = parseXLSXData(rawData)

        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Parse raw XLSX data (array of arrays) into ParsedCSVData format
 */
function parseXLSXData(rawData: (string | number | null)[][]): ParsedCSVData {
  if (rawData.length === 0) {
    throw new Error('Excel file is empty')
  }

  // Skip empty rows at the beginning
  const nonEmptyRows = rawData.filter(row =>
    row.some(cell => cell !== null && cell !== undefined && cell !== '')
  )

  if (nonEmptyRows.length === 0) {
    throw new Error('Excel file has no data')
  }

  // Find the header row (skip metadata/title rows)
  const headerRowIndex = findHeaderRow(nonEmptyRows)
  const headers = cleanHeaders(nonEmptyRows[headerRowIndex])

  // Parse data rows (start from row after headers)
  const rows: ParsedCSVRow[] = []
  for (let i = headerRowIndex + 1; i < nonEmptyRows.length; i++) {
    const values = nonEmptyRows[i]

    // Skip rows that are completely empty
    if (values.every(v => v === null || v === undefined || v === '')) {
      continue
    }

    const row: ParsedCSVRow = {}
    headers.forEach((header, index) => {
      const value = values[index]

      // Convert value to string or null
      if (value === null || value === undefined || value === '') {
        row[header] = null
      } else if (value instanceof Date || (typeof value === 'object' && value !== null && 'toISOString' in value)) {
        // Convert Date objects to ISO string
        row[header] = (value as Date).toISOString().split('T')[0]
      } else {
        row[header] = String(value)
      }
    })

    rows.push(row)
  }

  const result: ParsedCSVData = {
    headers,
    rows,
    totalRows: rows.length,
    detectedHeaderRow: headerRowIndex,
  }

  // Auto-detect date range and ending balance (reuse CSV logic)
  const metadata = extractStatementMetadata(rows, headers)
  if (metadata.startDate) result.detectedStartDate = metadata.startDate
  if (metadata.endDate) result.detectedEndDate = metadata.endDate
  if (metadata.endingBalance !== null) result.detectedEndingBalance = metadata.endingBalance

  return result
}

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Find the row index that contains actual column headers
 * Similar to CSV parser logic, but adapted for Excel data
 */
function findHeaderRow(rows: (string | number | null)[][]): number {
  const headerKeywords = [
    'date', 'ngày', 'ngay', 'transaction date', 'giao dich',
    'description', 'chi tiết', 'mô tả', 'particulars', 'details', 'dien giai', 'diễn giải',
    'debit', 'credit', 'chi', 'thu', 'amount', 'số tiền', 'ghi nợ', 'ghi có',
    'balance', 'số dư', 'sodu', 'running balance',
    'reference', 'but toan', 'số but toan', 'giao dịch', 'séc',
    'account', 'tai khoan', 'tài khoản',
    'bank', 'ngan hang', 'ngân hàng',
  ]

  // Strong indicators that this is a header row (Vietnamese "STT" = row number)
  const strongHeaderIndicators = ['stt', 'no.', '#', 'row']

  let bestMatchIndex = 0
  let bestMatchScore = 0

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i]

    // Skip rows with too few non-empty columns
    const nonEmptyCells = row.filter(cell =>
      cell !== null && cell !== undefined && String(cell).trim().length > 0
    )
    if (nonEmptyCells.length < 3) continue

    // Initialize score
    let score = 0

    // Count header keyword matches (HEAVILY WEIGHTED - 3 points each)
    let keywordMatches = 0
    let hasStrongIndicator = false
    let hasVeryLongCell = false

    for (const cell of nonEmptyCells) {
      // Normalize cell: remove newlines, convert to lowercase
      const cellStr = String(cell).replace(/[\r\n]+/g, ' ').toLowerCase().trim()

      // Check for strong header indicators (like "STT No.")
      for (const indicator of strongHeaderIndicators) {
        if (cellStr.includes(indicator)) {
          hasStrongIndicator = true
          break
        }
      }

      // Check for header keywords
      for (const keyword of headerKeywords) {
        if (cellStr.includes(keyword)) {
          keywordMatches++
          break // Only count once per cell
        }
      }

      // Check for very long cells (likely metadata like "Một triệu sáu trăm...")
      if (cellStr.length > 50) {
        hasVeryLongCell = true
      }
    }

    score += keywordMatches * 3

    // HUGE bonus for strong header indicators (like "STT")
    if (hasStrongIndicator) {
      score += 10
    }

    // Require minimum keyword matches to be considered a header
    if (keywordMatches < 3) {
      score -= 10
    }

    // Bonus: More columns = more likely to be header
    if (nonEmptyCells.length >= 5) {
      score += 5
    }
    if (nonEmptyCells.length >= 8) {
      score += 5
    }

    // Penalty: Row contains mostly numbers (likely a data row)
    const numericCells = nonEmptyCells.filter(cell => {
      if (typeof cell === 'number') return true
      const str = String(cell).replace(/[,.\s-]/g, '')
      return !isNaN(parseFloat(str)) && str.length > 0
    })
    if (numericCells.length / nonEmptyCells.length > 0.5) {
      score -= 5
    }

    // Heavy penalty: Row has very long cell content (likely metadata)
    if (hasVeryLongCell) {
      score -= 15
    }

    if (score > bestMatchScore) {
      bestMatchScore = score
      bestMatchIndex = i
    }
  }

  return bestMatchIndex
}

/**
 * Clean header values (convert to strings, trim whitespace, remove newlines)
 */
function cleanHeaders(headerRow: (string | number | null)[]): string[] {
  return headerRow.map((cell, index) => {
    if (cell === null || cell === undefined || String(cell).trim() === '') {
      return `Column ${index + 1}` // Generate name for empty headers
    }
    // Remove newlines and extra spaces, then trim
    return String(cell).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  })
}

/**
 * Extract statement metadata from parsed rows
 * Reuses CSV logic for consistency
 */
function extractStatementMetadata(
  rows: ParsedCSVRow[],
  headers: string[]
): {
  startDate: string | null
  endDate: string | null
  endingBalance: number | null
} {
  if (rows.length === 0) {
    return { startDate: null, endDate: null, endingBalance: null }
  }

  // Find date column - prioritize "effective date" over other date columns
  // First, look for "effective date" or "ngày hiệu lực"
  let dateColumn = headers.find(h => {
    const normalized = h.toLowerCase().replace(/\s+/g, ' ')
    return (
      normalized.includes('effective') ||
      normalized.includes('hiệu lực') ||
      normalized.includes('hieu luc')
    )
  })

  // Fallback: Find any date column
  if (!dateColumn) {
    dateColumn = headers.find(h => {
      const normalized = h.toLowerCase()
      return (
        normalized.includes('date') ||
        normalized.includes('ngày') ||
        normalized.includes('ngay') ||
        normalized.includes('giao dich')
      )
    })
  }

  if (!dateColumn) {
    return { startDate: null, endDate: null, endingBalance: null }
  }

  // Collect all valid dates
  const datesWithRows: Array<{ date: Date; rowIndex: number }> = []
  rows.forEach((row, index) => {
    const dateValue = row[dateColumn]
    if (!dateValue) return

    // Try to parse date
    const parsed = tryParseDate(String(dateValue))
    if (parsed) {
      datesWithRows.push({ date: parsed, rowIndex: index })
    }
  })

  if (datesWithRows.length === 0) {
    return { startDate: null, endDate: null, endingBalance: null }
  }

  // Sort by date
  datesWithRows.sort((a, b) => a.date.getTime() - b.date.getTime())

  const earliestDateEntry = datesWithRows[0]
  const latestDateEntry = datesWithRows[datesWithRows.length - 1]

  // Format dates in local timezone to avoid UTC conversion shifting dates
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const startDate = formatLocalDate(earliestDateEntry.date)
  const endDate = formatLocalDate(latestDateEntry.date)

  // Find balance column
  const balanceColumn = headers.find(h => {
    const normalized = h.toLowerCase()
    return (
      normalized.includes('balance') ||
      normalized.includes('số dư') ||
      normalized.includes('sodu') ||
      normalized.includes('running')
    )
  })

  let endingBalance: number | null = null

  if (balanceColumn) {
    const lastTransactionRow = rows[latestDateEntry.rowIndex]
    const balanceValue = lastTransactionRow[balanceColumn]

    if (balanceValue) {
      console.log('🔍 [XLSX Debug] Raw balance value from Excel:', balanceValue)
      console.log('🔍 [XLSX Debug] Type:', typeof balanceValue)
      endingBalance = parseAmount(balanceValue)
      console.log('🔍 [XLSX Debug] Parsed balance:', endingBalance)
    }
  }

  return { startDate, endDate, endingBalance }
}

/**
 * Try to parse a date string with various formats
 * Uses the CSV parser's date detection logic
 */
function tryParseDate(value: string): Date | null {
  // Try ISO format first (common in Excel)
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Fall back to CSV date parser (handles all formats)
  // We'll try all common formats
  const formats: DateFormat[] = [
    'dd/mm/yyyy',
    'mm/dd/yyyy',
    'yyyy-mm-dd',
    'dd-mm-yyyy',
    'dd.mm.yyyy',
    'yyyy/mm/dd',
    'dd MMM yyyy',
    'mm/dd/yy',
    'dd/mm/yy',
    'm/d/yy',
    'd/m/yy',
  ]

  for (const format of formats) {
    const parsed = parseDate(value, format)
    if (parsed) {
      return parsed
    }
  }

  return null
}

// ==============================================================================
// Multi-Sheet Support (Future Enhancement)
// ==============================================================================

/**
 * Get all sheet names from an XLSX file
 * Useful for letting users choose which sheet to import
 */
export async function getXLSXSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          throw new Error('Failed to read file')
        }

        const workbook = XLSX.read(data, { type: 'binary' })
        resolve(workbook.SheetNames)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Parse a specific sheet from XLSX file
 * @param file - The XLSX file
 * @param sheetName - Name of the sheet to parse
 */
export async function parseXLSXSheet(file: File, sheetName: string): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          throw new Error('Failed to read file')
        }

        const workbook = XLSX.read(data, {
          type: 'binary',
          cellDates: true,
        })

        if (!workbook.SheetNames.includes(sheetName)) {
          throw new Error(`Sheet "${sheetName}" not found in file`)
        }

        const worksheet = workbook.Sheets[sheetName]
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false, // Use formatted text values to preserve thousand separators
          defval: null,
        }) as (string | number | null)[][]

        const parsed = parseXLSXData(rawData)
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}
