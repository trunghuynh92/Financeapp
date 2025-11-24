# Timezone Analysis: System-Wide Date/Time Handling

**Analysis Date:** 2025-01-24
**Timezone Context:** System operates in GMT+7 (Vietnam)
**Status:** ⚠️ CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

### Key Findings:

1. **✅ Audit Timestamps Are Correct**
   - `created_at`, `updated_at`, `imported_at` use `TIMESTAMPTZ`
   - These SHOULD include timezone (recording exact moment)
   - Current implementation is correct

2. **❌ Business Dates Have Critical Bug**
   - `transaction_date`, `checkpoint_date`, and other business dates use `TIMESTAMPTZ`
   - These SHOULD be `DATE` type (no time/timezone component)
   - **Current implementation causes off-by-one date errors in GMT+7**

3. **Mixed Usage Patterns**
   - Some tables use `DATE` (correct) for business dates
   - Some tables use `TIMESTAMPTZ` (wrong) for business dates
   - Inconsistent handling across the system

---

## Database Schema Analysis

### Tables with Date Columns

| Table | Column | Current Type | Correct Type | Status |
|-------|--------|--------------|--------------|--------|
| **entities** | created_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **entities** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **accounts** | created_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **accounts** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **account_balance** | balance_date | TIMESTAMPTZ | **DATE** | ❌ **BUG** |
| **account_balance** | created_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **account_balance** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **import_batch** | import_date | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **import_batch** | created_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **original_transaction** | transaction_date | TIMESTAMPTZ | **DATE** | ❌ **BUG** |
| **original_transaction** | imported_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **original_transaction** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **main_transaction** | transaction_date | TIMESTAMPTZ | **DATE** | ❌ **BUG** |
| **main_transaction** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **balance_checkpoints** | checkpoint_date | TIMESTAMPTZ | **DATE** | ❌ **BUG** |
| **balance_checkpoints** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **loan_disbursement** | disbursement_date | DATE | DATE | ✅ Correct |
| **loan_disbursement** | due_date | DATE | DATE | ✅ Correct |
| **loan_disbursement** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **debt_drawdown** | drawdown_date | DATE | DATE | ✅ Correct |
| **debt_drawdown** | due_date | DATE | DATE | ✅ Correct |
| **investment_contribution** | contribution_date | DATE | DATE | ✅ Correct |
| **scheduled_payments** | start_date | DATE | DATE | ✅ Correct |
| **scheduled_payments** | end_date | DATE | DATE | ✅ Correct |
| **scheduled_payments** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |
| **scheduled_payment_instances** | due_date | DATE | DATE | ✅ Correct |
| **scheduled_payment_instances** | paid_date | DATE | DATE | ✅ Correct |
| **contracts** | signing_date | DATE | DATE | ✅ Correct |
| **contracts** | effective_start_date | DATE | DATE | ✅ Correct |
| **contracts** | effective_end_date | DATE | DATE | ✅ Correct |
| **contract_amendments** | amendment_date | DATE | DATE | ✅ Correct |
| **contract_amendments** | effective_date | DATE | DATE | ✅ Correct |
| **category_budgets** | start_date | DATE | DATE | ✅ Correct |
| **category_budgets** | end_date | DATE | DATE | ✅ Correct |
| **receipts** | ocr_transaction_date | DATE | DATE | ✅ Correct |
| **receipts** | updated_at | TIMESTAMPTZ | TIMESTAMPTZ | ✅ Correct |

---

## Critical Bugs Identified

### 🐛 Bug #1: Transaction Dates Use TIMESTAMPTZ

**Affected Tables:**
- `original_transaction.transaction_date`
- `main_transaction.transaction_date`

**Problem:**

```sql
-- Schema definition:
transaction_date TIMESTAMPTZ NOT NULL

-- Backend code:
transactionData.transaction_date = date.toISOString()
// Example: "2025-03-01 00:00:00 GMT+7" → "2025-02-28T17:00:00.000Z"
```

