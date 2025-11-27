# 🚀 READ FIRST BEFORE A NEW CODING SESSION

**For: Claude AI Assistant**
**Purpose: Onboard to this codebase efficiently at the start of each new session**

---

## 0. First Thing: Get Database Access

**Before doing anything**, read the Supabase credentials:

```bash
cat "docs/Connect to Supabase/Connect to Supabase.md"
```

This file contains:
- Database connection string
- Password

You'll need these to check current schema, run migrations, and verify database state.

---

## 1. Project Context

**Project Name**: Finance SaaS Application
**Tech Stack**: Next.js 14, TypeScript, Supabase (PostgreSQL), Tailwind CSS
**Purpose**: Multi-entity financial management system with transaction tracking, budgets, loans, contracts, and cash flow forecasting

**Current Status**:
- ✅ Production-ready core features
- ✅ Multi-user authentication with role-based access
- ✅ Bank import with Excel parsing
- ✅ Transaction categorization and matching
- ✅ Loan tracking (receivable & payable)
- ✅ Contract & scheduled payment management
- ✅ Budget & cash flow forecasting

---

## 2. CRITICAL: Read These Files First

**IN THIS ORDER** (5 minutes to read):

### 2.1 Database Schema (MOST IMPORTANT)
📄 **`docs/architecture/database-schema.md`**
- **This is the SINGLE SOURCE OF TRUTH** for current database structure
- Do NOT search through individual migration files (they contain outdated info)
- Current migration: 093
- Key: transaction_date is DATE (not TIMESTAMPTZ), account_balances table REMOVED

### 2.2 Architecture & Data Flow
📄 **`docs/CASHFLOW_SYSTEM_3.0.md`** (if working on cash flow features)
📄 **`docs/DATA_ENTRY_ROLE_SYSTEM.md`** (if working on permissions)

### 2.3 Recent Changes
📄 **`docs/SCHEMA_AUDIT_2025-11-25.md`**
- Complete CASCADE delete chain verified
- Date/timestamp handling fixed
- Entity deletion works with zero residue

---

## 3. Project Structure Quick Reference

```
Financeapp/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── accounts/            # Account management
│   │   ├── main-transactions/   # Transaction CRUD
│   │   ├── budgets/             # Budget management
│   │   ├── cash-flow-projection/ # Cash flow forecasting
│   │   └── ...
│   ├── dashboard/               # Protected pages
│   │   ├── accounts/
│   │   ├── main-transactions/
│   │   ├── budgets/
│   │   ├── cash-flow/
│   │   └── ...
│   └── (auth)/                  # Auth pages (signin, signup)
│
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   ├── main-transactions/       # Transaction-specific components
│   ├── budgets/                 # Budget components
│   └── ...
│
├── lib/                         # Utilities & helpers
│   ├── supabase.ts             # Supabase client (browser)
│   ├── supabase-server.ts      # Supabase client (server)
│   ├── cash-flow-analyzer.ts   # Cash flow calculation logic
│   ├── checkpoint-service.ts    # Balance checkpoint management
│   └── ...
│
├── database/
│   └── migrations/             # ⚠️ Historical only, not current state
│
├── docs/
│   └── architecture/
│       └── database-schema.md  # ⭐ READ THIS FIRST - Single source of truth
│
├── types/                       # TypeScript type definitions
│   ├── account.ts
│   ├── transaction.ts
│   └── ...
│
└── contexts/                    # React contexts
    └── EntityContext.tsx       # Current entity selection
```

---

## 4. Key Architectural Decisions

### 4.1 Database Design

**Two-Layer Transaction System**:
- `original_transaction` - Raw imported data (immutable)
- `main_transaction` - Categorized, split, matched transactions

**Balance Calculation**:
- ❌ NO account_balances table (removed in migration 084)
- ✅ Use `calculate_balance_up_to_date()` RPC function
- ✅ Balance checkpoints for auditing

**Date Handling** (CRITICAL):
- `transaction_date` is **DATE** type (not TIMESTAMPTZ)
- Use `toISODateString()` helper to avoid timezone bugs
- Audit timestamps use TIMESTAMPTZ

**Transaction Ordering**:
- Composite index: `(account_id, transaction_date, transaction_sequence)`
- `transaction_sequence` preserves within-day order

### 4.2 Multi-User Access Control

**Roles** (from highest to lowest):
1. **owner** - Full control, can delete entity
2. **admin** - Manage accounts, users, settings
3. **editor** - Create/edit/delete transactions
4. **data_entry** - Create/edit transactions (limited delete)
5. **viewer** - Read-only access

**Row-Level Security (RLS)**:
- All tables use Supabase RLS policies
- Access controlled via `entity_users` join table

### 4.3 Code Patterns

**API Routes**:
- Use `createSupabaseServerClient()` for server-side
- Use `createSupabaseClient()` for client-side
- Always check entity access via RLS

**Date Formatting**:
```typescript
// ❌ WRONG - causes timezone bugs
date.toISOString() // "2025-03-01T17:00:00.000Z" (shifts date!)

// ✅ CORRECT - use helper
toISODateString(date) // "2025-03-01"

function toISODateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

**Balance Calculation**:
```typescript
// ❌ WRONG - table removed
const { data } = await supabase.from('account_balances').select('*')

