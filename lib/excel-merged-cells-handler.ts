/**
 * Excel Merged Cells Handler
 * Utilities for handling merged cells in Excel imports
 * Specifically designed for bank statements with complex merged cell structures
 */

import type { WorkBook, WorkSheet, Range } from 'xlsx'

/**
 * Unmerge cells in a worksheet by copying the merged value to all cells in the merge range
 *
 * @param workbook - XLSX workbook
 * @param worksheet - XLSX worksheet to process
 * @param options - Options for unmerging
 * @returns Modified worksheet with unmerged cells
 */
export function unmergeCells(
  workbook: WorkBook,
  worksheet: WorkSheet,
  options: {
    skipBeforeRow?: number  // Don't unmerge rows before this index (for metadata)
  } = {}
): WorkSheet {
  const { skipBeforeRow } = options

  // Get merge information from worksheet
  const merges = worksheet['!merges'] || []

  if (merges.length === 0) {
    console.log('📋 No merged cells detected')
    return worksheet
  }

  console.log(`📋 Found ${merges.length} merged cell ranges`)
  if (skipBeforeRow !== undefined) {
    console.log(`📋 Skipping metadata rows before row ${skipBeforeRow + 1}`)
  }

  let skippedCount = 0
  let processedCount = 0

  // Process each merge range
  for (const merge of merges) {
    const startRow = merge.s.r  // Start row index (0-based)
    const endRow = merge.e.r    // End row index (0-based)
    const startCol = merge.s.c  // Start column index (0-based)
    const endCol = merge.e.c    // End column index (0-based)

    // Skip metadata rows if option is set
    if (skipBeforeRow !== undefined && startRow < skipBeforeRow) {
      skippedCount++
      console.log(
        `  ⏭️  Skipping metadata merge at R${startRow + 1}C${startCol + 1} (before header row)`
      )
      continue
    }

    // Get the value from the first cell in the merge range
    const firstCellAddress = encodeCell(startRow, startCol)
    const firstCell = worksheet[firstCellAddress]
    const mergedValue = firstCell ? firstCell.v : null

    console.log(
      `  Unmerging ${firstCellAddress} (R${startRow + 1}C${startCol + 1}) ` +
      `to R${endRow + 1}C${endCol + 1}, value: "${String(mergedValue).substring(0, 50)}..."`
    )

    // Copy the value to all cells in the merged range
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellAddress = encodeCell(row, col)

        // Create or update the cell with the merged value
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = {}
        }

        worksheet[cellAddress].v = mergedValue

        // Copy cell type and format from first cell if available
        if (firstCell) {
          worksheet[cellAddress].t = firstCell.t
          if (firstCell.w) worksheet[cellAddress].w = firstCell.w
          if (firstCell.z) worksheet[cellAddress].z = firstCell.z
        }
      }
    }

    processedCount++
  }

  // Clear merge information (cells are now unmerged)
  delete worksheet['!merges']

  console.log(`✅ Unmerged ${processedCount} cell ranges (skipped ${skippedCount} metadata merges)`)

  return worksheet
}

/**
 * Forward-fill empty cells by copying value from the cell above
 * This handles cases where merged cells span multiple rows in a single column
 *
 * @param data - 2D array of cell values from Excel
 * @param columnsToFill - Column indices to apply forward-fill (0-based). If empty, applies to all columns.
 * @returns Modified data with forward-filled values
 */
export function forwardFillEmptyCells(
  data: (string | number | null)[][],
  columnsToFill?: number[]
): (string | number | null)[][] {
  if (data.length === 0) return data

  const numCols = Math.max(...data.map(row => row.length))
  const fillColumns = columnsToFill || Array.from({ length: numCols }, (_, i) => i)

  console.log(`🔄 Forward-filling empty cells in ${fillColumns.length} column(s)...`)

  let fillCount = 0

  for (const colIndex of fillColumns) {
    let lastValue: string | number | null = null

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      const cellValue = row[colIndex]

      // Check if cell is empty/null/undefined or just whitespace
      const isEmpty = cellValue === null ||
                     cellValue === undefined ||
                     (typeof cellValue === 'string' && cellValue.trim() === '')

      if (isEmpty && lastValue !== null) {
        // Forward-fill from previous row
        row[colIndex] = lastValue
        fillCount++
      } else if (!isEmpty) {
        // Update last seen value
        lastValue = cellValue
      }
    }
  }

  console.log(`✅ Forward-filled ${fillCount} empty cells`)

  return data
}

