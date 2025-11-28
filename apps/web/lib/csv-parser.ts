/**
 * CSV/Excel Parser with Smart Column Detection
 * Handles multiple date formats, negative debits, and automatic column mapping
 */

import {
  ParsedCSVData,
  ParsedCSVRow,
  DateFormat,
  DateFormatDetectionResult,
  ColumnType,
  ColumnDetectionResult,
  ColumnMapping,
} from '@/types/import'

// ==============================================================================
// CSV Parsing
// ==============================================================================

/**
 * Parse CSV file into structured data
 * Uses browser's native parsing for now (can upgrade to Papa Parse if needed)
 */
export async function parseCSVFile(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseCSVText(text)
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Parse CSV text content with smart header detection
 */
export function parseCSVText(text: string): ParsedCSVData {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  // Find the row that contains actual headers (skip metadata/summary rows)
  const headerRowIndex = findHeaderRow(lines)
  const headers = parseCSVLine(lines[headerRowIndex])

  // Parse data rows (start from row after headers)
  const rows: ParsedCSVRow[] = []
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: ParsedCSVRow = {}

    headers.forEach((header, index) => {
      const value = values[index] || null
      row[header] = value
    })

    rows.push(row)
  }

  const result: ParsedCSVData = {
    headers,
    rows,
    totalRows: rows.length,
    detectedHeaderRow: headerRowIndex,
  }

  // Auto-detect date range and ending balance
  const metadata = extractStatementMetadata(rows, headers)
  if (metadata.startDate) result.detectedStartDate = metadata.startDate
  if (metadata.endDate) result.detectedEndDate = metadata.endDate
  if (metadata.endingBalance !== null) result.detectedEndingBalance = metadata.endingBalance

  return result
}

/**
 * Find the row index that contains actual column headers
 * Skips metadata/summary rows at the top of bank statements
 */
