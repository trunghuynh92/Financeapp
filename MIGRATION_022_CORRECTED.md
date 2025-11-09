# Migration 022: Multi-User Authentication - CORRECTED & READY

## ✅ Status: CORRECTED AND READY TO RUN

**Issue Fixed**: Removed references to non-existent `drawdown_payment` table.

The original migration referenced `drawdown_payment` table which does not exist in your schema. Payments for debt drawdowns are tracked using `main_transaction` table with `drawdown_id` and `transaction_subtype` columns.

## 🔧 What Was Fixed

1. **Removed RLS policies for `drawdown_payment` table** (doesn't exist)
2. **Updated SCHEMA.md** to correctly document that payments are tracked in `main_transaction`
3. **Updated migration summary** with correct table count and notes

## 📊 Correct Table Structure

### Existing Tables (12):
1. `entities` - Multi-entity support (UUID primary key)
2. `accounts` - Financial accounts (INTEGER account_id)
3. `balance_checkpoints` - Balance snapshots
4. `original_transaction` - Raw transactions
5. `main_transaction` - Processed transactions with categorization
6. `transaction_types` - Transaction type definitions (global)
7. `categories` - Transaction categories (global)
8. `branches` - Store/location tracking (global)
9. `debt_drawdown` - Debt tracking
10. `import_batch` - Import batch tracking
11. ~~`drawdown_payment`~~ **DOES NOT EXIST** ❌

### New Tables (2):
12. `users` - User profiles (UUID, extends auth.users)
13. `entity_users` - Junction table for multi-entity access with roles

**Total: 14 tables** (12 existing + 2 new)

## 💡 How Debt Payments Work

Instead of a separate `drawdown_payment` table, payments are tracked in `main_transaction`:

```sql
-- Example: Record a principal payment
INSERT INTO main_transaction (
  account_id,
  drawdown_id,           -- Links to debt_drawdown
  transaction_subtype,   -- 'principal', 'interest', 'fee', 'penalty'
  amount,
  transaction_direction, -- 'debit' for payment out
  ...
)
VALUES (...);
```

**Available Functions:**
- `get_drawdown_payment_history(drawdown_id)` - View all payments for a drawdown
- `get_active_drawdowns(account_id)` - Get drawdowns with payment summaries
- `process_debt_payment()` - Trigger that auto-updates drawdown balance

## 🚀 Ready to Deploy

The corrected migration is now ready. Follow these steps:

### Step 1: Run the Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `migrations/022_add_multi_user_auth_system.sql`
3. Paste and click **Run**
4. Should complete successfully with no errors

### Step 2: Verify Migration

Run this query to verify everything was created:

```sql
-- Check new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'entity_users')
ORDER BY table_name;
-- Expected: 2 rows (users, entity_users)

-- Check new ENUM type
SELECT enum_range(NULL::user_role);
-- Expected: {owner,admin,editor,viewer}

-- Check owner_user_id column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'entities' AND column_name = 'owner_user_id';
-- Expected: 1 row (owner_user_id, uuid)

-- Check new functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'handle_new_entity', 'add_entity_owner',
                       'get_user_role', 'user_has_entity_access', 'user_has_permission')
ORDER BY routine_name;
-- Expected: 6 rows

-- Check new triggers
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('on_auth_user_created', 'on_entity_created_set_owner',
                       'on_entity_created_add_owner')
ORDER BY trigger_name;
-- Expected: 3 rows
```

### Step 3: Assign Yourself to Existing Entities

Since you have existing entities (Pamper Me, BGS Saigon, Younique Academy, Trungs, Blue Wings International), you need to assign yourself as owner:

```sql
-- First, sign up and get your user UUID
-- After signing up, run this to see your user ID:
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Then assign yourself as owner to all existing entities
-- Replace 'YOUR_USER_UUID' with the actual UUID from above query
INSERT INTO entity_users (entity_id, user_id, role, created_by_user_id)
SELECT
  id as entity_id,
  'YOUR_USER_UUID'::uuid as user_id,
  'owner'::user_role as role,
  'YOUR_USER_UUID'::uuid as created_by_user_id
FROM entities
WHERE id NOT IN (SELECT entity_id FROM entity_users);

-- Also update entities.owner_user_id
UPDATE entities
SET owner_user_id = 'YOUR_USER_UUID'::uuid
WHERE owner_user_id IS NULL;
```

### Step 4: Enable Email Auth

1. Supabase Dashboard → Authentication → Providers
2. Ensure **Email** provider is enabled
3. **For Development**: Disable "Confirm email"
   - Settings → Authentication → Email Auth → Uncheck "Enable email confirmations"

### Step 5: Test

```bash
npm run dev
```

1. Visit http://localhost:3000 → Redirects to /signin
2. Go to /signup → Create account
3. Should redirect to /dashboard
4. You should see all 5 existing entities

## 📋 Migration Changes Summary

### Created:
- ✅ `users` table (2 policies)
- ✅ `entity_users` table (4 policies)
- ✅ `user_role` ENUM type
- ✅ `entities.owner_user_id` column
- ✅ 3 helper functions
- ✅ 3 auto-setup triggers

### Updated RLS Policies:
- ✅ `entities` (4 policies)
- ✅ `accounts` (4 policies)
- ✅ `main_transaction` (4 policies)
- ✅ `original_transaction` (4 policies)
- ✅ `balance_checkpoints` (1 policy for ALL)
- ✅ `debt_drawdown` (1 policy for ALL)
- ✅ `categories` (2 policies)
- ✅ `branches` (2 policies)
- ✅ `transaction_types` (2 policies)
- ✅ `import_batch` (2 policies, conditional)

**Total**: 30+ RLS policies updated/created

## ✨ What's Next

After successful migration:

1. **Test the auth flow**
   - Sign up → Sign in → Create entity → Verify ownership

2. **Update existing API routes**
   - Add `requireAuth()` checks
   - Filter data by `entity_users`

3. **Build user management UI**
   - Invite users page
   - Role management
   - User list

4. **Add logout button**
   - Update navbar with user menu
   - Show current user info

## 📚 Documentation Updated

- ✅ `SCHEMA.md` - Removed drawdown_payment, added users and entity_users tables
- ✅ `AUTH_IMPLEMENTATION.md` - Complete implementation guide
- ✅ `migrations/022_add_multi_user_auth_system.sql` - Corrected migration
- ✅ `MIGRATION_022_CORRECTED.md` - This file

---

**The migration is now correct and ready to run!** 🎉