/**
 * Smart forward-fill that detects which columns likely need filling
 * based on empty cell patterns
 *
 * IMPORTANT: Only forward-fills TEXT columns (like descriptions).
 * NEVER forward-fills numeric/amount columns (debit, credit, balance).
 *
 * @param data - 2D array of cell values
 * @param headerRow - Index of header row (0-based)
 * @returns Modified data with forward-filled values
 */
export function smartForwardFill(
  data: (string | number | null)[][],
  headerRow: number = 0
): (string | number | null)[][] {
  if (data.length <= headerRow + 1) return data

  const numCols = data[headerRow]?.length || 0
  const columnsNeedingFill: number[] = []

  // Keywords that identify amount/numeric columns that should NEVER be forward-filled
  const AMOUNT_COLUMN_KEYWORDS = [
    'NO', 'CO', 'SODU', 'BALANCE', 'DEBIT', 'CREDIT',
    'AMOUNT', 'SOTIEN', 'GHINO', 'GHICO', 'SODU',
    'THU', 'CHI', 'PHATSINH', 'TANG', 'GIAM',
    'CUOI', 'DAU', 'TIEN', 'MONEY', 'VND', 'USD',
    'WITHDRAWAL', 'DEPOSIT', 'RUT', 'NOP'
  ]

  // Analyze each column to detect if it needs forward-filling
  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    const headerName = String(data[headerRow][colIndex] || '').toUpperCase().trim()
    const normalizedHeader = headerName.replace(/\s+/g, '')

    // CRITICAL: Skip amount/numeric columns - these should NEVER be forward-filled
    const isAmountColumn = AMOUNT_COLUMN_KEYWORDS.some(keyword =>
      normalizedHeader.includes(keyword)
    )

    if (isAmountColumn) {
      console.log(
        `  Column ${colIndex} "${headerName}": Skipping (amount column - never forward-fill)`
      )
      continue
    }

    let emptyCount = 0
    let totalCount = 0
    let numericCount = 0
    let textCount = 0

    // Check data rows (skip header)
    for (let rowIndex = headerRow + 1; rowIndex < data.length; rowIndex++) {
      const cellValue = data[rowIndex][colIndex]
      totalCount++

      const isEmpty = cellValue === null ||
                     cellValue === undefined ||
                     (typeof cellValue === 'string' && cellValue.trim() === '')

      if (isEmpty) {
        emptyCount++
      } else {
        // Count numeric values
        const isNumeric = typeof cellValue === 'number' ||
                         (typeof cellValue === 'string' && !isNaN(parseFloat(cellValue.replace(/[,\s]/g, ''))))
        if (isNumeric) {
          numericCount++
        } else {
          textCount++
        }
      }
    }

    // If column is mostly numeric (>50% of non-empty cells), skip it
    const nonEmptyCount = totalCount - emptyCount
    const numericRatio = nonEmptyCount > 0 ? numericCount / nonEmptyCount : 0
    if (numericRatio > 0.5) {
      console.log(
        `  Column ${colIndex} "${headerName}": Skipping (mostly numeric: ${(numericRatio * 100).toFixed(1)}%)`
      )
      continue
    }

    // Only forward-fill if:
    // 1. Column has actual text content (not just numbers)
    // 2. More than 30% of cells are empty (indicating merged cells)
    const emptyRatio = totalCount > 0 ? emptyCount / totalCount : 0
    const hasText = textCount > 0

    if (hasText && emptyRatio > 0.3) {
      console.log(
        `  Column ${colIndex} "${headerName}": ${emptyCount}/${totalCount} empty (${(emptyRatio * 100).toFixed(1)}%), ${textCount} text cells - will forward-fill`
      )
      columnsNeedingFill.push(colIndex)
    } else if (emptyRatio > 0.3) {
      console.log(
        `  Column ${colIndex} "${headerName}": ${emptyCount}/${totalCount} empty but no text content - skipping`
      )
    }
  }

  if (columnsNeedingFill.length > 0) {
    return forwardFillEmptyCells(data, columnsNeedingFill)
  }

  return data
}

/**
 * Remove completely empty rows from data
 *
 * @param data - 2D array of cell values
 * @returns Filtered data without empty rows
 */