**Example of Bug:**
```
User imports: "01/03/2025" (March 1)
Parsed as: 2025-03-01 00:00:00 GMT+7 (local time)
Stored as: 2025-02-28T17:00:00.000Z (UTC in database)
Displayed as: "2025-02-28" (WRONG!)
```

**Impact:**
- ❌ All transactions after 5 PM GMT+7 get wrong date (1 day off)
- ❌ Date filtering returns wrong transactions
- ❌ Reports show wrong date ranges
- ❌ Duplicate detection compares wrong dates
- ❌ Checkpoint balance extracted from wrong date

**Severity:** **CRITICAL** - Affects all transaction data

**Affected Code Locations:**
1. `app/api/accounts/[id]/import/route.ts:762` - Stores date with `.toISOString()`
2. `app/api/accounts/[id]/import/route.ts:243` - Date filtering uses timezone-aware comparison
3. `app/api/accounts/[id]/import/route.ts:415` - Duplicate detection
4. `app/api/accounts/[id]/import/route.ts:563,570` - Checkpoint balance extraction

---

### 🐛 Bug #2: Checkpoint Dates Use TIMESTAMPTZ

**Affected Tables:**
- `balance_checkpoints.checkpoint_date`

**Problem:**

Same as Bug #1 - checkpoint dates should be date-only (no time component), but stored as TIMESTAMPTZ.

**Example:**
```
Checkpoint date: Feb 28, 2025
Stored as: 2025-02-27T17:00:00.000Z (UTC)
Compared as: "2025-02-27" (WRONG!)
```

**Impact:**
- ❌ Checkpoints created on wrong date
- ❌ Balance reconciliation compares wrong dates
- ❌ Future checkpoint recalculation uses wrong dates

**Severity:** **HIGH** - Affects balance reconciliation

---

### 🐛 Bug #3: Account Balance Dates Use TIMESTAMPTZ

**Affected Tables:**
- `account_balance.balance_date`

**Problem:**

Balance snapshots should be tied to specific dates (e.g., "balance as of March 1"), not specific times.

**Impact:**
- ❌ Balance history shows wrong dates
- ❌ Balance queries return wrong data for date ranges

**Severity:** **MEDIUM** - Affects balance history

---

## Correctly Implemented Date Columns

### ✅ Newer Tables Use DATE Correctly

The following tables were created later and **correctly** use `DATE` type for business dates:

**Loan System:**
- `loan_disbursement.disbursement_date` - DATE ✅
- `loan_disbursement.due_date` - DATE ✅
- `debt_drawdown.drawdown_date` - DATE ✅
- `debt_drawdown.due_date` - DATE ✅

**Investment System:**
- `investment_contribution.contribution_date` - DATE ✅

**Scheduled Payments:**
- `scheduled_payments.start_date` - DATE ✅
- `scheduled_payments.end_date` - DATE ✅
- `scheduled_payment_instances.due_date` - DATE ✅
- `scheduled_payment_instances.paid_date` - DATE ✅

**Contracts:**
- `contracts.signing_date` - DATE ✅
- `contracts.effective_start_date` - DATE ✅
- `contracts.effective_end_date` - DATE ✅
- `contract_amendments.amendment_date` - DATE ✅
- `contract_amendments.effective_date` - DATE ✅

**Budgets:**
- `category_budgets.start_date` - DATE ✅
- `category_budgets.end_date` - DATE ✅

**Receipts:**
- `receipts.ocr_transaction_date` - DATE ✅

**Why These Work:**
- No timezone conversion issues
- Simple date arithmetic
- Clear semantics (date only, no time)
- Direct comparison without `.toISOString()` manipulation

---

## When to Use DATE vs TIMESTAMPTZ

### Use `DATE` When:

✅ **Business dates** - Events that occur "on a day"
- Transaction dates
- Due dates
- Payment dates
- Contract dates
- Budget period dates
- Birthday, anniversary, etc.

**Characteristics:**
- No time component matters
- Timezone doesn't matter
- Examples: "Payment due on March 15", "Contract starts April 1"

### Use `TIMESTAMPTZ` When:

✅ **Audit timestamps** - Recording exact moments in time
- `created_at` - When record was created
- `updated_at` - When record was last modified
- `imported_at` - When data was imported
- `logged_in_at` - When user logged in
- `processed_at` - When job completed

**Characteristics:**
- Exact moment matters
- Timezone matters
- Examples: "User logged in at 3:45 PM GMT+7", "Import completed at 10:23 AM UTC"

### Use `TIMESTAMP` (without TZ) RARELY:

⚠️ Generally avoid - usually you want either:
- `DATE` for business dates
- `TIMESTAMPTZ` for audit timestamps

Only use when you specifically need time without timezone (very rare).

---

## System-Wide Date Handling Patterns

### Backend Code Analysis

**Pattern 1: Storing Dates (WRONG)**
```typescript
// Current (WRONG):
transactionData.transaction_date = date.toISOString()
// Result: "2025-02-28T17:00:00.000Z" for "01/03/2025" input

// Should be:
transactionData.transaction_date = formatAsDateOnly(date)
// Result: "2025-03-01"
```

**Pattern 2: Comparing Dates (WRONG)**
```typescript
// Current (WRONG):
const txDateStr = new Date(tx.transaction_date).toISOString().split('T')[0]
// Result: "2025-02-28" for "2025-03-01" transaction in GMT+7

// Should be:
const txDateStr = tx.transaction_date  // Already "2025-03-01" if DATE type
```

**Pattern 3: Date Filtering (WRONG)**
```typescript
// Current (WRONG):
const txDate = new Date(transactionData.transaction_date)
if (txDate < startDateFilter || txDate > endDateFilter) { ... }
// Compares timestamps, affected by timezone

// Should be:
if (transactionData.transaction_date < startDateStr ||
    transactionData.transaction_date > endDateStr) { ... }
// Compares date strings directly
```

### Frontend Code Analysis

**Pattern 1: Displaying Dates**
```typescript
// Frontend displays dates correctly because it reads
// the date and formats it without timezone conversion
new Date(transaction.transaction_date).toLocaleDateString()
```

**Pattern 2: Date Inputs**
```typescript
// Date inputs send YYYY-MM-DD format (correct)
<Input type="date" value={statementEndDate} />
// Sends: "2025-03-01"
```

---

## System Timezone Configuration

### PostgreSQL/Supabase

**Default Timezone:**
```sql
SHOW timezone;
-- Likely returns: UTC
```

**Server Functions:**
```sql
NOW()  -- Returns current timestamp in UTC
CURRENT_DATE  -- Returns current date (no timezone issues)
CURRENT_TIMESTAMP  -- Returns current timestamp in UTC
```

### Application Timezone

**User Location:** Vietnam (GMT+7)

**Browser:** Uses local timezone for Date objects

**Node.js Server:** Likely runs in UTC (Vercel, cloud providers)