function findHeaderRow(lines: string[]): number {
  // Strategy:
  // 1. Look for row with multiple distinct non-empty columns (likely headers)
  // 2. Check if CELLS contain common header keywords (not substrings in data)
  // 3. Skip rows that look like metadata (key-value pairs)
  // 4. Skip rows that look like data rows (contain dates, IDs, long text)
  // 5. Prefer rows with more columns

  // Header keywords - these should match ENTIRE CELLS or be the primary content
  const headerKeywords = [
    'date', 'ngày', 'ngay', 'transaction date', 'giao dich', 'ngày giờ',
    'description', 'chi tiết', 'mô tả', 'particulars', 'details', 'dien giai', 'diễn giải',
    'debit', 'credit', 'chi', 'thu', 'amount', 'số tiền', 'ghi nợ', 'ghi có',
    'balance', 'số dư', 'sodu', 'running balance',
    'reference', 'but toan', 'số but toan', 'giao dịch', 'séc',
    'account', 'tai khoan', 'tài khoản',
    'bank', 'ngan hang', 'ngân hàng',
    'fee', 'phi', 'phí', 'interest', 'lai', 'lãi',
    'nhận', 'nhan', 'loại', 'pttt', 'phiếu', 'người', 'điện thoại',
    'mã', 'chi nhánh', 'lý do'
  ]

  // Strong indicators that this is a header row (Vietnamese "STT" = row number)
  const strongHeaderIndicators = ['stt', 'no.', '#', 'row', 'mã thanh toán']

  // Patterns that indicate a DATA row (not header)
  const dateTimePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/
  const idPattern = /^#?\d{5,}$/  // IDs like #0179749

  let bestMatchIndex = 0
  let bestMatchScore = -100

  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const parsed = parseCSVLine(lines[i])

    // Skip rows with too few columns
    const nonEmptyColumns = parsed.filter(col => col.trim().length > 0)
    if (nonEmptyColumns.length < 3) continue

    // Initialize score
    let score = 0

    // Count header keyword matches AT THE CELL LEVEL (not substring in data)
    let keywordMatches = 0
    let hasStrongIndicator = false
    let hasVeryLongCell = false
    let hasDateTimeValue = false
    let hasIdValue = false

    for (const col of nonEmptyColumns) {
      const normalizedCell = col.toLowerCase().trim()

      // Check if the cell IS a header keyword (exact or close match)
      // A header cell is typically short (under 30 chars) and matches a keyword
      if (normalizedCell.length <= 30) {
        for (const keyword of headerKeywords) {
          // Check if keyword matches the cell content closely
          // Either exact match, or cell contains keyword as primary content
          if (
            normalizedCell === keyword ||
            normalizedCell.includes(keyword) && normalizedCell.length <= keyword.length + 10
          ) {
            keywordMatches++
            break // Only count one match per cell
          }
        }

        // Check for strong header indicators
        for (const indicator of strongHeaderIndicators) {
          if (normalizedCell === indicator || normalizedCell.includes(indicator)) {
            hasStrongIndicator = true
            break
          }
        }
      }

      // Check for very long cells (likely data, not header)
      if (col.length > 40) {
        hasVeryLongCell = true
      }

      // Check for date/time values (strong indicator this is a data row)
      if (dateTimePattern.test(col)) {
        hasDateTimeValue = true
      }

      // Check for ID values (strong indicator this is a data row)
      if (idPattern.test(col.trim())) {
        hasIdValue = true
      }
    }

    // Score based on keyword matches (3 points each)
    score += keywordMatches * 3

    // HUGE bonus for strong header indicators (like "STT", "Mã thanh toán")
    if (hasStrongIndicator) {
      score += 15
    }

    // Require minimum keyword matches to be considered a header
    if (keywordMatches < 2) {
      score -= 20
    }

    // HEAVY penalty: Row contains date/time values (this is DATA, not header!)
    if (hasDateTimeValue) {
      score -= 30
    }

    // HEAVY penalty: Row contains ID values (this is DATA, not header!)
    if (hasIdValue) {
      score -= 25
    }

    // Penalty: Row has very long cell content (likely data description)
    if (hasVeryLongCell) {
      score -= 15
    }

    // Bonus: More columns = more likely to be header (5+ columns gets bonus)
    if (nonEmptyColumns.length >= 5) {
      score += 3
    }
    if (nonEmptyColumns.length >= 8) {
      score += 3 // Extra bonus for very wide tables
    }

    // Bonus for row 0 if it has reasonable structure (often headers are first row)
    if (i === 0 && keywordMatches >= 2) {
      score += 5
    }

    // Penalty: If row looks like metadata (key-value pair pattern)
    // Example: "Account number,123456,Account type,Savings"
    if (nonEmptyColumns.length >= 4 && nonEmptyColumns.length % 2 === 0) {
      // Check if alternating pattern of text and values
      let looksLikeMetadata = true
      for (let j = 1; j < nonEmptyColumns.length; j += 2) {
        const col = nonEmptyColumns[j]
        // If odd-indexed columns are mostly short values (numbers, short text), it's metadata
        if (col.length > 30 || col.split(/[\s,/]/).length > 3) {
          looksLikeMetadata = false
          break
        }
      }
      if (looksLikeMetadata) {
        score -= 10 // Heavy penalty for metadata rows
      }
    }

    // Penalty: Row contains mostly numbers (likely a data row, not header)
    const numericColumns = nonEmptyColumns.filter(col => {
      const cleaned = col.replace(/[,.\s-]/g, '')
      return !isNaN(parseFloat(cleaned)) && cleaned.length > 0
    })
    if (numericColumns.length / nonEmptyColumns.length > 0.5) {
      score -= 10 // Higher penalty if more than 50% of columns are numeric
    }

    if (score > bestMatchScore) {
      bestMatchScore = score
      bestMatchIndex = i
    }
  }

  return bestMatchIndex
}

/**
 * Extract statement metadata (date range and ending balance) from parsed rows
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

  // Fallback: Find any date column (support both Vietnamese and English)
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

  // Collect all valid dates from transaction rows with their row index
  const datesWithRows: Array<{ date: Date; rowIndex: number }> = []
  rows.forEach((row, index) => {
    const dateValue = row[dateColumn]
    if (!dateValue) return

    // Try to parse with various formats
    const parsed = tryParseDate(String(dateValue))
    if (parsed) {
      datesWithRows.push({ date: parsed, rowIndex: index })
    }
  })

  if (datesWithRows.length === 0) {
    return { startDate: null, endDate: null, endingBalance: null }
  }

  // Sort by date to find earliest and latest (handles both ascending and descending CSV order)
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

  // Find balance/running balance column
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
    // Get the balance from the row with the latest date
    const lastTransactionRow = rows[latestDateEntry.rowIndex]
    const balanceValue = lastTransactionRow[balanceColumn]

    if (balanceValue) {
      endingBalance = parseAmount(balanceValue)
    }
  }

  return { startDate, endDate, endingBalance }
}

/**
 * Try to parse a date string with various formats
 */
