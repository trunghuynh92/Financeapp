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
import {
  processWorksheetWithMergedCells,
  analyzeMergedCells,
} from './excel-merged-cells-handler'

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

        // Analyze merged cells for debugging
        const mergeAnalysis = analyzeMergedCells(worksheet)
        console.log('📊 [XLSX Parser] Merge analysis:', mergeAnalysis)

        // First, convert to array WITHOUT processing to find the actual header row
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true, // Use raw values (numbers as numbers, not formatted strings)
          defval: null,
        }) as (string | number | null)[][]

        // Find header row BEFORE processing merged cells
        const preliminaryHeaderRow = findHeaderRow(rawData)
        console.log(`📋 [XLSX Parser] Detected header row at index: ${preliminaryHeaderRow}`)

        // Process worksheet with merged cells handler
        // This will: 1) Unmerge cells, 2) Forward-fill empty cells, 3) Remove empty rows
        // IMPORTANT: Skip metadata rows before header when unmerging
        const processedData = processWorksheetWithMergedCells(workbook, worksheet, {
          autoForwardFill: true,     // Auto-detect columns that need forward-filling
          removeEmptyRows: true,      // Remove completely empty rows
          headerRow: preliminaryHeaderRow,  // Use detected header row
          skipMergeBeforeHeader: true, // NEW: Don't unmerge metadata rows before header
        })

        console.log(`📋 [XLSX Parser] Processed data: ${processedData.length} rows`)

        // Parse the data similar to CSV
        const parsed = parseXLSXData(processedData)

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

      // Handle different value types appropriately
      if (value === null || value === undefined || value === '') {
        row[header] = null
      } else if (typeof value === 'object' && value !== null && 'toISOString' in value && typeof (value as any).toISOString === 'function') {
        // Convert Date objects to ISO date string
        row[header] = (value as Date).toISOString().split('T')[0]
      } else if (typeof value === 'number') {
        // Keep numbers as numbers (don't convert to formatted strings)
        // Debug: Log first few numeric values to verify they're correct
        if (i < headerRowIndex + 5) {
          console.log(`[XLSX Debug] Row ${i} "${header}": ${value} (type: number)`)
        }
        row[header] = value
      } else {
        // Convert everything else to string
        row[header] = String(value)
      }
    })

    rows.push(row)
  }

  // Remove duplicate columns (from horizontally merged header cells)
  const { headers: dedupedHeaders, rows: dedupedRows } = removeDuplicateColumns(headers, rows)

  // Remove duplicate rows (exact duplicates)
  const uniqueRows = removeDuplicateRows(dedupedRows)

  const result: ParsedCSVData = {
    headers: dedupedHeaders,
    rows: uniqueRows,
    totalRows: uniqueRows.length,
    detectedHeaderRow: headerRowIndex,
  }

  // Auto-detect date range and ending balance (reuse CSV logic)
  const metadata = extractStatementMetadata(uniqueRows, dedupedHeaders)
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
 * Also handles duplicate headers from horizontally merged cells
 */
function cleanHeaders(headerRow: (string | number | null)[]): string[] {
  const headers: string[] = []
  const headerCounts = new Map<string, number>()

  for (let index = 0; index < headerRow.length; index++) {
    const cell = headerRow[index]

    let headerName: string
    if (cell === null || cell === undefined || String(cell).trim() === '') {
      headerName = `Column ${index + 1}` // Generate name for empty headers
    } else {
      // Remove newlines and extra spaces, then trim
      headerName = String(cell).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    }

    // Handle duplicates from horizontally merged header cells
    if (headerCounts.has(headerName)) {
      const count = headerCounts.get(headerName)! + 1
      headerCounts.set(headerName, count)
      // Append suffix to make unique: "Transaction Date (2)", "Transaction Date (3)", etc.
      headerName = `${headerName} (${count})`
    } else {
      headerCounts.set(headerName, 1)
    }

    headers.push(headerName)
  }

  return headers
}

/**
 * Remove duplicate columns that result from horizontally merged header cells
 * Keeps only the first occurrence of each duplicate column
 */