**Impact:**
- Date parsing happens in GMT+7 (user's browser/local time)
- Storage happens with UTC conversion (`.toISOString()`)
- Retrieval happens from UTC storage
- Display converts back to GMT+7
- **Result: Off-by-one errors when crossing date boundary**

---

## Real-World Impact Examples

### Example 1: Late Night Transaction

**Scenario:** User imports transaction at 6 PM GMT+7

```
Time: 2025-03-01 18:00:00 GMT+7
Parsed as: 2025-03-01 00:00:00 GMT+7 (date from CSV)
Stored as: 2025-02-28T17:00:00.000Z (UTC)
Database sees: "2025-02-28"
User sees: "2025-02-28" ❌ WRONG!
Should be: "2025-03-01"
```

### Example 2: Date Range Query

**User Query:** "Show transactions from March 1-31, 2025"

```sql
-- What gets queried:
WHERE transaction_date >= '2025-03-01T00:00:00Z'
  AND transaction_date < '2025-04-01T00:00:00Z'

-- Actually returns transactions from:
-- Feb 28 17:00 GMT+7 to Mar 31 17:00 GMT+7

-- Result: Missing transactions from March 31 after 5PM,
-- Including transactions from Feb 28 after 5PM
```

### Example 3: Duplicate Detection

**Scenario:** User re-imports same statement

```
Original import (morning): "2025-03-01" → stored as "2025-02-28"
Re-import (evening): "2025-03-01" → stored as "2025-02-28"

Date comparison: "2025-02-28" === "2025-02-28" ✅ Detected!

BUT if time of day differs:
Original: "2025-03-01 09:00" → "2025-03-01T02:00:00Z" → "2025-03-01"
Re-import: "2025-03-01 19:00" → "2025-03-01T12:00:00Z" → "2025-03-01"

Still matches... but only by luck!
```

### Example 4: Checkpoint Balance

**Scenario:** Extract balance from Feb 28 transactions

```
CSV has transactions on "28/02/2025"
After 5 PM GMT+7, these get stored as:
  "2025-02-27T17:00:00.000Z" (displays as "2025-02-27")

System looks for checkpoint_date = "2025-02-28"
Finds no transactions!
Falls back to user-entered balance.

User thinks: "Why didn't it extract balance from CSV?"
```

---

## Is Our Entire System Subject to This Bug?

### ✅ Not Affected (Correct Implementation):

1. **Loan System** - Uses `DATE` ✅
2. **Investment System** - Uses `DATE` ✅
3. **Scheduled Payments** - Uses `DATE` ✅
4. **Contracts** - Uses `DATE` ✅
5. **Budgets** - Uses `DATE` ✅
6. **Receipts** - Uses `DATE` for transaction date ✅
7. **Audit Timestamps** - Uses `TIMESTAMPTZ` correctly ✅

### ❌ Affected (Has Bug):

1. **Transaction System** - Core transactions use `TIMESTAMPTZ` ❌
   - `original_transaction.transaction_date`
   - `main_transaction.transaction_date`
2. **Checkpoint System** - Checkpoints use `TIMESTAMPTZ` ❌
   - `balance_checkpoints.checkpoint_date`
3. **Balance History** - Balance dates use `TIMESTAMPTZ` ❌
   - `account_balance.balance_date`

### 🎯 Impact Assessment:

**Percentage of System Affected:** ~20%

- **Critical Core**: Transaction and checkpoint systems (affected)
- **Other Features**: Loans, investments, payments, contracts (not affected)

**Data Integrity Risk:**
- **HIGH** for transaction dates
- **HIGH** for checkpoint dates
- **MEDIUM** for balance history dates

---

## Is Entire System GMT+7?

### Answer: **Mixed**

**User Timezone:** GMT+7 (Vietnam)
- User's browser operates in GMT+7
- Date inputs assume GMT+7
- User expectations are GMT+7

**Server Timezone:** Likely UTC
- Vercel/cloud servers typically run UTC
- PostgreSQL default is UTC
- Node.js Date objects in server context use UTC

**Database Timezone:** UTC (Supabase default)
- `TIMESTAMPTZ` columns store in UTC
- `DATE` columns are timezone-agnostic

**Result:** System operates in **multiple timezones**
- User inputs in GMT+7
- Server processes in UTC
- Database stores in UTC (for TIMESTAMPTZ)
- Display converts to GMT+7

**Problem:** The conversion between GMT+7 and UTC causes date boundary issues for business dates that should never have been converted in the first place.

---

## Recommended Fix Strategy

### Phase 1: Fix Core Transaction System (CRITICAL)

**Priority:** HIGHEST
**Effort:** 6-8 hours
**Risk:** MEDIUM (requires migration + code changes)

**Tasks:**
1. Migrate `transaction_date` columns to `DATE`
2. Migrate `checkpoint_date` columns to `DATE`
3. Migrate `balance_date` columns to `DATE`
4. Update backend code to use date-only strings
5. Update all date comparisons
6. Test import, duplicate detection, checkpoints

**Files to Modify:**
- Database migration: `database/migrations/XXX_fix_date_types.sql`
- Import API: `app/api/accounts/[id]/import/route.ts`
- Transaction APIs: `app/api/main-transactions/route.ts`
- Checkpoint service: `lib/checkpoint-service.ts`
- Type definitions: `types/import.ts`, `types/transaction.ts`

### Phase 2: Add System-Wide Tests

**Priority:** HIGH
**Effort:** 4-6 hours

**Tasks:**
1. Create timezone test suite
2. Test date handling at timezone boundaries
3. Test all date-related APIs
4. Add E2E tests for critical flows

### Phase 3: Documentation & Monitoring

**Priority:** MEDIUM
**Effort:** 2-3 hours

**Tasks:**
1. Update all documentation
2. Add timezone handling guide
3. Create runbook for date issues
4. Add monitoring for date anomalies

---

## Prevention Guidelines

### For Future Development:

**Rule 1:** Use `DATE` for business dates
```sql
-- YES:
transaction_date DATE NOT NULL

-- NO:
transaction_date TIMESTAMPTZ NOT NULL
```

**Rule 2:** Use `TIMESTAMPTZ` for audit timestamps
```sql
-- YES:
created_at TIMESTAMPTZ DEFAULT NOW()

-- NO:
created_at DATE
```

**Rule 3:** Never use `.toISOString()` for business dates
```typescript
// NO:
date.toISOString()

// YES:
formatAsDateOnly(date)  // Returns "YYYY-MM-DD"
```

**Rule 4:** Store dates as strings in API payloads
```typescript
// YES:
{ transaction_date: "2025-03-01" }

// NO:
{ transaction_date: "2025-02-28T17:00:00.000Z" }
```

**Rule 5:** Test at timezone boundaries
```typescript
// Always test these scenarios:
// - Before midnight GMT+7
// - After midnight GMT+7
// - Exactly at midnight
// - Date range queries
// - Duplicate detection
```

---

## Summary

### Current State:
- ⚠️ Core transaction and checkpoint systems have **critical timezone bug**
- ✅ Newer features (loans, payments, contracts) implemented correctly
- 🔍 Bug has been in production but not widely noticed due to:
  - Most testing during daytime hours
  - Frontend displays dates correctly (masking the issue)
  - Database queries often work despite wrong data

### Impact:
- **Data Integrity:** Transactions have wrong dates in database
- **Reports:** Date-based reports return incorrect data
- **Reconciliation:** Balance checkpoints extracted from wrong dates
- **User Trust:** Users may notice date discrepancies

### Urgency:
- **Fix Priority:** **CRITICAL**
- **Timeline:** Should be fixed **ASAP** (within 1-2 weeks)
- **Risk of Delay:** More incorrect data accumulates daily

### Next Steps:
1. Create database migration to change column types
2. Update all backend code to use date-only strings
3. Test thoroughly at timezone boundaries
4. Deploy and monitor

---

## Related Documentation

- `docs/BANK_IMPORT_SYSTEM.md` - Import system overview
- `docs/BANK_IMPORT_DATE_FILTER_FIX.md` - Frontend date filtering fix
- `docs/CASHFLOW_SYSTEM_3.0.md` - Checkpoint system architecture

---

## Version History

- **2025-01-24** - Initial system-wide timezone analysis
  - Identified critical bugs in core transaction system
  - Confirmed newer features use correct DATE type
  - Created comprehensive fix strategy