function tryParseDate(value: string): Date | null {
  for (const { parser } of DATE_FORMAT_PATTERNS) {
    const parsed = parser(value)
    if (parsed && isValidDate(parsed)) {
      return parsed
    }
  }
  return null
}

/**
 * Parse a single CSV line (handles quotes and commas)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// ==============================================================================
// Date Format Detection
// ==============================================================================

const DATE_FORMAT_PATTERNS: Array<{
  format: DateFormat
  regex: RegExp
  parser: (value: string) => Date | null
}> = [
  // Datetime formats (check these first before date-only formats)
  {
    format: 'yyyy-mm-dd',
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
      if (!match) return null
      const [, year, month, day, hour, minute, second] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'dd/mm/yyyy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
      if (!match) return null
      const [, day, month, year, hour, minute, second] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'mm/dd/yyyy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
      if (!match) return null
      const [, month, day, year, hour, minute, second] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second))
      return isValidDate(date) ? date : null
    },
  },
  // Date-only formats
  {
    format: 'dd/mm/yyyy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (!match) return null
      const [, day, month, year] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'dd-mm-yyyy',
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      if (!match) return null
      const [, day, month, year] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'dd.mm.yyyy',
    regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
      if (!match) return null
      const [, day, month, year] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'mm/dd/yyyy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (!match) return null
      const [, month, day, year] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'yyyy-mm-dd',
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      if (!match) return null
      const [, year, month, day] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'yyyy/mm/dd',
    regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
      if (!match) return null
      const [, year, month, day] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  // 2-digit year formats
  {
    format: 'mm/dd/yy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (!match) return null
      const [, month, day, yearStr] = match
      // Y2K conversion: 00-29 → 2000-2029, 30-99 → 1930-1999
      const year = parseInt(yearStr) < 30 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr)
      const date = new Date(year, parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'dd/mm/yy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (!match) return null
      const [, day, month, yearStr] = match
      // Y2K conversion: 00-29 → 2000-2029, 30-99 → 1930-1999
      const year = parseInt(yearStr) < 30 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr)
      const date = new Date(year, parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'm/d/yy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (!match) return null
      const [, month, day, yearStr] = match
      // Y2K conversion: 00-29 → 2000-2029, 30-99 → 1930-1999
      const year = parseInt(yearStr) < 30 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr)
      const date = new Date(year, parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'd/m/yy',
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (!match) return null
      const [, day, month, yearStr] = match
      // Y2K conversion: 00-29 → 2000-2029, 30-99 → 1930-1999
      const year = parseInt(yearStr) < 30 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr)
      const date = new Date(year, parseInt(month) - 1, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
  {
    format: 'dd MMM yyyy',
    regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
    parser: (value) => {
      const match = value.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i)
      if (!match) return null
      const [, day, monthStr, year] = match
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      }
      const month = monthMap[monthStr.toLowerCase()]
      if (month === undefined) return null
      const date = new Date(parseInt(year), month, parseInt(day))
      return isValidDate(date) ? date : null
    },
  },
]

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Detect date format from sample values
 */
