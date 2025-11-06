/**
 * API Route: /api/accounts/[id]/import
 * Handles bank statement CSV import with automatic checkpoint creation
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createOrUpdateCheckpoint } from '@/lib/checkpoint-service'
import {
  parseCSVText,
  parseDate,
  parseAmount,
  amountToDebitCredit,
} from '@/lib/csv-parser'
import type {
  ColumnMapping,
  DateFormat,
  ImportedTransactionData,
  TransactionImportResult,
  ImportSummary,
  ImportWithCheckpointResult,
} from '@/types/import'

// ==============================================================================
// POST /api/accounts/[id]/import
// Import bank statement CSV and create checkpoint
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const statementStartDate = formData.get('statementStartDate') as string
    const statementEndDate = formData.get('statementEndDate') as string
    const statementEndingBalance = formData.get('statementEndingBalance') as string
    const columnMappingsStr = formData.get('columnMappings') as string
    const dateFormat = formData.get('dateFormat') as DateFormat
    const hasNegativeDebits = formData.get('hasNegativeDebits') === 'true'

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!statementEndDate || !statementEndingBalance) {
      return NextResponse.json(
        { error: 'Statement end date and ending balance are required' },
        { status: 400 }
      )
    }

    if (!columnMappingsStr) {
      return NextResponse.json({ error: 'Column mappings are required' }, { status: 400 })
    }

    // Parse column mappings
    let columnMappings: ColumnMapping[]
    try {
      columnMappings = JSON.parse(columnMappingsStr)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid column mappings format' }, { status: 400 })
    }

    // Parse file based on type (CSV or XLSX)
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    let parsedCSV

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      // Parse Excel file on server (use ArrayBuffer, not FileReader)
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()

      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false,
      })

      // Get first sheet
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('Excel file has no sheets')
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false, // Use formatted text values to preserve thousand separators
        defval: null,
      }) as (string | number | null)[][]

      // Filter out completely empty rows (rows with formatting but no actual data)
      const filteredData = rawData.filter(row => {
        // Keep row if it has at least one non-empty cell
        return row.some(cell => {
          if (cell === null || cell === undefined) return false
          const str = String(cell).trim()
          return str.length > 0
        })
      })

      // Convert to CSV text format for existing parser
      // IMPORTANT: Properly escape newlines and quotes to preserve structure
      const csvText = filteredData
        .map(row =>
          row.map(cell => {
            if (cell === null || cell === undefined) return ''
            const str = String(cell)
            // Always quote cells that contain special characters
            // Replace actual newlines with space to prevent CSV row breaks
            const cleaned = str.replace(/[\r\n]+/g, ' ').trim()
            // Escape quotes and wrap in quotes if contains comma or quotes
            if (cleaned.includes(',') || cleaned.includes('"')) {
              return `"${cleaned.replace(/"/g, '""')}"`
            }
            return cleaned
          }).join(',')
        )
        .join('\n')

      parsedCSV = parseCSVText(csvText)
    } else {
      // Parse CSV file (default)
      const csvText = await file.text()
      parsedCSV = parseCSVText(csvText)
    }

    // Create import batch record
    const { data: importBatch, error: batchError } = await supabase
      .from('import_batch')
      .insert({
        account_id: accountId,
        import_file_name: file.name,
        total_records: parsedCSV.totalRows,
        import_status: 'processing',
      })
      .select()
      .single()

    if (batchError) {
      throw new Error(`Failed to create import batch: ${batchError.message}`)
    }

    // Process transactions
    const importResults: TransactionImportResult[] = []
    const transactionsToInsert: any[] = []
    const errors: Array<{ rowIndex: number; error: string }> = []

    console.log(`📊 Processing ${parsedCSV.rows.length} rows from import...`)

    for (let i = 0; i < parsedCSV.rows.length; i++) {
      const row = parsedCSV.rows[i]
      const rowIndex = i + 2 // +2 because row 1 is header, and we're 0-indexed

      try {
        const transactionData = processRow(
          row,
          columnMappings,
          dateFormat,
          hasNegativeDebits,
          accountId,
          importBatch.import_batch_id,
          file.name,
          i // Pass row index for unique ID generation
        )

        if (transactionData) {
          transactionsToInsert.push(transactionData)
          importResults.push({
            success: true,
            rowIndex,
            data: {
              transaction_date: new Date(transactionData.transaction_date),
              description: transactionData.description,
              debit_amount: transactionData.debit_amount,
              credit_amount: transactionData.credit_amount,
              balance: transactionData.balance,
              bank_reference: transactionData.bank_reference,
            },
          })
        } else {
          console.log(`⚠️  Row ${rowIndex}: processRow returned null (skipped)`)
        }
      } catch (err: any) {
        console.error(`❌ Row ${rowIndex} error:`, err.message)
        errors.push({
          rowIndex,
          error: err.message || 'Failed to process row',
        })
        importResults.push({
          success: false,
          rowIndex,
          error: err.message,
        })
      }
    }

    console.log(`✅ Successfully processed ${transactionsToInsert.length} transactions`)
    console.log(`❌ Failed to process ${errors.length} rows`)
    if (errors.length > 0) {
      console.log('First few errors:', errors.slice(0, 5))
    }

    // Bulk insert transactions
    let successfulImports = 0
    if (transactionsToInsert.length > 0) {
      const { data: insertedTransactions, error: insertError } = await supabase
        .from('original_transaction')
        .insert(transactionsToInsert)
        .select()

      if (insertError) {
        throw new Error(`Failed to insert transactions: ${insertError.message}`)
      }

      successfulImports = insertedTransactions?.length || 0
    }

    // Update import batch status
    await supabase
      .from('import_batch')
      .update({
        successful_records: successfulImports,
        failed_records: errors.length,
        import_status: errors.length === parsedCSV.totalRows ? 'failed' : 'completed',
        error_log: errors.length > 0 ? JSON.stringify(errors) : null,
      })
      .eq('import_batch_id', importBatch.import_batch_id)

    // Create checkpoint with statement ending balance
    // Set checkpoint to END of day to ensure all same-day transactions are included in calculation
    // Parse date in local timezone to avoid UTC conversion issues
    const dateMatch = statementEndDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
    let checkpointDate: Date
    if (dateMatch) {
      // ISO format: create date directly in local timezone
      const [, year, month, day] = dateMatch
      checkpointDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999)
    } else {
      // Fallback for other formats
      checkpointDate = new Date(statementEndDate)
      checkpointDate.setHours(23, 59, 59, 999)
    }
    const endingBalance = parseFloat(statementEndingBalance)

    // Count existing checkpoints BEFORE creating new one
    // to determine how many will be recalculated
    const { count: existingCheckpointsCount } = await supabase
      .from('balance_checkpoints')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('checkpoint_date', checkpointDate.toISOString())

    const checkpoint = await createOrUpdateCheckpoint({
      account_id: accountId,
      checkpoint_date: checkpointDate,
      declared_balance: endingBalance,
      notes: `Checkpoint for imported statement from ${new Date(
        statementStartDate || statementEndDate
      ).toLocaleDateString()} to ${checkpointDate.toLocaleDateString()}`,
      import_batch_id: importBatch.import_batch_id,
    })

    // Prepare recalculation summary
    const recalculationSummary = {
      checkpointsRecalculated: existingCheckpointsCount || 0,
      message:
        (existingCheckpointsCount || 0) > 0
          ? `Recalculated ${existingCheckpointsCount} existing checkpoint${
              existingCheckpointsCount === 1 ? '' : 's'
            } due to statement date`
          : 'No existing checkpoints affected',
    }

    // Prepare import summary
    const importSummary: ImportSummary = {
      importBatchId: importBatch.import_batch_id,
      totalRows: parsedCSV.totalRows,
      successfulImports,
      failedImports: errors.length,
      duplicatesDetected: 0, // TODO: Implement duplicate detection
      errors,
    }

    // Prepare result
    const result: ImportWithCheckpointResult = {
      importSummary,
      checkpoint: {
        checkpoint_id: checkpoint.checkpoint_id,
        declared_balance: checkpoint.declared_balance,
        calculated_balance: checkpoint.calculated_balance,
        adjustment_amount: checkpoint.adjustment_amount,
        is_reconciled: checkpoint.is_reconciled,
        checkpoint_date: checkpoint.checkpoint_date,
      },
      recalculationSummary,
      duplicateWarnings: [], // TODO: Implement duplicate detection
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Imported ${successfulImports} transactions and created checkpoint`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error importing transactions:', error)

    return NextResponse.json(
      {
        error: 'Failed to import transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Process a single CSV row into transaction data
 */
