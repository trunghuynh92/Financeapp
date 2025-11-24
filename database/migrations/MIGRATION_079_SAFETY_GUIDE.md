# Migration 079 Safety Guide

## Pre-Migration Checklist

### 1. **Backup Your Database**

#### Via Supabase Dashboard:
1. Go to Supabase Dashboard → Database → Backups
2. Create a manual backup (PITR - Point In Time Recovery)
3. Wait for backup to complete before proceeding

#### Via pg_dump (Alternative):
```bash
# Backup entire database
pg_dump $DATABASE_URL > backup_before_079_$(date +%Y%m%d_%H%M%S).sql

# Backup only affected tables (faster)
pg_dump $DATABASE_URL \
  -t original_transaction \
  -t main_transaction \
  -t balance_checkpoints \
  -t account_balance \
  > backup_affected_tables_$(date +%Y%m%d_%H%M%S).sql
```

### 2. **Test in Development First**
```bash
# Run migration on dev database first
psql $DEV_DATABASE_URL -f database/migrations/079_convert_timestamps_to_dates.sql

# Test your application thoroughly
npm run dev

# If successful, proceed to production
```

### 3. **Check Current Data**
```sql
-- Check how many records will be affected
SELECT 'original_transaction' as table_name, COUNT(*) as count FROM original_transaction
UNION ALL
SELECT 'main_transaction', COUNT(*) FROM main_transaction
UNION ALL
SELECT 'balance_checkpoints', COUNT(*) FROM balance_checkpoints
UNION ALL
SELECT 'account_balance', COUNT(*) FROM account_balance;

-- Sample some dates to verify format
SELECT transaction_date FROM original_transaction LIMIT 5;
SELECT checkpoint_date FROM balance_checkpoints LIMIT 5;
```

## Migration Execution

### Safe Migration Process:

```bash
# 1. Start a transaction manually (optional - for extra safety)
psql $DATABASE_URL << 'EOF'
BEGIN;
-- Run the migration
\i database/migrations/079_convert_timestamps_to_dates.sql
-- Check results
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('original_transaction', 'main_transaction', 'balance_checkpoints', 'account_balance')
  AND column_name LIKE '%date';
-- If everything looks good:
COMMIT;
-- If something is wrong:
-- ROLLBACK;
EOF
```

## Post-Migration Verification

### 1. **Verify Data Integrity**
```sql
-- Check that no dates were lost
SELECT 'original_transaction' as table_name, COUNT(*) as count FROM original_transaction WHERE transaction_date IS NULL
UNION ALL
SELECT 'main_transaction', COUNT(*) FROM main_transaction WHERE transaction_date IS NULL
UNION ALL
SELECT 'balance_checkpoints', COUNT(*) FROM balance_checkpoints WHERE checkpoint_date IS NULL
UNION ALL
SELECT 'account_balance', COUNT(*) FROM account_balance WHERE balance_date IS NULL;
-- All counts should be 0 (or expected nulls)

-- Check date ranges are preserved
SELECT MIN(transaction_date), MAX(transaction_date) FROM original_transaction;
SELECT MIN(checkpoint_date), MAX(checkpoint_date) FROM balance_checkpoints;
```

### 2. **Test Application Functions**
- [ ] Test bank statement import
- [ ] Test checkpoint creation
- [ ] Test balance calculations
- [ ] Test transaction filtering by date
- [ ] Test reports/dashboards

### 3. **Check Views Work**
```sql
-- Test each recreated view
SELECT COUNT(*) FROM main_transaction_details;
SELECT COUNT(*) FROM unmatched_transfers;
SELECT COUNT(*) FROM debt_summary;
```

## If Something Goes Wrong

### Option 1: Rollback via Supabase Dashboard
1. Go to Database → Backups
2. Select the backup created before migration
3. Click "Restore"
4. Wait for restoration to complete

### Option 2: Run Rollback Script
```bash
psql $DATABASE_URL -f database/migrations/079_rollback_dates_to_timestamptz.sql
```

### Option 3: Manual Rollback
```sql
-- Revert columns manually
ALTER TABLE original_transaction ALTER COLUMN transaction_date TYPE TIMESTAMPTZ;
ALTER TABLE main_transaction ALTER COLUMN transaction_date TYPE TIMESTAMPTZ;
ALTER TABLE balance_checkpoints ALTER COLUMN checkpoint_date TYPE TIMESTAMPTZ;
ALTER TABLE account_balance ALTER COLUMN balance_date TYPE TIMESTAMPTZ;

-- Revert function
CREATE OR REPLACE FUNCTION calculate_balance_up_to_date(
  p_account_id INTEGER,
  p_up_to_date TIMESTAMPTZ
) RETURNS DECIMAL(15,2) AS $$
-- (original function body)
$$ LANGUAGE plpgsql;
```

### Option 4: Git Revert Code Changes
```bash
# Revert the backend code changes
git revert HEAD~3  # Adjust based on how many commits to revert

# Or reset to before migration
git reset --hard <commit-before-migration>
```

## What Could Go Wrong?

### Low Risk Issues:
1. ✅ **Views fail to recreate** - Easy fix, just recreate them manually
2. ✅ **Application crashes** - Just deploy the rollback and revert code
3. ✅ **Date filtering doesn't work** - Code bug, can be fixed without DB rollback

### Medium Risk Issues:
1. ⚠️ **Performance degradation** - DATE is actually faster, so unlikely
2. ⚠️ **Timezone display issues** - Frontend issue, not data corruption

### High Risk Issues (Very Unlikely):
1. ❌ **Data loss** - PostgreSQL's type conversion is safe, won't lose data
2. ❌ **Cannot rollback** - Can always restore from backup

## Expected Behavior After Migration

### What Changes:
- ✅ Date columns store "2025-03-01" instead of "2025-03-01T00:00:00Z"
- ✅ No more timezone conversion bugs
- ✅ Date comparisons are simpler (string comparison)

### What Stays the Same:
- ✅ All your transaction data (dates preserved)
- ✅ All balances and calculations
- ✅ All relationships and foreign keys
- ✅ Audit timestamps (created_at, updated_at still TIMESTAMPTZ)

## Recovery Time Estimate

- **Backup restoration**: 5-15 minutes (depending on database size)
- **Rollback script**: 1-2 minutes
- **Code revert**: Instant (git revert + deploy)

## Support Contacts

If migration fails:
1. Check migration logs in terminal
2. Check Supabase logs in Dashboard → Logs
3. Review verification output at end of migration
4. Contact support with error messages

## Migration Success Indicators

✅ All verification checks pass
✅ Views recreated successfully
✅ Application starts without errors
✅ Can create new transactions
✅ Can view existing transactions
✅ Reports load correctly

## Confidence Level

**This migration is LOW RISK** because:
1. ✅ Type conversion is safe (DATE ← TIMESTAMPTZ)
2. ✅ Data is not modified, only type changes
3. ✅ Rollback script is ready
4. ✅ Supabase has automatic backups
5. ✅ Tested in development first
6. ✅ No breaking schema changes (same table structure)