export function detectDateFormat(sampleValues: (string | number | null)[]): DateFormatDetectionResult {
  const validSamples = sampleValues
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .slice(0, 10) // Check up to 10 samples

  if (validSamples.length === 0) {
    return {
      detectedFormat: 'unknown',
      confidence: 0,
      sampleValues: [],
      warnings: ['No valid date samples found'],
    }
  }

  // Try each format and score by success rate
  const scores: Array<{ format: DateFormat; successCount: number; totalTried: number }> = []

  for (const { format, regex, parser } of DATE_FORMAT_PATTERNS) {
    let successCount = 0
    let totalTried = 0

    for (const sample of validSamples) {
      if (regex.test(sample)) {
        totalTried++
        const parsed = parser(sample)
        if (parsed) {
          successCount++
        }
      }
    }

    if (totalTried > 0) {
      scores.push({ format, successCount, totalTried })
    }
  }

  // Sort by success rate, then by total tried
  scores.sort((a, b) => {
    const rateA = a.successCount / a.totalTried
    const rateB = b.successCount / b.totalTried
    if (rateB !== rateA) return rateB - rateA
    return b.totalTried - a.totalTried
  })

  if (scores.length === 0 || scores[0].successCount === 0) {
    return {
      detectedFormat: 'unknown',
      confidence: 0,
      sampleValues: validSamples,
      warnings: ['Could not detect date format from samples'],
    }
  }

  const best = scores[0]
  const confidence = best.successCount / best.totalTried
  const warnings: string[] = []

  // Check for ambiguous formats (dd/mm/yyyy vs mm/dd/yyyy)
  if (best.format === 'dd/mm/yyyy' || best.format === 'mm/dd/yyyy') {
    const hasAmbiguous = validSamples.some(sample => {
      const parts = sample.split('/')
      if (parts.length === 3) {
        const first = parseInt(parts[0])
        const second = parseInt(parts[1])
        return first <= 12 && second <= 12 // Could be either format
      }
      return false
    })

    if (hasAmbiguous) {
      warnings.push(
        best.format === 'dd/mm/yyyy'
          ? 'Date format auto-detected as dd/mm/yyyy (Vietnam format). Change if incorrect.'
          : 'Date format detected as mm/dd/yyyy (US format). Change to dd/mm/yyyy if needed.'
      )
    }
  }

  return {
    detectedFormat: best.format,
    confidence,
    sampleValues: validSamples,
    warnings,
  }
}

/**
 * Parse date string with specified format
 * Tries both datetime and date-only variants of the format
 */
export function parseDate(value: string, format: DateFormat): Date | null {
  if (!value || typeof value !== 'string') return null

  const trimmedValue = value.trim()

  // Get all patterns matching the specified format (includes both datetime and date-only)
  const matchingPatterns = DATE_FORMAT_PATTERNS.filter(p => p.format === format)

  // Try each matching pattern
  for (const pattern of matchingPatterns) {
    const parsed = pattern.parser(trimmedValue)
    if (parsed && isValidDate(parsed)) {
      return parsed
    }
  }

  // If no pattern matched, fall back to trying all formats
  return tryParseDate(trimmedValue)
}

// ==============================================================================
// Column Type Detection
// ==============================================================================

/**
 * Detect likely column types from header names and sample data
 */
export function detectColumnTypes(
  headers: string[],
  rows: ParsedCSVRow[]
): ColumnDetectionResult[] {
  const sampleSize = Math.min(10, rows.length)
  const sampleRows = rows.slice(0, sampleSize)

  return headers.map(header => {
    const sampleValues = sampleRows.map(row => row[header])
    return detectSingleColumnType(header, sampleValues)
  })
}

/**
 * Detect column type for a single column
 */
