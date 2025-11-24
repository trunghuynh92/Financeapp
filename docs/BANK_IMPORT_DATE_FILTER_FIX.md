# Bank Import Date Filtering & Checkpoint Balance Fix

**Date:** 2025-01-24
**Status:** ✅ Fixed
**Commit:** 5ce3076

---

## Problem Summary

The bank import system had two critical bugs that caused incorrect data imports and balance discrepancies:

### Bug #1: No Date Filtering
**Issue:** System imported ALL transactions from the CSV file, regardless of user-selected date range.

**Example:**
- CSV has transactions: Jan 1 - Mar 31
- User selects: Jan 1 - Feb 28
- **Expected:** Import only Jan-Feb transactions
- **Actual:** Imported ALL Jan-Mar transactions ❌

### Bug #2: Wrong Checkpoint Balance
**Issue:** Checkpoint used the auto-detected ending balance from the full statement, not the balance at the user-selected end date.

**Example:**
- CSV ending balance: 342,091,199 (Mar 31)
- User selects end date: Feb 28
- **Expected:** Checkpoint at Feb 28 with Feb 28's balance (332,220,085)
- **Actual:** Checkpoint at Feb 28 with Mar 31's balance (342,091,199) ❌

**Impact:**
- Created balance discrepancies
- All Feb 28 transactions flagged as "discrepancies"
- Incorrect checkpoint calculations for future reconciliations

---

## Root Cause

The import system was designed only for **full statement imports**:
1. Auto-detect full statement period
2. Import everything
3. Use auto-detected ending balance

It did NOT support:
- ❌ Partial period imports
- ❌ Date-based transaction filtering
- ❌ Extracting balance from specific date transactions

---

## Solution Implemented

### 1. Date Range Filtering

**Location:** `app/api/accounts/[id]/import/route.ts:212-250`

```typescript
// Parse statement date range for filtering
const startDateFilter = statementStartDate ? new Date(statementStartDate) : null
const endDateFilter = statementEndDate ? new Date(statementEndDate) : null

// Filter transactions by date range
if (startDateFilter && endDateFilter && transactionData.transaction_date) {
  const txDate = new Date(transactionData.transaction_date)
  if (txDate < startDateFilter || txDate > endDateFilter) {
    dateFilteredCount++
    continue // Skip this transaction
  }
}
```

**Result:** Only transactions within the selected date range are imported.

### 2. Transaction Sort Order Detection

**Location:** `app/api/accounts/[id]/import/route.ts:547-554`

Banks format statements differently:
- **Techcombank:** Newest to Oldest (Descending)
- **Other banks:** Oldest to Newest (Ascending)

```typescript
// Detect sort order
const firstTxDate = new Date(transactionsToInsert[0].transaction_date)
const lastTxDate = new Date(transactionsToInsert[transactionsToInsert.length - 1].transaction_date)
const isDescending = firstTxDate > lastTxDate
```

### 3. Smart Balance Extraction

**Location:** `app/api/accounts/[id]/import/route.ts:556-608`

The system now:
1. Finds the **chronologically LAST** transaction on the checkpoint date
2. Accounts for sort order when finding "last" transaction:
   - **Descending order:** First occurrence = last chronologically
   - **Ascending order:** Last occurrence = last chronologically
3. Extracts the **balance value** from that transaction's Balance column
4. Uses that as the checkpoint balance

```typescript
if (isDescending) {
  // Newest first → FIRST occurrence of checkpoint date = last chronologically
  lastTransactionOnEndDate = transactionsToInsert.find(tx => {
    const txDateStr = new Date(tx.transaction_date).toISOString().split('T')[0]
    return txDateStr === checkpointDateStr
  })
} else {
  // Oldest first → LAST occurrence of checkpoint date = last chronologically
  for (let i = transactionsToInsert.length - 1; i >= 0; i--) {
    const txDateStr = new Date(transactionsToInsert[i].transaction_date).toISOString().split('T')[0]
    if (txDateStr === checkpointDateStr) {
      lastTransactionOnEndDate = transactionsToInsert[i]
      break
    }
  }
}

// Extract balance from that transaction
const extractedBalance = parseFloat(lastTransactionOnEndDate.balance)
```

