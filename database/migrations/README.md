# Database Migrations

## ⚠️ IMPORTANT: DO NOT Use Individual Migrations as Reference

**Migrations are historical records, NOT current state documentation.**

Individual migration files may contain:
- Obsolete table structures that were later changed
- Functions/triggers that were later dropped
- Constraints that were later modified
- Column types that were later converted

## Where to Find Current Schema

**ALWAYS refer to**: `database/schema/SCHEMA.md`

This is the **SINGLE SOURCE OF TRUTH** for the current database state.

## Migration Numbering

Migrations are numbered sequentially: `001`, `002`, `003`, etc.

Current migration: **086**

## How to Apply Migrations

### Via Supabase SQL Editor (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy migration file contents
3. Run the SQL
4. Update `SCHEMA.md` with changes

### Via CLI
```bash
PGPASSWORD="your-password" psql \
  "postgresql://postgres.mflyrbzriksgjutlalkf:your-password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  -f database/migrations/XXX_migration_name.sql
```

## After Running a Migration

**Always update** `database/schema/SCHEMA.md`:
1. Update migration number
2. Update "Last Updated" date
3. Update table count if tables added/removed
4. Add to "Key Changes" section
5. Update relevant table documentation

## Migration History

### Major Changes

**Migrations 079-086** (Nov 2025):
- **079**: Converted `transaction_date` from TIMESTAMPTZ → DATE (timezone bug fix)
- **081**: Cleanup all transactions for fresh import
- **082**: Fixed CASCADE DELETE on transaction tables
- **084**: Dropped `account_balances` table (use RPC instead)
- **085**: Dropped obsolete functions referencing account_balances
- **086**: Fixed duplicate RESTRICT constraint on debt_drawdown

**Migrations 001-078**: Initial schema and feature development

## Common Pitfalls

❌ **DON'T**: Search through migrations to understand current schema
✅ **DO**: Read `SCHEMA.md` for current state

❌ **DON'T**: Assume a migration file shows current table structure
✅ **DO**: Verify against `SCHEMA.md` or live database

❌ **DON'T**: Copy-paste from old migrations
✅ **DO**: Check current schema first, then write new migration

## Rollback Policy

**We DO NOT support automatic rollbacks.**

Migrations are forward-only. If a migration causes issues:
1. Write a new migration to fix the problem
2. Do NOT try to undo previous migrations
3. Update `SCHEMA.md` to reflect the fix

## Questions?

If you need to know:
- **Current table structure** → Check `SCHEMA.md`
- **Current constraints** → Check `SCHEMA.md` or query database
- **Why something changed** → Check migration file + git history
- **How to add new feature** → Read `SCHEMA.md`, write new migration