function detectSingleColumnType(
  columnName: string,
  sampleValues: (string | number | null)[]
): ColumnDetectionResult {
  const normalizedName = columnName.toLowerCase().trim()

  // Date column detection
  if (
    normalizedName.includes('date') ||
    normalizedName.includes('ngày') || // Vietnamese
    normalizedName.includes('ngay') ||
    normalizedName.includes('giờ') || // Vietnamese for "time" (used in datetime columns like "Ngày giờ")
    normalizedName.includes('gio') ||
    normalizedName.includes('giao dịch')
  ) {
    const dateDetection = detectDateFormat(sampleValues)
    return {
      columnName,
      suggestedType: 'transaction_date',
      confidence: dateDetection.confidence,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: `Column name contains "date" and ${Math.round(dateDetection.confidence * 100)}% of samples match date format`,
    }
  }

  // Description column detection
  if (
    normalizedName.includes('description') ||
    normalizedName.includes('memo') ||
    normalizedName.includes('details') ||
    normalizedName.includes('particulars') ||
    normalizedName.includes('narration') ||
    normalizedName.includes('chi tiết') || // Vietnamese
    normalizedName.includes('diễn giải') ||
    normalizedName.includes('mô tả')
  ) {
    return {
      columnName,
      suggestedType: 'description',
      confidence: 0.9,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests transaction description',
    }
  }

  // Debit amount detection
  if (
    normalizedName.includes('debit') ||
    normalizedName.includes('withdrawal') ||
    normalizedName.includes('spent') ||
    normalizedName.includes('payment') ||
    normalizedName.includes('chi') || // Vietnamese
    normalizedName.includes('rút') ||
    normalizedName.includes('ghi nợ')
  ) {
    const hasNumbers = sampleValues.some(v => typeof v === 'string' && !isNaN(parseFloat(v)))
    return {
      columnName,
      suggestedType: 'debit_amount',
      confidence: hasNumbers ? 0.85 : 0.6,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests debit/withdrawal amounts',
    }
  }

  // Credit amount detection
  if (
    normalizedName.includes('credit') ||
    normalizedName.includes('deposit') ||
    normalizedName.includes('received') ||
    normalizedName.includes('income') ||
    normalizedName.includes('thu') || // Vietnamese
    normalizedName.includes('nạp') ||
    normalizedName.includes('nhận') || // Vietnamese for "receive"
    normalizedName.includes('nhan') ||
    normalizedName.includes('ghi có')
  ) {
    const hasNumbers = sampleValues.some(v => typeof v === 'string' && !isNaN(parseFloat(v)))
    return {
      columnName,
      suggestedType: 'credit_amount',
      confidence: hasNumbers ? 0.85 : 0.6,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests credit/deposit amounts',
    }
  }

  // Balance column detection
  if (
    normalizedName.includes('balance') ||
    normalizedName.includes('số dư') || // Vietnamese
    normalizedName.includes('sodu')
  ) {
    const hasNumbers = sampleValues.some(v => typeof v === 'string' && !isNaN(parseFloat(v)))
    return {
      columnName,
      suggestedType: 'balance',
      confidence: hasNumbers ? 0.9 : 0.7,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests account balance',
    }
  }

  // Reference/ID column detection
  if (
    normalizedName.includes('reference') ||
    normalizedName.includes('ref') ||
    normalizedName.includes('id') ||
    normalizedName.includes('transaction id') ||
    normalizedName.includes('doc') ||
    normalizedName.includes('mã') || // Vietnamese
    normalizedName.includes('số chứng từ')
  ) {
    return {
      columnName,
      suggestedType: 'reference',
      confidence: 0.8,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests reference number or transaction ID',
    }
  }

  // Branch column detection
  if (
    normalizedName.includes('branch') ||
    normalizedName.includes('chi nhánh') || // Vietnamese
    normalizedName.includes('chi nhanh') ||
    normalizedName.includes('chinhanh') ||
    normalizedName.includes('location') ||
    normalizedName.includes('store') ||
    normalizedName.includes('cửa hàng') ||
    normalizedName.includes('cua hang')
  ) {
    return {
      columnName,
      suggestedType: 'branch',
      confidence: 0.9,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Column name suggests branch or store location',
    }
  }

  // Amount column (single column with positive/negative)
  if (normalizedName.includes('amount') || normalizedName.includes('số tiền')) {
    const numericValues = sampleValues
      .map(v => typeof v === 'string' ? parseFloat(v.replace(/[,\s]/g, '')) : null)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v))

    const hasNegative = numericValues.some(v => v < 0)
    const hasPositive = numericValues.some(v => v > 0)

    if (hasNegative && hasPositive) {
      return {
        columnName,
        suggestedType: 'amount',
        confidence: 0.85,
        sampleValues: sampleValues.slice(0, 5),
        reasoning: 'Column contains both positive and negative amounts (negative = debit, positive = credit)',
      }
    }
  }

  // Generic number column - could be amount
  const numericValues = sampleValues.filter(v => {
    if (typeof v === 'string') {
      const cleaned = v.replace(/[,\s]/g, '')
      return !isNaN(parseFloat(cleaned))
    }
    return false
  })

  if (numericValues.length >= sampleValues.length * 0.7) {
    return {
      columnName,
      suggestedType: 'ignore',
      confidence: 0.3,
      sampleValues: sampleValues.slice(0, 5),
      reasoning: 'Numeric column - please map manually to debit, credit, amount, or balance',
    }
  }

  // Default: ignore
  return {
    columnName,
    suggestedType: 'ignore',
    confidence: 0.2,
    sampleValues: sampleValues.slice(0, 5),
    reasoning: 'Could not determine column type - set manually if needed',
  }
}