### 4. Fallback Handling

If balance cannot be extracted from CSV:
- Falls back to user-entered balance
- Logs warning for user awareness
- System still works with statements that don't have balance columns

---

## Testing Example: Techcombank Statement

### Scenario
- **Statement period:** Jan 1 - Mar 31, 2025
- **User selection:** Jan 1 - Feb 28, 2025
- **Sort order:** Descending (newest first)

### CSV Data (Simplified)
```
Date       | Debit      | Credit | Balance
2025-03-01 | 259,000    |        | 402,135,499
2025-03-01 | 289,000    |        | 401,876,499
...
2025-02-28 | 8,008      |        | 332,220,085  ← First Feb 28 = Last chronologically
2025-02-28 | 129,000    |        | 332,212,077
...
2025-02-28 | 199,000    |        | 288,426,710  ← Last Feb 28 = First chronologically
2025-02-27 | 358,000    |        | 288,227,710
```

### Before Fix ❌
- **Imported:** All Jan-Mar transactions (1,332 rows)
- **Checkpoint date:** Feb 28, 2025 EOD
- **Checkpoint balance:** 342,091,199 (wrong - this is from Mar 31 auto-detection)
- **Result:** Balance discrepancy, all transactions flagged

### After Fix ✅
- **Imported:** Only Jan-Feb transactions (filtered out all Mar transactions)
- **Checkpoint date:** Feb 28, 2025 EOD
- **Checkpoint balance:** 332,220,085 (correct - extracted from first Feb 28 row)
- **Result:** No discrepancies, accurate checkpoint

---

## Logging Output

The fix includes detailed logging for troubleshooting:

```
📊 Processing 1332 rows from import...
📅 Filtering transactions between 2025-01-01 and 2025-02-28
✅ Successfully processed 1200 transactions
❌ Failed to process 0 rows
🔄 Skipped 0 duplicate transactions
📅 Filtered out 132 transactions outside date range

🔍 Attempting to extract checkpoint balance from last transaction...
📊 Transaction order: DESCENDING (newest first)
   First tx date: 2025-02-28
   Last tx date: 2025-01-01
✅ Found balance from last transaction on 2025-02-28: 332220085
   Transaction: CHUYỂN KHOẢN ĐẾN [...]
💰 Final checkpoint balance: 332220085 (source: extracted_from_csv)
```

---

## Benefits

1. ✅ **Accurate Partial Imports:** Users can import specific date ranges
2. ✅ **Correct Checkpoint Balances:** Balance matches actual end date
3. ✅ **No False Discrepancies:** System doesn't flag correct transactions
4. ✅ **Bank Format Agnostic:** Works with both ascending and descending order
5. ✅ **Transparent Logging:** Clear visibility into what's happening
6. ✅ **Backward Compatible:** Falls back gracefully for statements without balance columns

---

## Files Modified

- `app/api/accounts/[id]/import/route.ts`
  - Added date filtering logic (lines 212-250)
  - Added transaction order detection (lines 547-554)
  - Added smart balance extraction (lines 556-608)

---

## Future Enhancements

Potential improvements for future consideration:

1. **UI Enhancement:** Add date column selection in Step 1
   - Some banks have multiple date columns ("Transaction Date", "Posted Date", "Value Date")
   - Let user select which one to use for filtering

2. **Balance Validation:** Add user confirmation when extracted balance differs significantly from entered balance

3. **Preview:** Show filtered transaction count before final import

4. **Date Range Presets:** Quick buttons for "Last Month", "This Quarter", etc.

---

## Related Documentation

- `docs/features/bank-import.md` - Bank import system overview
- `docs/CASHFLOW_SYSTEM_3.0.md` - Checkpoint system architecture
- `database/migrations/003_add_balance_checkpoint_system.sql` - Checkpoint schema

---

## Support

If you encounter issues with date filtering or checkpoint balances:

1. Check the console logs for detailed import information
2. Verify the CSV has a Balance column (if using balance extraction)
3. Confirm the date range covers transactions you want to import
4. Check the transaction sort order in the logs

For questions or issues, contact the development team.
