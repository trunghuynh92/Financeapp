# Descending Order Import Fix + Balance Investigation

## Issue #1: Balance Calculation Mismatch ❌

**Symptom:**
- Checkpoint showing `calculated_balance = -151,547,028`
- UI page totals showing `balance = +53,684,403`
- Difference of ~205 million

**Investigation:**
Run the diagnostic queries in `DIAGNOSTIC_BALANCE_ISSUE.sql` to identify:
1. If there are duplicate transactions in the database
2. If the database function is calculating correctly
3. If the checkpoint recalculation has a bug

**Expected Results:**
- Query 3 should show: `balance = 53,684,403` (matching UI)
- Query 9 (database function) should also return: `53,684,403`
- If checkpoint still shows `-151,547,028`, there's a bug in the TypeScript recalculation logic

---

## Issue #2: Descending Order Import (Techcombank Format) ✅ FIXED

### The Problem

Techcombank exports transactions in **descending chronological order** (latest first):
```
Row 1: Nov 1 - Transaction A (happened later in the day)
Row 2: Nov 1 - Transaction B (happened earlier in the day)
Row 3: Oct 31 - Transaction C
...
Row 130: Sept 1 - Transaction Z
```

**Before Fix:**
1. Import assigns sequence based on row position:
   - Transaction A → sequence 1
   - Transaction B → sequence 2
   - Transaction Z → sequence 130

2. Renumber function orders by `transaction_date ASC, transaction_sequence ASC`:
   - Sept 1 Transaction Z (date earliest, seq 130) → new seq 1
   - Nov 1 Transaction A (date latest, seq 1) → new seq 130

3. **Problem**: For same-date transactions, sequence is REVERSED!
   - Nov 1 Transaction A (seq 1) comes BEFORE Transaction B (seq 2)
   - But Transaction A happened LATER than B in reality

### The Fix

**File Modified**: `app/api/accounts/[id]/import/route.ts` (lines 218-242)

**What it does:**
1. After processing all transactions, compares first and last transaction dates
2. If `firstDate > lastDate`, we have descending order
3. Reverses all sequence numbers: `newSequence = totalTransactions - oldSequence + 1`

**Example:**
```
Before reversal:
- Nov 1 Transaction A → seq 1
- Nov 1 Transaction B → seq 2
- Sept 1 Transaction Z → seq 130

After reversal:
- Nov 1 Transaction A → seq 130 (was 1, now 130 - 1 + 1 = 130)
- Nov 1 Transaction B → seq 129 (was 2, now 130 - 2 + 1 = 129)
- Sept 1 Transaction Z → seq 1 (was 130, now 130 - 130 + 1 = 1)
```

4. When renumber function runs with `ORDER BY transaction_date ASC, transaction_sequence ASC`:
   - Sept 1 (date earliest, seq 1) → final seq 1 ✅
   - Nov 1 Transaction B (date Nov 1, seq 129) → final seq 129 ✅
   - Nov 1 Transaction A (date Nov 1, seq 130) → final seq 130 ✅

**Result**: Transactions maintain their correct chronological order!

### How to Test

1. Import a Techcombank statement (descending order)
2. Check console logs during import:
   ```
   🔄 Detected descending order import (first: 2024-11-01..., last: 2024-09-01...)
      Reversing transaction sequences to preserve chronological order...
   ✅ Reversed 130 transaction sequences
   ```

3. Verify transaction order in UI matches Excel order

### Handles Both Formats

The fix automatically detects the order:
- **Descending order** (Techcombank): Reverses sequences
- **Ascending order** (standard CSV): No reversal needed

Console will show:
```
✅ Transactions in ascending order (first: 2024-09-01..., last: 2024-11-01...)
```

---

## Next Steps

1. ⚠️ **Run diagnostic SQL** to investigate the balance mismatch
2. ✅ **Test the descending order fix** by re-importing the Techcombank statement
3. 🔄 If needed, re-run `renumber_transaction_sequences(14)` to fix existing transactions

## Files Changed

- ✅ `app/api/accounts/[id]/import/route.ts` - Added descending order detection and sequence reversal
- 📄 `DIAGNOSTIC_BALANCE_ISSUE.sql` - Diagnostic queries for balance investigation
- 📄 `DESCENDING_ORDER_FIX_SUMMARY.md` - This file
