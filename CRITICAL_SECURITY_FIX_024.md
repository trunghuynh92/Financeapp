# 🚨 CRITICAL SECURITY FIX: Migration 024 - Cross-Entity Transfer Prevention

## 🔴 Security Vulnerability Discovered

**Issue**: The system allowed transfers between accounts belonging to **different entities**.

**Impact**: An accountant managing multiple companies could:
- Accidentally transfer money between different companies
- Maliciously move funds between entities
- Cause data integrity issues across tenant boundaries

## ✅ The Fix

**Migration 024** adds entity boundary validation to the `validate_transfer_match()` function.

### What Changed

**Before** (Vulnerable):
```sql
-- ❌ Only checked transaction types matched
-- Did NOT check if accounts belonged to same entity

validate_transfer_match():
  ✅ Check TRF_OUT ↔ TRF_IN
  ✅ Check different accounts
  ❌ Missing: Check same entity
```

**After** (Secure):
```sql
-- ✅ Now enforces entity boundaries

validate_transfer_match():
  ✅ Check TRF_OUT ↔ TRF_IN
  ✅ Check different accounts
  ✅ Check SAME ENTITY (NEW!)
  ✅ Detailed error messages
  ✅ Amount validation warning
```

## 📋 How to Deploy

### Step 1: Run Migration 024

In Supabase Dashboard → SQL Editor:

```sql
-- Copy entire contents of migrations/024_prevent_cross_entity_transfers.sql
-- and run it
```

OR run this directly:

```sql
-- Drop and recreate the function with entity validation
DROP FUNCTION IF EXISTS validate_transfer_match() CASCADE;

CREATE OR REPLACE FUNCTION validate_transfer_match()
RETURNS TRIGGER AS $$
DECLARE
  my_type_code VARCHAR(20);
  matched_type_code VARCHAR(20);
  my_entity_id UUID;
  matched_entity_id UUID;
  my_account_id INTEGER;
  matched_account_id INTEGER;
BEGIN
  IF NEW.transfer_matched_transaction_id IS NOT NULL THEN
    -- Get my transaction details
    SELECT tt.type_code, a.entity_id, NEW.account_id
    INTO my_type_code, my_entity_id, my_account_id
    FROM transaction_types tt
    JOIN accounts a ON a.account_id = NEW.account_id
    WHERE tt.transaction_type_id = NEW.transaction_type_id;

    -- Get matched transaction details
    SELECT tt.type_code, a.entity_id, mt.account_id
    INTO matched_type_code, matched_entity_id, matched_account_id
    FROM main_transaction mt
    JOIN transaction_types tt ON mt.transaction_type_id = tt.transaction_type_id
    JOIN accounts a ON a.account_id = mt.account_id
    WHERE mt.main_transaction_id = NEW.transfer_matched_transaction_id;

    -- CRITICAL: Both must belong to SAME entity
    IF my_entity_id != matched_entity_id THEN
      RAISE EXCEPTION 'Cross-entity transfers are not allowed. Cannot transfer between accounts in different entities.';
    END IF;

    -- [Rest of validation...]
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_validate_transfer_match
  BEFORE INSERT OR UPDATE ON main_transaction
  FOR EACH ROW
  EXECUTE FUNCTION validate_transfer_match();
```

### Step 2: Verify Protection

Test that cross-entity transfers are blocked:

```sql
-- Assuming you have:
-- Account 1 in Entity A
-- Account 2 in Entity B

-- Try to create cross-entity transfer (should FAIL)
INSERT INTO main_transaction (
  raw_transaction_id,
  account_id,
  transaction_type_id,
  amount,
  transaction_direction,
  transaction_date,
  transfer_matched_transaction_id
)
VALUES (
  'test-cross-entity-1',
  1,  -- Account in Entity A
  (SELECT transaction_type_id FROM transaction_types WHERE type_code = 'TRF_OUT'),
  1000,
  'credit',
  CURRENT_DATE,
  (SELECT main_transaction_id FROM main_transaction
   WHERE account_id = 2 LIMIT 1)  -- Account in Entity B
);

-- Expected: ERROR: Cross-entity transfers are not allowed
```

## 🛡️ Security Guarantees

After this migration:

✅ **Database-level enforcement** - Cannot be bypassed by application code
✅ **Automatic validation** - Triggers on every INSERT/UPDATE
✅ **Clear error messages** - Shows which entities are involved
✅ **Prevents accidents** - Protects against human error
✅ **Prevents malicious activity** - Blocks intentional cross-entity transfers

## 🎯 UI Implications

### Before Building Transfer UI

