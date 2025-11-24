# Bank Import System Documentation

**Last Updated:** 2025-01-24
**Status:** ⚠️ Production with Known Timezone Bug

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Import Flow](#import-flow)
3. [Architecture](#architecture)
4. [Key Features](#key-features)
5. [Known Issues](#known-issues)
6. [Fix Roadmap](#fix-roadmap)

---

## System Overview

The Bank Import System allows users to import bank statements (CSV/Excel) and automatically:
- Clean and parse transaction data
- Map columns to standardized fields
- Filter transactions by date range
- Detect and skip duplicates
- Create balance checkpoints for reconciliation
- Flag discrepancies automatically

### Supported Formats

- **CSV files** (`.csv`)
- **Excel files** (`.xlsx`, `.xls`)

### Supported Banks

The system is designed to work with any bank format, with special handling for:
- **Techcombank** (Vietnam) - Descending order, merged cells
- Other banks - Ascending order, standard format

---

## Import Flow

### Step 1: Upload & Parse

**User Action:** Upload CSV or Excel file

**System Processing:**
1. **File Validation**
   - Check file type (CSV/Excel)
   - Validate file size

2. **Parsing & Cleanup**
   - **CSV**: Parse with header detection
   - **Excel**:
     - Unmerge cells (spread value to all cells in range)
     - Forward-fill empty cells in text columns
     - Skip metadata rows
     - Detect header row

3. **Auto-Detection**
   - Detect all columns and their types
   - Detect date format (dd/mm/yyyy, mm/dd/yyyy, etc.)
   - Detect date columns (can be multiple!)
   - Auto-detect statement start/end dates
   - Auto-detect ending balance

**User Features:**
- Preview cleaned data (Excel only) - shows how merged cells were handled
- See auto-detected values

**Code Locations:**
- Frontend: `components/bank-import-dialog.tsx:153-270`
- Parsers: `lib/csv-parser.ts`, `lib/excel-merged-cells-handler.ts`

---

### Step 2: Date Column Selection

**Trigger:** System detects multiple date columns

**User Action:** Select which date column to use

**System Behavior:**
- If multiple date columns found → Show amber warning box
- Display dropdown with all available date columns
- Auto-select first date column by default
- If only one date column → Show green confirmation

**Why This Matters:**
The selected date column is used for:
- Balance recalculation on end date
- Date range filtering
- Transaction sort order detection
- Checkpoint balance extraction

**Example:**
Techcombank has two date columns:
- "Ngày KH thực hiện/Requesting date" - When customer requested
- "Ngày giao dịch/Transaction date" - When bank processed

User must choose which one to use.

**Code Locations:**
- Frontend: `components/bank-import-dialog.tsx:671-725`
- Detection: `components/bank-import-dialog.tsx:186-194`

---

### Step 3: Statement Details

**User Action:** Fill in statement details

**Fields:**
1. **Statement Start Date** - First date of statement period
2. **Statement End Date** - Last date of statement period
3. **Statement Ending Balance** - Balance at end of statement

**Auto-Fill Behavior:**
- Start/end dates auto-filled from CSV detection
- Ending balance auto-filled if detected

**Balance Auto-Recalculation:**
When user changes the end date, system automatically:
1. Detects transaction sort order (ascending/descending)
2. Finds last transaction on selected date
3. Extracts balance from that transaction
4. Updates "Statement Ending Balance" field

**Sort Order Detection:**
- Compare first parseable date vs last parseable date
- If first > last → **Descending** (newest first, like Techcombank)
- If first < last → **Ascending** (oldest first, most banks)

**Finding Last Transaction:**
- **Descending order:** First occurrence of date = last chronologically
- **Ascending order:** Last occurrence of date = last chronologically

**Timezone Handling (Frontend):**
Uses `toLocalDateString()` helper to avoid UTC conversion:
```typescript
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

**Code Locations:**
- Balance recalculation: `components/bank-import-dialog.tsx:272-443`
- UI: `components/bank-import-dialog.tsx:727-774`

---

### Step 4: Column Mapping

**User Action:** Map CSV columns to system fields

**System Behavior:**
- Auto-generate mappings based on column name detection
- Apply saved config if available (from previous imports)
- User can adjust mappings manually

**Required Mappings:**
- Transaction Date
- At least one amount column (Debit, Credit, or Amount)

**Optional Mappings:**
- Description
- Bank Reference
- Balance
- Category
- Other fields

**Special Handling:**
- **Amount column:** System can split into debit/credit automatically
- **Negative debits:** Option to convert negative amounts to positive
- **Balance column:** Used for checkpoint extraction (recommended)

**Code Locations:**
- Mapping generation: `lib/csv-parser.ts:generateColumnMappings()`
- UI: `components/bank-import-dialog.tsx:renderStep2()`

---

### Step 5: Preview

**User Action:** Review filtered transactions before import

**Display:**
- Total transactions (filtered count)
- Statement period (user-selected range)
- Ending balance
- First 10 transactions (from filtered set)

**Date Filtering:**
The preview shows only transactions within the selected date range:
```typescript
const getFilteredRows = () => {
  return parsedData.rows.filter(row => {
    const txDate = parseRowDate(row[selectedDateColumn])
    return txDate >= startDateFilter && txDate <= endDateFilter
  })
}
```

**What User Sees:**
- Accurate preview of what will be imported
- No transactions outside selected date range
- Correct transaction count

**Code Locations:**
- Filtering: `components/bank-import-dialog.tsx:508-539`
- Preview UI: `components/bank-import-dialog.tsx:renderStep3()`

---

### Step 6: Import

**User Action:** Click "Import" button

**Backend Processing:**

1. **Re-parse File**
   - Parse CSV/Excel again on server
   - Apply same cleanup logic

2. **Process Each Row**
   - Map columns according to user mappings
   - Parse dates and amounts
   - **⚠️ TIMEZONE BUG: Uses `.toISOString()` here**

3. **Date Range Filtering**
   ```typescript
   if (txDate < startDateFilter || txDate > endDateFilter) {
     continue // Skip this transaction
   }
   ```

4. **Duplicate Detection**
   - Check against existing transactions in database
   - Compare: date, description, amounts, reference
   - Skip if exact duplicate found

5. **Batch Insert**
   - Insert all non-duplicate transactions
   - Assign sequential numbers within batch

6. **Sort Order Correction**
   - If descending order detected → Reverse sequence numbers
   - Ensures chronological order in database

7. **Checkpoint Creation**
   - Extract balance from last transaction on end date
   - Create balance checkpoint at end of statement
   - **⚠️ TIMEZONE BUG: Date comparison uses `.toISOString()`**

8. **Recalculation**
   - Recalculate all future checkpoints
   - Update balances for all affected transactions

**Code Locations:**
- Import API: `app/api/accounts/[id]/import/route.ts`
- Row processing: `app/api/accounts/[id]/import/route.ts:714-850`
- Checkpoint creation: `app/api/accounts/[id]/import/route.ts:540-620`

---

## Architecture

### Frontend Components

**`components/bank-import-dialog.tsx`** (Main Dialog)
- Multi-step form (4 steps)
- File upload and parsing
- Date column selection
- Statement details form
- Column mapping interface
- Preview table
- Import results display

### Backend APIs

**`app/api/accounts/[id]/import/route.ts`** (Import API)
- File parsing and validation
- Transaction processing
- Date filtering
- Duplicate detection
- Checkpoint creation
- Batch operations

### Parsing Libraries

**`lib/csv-parser.ts`**
- CSV parsing with header detection
- Date format detection
- Column type detection
- Date/amount parsing utilities

**`lib/excel-merged-cells-handler.ts`**
- Excel worksheet processing
- Merged cell unmerging
- Forward-fill for empty cells
- Metadata detection

### Database Schema

**`raw_transactions`** - Original imported transactions
- `transaction_id` - Primary key
- `account_id` - Foreign key to accounts
- `transaction_date` - Date of transaction (⚠️ stored as UTC ISO string)
- `description` - Transaction description
- `debit_amount` - Money out
- `credit_amount` - Money in
- `balance` - Balance after transaction (optional)
- `import_batch_id` - Links to import batch
- `import_sequence` - Order within batch
- `is_flagged` - System-flagged for review

**`balance_checkpoints`** - Balance verification points
- `checkpoint_id` - Primary key
- `account_id` - Foreign key to accounts
- `checkpoint_date` - Date of checkpoint (⚠️ stored as UTC ISO string)
- `declared_balance` - Balance from statement
- `calculated_balance` - Balance from transactions
- `adjustment_amount` - Difference
- `is_reconciled` - Whether balanced

**`import_batches`** - Import metadata
- `import_batch_id` - Primary key
- `account_id` - Foreign key to accounts
- `file_name` - Uploaded filename
- `import_date` - When imported
- `user_id` - Who imported

---

## Key Features

### 1. Merged Cell Handling (Excel)

**Problem:** Banks merge cells for readability, but this loses data when parsing

**Solution:**
```typescript
// Original Excel:
// | [Merged: "Fee"] | 100 |
// |                 | 200 |

// After processing:
// | "Fee" | 100 |
// | "Fee" | 200 |
```

**Code:** `lib/excel-merged-cells-handler.ts:processWorksheetWithMergedCells()`

---

### 2. Forward-Fill for Empty Cells

**Problem:** Some columns have sparse data (e.g., category only on first row of group)

**Solution:**
```typescript
// Original:
// | "Salary" |     |     |
// |          | 100 | 200 |

// After forward-fill:
// | "Salary" |     |     |
// | "Salary" | 100 | 200 |
```

**Criteria for Forward-Fill:**
- Column has >30% empty cells
- Column has text content
- Column is not mostly numeric

**Code:** `lib/excel-merged-cells-handler.ts:118-175`

---

### 3. Multiple Date Column Support

**Problem:** Some banks have multiple date columns (requesting date vs. transaction date)

**Solution:**
- Detect all date columns
- If multiple found → Ask user to choose
- Use selected column consistently throughout import

**Code:** `components/bank-import-dialog.tsx:671-725`

---

### 4. Sort Order Detection

**Problem:** Different banks sort transactions differently
- Techcombank: Newest to Oldest (Descending)
- Most banks: Oldest to Newest (Ascending)

**Solution:**
- Compare first vs last transaction date
- If first > last → Descending
- Adjust balance extraction logic accordingly

**Code:**
- Frontend: `components/bank-import-dialog.tsx:366`
- Backend: `app/api/accounts/[id]/import/route.ts:547-554`

---

### 5. Balance Auto-Extraction

**Problem:** User might enter wrong ending balance manually

**Solution:**
- Find last transaction on checkpoint date
- Extract balance from Balance column
- Compare with user-entered value
- Use CSV balance if different (more accurate)
- Log warning if mismatch detected

**Code:** `app/api/accounts/[id]/import/route.ts:540-608`

---

### 6. Duplicate Detection

**Problem:** Re-importing same statement would create duplicate transactions

**Solution:**
- Query existing transactions in date range ±7 days
- Compare new transaction with existing:
  - Same date (⚠️ timezone bug affects this)
  - Same description (case-insensitive, trimmed)
  - Same debit/credit amounts
  - Same bank reference (if available)
- Skip if exact match found

**Code:** `app/api/accounts/[id]/import/route.ts:370-460`

---

### 7. Automatic Checkpoint Recalculation

**Problem:** New transactions affect future balance calculations

**Solution:**
- When checkpoint created → Find all future checkpoints
- Recalculate declared and calculated balances
- Update adjustment amounts
- Re-flag discrepancies if needed

**Code:** `lib/checkpoint-service.ts`

---

## Known Issues

### 🐛 Critical: Timezone Bug in Backend

**Status:** ⚠️ **NOT FIXED**
**Severity:** HIGH
**Affects:** Production imports

**Problem:**

The backend converts dates to UTC when storing in database, causing off-by-one date errors in GMT+7 timezone.

**Example:**
```
Input: "01/03/2025" (March 1, 2025)
Parsed: 2025-03-01 00:00:00 GMT+7 (local time)
Stored: 2025-02-28T17:00:00.000Z (UTC)
Retrieved: "2025-02-28" (WRONG!)
```

**Affected Code:**

1. **Transaction Date Storage** - `app/api/accounts/[id]/import/route.ts:762`
   ```typescript
   transactionData.transaction_date = date.toISOString()  // ❌ BUG
   ```

2. **Checkpoint Date Comparison** - `app/api/accounts/[id]/import/route.ts:563,570`
   ```typescript
   const txDateStr = new Date(tx.transaction_date).toISOString().split('T')[0]
   ```

3. **Date Filtering** - `app/api/accounts/[id]/import/route.ts:243`
   ```typescript
   const txDate = new Date(transactionData.transaction_date)
   if (txDate < startDateFilter || txDate > endDateFilter) { ... }
   ```

4. **Duplicate Detection** - `app/api/accounts/[id]/import/route.ts:415`
   ```typescript
   const sameDate = new Date(existingTx.transaction_date).toISOString().split('T')[0] === dateStr
   ```

**Impact:**

✅ **Works Correctly:**
- Frontend preview (uses `toLocalDateString()`)
- Frontend balance recalculation
- Frontend date filtering display

❌ **Works Incorrectly:**
- Database stores wrong dates (1 day off for times after 5 PM GMT+7)
- Checkpoint balance extraction matches wrong date
- Date filtering during import uses wrong dates
- Duplicate detection compares wrong dates
- Reports and queries return wrong date ranges

**Why This Wasn't Caught:**

1. Frontend displays local dates correctly (reads from DB and displays)
2. Most testing done during daytime hours (before 5 PM GMT+7)
3. Date comparison "works" but matches wrong day
4. Balance still extracted (from wrong day's last transaction)

**Related Documentation:**
- `docs/BANK_IMPORT_DATE_FILTER_FIX.md` - Claims timezone fixed, but only frontend

---

## Fix Roadmap

### 🔧 TODO: Fix Backend Timezone Bug

**Priority:** HIGH
**Estimated Effort:** 4-6 hours
**Risk Level:** MEDIUM (requires database migration)

#### Phase 1: Store Dates as Date-Only Strings (Recommended)

**Approach:** Store dates as `YYYY-MM-DD` strings instead of ISO timestamps

**Benefits:**
- No timezone conversion issues
- Simple to query and compare
- Human-readable in database
- Matches user's intent (date, not datetime)

**Changes Required:**

1. **Database Migration**
   - Change `transaction_date` type from `timestamptz` to `date`
   - Change `checkpoint_date` type from `timestamptz` to `date`
   - Convert existing data: `transaction_date::date`

2. **Backend Code Changes**
   - `app/api/accounts/[id]/import/route.ts:762`
     ```typescript
     // BEFORE:
     transactionData.transaction_date = date.toISOString()

     // AFTER:
     const year = date.getFullYear()
     const month = String(date.getMonth() + 1).padStart(2, '0')
     const day = String(date.getDate()).padStart(2, '0')
     transactionData.transaction_date = `${year}-${month}-${day}`
     ```

   - Remove all `.toISOString().split('T')[0]` calls
   - Use direct string comparison: `tx.transaction_date === checkpointDateStr`

3. **Frontend Code Changes**
   - Update type definitions (`types/import.ts`)
   - Ensure date inputs send `YYYY-MM-DD` format (already does)
   - Test all date displays

4. **Testing**
   - Import Techcombank statement (descending order)
   - Verify dates stored correctly
   - Verify checkpoint balance extracted from correct date
   - Verify date filtering works correctly
   - Test duplicate detection
   - Test around 5 PM GMT+7 boundary

**Files to Modify:**
- `database/migrations/XXX_fix_timezone_dates.sql` (NEW)
- `app/api/accounts/[id]/import/route.ts`
- `app/api/main-transactions/route.ts` (if any date queries)
- `types/import.ts`
- All components that display transaction dates

---

#### Phase 2: Store Timezone with Dates (Alternative)

**Approach:** Store dates with timezone information

**Benefits:**
- Preserves exact moment in time
- Useful for future features (transaction time tracking)

**Drawbacks:**
- More complex
- Still need to handle timezone conversion
- Overkill for current needs (only date matters)

**Not Recommended:** For this use case, transactions only need date precision.

---

### 🧪 TODO: Add Timezone Tests

**Create test suite for timezone handling:**

1. **Unit Tests**
   - Test `parseDate()` with different timezones
   - Test date-only storage format
   - Test date comparison logic

2. **Integration Tests**
   - Import statement at 4 PM GMT+7 (before boundary)
   - Import statement at 6 PM GMT+7 (after boundary)
   - Verify dates stored correctly in both cases

3. **E2E Tests**
   - Full import flow with Techcombank format
   - Verify checkpoint balance from correct date
   - Verify date filtering accuracy

**Files to Create:**
- `__tests__/lib/csv-parser.timezone.test.ts`
- `__tests__/api/import.timezone.test.ts`

---

### 📝 TODO: Update Documentation

After fix is deployed:

1. Update `docs/BANK_IMPORT_DATE_FILTER_FIX.md`
   - Change status to "✅ Fixed (Backend + Frontend)"
   - Document the date storage format change
   - Add migration notes

2. Update this document
   - Remove "Known Issues" section
   - Add "Fixed Issues" section with date
   - Update code location references

3. Create `docs/DATE_STORAGE_MIGRATION.md`
   - Document why we changed from timestamp to date
   - Migration steps
   - Rollback procedure
   - Testing checklist

---

## Development Notes

### Local Development Setup

1. **Environment Variables Required:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

2. **Test Files:**
   - Techcombank sample: `test-data/techcombank-sample.xlsx`
   - Standard CSV: `test-data/standard-bank.csv`

3. **Database Setup:**
   - Run migrations in order
   - Seed with sample account
   - Test with empty account and account with existing transactions

### Debugging Import Issues

**Enable Debug Logging:**
```typescript
// In browser console:
localStorage.setItem('DEBUG_IMPORT', 'true')

// Check these logs:
// 🔧 - Function entry/setup
// 📊 - Data processing
// 📋 - Column mapping
// 📅 - Date handling
// 💰 - Balance calculation
// ✅ - Success
// ❌ - Error
// ⚠️  - Warning
```

**Common Issues:**

1. **"Balance not updating"**
   - Check if balance column is mapped
   - Check if transactions exist on selected date
   - Check console for balance recalculation logs

2. **"Wrong transaction count"**
   - Check date filtering logs
   - Verify start/end dates are correct
   - Check if date column selection is correct

3. **"Duplicate detection not working"**
   - Check timezone bug (dates might not match)
   - Check if description/amounts are exactly the same
   - Check duplicate detection logs in backend

---

## API Reference

### POST `/api/accounts/[id]/import`

Import bank statement for an account.

**Parameters:**
- `id` (path) - Account ID

**Form Data:**
- `file` (File) - CSV or Excel file
- `statementStartDate` (string) - Start date (YYYY-MM-DD)
- `statementEndDate` (string) - End date (YYYY-MM-DD)
- `statementEndingBalance` (string) - Ending balance amount
- `columnMappings` (JSON string) - Column mapping configuration
- `dateFormat` (string) - Date format (dd/mm/yyyy, mm/dd/yyyy, etc.)
- `hasNegativeDebits` (boolean) - Whether to convert negative debits to positive

**Response:**
```typescript
{
  success: boolean
  importSummary: {
    totalRows: number
    successfulImports: number
    failedImports: number
    duplicatesDetected: number
  }
  checkpoint: {
    checkpoint_id: number
    declared_balance: number
    calculated_balance: number
    adjustment_amount: number
    is_reconciled: boolean
  }
  recalculationSummary: {
    checkpointsRecalculated: number
  }
}
```

**Error Codes:**
- `400` - Invalid input (missing file, dates, or mappings)
- `401` - Unauthorized
- `403` - No access to account
- `500` - Server error

---

## Support

For questions or issues:
1. Check this documentation
2. Check related docs: `BANK_IMPORT_DATE_FILTER_FIX.md`, `CASHFLOW_SYSTEM_3.0.md`
3. Review console logs (frontend and backend)
4. Contact development team

---

## Version History

- **2025-01-24** - Initial documentation
  - Comprehensive import flow documentation
  - Identified critical timezone bug
  - Created fix roadmap