function removeDuplicateColumns(
  headers: string[],
  rows: ParsedCSVRow[]
): { headers: string[]; rows: ParsedCSVRow[] } {
  const columnsToKeep: number[] = []
  const headersToKeep: string[] = []
  const duplicatesRemoved: string[] = []

  // Identify which columns to keep
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]

    // Check if this is a duplicate header (ends with " (2)", " (3)", etc.)
    const isDuplicate = /\s\(\d+\)$/.test(header)

    if (isDuplicate) {
      // Extract the original header name (remove the "(2)" suffix)
      const originalHeader = header.replace(/\s\(\d+\)$/, '')

      console.log(`🔍 [Duplicate Check] Header: "${header}" → Original: "${originalHeader}"`)

      // Check if the original header exists and if data is identical
      const originalIndex = headersToKeep.indexOf(originalHeader)

      console.log(`  Original header "${originalHeader}" ${originalIndex !== -1 ? 'FOUND' : 'NOT FOUND'} in headersToKeep`)

      if (originalIndex !== -1) {
        // Check if all data in this column matches the original
        // Skip footer/summary rows (rows with keywords like "Tổng", "Total", "Chứng từ")
        const footerKeywords = ['tổng phát sinh', 'total', 'chứng từ này', 'this document', 'automatically exported']

        let mismatchCount = 0
        const allRowsMatch = rows.every((row, rowIndex) => {
          // Check if this is a footer/summary row
          const isFooterRow = Object.values(row).some(val => {
            if (!val) return false
            const str = String(val).toLowerCase()
            return footerKeywords.some(keyword => str.includes(keyword))
          })

          // Skip footer rows in comparison
          if (isFooterRow) {
            return true // Don't count this row
          }

          const originalValue = row[originalHeader]
          const duplicateValue = row[header]
          // Compare as strings, treating null/undefined/empty as equal
          const origStr = originalValue === null || originalValue === undefined ? '' : String(originalValue)
          const dupStr = duplicateValue === null || duplicateValue === undefined ? '' : String(duplicateValue)
          const matches = origStr === dupStr

          if (!matches && mismatchCount < 3) {
            console.log(`  Row ${rowIndex}: "${originalHeader}" = "${origStr}" vs "${header}" = "${dupStr}" → MISMATCH`)
            mismatchCount++
          }

          return matches
        })

        console.log(`  Data comparison: ${allRowsMatch ? 'ALL MATCH' : 'HAS MISMATCHES'}`)

        if (allRowsMatch) {
          // This is truly a duplicate - skip it
          duplicatesRemoved.push(header)
          console.log(`🗑️  Removing duplicate column: "${header}" (identical to "${originalHeader}")`)
          continue
        } else {
          console.log(`  Keeping "${header}" - data differs from original`)
        }
      }
    }

    // Keep this column
    columnsToKeep.push(i)
    headersToKeep.push(header)
  }

  if (duplicatesRemoved.length > 0) {
    console.log(`✅ Removed ${duplicatesRemoved.length} duplicate column(s) from merged headers`)
  }

  // Rebuild rows with only the kept columns
  const newRows = rows.map(row => {
    const newRow: ParsedCSVRow = {}
    headersToKeep.forEach(header => {
      newRow[header] = row[header]
    })
    return newRow
  })

  return {
    headers: headersToKeep,
    rows: newRows
  }
}

/**
 * Remove duplicate rows (exact duplicates) from parsed data
 * Uses JSON stringification to detect exact row matches
 */