// ==============================================================================
// Number Parsing
// ==============================================================================

/**
 * Parse amount from string, handling various formats
 * Handles: 1,000.50 or 1.000,50 or 1 000.50 or (1000) for negative
 * Also handles multiple thousand separators: 111.244.435 or 111,244,435
 */
export function parseAmount(value: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') return value

  // Remove whitespace
  let cleaned = value.toString().trim()

  // Handle empty/dash values (various dash characters commonly used in Vietnamese bank statements)
  if (cleaned === '-' || cleaned === '—' || cleaned === '–' || cleaned === '−' || cleaned === '') {
    return null
  }

  // Handle negative in parentheses: (1000) -> -1000
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  // Remove currency symbols
  cleaned = cleaned.replace(/[₫$€£¥]/g, '')

  // Count occurrences of dots and commas
  const dotCount = (cleaned.match(/\./g) || []).length
  const commaCount = (cleaned.match(/,/g) || []).length

  // Determine decimal separator based on position and count
  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  // If multiple dots or commas, they're thousand separators
  // The decimal separator (if any) should be the LAST one and have <=2 digits after it
  if (dotCount > 1) {
    // Multiple dots = dots are thousand separators (European style: 111.244.435)
    cleaned = cleaned.replace(/\./g, '')
  } else if (commaCount > 1) {
    // Multiple commas = commas are thousand separators (US style: 111,244,435)
    cleaned = cleaned.replace(/,/g, '')
  } else if (dotCount === 1 && commaCount === 1) {
    // Both present, determine which is decimal by position
    if (lastDot > lastComma) {
      // Dot comes last, it's decimal: 1,000.50 -> 1000.50
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Comma comes last, it's decimal: 1.000,50 -> 1000.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (dotCount === 1) {
    // Only one dot - check if it's decimal (has 1-2 digits after) or thousand separator
    const digitsAfterDot = cleaned.length - lastDot - 1
    if (digitsAfterDot === 3) {
      // Exactly 3 digits after dot = thousand separator (e.g., 1.000)
      cleaned = cleaned.replace(/\./g, '')
    }
    // Otherwise keep the dot as decimal separator
  } else if (commaCount === 1) {
    // Only one comma - check if it's decimal (has 1-2 digits after) or thousand separator
    const digitsAfterComma = cleaned.length - lastComma - 1
    if (digitsAfterComma === 3) {
      // Exactly 3 digits after comma = thousand separator (e.g., 1,000)
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Comma is decimal separator, convert to dot
      cleaned = cleaned.replace(',', '.')
    }
  } else {
    // No dots or commas, just remove spaces
    cleaned = cleaned.replace(/\s/g, '')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

/**
 * Convert amount to debit/credit based on value and settings
 */
export function amountToDebitCredit(
  amount: number,
  hasNegativeDebits: boolean
): { debit: number | null; credit: number | null } {
  if (hasNegativeDebits) {
    // Negative = debit (withdrawal), Positive = credit (deposit)
    if (amount < 0) {
      return { debit: Math.abs(amount), credit: null }
    } else {
      return { debit: null, credit: amount }
    }
  } else {
    // Positive number in debit column = debit, positive in credit column = credit
    // This case is handled by column mapping, not here
    return { debit: null, credit: amount }
  }
}

// ==============================================================================
// Auto-generate Column Mappings
// ==============================================================================

/**
 * Generate initial column mappings from detection results
 */
export function generateColumnMappings(
  detections: ColumnDetectionResult[],
  dateFormat: DateFormat
): ColumnMapping[] {
  return detections.map(detection => {
    const mapping: ColumnMapping = {
      csvColumn: detection.columnName,
      mappedTo: detection.suggestedType,
    }

    // Add date format for date columns
    if (detection.suggestedType === 'transaction_date') {
      mapping.dateFormat = dateFormat
    }

    // Add negative debit flag for amount columns
    if (detection.suggestedType === 'amount') {
      mapping.isNegativeDebit = true
    }

    return mapping
  })
}
