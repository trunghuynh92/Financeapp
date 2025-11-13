# Balance Checkpoint Integration - Design Document

## Overview

This document outlines the integration of the "Edit Balance" functionality with the Balance Checkpoint System, ensuring all balance changes follow the "No money without origin" principle.

---

## Problem Statement

### Before Integration

The system had **two disconnected balance tracking mechanisms**:

1. **Direct Balance Updates** (`account_balances` table)
   - Manual edits via "Edit Balance" button
   - No audit trail
   - No origin tracking
   - Bypasses checkpoint system

2. **Balance Checkpoints** (checkpoint system)
   - Used only during account creation
   - Tracks declared vs calculated balance
   - Creates audit trail via adjustment transactions
   - Enforces "No money without origin"

**Result:** Inconsistent approach to balance management, allowing users to bypass the sophisticated checkpoint system.

---

## Solution: Unified Balance Management

### Core Principle

**All balance changes must go through the checkpoint system.**

---

## Architectural Changes

### 1. Button Rename

**Before:** "Edit Balance"
**After:** "Create Balance Checkpoint"

**Rationale:** Accurately describes what the action does and aligns with system terminology.

---

### 2. Behavior Change

#### Old Flow (Direct Update)
```
User clicks "Edit Balance"
  ↓
Enter new balance
  ↓
PATCH /api/accounts/{id}/balance
  ↓
UPDATE account_balances SET current_balance = X
  ↓
Done (no checkpoint, no transaction, no audit trail)
```

#### New Flow (Checkpoint Creation)
```
User clicks "Create Balance Checkpoint"
  ↓
Enter declared balance, date, notes
  ↓
⚠️ Show warning about checkpoint system
  ↓
POST /api/accounts/{id}/checkpoints
  ↓
Create/update checkpoint record
  ↓
Calculate adjustment_amount
  ↓
Create/update balance adjustment transaction (if needed)
  ↓
✅ Sync account_balances.current_balance from calculated balance
  ↓
Show success message with adjustment info
```

---

### 3. Table Role Redefinition

#### `account_balances` Table

**Previous Role:** Manually editable balance storage
**New Role:** Cached/computed balance for quick lookups

| Field | Source | Update Method |
|-------|--------|---------------|
| `account_id` | Manual | On account creation |
| `current_balance` | **Calculated from checkpoints + transactions** | **Auto-sync from checkpoint system** |
| `last_transaction_id` | Last transaction processed | Updated by transaction processing |
| `last_updated` | Timestamp | Trigger on update |

**Key Change:** `current_balance` is now a **computed/cached value**, not a manually editable field.

---

### 4. Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                SOURCE OF TRUTH                          │
│                                                         │
│  balance_checkpoints table                             │
│  + original_transaction table                          │
│  = Declared balance + All transactions                 │
└─────────────────────┬───────────────────────────────────┘
                      ↓
                (Calculation)
                      ↓
┌─────────────────────────────────────────────────────────┐
│              CALCULATED BALANCE                         │
│                                                         │
│  checkpoint.calculated_balance                          │
│  = SUM of all transactions up to checkpoint date       │
└─────────────────────┬───────────────────────────────────┘
                      ↓
                (Auto-sync)
                      ↓
┌─────────────────────────────────────────────────────────┐
│              CACHED FOR DISPLAY                         │
│                                                         │
│  account_balances.current_balance                      │
│  = Latest calculated balance (for quick queries)       │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. UI Changes (`components/balance-edit-dialog.tsx`)

#### Dialog Title
- **Before:** "Edit Account Balance"
- **After:** "Create Balance Checkpoint"

#### Dialog Description
- **Before:** "Update the balance for {account_name}"
- **After:** "Create a balance checkpoint for {account_name} to track reconciliation"

#### Warning Message (New)
```
⚠️ Balance Checkpoint System

When you create a checkpoint, the system:
• Compares your declared balance to calculated balance from transactions
• Flags any unexplained difference as a balance adjustment
• Encourages you to add historical transactions to reconcile

This ensures all money has a documented origin.
```

#### Field Labels
- "New Balance" → "Declared Balance"
- "Balance Update Date" → "Checkpoint Date"
- Add: "Notes" field (explain where this balance came from)

#### Success/Error Messages
Show adjustment information:
```
✅ Checkpoint created successfully!

Declared balance: 200,000,000 VND
Calculated balance: 50,000,000 VND
Adjustment amount: +150,000,000 VND (unexplained income)

💡 Add historical transactions to reduce this adjustment.
```

---

### 2. API Changes