function removeDuplicateRows(rows: ParsedCSVRow[]): ParsedCSVRow[] {
  const seen = new Set<string>()
  const uniqueRows: ParsedCSVRow[] = []
  let duplicateCount = 0

  for (const row of rows) {
    // Create a hash of the row by sorting keys and stringifying
    const sortedKeys = Object.keys(row).sort()
    const rowHash = JSON.stringify(
      sortedKeys.reduce((obj, key) => {
        obj[key] = row[key]
        return obj
      }, {} as ParsedCSVRow)
    )

    if (!seen.has(rowHash)) {
      seen.add(rowHash)
      uniqueRows.push(row)
    } else {
      duplicateCount++
    }
  }

  if (duplicateCount > 0) {
    console.log(`🗑️  Removed ${duplicateCount} duplicate row(s) (exact matches)`)
  }

  return uniqueRows
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
  console.log('📅 [Metadata] Extracting statement metadata...')
  console.log('📅 [Metadata] Available headers:', headers)
  console.log('📅 [Metadata] Total rows:', rows.length)

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

  console.log('📅 [Metadata] Date column found:', dateColumn || 'NOT FOUND')

  if (!dateColumn) {
    return { startDate: null, endDate: null, endingBalance: null }
  }

  // Collect all valid dates
  const datesWithRows: Array<{ date: Date; rowIndex: number }> = []
  let sampleFailedDates: string[] = []

  rows.forEach((row, index) => {
    const dateValue = row[dateColumn]
    if (!dateValue) return

    // Handle Date objects directly (from Excel with cellDates: true)
    let parsed: Date | null = null
    if (dateValue instanceof Date) {
      parsed = dateValue
    } else {
      // Try to parse date string
      parsed = tryParseDate(String(dateValue))
    }

    if (parsed) {
      datesWithRows.push({ date: parsed, rowIndex: index })
    } else if (sampleFailedDates.length < 5) {
      // Collect sample of failed dates for debugging
      sampleFailedDates.push(String(dateValue))
    }
  })

  if (sampleFailedDates.length > 0) {
    console.log('📅 [Metadata] Sample of failed date values:', sampleFailedDates)
  }

  console.log(`📅 [Metadata] Parsed ${datesWithRows.length} valid dates from ${rows.length} rows`)

  if (datesWithRows.length === 0) {
    console.log('📅 [Metadata] No valid dates found')
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

  console.log(`📅 [Metadata] Date range: ${startDate} to ${endDate}`)

  // Find balance column
  const balanceColumn = headers.find(h => {
    const normalized = h.toLowerCase().replace(/\s+/g, '') // Remove all spaces
    return (
      normalized.includes('balance') ||
      normalized.includes('sodu') ||      // "so du" without accent, no space
      normalized.includes('sốdư') ||      // "số dư" with accent, no space
      normalized.includes('sổdư') ||      // Alternative Vietnamese spelling
      normalized.includes('running') ||
      normalized.includes('cuối')         // "cuối" = ending (for "số dư cuối")
    )
  })

  console.log('📅 [Metadata] Balance column found:', balanceColumn || 'NOT FOUND')

  let endingBalance: number | null = null

  if (balanceColumn) {
    const lastTransactionRow = rows[latestDateEntry.rowIndex]
    const balanceValue = lastTransactionRow[balanceColumn]

    console.log('📅 [Metadata] Balance value from last transaction row:', balanceValue)

    if (balanceValue) {
      endingBalance = parseAmount(balanceValue)
      console.log('📅 [Metadata] Parsed ending balance:', endingBalance)
    }
  }

  const result = { startDate, endDate, endingBalance }
  console.log('📅 [Metadata] Final result:', result)

  return result
}

/**
 * Try to parse a date string with various formats
 * Uses the CSV parser's date detection logic
 */
function tryParseDate(value: string): Date | null {
  // Strip time component if present (e.g., "17/11/2025 15:45" → "17/11/2025")
  let dateOnly = value.trim()
  const spaceIndex = dateOnly.indexOf(' ')
  if (spaceIndex !== -1) {
    dateOnly = dateOnly.substring(0, spaceIndex)
  }

  // Try ISO format first (common in Excel)
  const isoMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const date = new Date(dateOnly)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Try dd/mm/yyyy format (common in Vietnamese banks)
  const ddmmyyyyMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10)
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1 // Month is 0-indexed
    const year = parseInt(ddmmyyyyMatch[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Fall back to CSV date parser (handles all formats)
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
    const parsed = parseDate(dateOnly, format)
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

        // Analyze and process merged cells
        const mergeAnalysis = analyzeMergedCells(worksheet)
        console.log(`📊 [XLSX Parser] Sheet "${sheetName}" merge analysis:`, mergeAnalysis)

        const processedData = processWorksheetWithMergedCells(workbook, worksheet, {
          autoForwardFill: true,
          removeEmptyRows: true,
          headerRow: 0,
        })

        const parsed = parseXLSXData(processedData)
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}