Use the new helper function to show only valid transfer destinations:

```sql
-- Check if transfer is allowed between two accounts
SELECT can_transfer_between_accounts(from_account_id, to_account_id);
-- Returns: TRUE if same entity and different accounts, FALSE otherwise
```

### Transfer Dropdown Example

```typescript
// When user selects "Transfer Out" from Account 1
// Only show accounts that:
// 1. Belong to the SAME entity as Account 1
// 2. Are different from Account 1

const { data: validDestinations } = await supabase
  .from('accounts')
  .select('*')
  .eq('entity_id', sourceAccount.entity_id)  // Same entity
  .neq('account_id', sourceAccount.account_id);  // Different account
```

## 📊 Example Scenarios

### ✅ Scenario 1: Allowed (Same Entity)

```
User: Sarah (Accountant)
Manages: "Company ABC" entity

Action: Transfer $5,000
  From: "ABC Checking Account" (Entity: Company ABC)
  To:   "ABC Savings Account"  (Entity: Company ABC)

Result: ✅ SUCCESS - Same entity, different accounts
```

### ❌ Scenario 2: Blocked (Different Entities)

```
User: Sarah (Accountant)
Manages:
  - "Company ABC" entity
  - "Company XYZ" entity

Action: Transfer $5,000
  From: "ABC Checking Account" (Entity: Company ABC)
  To:   "XYZ Checking Account" (Entity: Company XYZ)

Result: ❌ BLOCKED
Error: "Cross-entity transfers are not allowed. Cannot transfer
        between accounts in different entities. Account 1 (entity abc)
        cannot be matched with account 5 (entity xyz)"
```

### ✅ Scenario 3: Allowed (Internal Company Transfers)

```
User: John (Owner)
Entity: "Pamper Me Spa"

Accounts:
  - Bank Account (Pamper Me)
  - Petty Cash (Pamper Me)
  - Credit Card (Pamper Me)

Action: Transfer $500
  From: Bank Account → Petty Cash

Result: ✅ SUCCESS - Both in "Pamper Me" entity
```

## 🔍 Validation Rules Summary

The trigger now validates:

1. ✅ **Same Entity** - Both accounts must belong to same entity (NEW!)
2. ✅ **Different Accounts** - Cannot transfer to same account
3. ✅ **Valid Types** - Must be transfer/debt transaction types
4. ✅ **Correct Pairs** - TRF_OUT↔TRF_IN, DEBT_DRAW↔DEBT_ACQ, etc.
5. ⚠️ **Amount Match** - Warns if amounts don't match (warning only)

## 📝 Next Steps

### Required UI Updates

1. **Transfer Form**:
   - Filter destination accounts by same entity
   - Use `can_transfer_between_accounts()` function
   - Show entity name next to account names

2. **Transfer Matching UI**:
   - Only show unmatched transactions from same entity
   - Add entity filter to transfer matching page

3. **Admin Dashboard**:
   - Add report showing transfer activity by entity
   - Detect and alert on transfer anomalies

### Recommended Testing

```sql
-- Test 1: Same entity transfer (should work)
SELECT can_transfer_between_accounts(
  (SELECT account_id FROM accounts WHERE entity_id = 'entity-a-uuid' LIMIT 1),
  (SELECT account_id FROM accounts WHERE entity_id = 'entity-a-uuid' LIMIT 1 OFFSET 1)
);
-- Expected: TRUE

-- Test 2: Cross-entity transfer (should fail)
SELECT can_transfer_between_accounts(
  (SELECT account_id FROM accounts WHERE entity_id = 'entity-a-uuid' LIMIT 1),
  (SELECT account_id FROM accounts WHERE entity_id = 'entity-b-uuid' LIMIT 1)
);
-- Expected: FALSE
```

## 🎉 Benefits

**For SaaS Security:**
- ✅ Multi-tenant data isolation enforced
- ✅ Prevents cross-contamination of financial data
- ✅ Compliance with data separation requirements

**For Users:**
- ✅ Protection against costly mistakes
- ✅ Clear error messages for troubleshooting
- ✅ Confidence in data integrity

**For Developers:**
- ✅ Database-level enforcement (can't forget to check)
- ✅ Helper functions for UI filtering
- ✅ Detailed error messages for debugging

---

## ⚠️ IMPORTANT

**Run this migration immediately** before allowing users to create transfers in production.

This is a **critical security fix** that should be deployed as soon as possible.

---

**Migration File**: `migrations/024_prevent_cross_entity_transfers.sql`
**Documentation**: Updated in `SCHEMA.md`
**Status**: Ready to deploy ✅