export function removeEmptyRows(data: (string | number | null)[][]): (string | number | null)[][] {
  const filtered = data.filter(row => {
    // Keep row if it has at least one non-empty cell
    return row.some(cell => {
      if (cell === null || cell === undefined) return false
      const str = String(cell).trim()
      return str.length > 0
    })
  })

  const removedCount = data.length - filtered.length
  if (removedCount > 0) {
    console.log(`🗑️  Removed ${removedCount} completely empty row(s)`)
  }

  return filtered
}

/**
 * Process Excel worksheet with merged cells
 * Complete pipeline: unmerge → forward-fill → remove empty rows
 *
 * @param workbook - XLSX workbook
 * @param worksheet - XLSX worksheet
 * @param options - Processing options
 * @returns Processed 2D array of cell values
 */
export function processWorksheetWithMergedCells(
  workbook: WorkBook,
  worksheet: WorkSheet,
  options: {
    autoForwardFill?: boolean    // Auto-detect and forward-fill columns (default: true)
    forwardFillColumns?: number[] // Specific columns to forward-fill (overrides auto-detect)
    removeEmptyRows?: boolean     // Remove completely empty rows (default: true)
    headerRow?: number            // Index of header row for smart forward-fill (default: 0)
    skipMergeBeforeHeader?: boolean // Don't unmerge metadata rows before header (default: false)
  } = {}
): (string | number | null)[][] {
  const {
    autoForwardFill = true,
    forwardFillColumns,
    removeEmptyRows: shouldRemoveEmptyRows = true,
    headerRow = 0,
    skipMergeBeforeHeader = false
  } = options

  console.log('🔧 Processing Excel worksheet with merged cells...')

  // Step 1: Unmerge cells (skip metadata rows if requested)
  const unmergedWorksheet = unmergeCells(workbook, worksheet, {
    skipBeforeRow: skipMergeBeforeHeader ? headerRow : undefined
  })

  // Step 2: Convert to array
  const XLSX = require('xlsx')
  let data = XLSX.utils.sheet_to_json(unmergedWorksheet, {
    header: 1,
    raw: true, // Use raw values (numbers as numbers, not formatted strings)
    defval: null,
  }) as (string | number | null)[][]

  // Step 3: Forward-fill empty cells
  if (forwardFillColumns && forwardFillColumns.length > 0) {
    // User specified columns to fill
    data = forwardFillEmptyCells(data, forwardFillColumns)
  } else if (autoForwardFill) {
    // Auto-detect columns that need filling
    data = smartForwardFill(data, headerRow)
  }

  // Step 4: Remove empty rows
  if (shouldRemoveEmptyRows) {
    data = removeEmptyRows(data)
  }

  console.log(`✅ Processed worksheet: ${data.length} rows remaining`)

  return data
}

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Convert row/column indices to Excel cell address (e.g., R0C0 → "A1")
 *
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @returns Excel cell address (e.g., "A1", "B5")
 */
function encodeCell(row: number, col: number): string {
  // Convert column index to letter (0=A, 1=B, ..., 26=AA)
  let colLetter = ''
  let c = col
  while (c >= 0) {
    colLetter = String.fromCharCode((c % 26) + 65) + colLetter
    c = Math.floor(c / 26) - 1
  }
  return `${colLetter}${row + 1}`
}

/**
 * Analyze merged cells in a worksheet (for debugging)
 *
 * @param worksheet - XLSX worksheet
 * @returns Summary of merged cells
 */
export function analyzeMergedCells(worksheet: WorkSheet): {
  totalMerges: number
  verticalMerges: number   // Merges spanning multiple rows
  horizontalMerges: number // Merges spanning multiple columns
  complexMerges: number    // Merges spanning both rows and columns
} {
  const merges = worksheet['!merges'] || []

  let verticalMerges = 0
  let horizontalMerges = 0
  let complexMerges = 0

  for (const merge of merges) {
    const rowSpan = merge.e.r - merge.s.r + 1
    const colSpan = merge.e.c - merge.s.c + 1

    if (rowSpan > 1 && colSpan > 1) {
      complexMerges++
    } else if (rowSpan > 1) {
      verticalMerges++
    } else if (colSpan > 1) {
      horizontalMerges++
    }
  }

  return {
    totalMerges: merges.length,
    verticalMerges,
    horizontalMerges,
    complexMerges
  }
}
