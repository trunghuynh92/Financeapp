/**
 * API Route: /api/accounts/[id]/import
 * Handles bank statement CSV import with automatic checkpoint creation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createOrUpdateCheckpoint } from '@/lib/checkpoint-service'
import { formatDate } from '@/lib/account-utils'
import {
  parseCSVText,
  parseDate,
  parseAmount,
  amountToDebitCredit,
} from '@/lib/csv-parser'
import {
  processWorksheetWithMergedCells,
  analyzeMergedCells,
} from '@/lib/excel-merged-cells-handler'
import type {
  ColumnMapping,
  DateFormat,
  ImportedTransactionData,
  TransactionImportResult,
  ImportSummary,
  ImportWithCheckpointResult,
} from '@/types/import'

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Converts a Date object to ISO date string (YYYY-MM-DD) without timezone conversion
 * This is timezone-safe: 2025-03-01 midnight GMT+7 → "2025-03-01" (not "2025-02-28"!)
 */
function toISODateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ==============================================================================
// POST /api/accounts/[id]/import
// Import bank statement CSV and create checkpoint
// ==============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('========== IMPORT API CALLED ==========')
  try {
    const supabase = createSupabaseServerClient()
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
    const branchMappingsStr = formData.get('branchMappings') as string | null

    // Parse branch mappings if provided (CSV branch name -> branch_id)
    let branchMappingsFromUI: Record<string, number | null> = {}
    if (branchMappingsStr) {
      try {
        branchMappingsFromUI = JSON.parse(branchMappingsStr)
      } catch (err) {
        console.warn('Failed to parse branch mappings, using auto-match:', err)
      }
    }

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

      // Analyze merged cells for debugging
      const mergeAnalysis = analyzeMergedCells(worksheet)
      console.log('📊 Excel file merge analysis:', mergeAnalysis)

      // Process worksheet with merged cells handler
      // This will: 1) Unmerge cells, 2) Smart forward-fill (text only), 3) Remove empty rows
      const processedData = processWorksheetWithMergedCells(workbook, worksheet, {
        autoForwardFill: true,      // ENABLE smart forward-fill - only fills text columns, never amounts
        removeEmptyRows: true,      // Remove completely empty rows
        headerRow: 0,               // Assume header is in first row
      })

      console.log(`📋 Processed Excel data: ${processedData.length} rows`)

      // Debug: Log first few rows to verify data types
      if (processedData.length > 1) {
        console.log('🔍 First row (header):', processedData[0])
        console.log('🔍 Second row data:', processedData[1])
        console.log('🔍 Second row types:', processedData[1].map((cell, idx) => {
          const isDate = Object.prototype.toString.call(cell) === '[object Date]'
          return `[${idx}] ${typeof cell} ${isDate ? '(Date)' : ''}: ${cell}`
        }))
      }

      // Build parsedCSV directly from processedData WITHOUT re-running header detection
      // Header is guaranteed to be at row 0 since we already processed the worksheet
      if (processedData.length === 0) {
        throw new Error('Excel file has no data after processing')
      }

      // First row is headers (row 0 of processed data)
      const headers = processedData[0].map((cell, idx) => {
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          return `Column ${idx + 1}`
        }
        return String(cell).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
      })

      console.log('🔍 Excel headers (from row 0):', headers)

      // Build data rows (skip header row)
      const rows: import('@/types/import').ParsedCSVRow[] = []
      for (let i = 1; i < processedData.length; i++) {
        const rowData = processedData[i]

        // Skip completely empty rows
        if (rowData.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
          continue
        }

        const row: import('@/types/import').ParsedCSVRow = {}
        headers.forEach((header, idx) => {
          const cell = rowData[idx]
          if (cell === null || cell === undefined) {
            row[header] = null
          } else if (Object.prototype.toString.call(cell) === '[object Date]') {
            // Convert Date objects to ISO date string (YYYY-MM-DD)
            const dateObj = cell as unknown as Date
            const year = dateObj.getFullYear()
            const month = String(dateObj.getMonth() + 1).padStart(2, '0')
            const day = String(dateObj.getDate()).padStart(2, '0')
            row[header] = `${year}-${month}-${day}`
          } else if (typeof cell === 'number') {
            row[header] = cell
          } else {
            row[header] = String(cell).replace(/[\r\n]+/g, ' ').trim()
          }
        })
        rows.push(row)
      }

      parsedCSV = {
        headers,
        rows,
        totalRows: rows.length,
        detectedHeaderRow: 0,
      }

      console.log('🔍 Parsed Excel data:')
      console.log('  Headers:', parsedCSV.headers)
      console.log('  Total rows:', parsedCSV.totalRows)
      if (rows.length > 0) {
        console.log('  First data row:', rows[0])
      }
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
    const seenTransactions = new Set<string>()
    let duplicateCount = 0
    let dateFilteredCount = 0

    // Parse statement date range for filtering
    const startDateFilter = statementStartDate ? new Date(statementStartDate) : null
    const endDateFilter = statementEndDate ? new Date(statementEndDate) : null

    if (startDateFilter) startDateFilter.setHours(0, 0, 0, 0)
    if (endDateFilter) endDateFilter.setHours(23, 59, 59, 999)

    console.log(`📊 Processing ${parsedCSV.rows.length} rows from import...`)
    // Convert date filters to ISO date strings for comparison
    const startDateStr = startDateFilter ? toISODateString(startDateFilter) : null
    const endDateStr = endDateFilter ? toISODateString(endDateFilter) : null

    if (startDateStr && endDateStr) {
      console.log(`📅 Filtering transactions between ${startDateStr} and ${endDateStr}`)
    }

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
          // Filter by date range if specified (simple string comparison works for ISO dates)
          if (startDateStr && endDateStr && transactionData.transaction_date) {
            if (transactionData.transaction_date < startDateStr || transactionData.transaction_date > endDateStr) {
              dateFilteredCount++
              if (dateFilteredCount <= 5) {
                console.log(`📅 Row ${rowIndex}: Filtering out transaction outside date range (${transactionData.transaction_date})`)
              }
              continue // Skip this transaction
            }
          }
          // Create a hash of the transaction to detect duplicates
          const transactionHash = JSON.stringify({
            date: transactionData.transaction_date,
            desc: transactionData.description,
            debit: transactionData.debit_amount,
            credit: transactionData.credit_amount,
            ref: transactionData.bank_reference,
          })

          // Skip exact duplicates
          if (seenTransactions.has(transactionHash)) {
            duplicateCount++
            console.log(`⚠️  Row ${rowIndex}: Skipping duplicate transaction`)
            importResults.push({
              success: false,
              rowIndex,
              error: 'Duplicate transaction (skipped)',
            })
            continue
          }

          seenTransactions.add(transactionHash)
          transactionsToInsert.push(transactionData)
          importResults.push({
            success: true,
            rowIndex,
            data: {
              transaction_date: transactionData.transaction_date,
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
    console.log(`🔄 Skipped ${duplicateCount} duplicate transactions`)
    console.log(`📅 Filtered out ${dateFilteredCount} transactions outside date range`)
    if (errors.length > 0) {
      console.log('First few errors:', errors.slice(0, 5))
    }

    // Detect and fix descending order (Techcombank format)
    // If transactions are in descending chronological order, reverse the sequence numbers
    if (transactionsToInsert.length >= 2) {
      // transaction_date is already a string (YYYY-MM-DD), can compare directly
      const firstDate = transactionsToInsert[0].transaction_date
      const lastDate = transactionsToInsert[transactionsToInsert.length - 1].transaction_date

      // If first transaction is LATER than last transaction, we have descending order
      if (firstDate > lastDate) {
        console.log(`🔄 Detected descending order import (first: ${firstDate}, last: ${lastDate})`)
        console.log(`   Reversing transaction sequences to preserve chronological order...`)

        const totalTransactions = transactionsToInsert.length

        // Reverse the sequence numbers: 1 becomes N, 2 becomes N-1, etc.
        for (let i = 0; i < transactionsToInsert.length; i++) {
          const oldSequence = transactionsToInsert[i].transaction_sequence
          const newSequence = totalTransactions - oldSequence + 1
          transactionsToInsert[i].transaction_sequence = newSequence
        }

        console.log(`✅ Reversed ${totalTransactions} transaction sequences`)
      } else {
        console.log(`✅ Transactions in ascending order (first: ${firstDate}, last: ${lastDate})`)
      }
    }

    // Check for duplicate transactions
    const duplicateWarnings: Array<{
      importedTransaction: ImportedTransactionData
      possibleDuplicate: {
        transaction_id: string
        transaction_date: string
        description: string
        amount: number
      }
    }> = []
    const transactionsToInsertAfterDupeCheck: any[] = []

    if (transactionsToInsert.length > 0) {
      console.log(`🔍 Checking for duplicates among ${transactionsToInsert.length} transactions...`)

      // Get existing transactions for this account to check for duplicates
      // Only check recent transactions (within date range of import) to avoid fetching too much data
      const importDates = transactionsToInsert.map(t => new Date(t.transaction_date))
      const minDate = new Date(Math.min(...importDates.map(d => d.getTime())))
      const maxDate = new Date(Math.max(...importDates.map(d => d.getTime())))

      // Expand range by 7 days on each side to catch near-duplicates
      minDate.setDate(minDate.getDate() - 7)
      maxDate.setDate(maxDate.getDate() + 7)

      const minDateStr = toISODateString(minDate)
      const maxDateStr = toISODateString(maxDate)

      console.log(`📅 Checking duplicates in date range: ${minDateStr} to ${maxDateStr}`)

      const { data: existingTransactions, error: fetchError } = await supabase
        .from('original_transaction')
        .select('raw_transaction_id, transaction_date, description, debit_amount, credit_amount, bank_reference')
        .eq('account_id', accountId)
        .gte('transaction_date', minDateStr)
        .lte('transaction_date', maxDateStr)

      if (fetchError) {
        console.warn('⚠️ Could not fetch existing transactions for duplicate check:', fetchError.message)
      }

      // Build a duplicate detection map
      const existingMap = new Map<string, any>()
      if (existingTransactions) {
        for (const tx of existingTransactions) {
          // Create a composite key: date + amount + description (first 50 chars)
          // transaction_date is already a date string (YYYY-MM-DD)
          const amount = tx.debit_amount || tx.credit_amount || 0
          const descPart = (tx.description || '').substring(0, 50).toLowerCase().trim()
          const key = `${tx.transaction_date}|${amount}|${descPart}`

          // Store in map (may have multiple transactions with same key)
          if (!existingMap.has(key)) {
            existingMap.set(key, [])
          }
          existingMap.get(key)!.push(tx)
        }
      }

      console.log(`📋 Found ${existingTransactions?.length || 0} existing transactions for duplicate check`)

      // Check each new transaction against existing ones
      for (let i = 0; i < transactionsToInsert.length; i++) {
        const newTx = transactionsToInsert[i]
        const rowIndex = i + 2 // Match the rowIndex used earlier

        // Create key for this transaction
        // transaction_date is already a date string (YYYY-MM-DD)
        const amount = newTx.debit_amount || newTx.credit_amount || 0
        const descPart = (newTx.description || '').substring(0, 50).toLowerCase().trim()
        const key = `${newTx.transaction_date}|${amount}|${descPart}`

        const possibleDuplicates = existingMap.get(key) || []

        // Check for exact matches
        let isDuplicate = false
        let matchedTx = null

        for (const existingTx of possibleDuplicates) {
          // More detailed comparison
          // Both dates are already date strings (YYYY-MM-DD), can compare directly
          const sameDate = existingTx.transaction_date === newTx.transaction_date
          const sameDebit = (existingTx.debit_amount || 0) === (newTx.debit_amount || 0)
          const sameCredit = (existingTx.credit_amount || 0) === (newTx.credit_amount || 0)
          const sameDesc = (existingTx.description || '').toLowerCase().trim() === (newTx.description || '').toLowerCase().trim()

          // Also check bank reference if both have it
          const bothHaveRef = existingTx.bank_reference && newTx.bank_reference
          const sameRef = bothHaveRef ? existingTx.bank_reference === newTx.bank_reference : true

          if (sameDate && sameDebit && sameCredit && (sameDesc || bothHaveRef && sameRef)) {
            isDuplicate = true
            matchedTx = existingTx
            break
          }
        }

        if (isDuplicate && matchedTx) {
          duplicateWarnings.push({
            importedTransaction: {
              transaction_date: newTx.transaction_date,  // Already a string
              description: newTx.description,
              debit_amount: newTx.debit_amount,
              credit_amount: newTx.credit_amount,
              balance: newTx.balance,
              bank_reference: newTx.bank_reference,
            },
            possibleDuplicate: {
              transaction_id: matchedTx.raw_transaction_id,
              transaction_date: matchedTx.transaction_date,
              description: matchedTx.description || '',
              amount: matchedTx.debit_amount || matchedTx.credit_amount || 0,
            }
          })
          console.log(`⚠️ Skipping duplicate at row ${rowIndex}: ${newTx.description}`)
        } else {
          transactionsToInsertAfterDupeCheck.push(newTx)
        }
      }

      console.log(`✨ After duplicate check: ${transactionsToInsertAfterDupeCheck.length} unique, ${duplicateWarnings.length} duplicates skipped`)
    }

    // Bulk insert transactions in batches to avoid database timeout (only non-duplicates)
    let successfulImports = 0
    if (transactionsToInsertAfterDupeCheck.length > 0) {
      const BATCH_SIZE = 50 // Insert 50 transactions at a time (safer for free tier)
      const totalTransactions = transactionsToInsertAfterDupeCheck.length
      const totalBatches = Math.ceil(totalTransactions / BATCH_SIZE)

      console.log(`🔄 Inserting ${totalTransactions} transactions in ${totalBatches} batches of ${BATCH_SIZE}...`)

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE
        const end = Math.min(start + BATCH_SIZE, totalTransactions)
        const batch = transactionsToInsertAfterDupeCheck.slice(start, end)

        // Remove _branch_name from batch before inserting (it's not a database column)
        const cleanedBatch = batch.map(tx => {
          const { _branch_name, ...rest } = tx
          return rest
        })

        console.log(`📦 Inserting batch ${batchIndex + 1}/${totalBatches} (${cleanedBatch.length} transactions)...`)

        const { data: insertedTransactions, error: insertError } = await supabase
          .from('original_transaction')
          .insert(cleanedBatch)
          .select()

        if (insertError) {
          throw new Error(`Failed to insert batch ${batchIndex + 1}: ${insertError.message}`)
        }

        successfulImports += insertedTransactions?.length || 0
        console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} complete. Total inserted: ${successfulImports}`)
      }

      console.log(`🎉 All batches complete! Total successful imports: ${successfulImports}`)
    }

    // Renumber transaction sequences globally for this account
    // This ensures sequences are correct across multiple imports
    // Note: Skip for large imports to avoid timeout on free tier
    if (successfulImports <= 200) {
      console.log(`🔄 Renumbering transaction sequences for account ${accountId}...`)
      const { error: renumberError } = await supabase.rpc('renumber_transaction_sequences', {
        p_account_id: accountId
      })

      if (renumberError) {
        console.error('⚠️ Warning: Failed to renumber sequences:', renumberError.message)
        // Don't throw - this is not critical, transactions are still imported
      } else {
        console.log(`✅ Transaction sequences renumbered successfully`)
      }
    } else {
      console.log(`⏭️ Skipping renumber for large import (${successfulImports} transactions) to avoid timeout`)
    }

    // =========================================================================
    // Branch Mapping: Update main_transaction with branch_id based on branch names
    // Uses UI-provided mappings if available, otherwise falls back to auto-match
    // =========================================================================
    const branchNames = new Set<string>()
    const transactionBranchMap = new Map<string, string>() // raw_transaction_id -> branch_name

    // Collect unique branch names from imported transactions
    for (const tx of transactionsToInsertAfterDupeCheck) {
      if (tx._branch_name) {
        branchNames.add(tx._branch_name.toLowerCase())
        transactionBranchMap.set(tx.raw_transaction_id, tx._branch_name)
      }
    }

    if (branchNames.size > 0) {
      console.log(`🏢 Found ${branchNames.size} unique branch names to map`)

      // Check if we have UI-provided branch mappings
      const hasUIBranchMappings = Object.keys(branchMappingsFromUI).length > 0
      if (hasUIBranchMappings) {
        console.log(`🏢 Using ${Object.keys(branchMappingsFromUI).length} UI-provided branch mappings`)
      }

      // Get entity_id for this account (needed for auto-matching)
      const { data: accountData } = await supabase
        .from('accounts')
        .select('entity_id')
        .eq('account_id', accountId)
        .single()

      // Build branch name to ID map
      // Priority: 1) UI-provided mappings, 2) Auto-match by name
      let branchNameToId = new Map<string, number>()

      // If UI mappings provided, use them directly
      if (hasUIBranchMappings) {
        for (const [csvName, branchId] of Object.entries(branchMappingsFromUI)) {
          if (branchId !== null) {
            branchNameToId.set(csvName.toLowerCase(), branchId)
          }
        }
      }

      // If no UI mappings OR for any names not in UI mappings, try auto-match
      if (accountData?.entity_id) {
        const { data: branches } = await supabase
          .from('branches')
          .select('branch_id, branch_name')
          .eq('entity_id', accountData.entity_id)
          .eq('is_active', true)

        if (branches && branches.length > 0) {
          console.log(`🏢 Found ${branches.length} branches for entity`)

          // Auto-match for any names not already mapped by UI
          for (const branch of branches) {
            const nameLower = branch.branch_name.toLowerCase()
            // Only add if not already mapped by UI
            if (!branchNameToId.has(nameLower)) {
              branchNameToId.set(nameLower, branch.branch_id)
            }
          }
        }
      }

      // Update main_transaction records with branch_id
      let branchUpdateCount = 0
      const unmatchedBranches = new Set<string>()

      for (const [rawTxId, branchName] of Array.from(transactionBranchMap.entries())) {
        // Try UI mapping first (exact match), then lowercase match
        let branchId = branchMappingsFromUI[branchName] ?? null
        if (branchId === null) {
          branchId = branchNameToId.get(branchName.toLowerCase()) ?? null
        }

        if (branchId) {
          const { error: updateError } = await supabase
            .from('main_transaction')
            .update({ branch_id: branchId })
            .eq('raw_transaction_id', rawTxId)

          if (!updateError) {
            branchUpdateCount++
          }
        } else {
          unmatchedBranches.add(branchName)
        }
      }

      console.log(`✅ Updated ${branchUpdateCount} transactions with branch_id`)

      if (unmatchedBranches.size > 0) {
        console.log(`⚠️  ${unmatchedBranches.size} branch names not matched:`, Array.from(unmatchedBranches).slice(0, 5))
      }
    }

    // Update import batch status
    await supabase
      .from('import_batch')
      .update({
        successful_records: successfulImports,
        failed_records: errors.length,
        import_status: errors.length === parsedCSV.totalRows ? 'failed' : 'completed',
        error_log: errors.length > 0 || duplicateWarnings.length > 0
          ? JSON.stringify({
              errors,
              duplicates: duplicateWarnings.length,
              duplicateDetails: duplicateWarnings.slice(0, 10) // Store first 10 for reference
            })
          : null,
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

    // Extract ending balance from the last transaction on the end date (if available)
    let endingBalance = parseFloat(statementEndingBalance) // Default: use auto-detected or user-entered balance
    let balanceSource = 'user_entered'

    if (transactionsToInsert.length > 0) {
      console.log('🔍 Attempting to extract checkpoint balance from last transaction...')

      // Detect sort order: check if transactions are in descending order (newest first)
      // transaction_date is already a string (YYYY-MM-DD), can compare directly
      const firstTxDate = transactionsToInsert[0].transaction_date
      const lastTxDate = transactionsToInsert[transactionsToInsert.length - 1].transaction_date
      const isDescending = firstTxDate > lastTxDate  // String comparison works for ISO dates

      console.log(`📊 Transaction order: ${isDescending ? 'DESCENDING (newest first)' : 'ASCENDING (oldest first)'}`)
      console.log(`   First tx date: ${firstTxDate}`)
      console.log(`   Last tx date: ${lastTxDate}`)

      // Find the chronologically LAST transaction on the checkpoint date
      const checkpointDateStr = toISODateString(checkpointDate)
      let lastTransactionOnEndDate = null

      if (isDescending) {
        // Newest first → FIRST occurrence of checkpoint date = last chronologically
        lastTransactionOnEndDate = transactionsToInsert.find(tx => {
          // transaction_date is already a string (YYYY-MM-DD)
          return tx.transaction_date === checkpointDateStr
        })
      } else {
        // Oldest first → LAST occurrence of checkpoint date = last chronologically
        // Search from end of array
        for (let i = transactionsToInsert.length - 1; i >= 0; i--) {
          // transaction_date is already a string (YYYY-MM-DD)
          if (transactionsToInsert[i].transaction_date === checkpointDateStr) {
            lastTransactionOnEndDate = transactionsToInsert[i]
            break
          }
        }
      }

      // If we found a transaction and it has a balance field, use it
      if (lastTransactionOnEndDate && lastTransactionOnEndDate.balance !== null && lastTransactionOnEndDate.balance !== undefined) {
        const extractedBalance = parseFloat(lastTransactionOnEndDate.balance)
        if (!isNaN(extractedBalance)) {
          console.log(`✅ Found balance from last transaction on ${checkpointDateStr}: ${extractedBalance}`)
          console.log(`   Transaction: ${lastTransactionOnEndDate.description?.substring(0, 50) || 'N/A'}`)

          // Compare with user-entered balance
          const difference = Math.abs(extractedBalance - endingBalance)
          const percentDiff = endingBalance !== 0 ? (difference / Math.abs(endingBalance)) * 100 : 0

          if (difference > 0.01) {
            console.log(`⚠️  Balance mismatch detected:`)
            console.log(`   User entered: ${endingBalance}`)
            console.log(`   From CSV: ${extractedBalance}`)
            console.log(`   Difference: ${difference} (${percentDiff.toFixed(2)}%)`)
            console.log(`   → Using balance from CSV (more accurate)`)
          }

          endingBalance = extractedBalance
          balanceSource = 'extracted_from_csv'
        }
      } else {
        console.log(`⚠️  Could not find transaction with balance on ${checkpointDateStr}`)
        console.log(`   Using user-entered balance: ${endingBalance}`)
      }
    } else {
      console.log(`⚠️  No transactions to extract balance from, using user-entered: ${endingBalance}`)
    }

    console.log(`💰 Final checkpoint balance: ${endingBalance} (source: ${balanceSource})`)

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
      notes: `Checkpoint for imported statement from ${formatDate(
        statementStartDate || statementEndDate
      )} to ${formatDate(checkpointDate)}`,
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
      duplicatesDetected: duplicateWarnings.length,
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
      duplicateWarnings,
    }

    // Save import configuration for future imports (UX improvement)
    // Only save if import was successful (at least 1 transaction imported)
    if (successfulImports > 0) {
      const importConfig = {
        columnMappings,
        dateFormat,
        hasNegativeDebits,
        lastImportDate: new Date().toISOString(),
      }

      await supabase
        .from('accounts')
        .update({ last_import_config: importConfig })
        .eq('account_id', accountId)
    }

    // Build success message with duplicate info
    let message = `Imported ${successfulImports} transactions and created checkpoint`
    if (duplicateWarnings.length > 0) {
      message += `. Skipped ${duplicateWarnings.length} duplicate${duplicateWarnings.length === 1 ? '' : 's'}`
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message,
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
        // Strip time component if present (e.g., "17/11/2025 15:45" → "17/11/2025")
        let dateValue = value.toString().trim()
        const spaceIndex = dateValue.indexOf(' ')
        if (spaceIndex !== -1) {
          dateValue = dateValue.substring(0, spaceIndex)
        }

        const date = parseDate(dateValue, mapping.dateFormat || dateFormat)
        if (!date) {
          throw new Error(`Invalid date format: ${value}`)
        }
        // Convert Date to ISO date string (YYYY-MM-DD) without timezone conversion
        transactionData.transaction_date = toISODateString(date)
        hasRequiredFields = true
        break
      }

      case 'description':
        transactionData.description = value.toString().trim().substring(0, 500)
        break

      case 'debit_amount': {
        const amount = parseAmount(value)
        if (rowIndex === 0) {
          console.log(`[Row ${rowIndex}] Debit raw value: "${value}" (${typeof value}) → parsed: ${amount}`)
        }
        if (amount !== null && amount !== 0) {
          // Convert to positive if negative (e.g., Techcombank format)
          transactionData.debit_amount = Math.abs(amount)
          // Don't overwrite credit_amount if it was already set
          if (transactionData.credit_amount === undefined) {
            transactionData.credit_amount = null
          }
          hasRequiredFields = true
        }
        break
      }

      case 'credit_amount': {
        const amount = parseAmount(value)
        if (rowIndex === 0) {
          console.log(`[Row ${rowIndex}] Credit raw value: "${value}" (${typeof value}) → parsed: ${amount}`)
        }
        if (amount !== null && amount !== 0) {
          // Convert to positive if negative
          transactionData.credit_amount = Math.abs(amount)
          // Don't overwrite debit_amount if it was already set
          if (transactionData.debit_amount === undefined) {
            transactionData.debit_amount = null
          }
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

      case 'branch':
        // Store branch name for later matching to branch_id
        transactionData._branch_name = value.toString().trim()
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

  // Set transaction_sequence to preserve CSV row order (critical for balance calculations)
  // rowIndex is 0-based position in the CSV (after header row)
  transactionData.transaction_sequence = rowIndex + 1 // +1 to start sequence from 1

  return transactionData
}