function processRow(
  row: any,
  columnMappings: ColumnMapping[],
  dateFormat: DateFormat,
  hasNegativeDebits: boolean,
  accountId: number,
  importBatchId: number,
  fileName: string,
  rowIndex: number
): any | null {
  // Debug logging for first row
  if (rowIndex === 0) {
    console.log('🔍 First row data:', row)
    console.log('🔍 Column mappings:', columnMappings.map(m => `${m.csvColumn} -> ${m.mappedTo}`))
    console.log('🔍 Available columns in row:', Object.keys(row))
  }

  const transactionData: any = {
    account_id: accountId,
    transaction_source: 'imported_bank',
    import_batch_id: importBatchId,
    import_file_name: fileName,
    is_balance_adjustment: false,
    is_flagged: false,
  }

  let hasRequiredFields = false

  for (const mapping of columnMappings) {
    const value = row[mapping.csvColumn]

    if (mapping.mappedTo === 'ignore' || !value) {
      continue
    }

    switch (mapping.mappedTo) {
      case 'transaction_date': {
        const date = parseDate(value, mapping.dateFormat || dateFormat)
        if (!date) {
          throw new Error(`Invalid date format: ${value}`)
        }
        transactionData.transaction_date = date.toISOString()
        hasRequiredFields = true
        break
      }

      case 'description':
        transactionData.description = value.toString().trim().substring(0, 500)
        break

      case 'debit_amount': {
        const amount = parseAmount(value)
        if (amount !== null && amount !== 0) {
          // Convert to positive if negative (e.g., Techcombank format)
          transactionData.debit_amount = Math.abs(amount)
          transactionData.credit_amount = null
          hasRequiredFields = true
        }
        break
      }

      case 'credit_amount': {
        const amount = parseAmount(value)
        if (amount !== null && amount !== 0) {
          // Convert to positive if negative
          transactionData.credit_amount = Math.abs(amount)
          transactionData.debit_amount = null
          hasRequiredFields = true
        }
        break
      }

      case 'amount': {
        const amount = parseAmount(value)
        if (amount !== null) {
          const { debit, credit } = amountToDebitCredit(amount, mapping.isNegativeDebit ?? hasNegativeDebits)
          transactionData.debit_amount = debit
          transactionData.credit_amount = credit
          hasRequiredFields = true
        }
        break
      }

      case 'balance': {
        const amount = parseAmount(value)
        if (amount !== null) {
          transactionData.balance = amount
        }
        break
      }

      case 'reference':
        transactionData.bank_reference = value.toString().trim().substring(0, 100)
        break
    }
  }

  // Validate required fields
  if (!hasRequiredFields) {
    throw new Error('Missing required fields: transaction_date and amount')
  }

  if (!transactionData.transaction_date) {
    throw new Error('Missing transaction date')
  }

  if (
    (transactionData.debit_amount === null || transactionData.debit_amount === undefined) &&
    (transactionData.credit_amount === null || transactionData.credit_amount === undefined)
  ) {
    throw new Error('Missing debit or credit amount')
  }

  // Generate raw_transaction_id (using rowIndex to guarantee uniqueness within batch)
  const timestamp = new Date().getTime()
  transactionData.raw_transaction_id = `IMPORT-${importBatchId}-${rowIndex}-${timestamp}`

  return transactionData
}