#### Remove Direct Balance Update
The endpoint `/api/accounts/[id]/balance` PATCH method becomes **deprecated** (or repurposed).

#### Use Existing Checkpoint Endpoint
```typescript
// Instead of:
PATCH /api/accounts/{id}/balance
{ balance: 200000000 }

// Use:
POST /api/accounts/{id}/checkpoints
{
  checkpoint_date: "2025-11-05",
  declared_balance: 200000000,
  notes: "From November bank statement"
}
```

**Endpoint already exists!** We reuse: `/api/accounts/[id]/checkpoints/route.ts`

#### Handle Duplicate Date (Update Existing Checkpoint)

The API should detect if a checkpoint already exists for the given date:

```typescript
// Pseudo-code
if (checkpointExistsForDate) {
  // Update existing checkpoint
  UPDATE balance_checkpoints
  SET declared_balance = newAmount
  WHERE account_id = X AND checkpoint_date = Y

  // Recalculate adjustment
  recalculateCheckpoint(checkpoint_id)
} else {
  // Create new checkpoint
  INSERT INTO balance_checkpoints ...
}
```

---

### 3. Checkpoint Service Enhancement

#### New Function: `syncAccountBalance()`

Add to `lib/checkpoint-service.ts`:

```typescript
/**
 * Sync account_balances table with latest calculated balance
 * Called after checkpoint creation/update
 */
async function syncAccountBalance(accountId: number): Promise<void> {
  // Get the latest calculated balance from most recent checkpoint
  const latestCheckpoint = await getLatestCheckpoint(accountId)

  // If no checkpoint, calculate from all transactions
  const calculatedBalance = latestCheckpoint
    ? latestCheckpoint.calculated_balance + latestCheckpoint.adjustment_amount
    : await calculateBalanceFromTransactions(accountId)

  // Update account_balances table
  await supabase
    .from('account_balances')
    .update({
      current_balance: calculatedBalance,
      last_updated: new Date().toISOString()
    })
    .eq('account_id', accountId)
}
```

#### Update `createOrUpdateCheckpoint()`

After creating/updating a checkpoint, sync the balance:

```typescript
export async function createOrUpdateCheckpoint(...) {
  // ... existing checkpoint creation logic ...

  // NEW: Sync account_balances table
  await syncAccountBalance(account_id)

  return checkpoint
}
```

---

### 4. Database Trigger (Alternative Approach)

Instead of calling `syncAccountBalance()` in code, create a PostgreSQL trigger:

```sql
-- Trigger function to sync account_balances when checkpoints change
CREATE OR REPLACE FUNCTION sync_account_balance_from_checkpoint()
RETURNS TRIGGER AS $$
DECLARE
  v_calculated_balance NUMERIC(15,2);
BEGIN
  -- Calculate current balance for this account
  SELECT
    COALESCE(
      (SELECT calculated_balance + adjustment_amount
       FROM balance_checkpoints
       WHERE account_id = NEW.account_id
       ORDER BY checkpoint_date DESC, checkpoint_id DESC
       LIMIT 1),
      0
    )
  INTO v_calculated_balance;

  -- Update account_balances table
  UPDATE account_balances
  SET
    current_balance = v_calculated_balance,
    last_updated = NOW()
  WHERE account_id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to balance_checkpoints
CREATE TRIGGER sync_balance_after_checkpoint
AFTER INSERT OR UPDATE ON balance_checkpoints
FOR EACH ROW
EXECUTE FUNCTION sync_account_balance_from_checkpoint();
```

**Advantage:** Automatic sync, no need to remember to call it in code.

---

## Migration Strategy

### Phase 1: Soft Launch (Recommended)