// ✅ CORRECT - use RPC
const { data } = await supabase.rpc('calculate_balance_up_to_date', {
  p_account_id: accountId,
  p_up_to_date: '2025-11-25'
})
```

---

## 5. Common Tasks & Where to Look

| Task | Files to Check |
|------|---------------|
| Add new transaction type | `database/schema/SCHEMA.md` → transaction_types table |
| Modify transaction flow | `app/api/main-transactions/route.ts` |
| Add new category | `app/api/categories/route.ts` |
| Change budget logic | `lib/cash-flow-analyzer.ts` |
| Fix import issues | `app/api/accounts/[id]/import/route.ts` |
| Add new user role | `types/roles.ts` + RLS policies |
| Modify balance calculation | `database/migrations/` (new migration) + RPC function |

---

## 6. Before Making Changes

### 6.1 Database Changes

**DO**:
1. Read `docs/architecture/database-schema.md` to understand current state
2. Create new migration file: `094_your_change.sql`
3. Test migration in Supabase SQL Editor
4. Update `docs/architecture/database-schema.md` with changes
5. Commit both migration + updated database-schema.md

**DON'T**:
- Don't search through old migrations for reference
- Don't assume migrations 001-078 are accurate
- Don't modify existing migration files

### 6.2 Code Changes

**DO**:
1. Check if there's an existing API route
2. Use TypeScript types from `types/` folder
3. Use existing components from `components/ui/`
4. Follow existing patterns (check similar features)
5. Test with dev server: `npm run dev`

**DON'T**:
- Don't use `account_balances` table (removed)
- Don't use `.toISOString()` for transaction dates
- Don't bypass RLS by querying directly
- Don't create new UI components if shadcn/ui has one

---

## 7. Environment Setup

### 7.1 Required Files
- `.env.local` - Supabase credentials
- Must contain: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 7.2 Database Connection

**Credentials are stored locally in**: `docs/Connect to Supabase/Connect to Supabase.md`

This file is **NOT tracked in git** (.gitignore) for security.

To connect to Supabase database:
```bash
# Read the credentials file first
cat "docs/Connect to Supabase/Connect to Supabase.md"

# Then use the connection string with password
PGPASSWORD="password-from-file" psql "postgresql://postgres.mflyrbzriksgjutlalkf:password-from-file@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

**Example queries**:
```bash
# List all tables
PGPASSWORD="..." psql "postgresql://..." -c "\dt"

# Describe a table
PGPASSWORD="..." psql "postgresql://..." -c "\d accounts"

# Run a query
PGPASSWORD="..." psql "postgresql://..." -c "SELECT count(*) FROM entities;"
```

### 7.3 Dev Server
```bash
npm run dev  # Runs on http://localhost:3000
```

---

## 8. Known Issues & Gotchas

### 8.1 Timezone Bugs (FIXED)
- **Problem**: Using `.toISOString()` shifts dates by timezone offset
- **Solution**: Use `toISODateString()` helper for business dates
- **Status**: Fixed in migration 079, helper added to import routes

### 8.2 Entity Deletion (FIXED)
- **Problem**: CASCADE constraints were RESTRICT, blocking deletion
- **Solution**: All fixed in migrations 082, 084, 085, 086
- **Status**: Entity deletion now works with ZERO residue

### 8.3 account_balances Table (REMOVED)
- **Problem**: Deprecated table still referenced in old code
- **Solution**: All references removed in migration 085
- **Status**: Use `calculate_balance_up_to_date()` RPC instead

### 8.4 Duplicate Foreign Keys
- **Known**: Some tables have duplicate FK constraints (non-critical)
- `projects.entity_id` - 2x CASCADE
- `main_transaction.account_id` - 2x CASCADE
- These are redundant but don't cause issues

---

## 9. Testing Checklist

Before committing:
- [ ] TypeScript builds without errors (`npx tsc --noEmit`)
- [ ] Dev server runs without errors
- [ ] If database changes: Migration tested in Supabase
- [ ] If database changes: SCHEMA.md updated
- [ ] If API changes: Test with Postman/curl
- [ ] If UI changes: Test in browser at localhost:3000

---

## 10. Git Workflow

```bash
# 1. Check status
git status

# 2. Stage changes
git add -A

# 3. Commit with descriptive message
git commit -m "feat: your feature description

- Detailed change 1
- Detailed change 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push to remote
git push
```

---

## 11. Quick Command Reference

```bash
# Database: Check current schema
PGPASSWORD="pwd" psql "postgresql://..." -c "\d tablename"

# Database: Run migration
PGPASSWORD="pwd" psql "postgresql://..." -f database/migrations/087_file.sql

# Dev: Start server
npm run dev

# Dev: Type check
npx tsc --noEmit

# Dev: Build for production
npm run build

# Git: See recent commits
git log --oneline -10
```

---

## 12. When You're Stuck

1. **Schema confusion** → Read `docs/architecture/database-schema.md`
2. **TypeScript errors** → Check `types/` folder for type definitions
3. **API not working** → Check RLS policies in Supabase dashboard
4. **Import failing** → Check `app/api/accounts/[id]/import/route.ts`
5. **Balance wrong** → Verify using `calculate_balance_up_to_date` RPC
6. **Date off by one** → Use `toISODateString()` helper

---

## 13. Summary: Start Every Session With

1. ✅ Read `docs/architecture/database-schema.md`
2. ✅ Check `docs/SCHEMA_AUDIT_2025-11-25.md` for recent changes
3. ✅ Review git log to see what changed recently: `git log --oneline -20`
4. ✅ Start dev server: `npm run dev`
5. ✅ Remember: DO NOT trust individual migration files for current state

**Time investment**: 5-10 minutes
**Payoff**: Avoid hours of debugging outdated assumptions

---

## 14. Contact

**Codebase Owner**: User (Trung Huynh)
**Last Updated**: 2025-11-25
**Claude Sessions**: Always read this file first

---

**Happy Coding! 🚀**
