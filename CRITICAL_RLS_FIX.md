# CRITICAL: Transaction Data Isolation Issue

## Issue Description
**Severity**: CRITICAL - Data Security Breach
**Date Discovered**: 2025-11-10
**Reporter**: User testing with newly created account

### Problem
Users can see ALL transactions from ALL entities, even entities they are not members of. This is a critical data isolation breach in a multi-tenant SaaS application.

### Impact
- New users without entity memberships can see transactions from other entities
- Users can view financial data from entities they don't belong to
- Complete breach of entity-level data isolation for transactions

## Root Cause Analysis

The issue stems from potentially incomplete or permissive Row Level Security (RLS) policies on the `original_transaction` and `main_transaction` tables.

### Technical Details

1. **Frontend Code** (`/app/dashboard/transactions/page.tsx`):
   - Correctly passes `entity_id` filter to API (lines 151, 191)
   - Properly uses EntityContext to get current entity

2. **API Code** (`/app/api/transactions/route.ts`):
   - Correctly filters by entity_id by first fetching account IDs (lines 22-26)
   - Then filters transactions by those account IDs (lines 51-53)
   - Uses authenticated Supabase client (`createSupabaseServerClient()`)

3. **RLS Policies**:
   - RLS is enabled on `original_transaction` (Migration 025, line 20)
   - Policy exists: "Users can read original transactions for their accounts" (Migration 022, lines 395-404)
   - However, the policy might not be strict enough or there may be conflicting permissive policies

### Possible Causes

1. **Permissive policies not fully removed**: Migration 025 attempted to remove permissive "Enable all access" policies, but some might remain
2. **Policy logic issue**: The existing policy joins might not be working as expected
3. **Missing SECURITY DEFINER context**: Policies might need to specify `TO authenticated` explicitly

## The Fix: Migration 028

### What It Does

Migration 028 (`migrations/028_fix_transaction_rls_isolation.sql`) performs a complete RLS reset and reapplication:

1. **Drops ALL existing policies** on `original_transaction` and `main_transaction` tables
2. **Ensures RLS is enabled** on both tables
3. **Creates strict, explicit policies** with proper `TO authenticated` clauses
4. **Uses INNER JOIN** instead of just JOIN for clearer semantics
5. **Applies all CRUD policies** (SELECT, INSERT, UPDATE, DELETE) with proper role checks

### Key Changes

**Policy naming convention updated**:
- Old: "Users can read original transactions for their accounts"
- New: "Users can read original transactions for their entities"

This clarifies that the filter is entity-based, not just account-based.

**Stricter policy logic**:
```sql
-- Old policy (Migration 022)
EXISTS (
    SELECT 1 FROM accounts a
    JOIN entity_users eu ON eu.entity_id = a.entity_id
    WHERE a.account_id = original_transaction.account_id
    AND eu.user_id = auth.uid()
)

-- New policy (Migration 028)
EXISTS (
    SELECT 1 FROM accounts a
    INNER JOIN entity_users eu ON eu.entity_id = a.entity_id
    WHERE a.account_id = original_transaction.account_id
    AND eu.user_id = auth.uid()
)
```

The addition of `TO authenticated` and explicit `INNER JOIN` makes the intent clearer.

## How to Apply the Fix

### Step 1: Run Diagnostic Query
First, check what policies currently exist:

```bash
# In Supabase SQL Editor, run:
cat scripts/check-rls-policies.sql
```

This will show you:
- All current RLS policies on critical tables
- Whether RLS is enabled on each table

### Step 2: Apply Migration 028
```bash
# In Supabase SQL Editor
# Copy and paste the contents of migrations/028_fix_transaction_rls_isolation.sql
# Execute the migration
```

### Step 3: Verify the Fix
After applying Migration 028, run this verification query:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('original_transaction', 'main_transaction')
ORDER BY tablename, cmd;
```

Expected output should show:
- `original_transaction`: 4 policies (SELECT, INSERT, UPDATE, DELETE)
- `main_transaction`: 4 policies (SELECT, INSERT, UPDATE, DELETE)

### Step 4: Test
1. Log in with a user that belongs to Entity A only
2. Go to Transactions page
3. Verify you can ONLY see transactions from Entity A
4. Log in with a new user (no entity memberships)
5. Verify they see NO transactions

## Additional Diagnostic Tools

### Check User's Entity Memberships
```sql
SELECT
    e.id as entity_id,
    e.name as entity_name,
    eu.role,
    eu.created_at
FROM entity_users eu
JOIN entities e ON e.id = eu.entity_id
WHERE eu.user_id = auth.uid();
```

### Check Accounts for an Entity
```sql
SELECT
    account_id,
    account_name,
    account_type,
    entity_id
FROM accounts
WHERE entity_id = '<your-entity-id>';
```

### Check Transactions for an Account
```sql
SELECT
    raw_transaction_id,
    account_id,
    transaction_date,
    description,
    debit_amount,
    credit_amount
FROM original_transaction
WHERE account_id = <your-account-id>
LIMIT 10;
```

## Related Migrations

- **Migration 022**: Added multi-user auth system with RLS policies
- **Migration 025**: Attempted to remove permissive policies
- **Migration 027**: Fixed entity creation RLS issues
- **Migration 028**: Fixes transaction data isolation (THIS FIX)

## Prevention for Future

### Code Review Checklist
- [ ] All new tables must have RLS enabled (`ALTER TABLE xxx ENABLE ROW LEVEL SECURITY`)
- [ ] All tables must have explicit policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Policies must use `TO authenticated` to be explicit
- [ ] Policies must check entity membership via `entity_users` table
- [ ] Never create "Enable all access" policies in production
- [ ] Always test RLS with multiple test users from different entities

### Testing Protocol
Before deploying any RLS changes:
1. Create test users in different entities
2. Verify each user can ONLY see their own entity's data
3. Verify new users (no memberships) see NO data
4. Test all CRUD operations with different role levels

## Status

- [ ] Migration 028 created
- [ ] Migration 028 applied to production database
- [ ] Verification query executed
- [ ] Manual testing completed
- [ ] Issue resolved

**Apply this migration IMMEDIATELY to fix the critical data isolation breach.**