1. ✅ Rename button and update UI
2. ✅ Change to use checkpoint API
3. ✅ Add sync functionality
4. ⚠️ Keep old balance API for backward compatibility (but don't expose in UI)
5. 📊 Monitor for issues

### Phase 2: Deprecation (Later)

1. ❌ Remove direct balance update API entirely
2. 📝 Update documentation
3. 🧪 Comprehensive testing

---

## User Experience

### Creating First Checkpoint

```
User: "I want to set my account balance to 100M VND"
  ↓
Clicks: "Create Balance Checkpoint"
  ↓
Sees warning: "This will track where your money comes from"
  ↓
Enters: Balance = 100M, Date = Nov 5, Notes = "Opening balance"
  ↓
System: "✅ Checkpoint created! You have 100M in unexplained income.
         Add transactions to reconcile."
  ↓
User sees: Account balance = 100M VND
           Flagged adjustment transaction = +100M
```

### Updating Existing Checkpoint

```
User: "Actually, the balance on Nov 5 was 120M, not 100M"
  ↓
Clicks: "Create Balance Checkpoint"
  ↓
Enters: Balance = 120M, Date = Nov 5 (same date as existing)
  ↓
System detects: "Checkpoint for Nov 5 exists. Updating..."
  ↓
System: "✅ Checkpoint updated! Adjustment changed from +100M to +120M"
  ↓
Balance adjustment transaction updated automatically
```

### Adding Transactions Reconciles

```
User adds historical transaction: "+50M on Nov 1"
  ↓
Trigger fires: Recalculate all checkpoints
  ↓
Nov 5 checkpoint:
  - Declared: 120M (unchanged)
  - Calculated: 50M (updated!)
  - Adjustment: 70M (reduced from 120M)
  ↓
Balance adjustment transaction: Updated to +70M
  ↓
User sees: "Great! You're making progress. Only 70M unexplained now."
```

---

## Benefits

### For Users
✅ Consistent balance management
✅ Clear audit trail for all changes
✅ Encouragement to add historical data
✅ Better understanding of account state
✅ No arbitrary unexplained balance changes

### For System
✅ Single source of truth (checkpoints)
✅ `account_balances` becomes computed/cached
✅ All balance changes follow same flow
✅ Proper enforcement of "No money without origin"
✅ Better data integrity

---

## Technical Considerations

### Performance

**Q: Won't this be slower than direct updates?**

A: Minimal impact:
- Checkpoint creation is already optimized
- Balance sync is a single UPDATE query
- Can be done asynchronously
- `account_balances` remains fast for reads (cached value)

### Backward Compatibility

**Q: What about existing code that updates balances directly?**

A:
- Keep the balance API but make it create checkpoints internally
- Or deprecate it entirely if only used by the Edit button
- Audit codebase for direct `account_balances` updates

### Data Consistency

**Q: What if `account_balances` gets out of sync?**

A: Create a maintenance function:
```typescript
async function recalculateAllAccountBalances() {
  const accounts = await getAllAccounts()
  for (const account of accounts) {
    await syncAccountBalance(account.account_id)
  }
}
```

Run periodically or on-demand.

---

## Testing Checklist

- [ ] Create checkpoint with new date → checkpoint created, balance synced
- [ ] Create checkpoint with existing date → checkpoint updated, balance synced
- [ ] Create checkpoint with declared = calculated → no adjustment transaction
- [ ] Create checkpoint with declared > calculated → positive adjustment (flagged)
- [ ] Create checkpoint with declared < calculated → negative adjustment (flagged)
- [ ] Add transaction before checkpoint → checkpoint recalculates, balance syncs
- [ ] Add transaction after checkpoint → no effect on that checkpoint
- [ ] Delete checkpoint → balance recalculates from remaining data
- [ ] Multiple checkpoints for same account → each tracks its own reconciliation
- [ ] Account balance display matches latest calculated balance

---

## File Changes Summary

### Modified Files
1. ✏️ `components/balance-edit-dialog.tsx` - UI and API call
2. ✏️ `app/dashboard/accounts/[id]/page.tsx` - Button label
3. ✏️ `lib/checkpoint-service.ts` - Add syncAccountBalance()
4. ✏️ `app/api/accounts/[id]/checkpoints/route.ts` - Handle existing checkpoint updates (may already work)

### New Files
5. 📄 `migrations/004_add_balance_sync_trigger.sql` - Optional DB trigger

### Deprecated (Future)
6. ⚠️ `app/api/accounts/[id]/balance/route.ts` - PATCH method becomes unused

---

## Rollout Plan

### Step 1: Code Changes (This Session)
- Update UI components
- Change API calls
- Add sync functionality
- Test locally

### Step 2: Testing (Next)
- Create test accounts
- Test all scenarios
- Verify balance sync
- Check edge cases

### Step 3: Documentation (After Testing)
- Update user guide
- Add inline help text
- Create video/screenshots

### Step 4: Deploy
- Deploy to production
- Monitor for issues
- Gather user feedback

---

## Success Metrics

- ✅ All balance changes create checkpoints
- ✅ No direct updates to `account_balances.current_balance` in code
- ✅ Users understand and use checkpoint system
- ✅ Audit trail exists for all balance changes
- ✅ Balance display always matches calculated balance

---

**Document Version:** 1.0
**Date:** November 5, 2025
**Status:** Approved - Ready for Implementation
**Reviewed By:** User (confirmed via chat)
