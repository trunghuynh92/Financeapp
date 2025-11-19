# Multi-Tenant SaaS Test Guide

## Test Scenario: Complete Data Isolation

### Setup Phase

#### User 1: Alice
1. **Sign up** as `alice@example.com`
2. **Create entity**: "Alice Corp" (Company)
3. **Create bank account**: "Alice Bank - VCB" with opening balance 10,000,000 VND
4. **Create transaction**: Debit 500,000 VND - "Office rent"

#### User 2: Bob
1. **Sign up** as `bob@example.com`
2. **Create entity**: "Bob Personal" (Personal)
3. **Create bank account**: "Bob Cash" with opening balance 5,000,000 VND
4. **Create transaction**: Credit 200,000 VND - "Freelance income"

---

## Security Tests

### Test 1: Entity Isolation
**Expected:** Alice and Bob only see their own entities

✅ **Alice logs in:**
- Dashboard shows: "Alice Corp"
- Entity switcher dropdown: Only shows "Alice Corp"
- Cannot see "Bob Personal"

✅ **Bob logs in:**
- Dashboard shows: "Bob Personal"
- Entity switcher dropdown: Only shows "Bob Personal"
- Cannot see "Alice Corp"

---

### Test 2: Account Isolation
**Expected:** Users only see accounts for their entities

✅ **Alice's Accounts Page:**
- Shows: "Alice Bank - VCB" (10,000,000 VND)
- Does NOT show: "Bob Cash"
- Total accounts: 1

✅ **Bob's Accounts Page:**
- Shows: "Bob Cash" (5,000,000 VND)
- Does NOT show: "Alice Bank - VCB"
- Total accounts: 1

---

### Test 3: Transaction Isolation
**Expected:** Users only see transactions for their accounts

✅ **Alice's Transactions Page:**
- Shows: Office rent transaction (-500,000 VND)
- Does NOT show: Bob's freelance income
- Balance reflects: 9,500,000 VND

✅ **Bob's Transactions Page:**
- Shows: Freelance income transaction (+200,000 VND)
- Does NOT show: Alice's office rent
- Balance reflects: 5,200,000 VND

---

### Test 4: Cross-Entity Transfer Prevention
**Expected:** Cannot transfer between different entities (enforced at DB level)

❌ **Attempt (should FAIL):**
```sql
-- Even if someone tries via SQL directly:
INSERT INTO transfers (transfer_out_main_id, transfer_in_main_id)
VALUES (
  (SELECT id FROM main_transaction WHERE entity_id = 'alice-corp'),
  (SELECT id FROM main_transaction WHERE entity_id = 'bob-personal')
);
```

**Result:** `ERROR: Cannot transfer between different entities`

---

### Test 5: Entity Switching (Multi-Entity User)
**Setup:** Manually add Bob to Alice's entity as 'viewer' role

```sql
-- In Supabase SQL Editor:
INSERT INTO entity_users (entity_id, user_id, role, created_by_user_id)
VALUES (
  (SELECT id FROM entities WHERE name = 'Alice Corp'),
  (SELECT id FROM auth.users WHERE email = 'bob@example.com'),
  'viewer',
  (SELECT id FROM auth.users WHERE email = 'alice@example.com')
);
```

✅ **Bob logs in again:**
- Entity switcher dropdown: Shows BOTH "Bob Personal" AND "Alice Corp"
- Can switch between entities
- When viewing "Alice Corp": Shows Alice's accounts but with 'viewer' role badge
- When viewing "Bob Personal": Shows Bob's accounts with 'owner' role badge

---

### Test 6: Role-Based Permissions
**Expected:** Viewer can see but not modify

✅ **Bob viewing "Alice Corp" (as viewer):**
- ✅ Can see accounts
- ✅ Can see transactions
- ❌ Cannot create new accounts (enforced by RLS INSERT policy)
- ❌ Cannot delete transactions (enforced by RLS DELETE policy)

---

### Test 7: URL Manipulation Attack
**Expected:** Cannot access data by guessing UUIDs

❌ **Attempt (should show nothing):**
1. Bob copies Alice's entity UUID from browser DevTools
2. Bob manually types URL: `/api/accounts?entity_id=alice-corp-uuid`
3. **Result:** Empty response or 403 error (RLS blocks it)

---

## Database-Level Security Verification

### Check RLS Policies Active
```sql
-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'entities', 'entity_users', 'original_transaction', 'main_transaction');
```
**Expected:** All show `rowsecurity = true`

### Check Entity Access Function
```sql
-- Test the security function
SELECT user_has_entity_access('alice-corp-uuid');
-- When run by Alice: returns TRUE
-- When run by Bob: returns FALSE (unless he's added to the entity)
```

---

## Summary: What Makes This a True Multi-Tenant SaaS

✅ **1. Complete Data Isolation**
- Users ONLY see entities they have explicit access to
- No way to access other users' data (even via API manipulation)

✅ **2. Multi-Entity Support**
- Users can belong to multiple entities with different roles
- Easy switching between entities via sidebar

✅ **3. Role-Based Access Control**
- Owner, Admin, Editor, Viewer roles enforced at database level
- Different permissions for read/write operations

✅ **4. Secure by Design**
- Row Level Security enforced at PostgreSQL level
- Cannot be bypassed by client-side code
- Cross-entity operations blocked by database triggers

✅ **5. Scalable Architecture**
- Single shared database (not separate DB per tenant)
- Efficient queries with entity_id indexing
- Can support thousands of entities

---

## Ready for Production?

**Current Status:** ✅ Ready for multi-tenant use!

**Remaining TODOs for full production:**
- [ ] Team management UI (invite users to entities)
- [ ] Subscription/billing per entity
- [ ] Audit logs (who did what, when)
- [ ] Entity settings page (rename, transfer ownership, delete)
- [ ] Email notifications for invites
- [ ] Advanced reporting per entity

**But the core multi-tenant security is COMPLETE!** 🎉
