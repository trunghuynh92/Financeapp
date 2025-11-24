# Migration 075: Receipts Table Setup

## How to Run This Migration

### Option 1: Via Supabase Dashboard (Recommended for now)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/mflyrbzriksgjutlalkf
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire content of `075_create_receipts_table.sql`
5. Paste into the SQL Editor
6. Click **Run** or press `Ctrl/Cmd + Enter`

### Option 2: Via Script (Requires Service Role Key)

1. Get your service_role key from Supabase Dashboard → Project Settings → API
2. Add to `.env.local`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
3. Run the migration script:
   ```bash
   npx tsx scripts/run-receipt-migration.ts
   ```

## What This Migration Does

✅ Creates `receipts` table with:
- File storage metadata (URL, path, size, type)
- OCR extraction fields (merchant, date, amount, items)
- Processing status tracking
- Links to transactions, accounts, and entities

✅ Sets up Supabase Storage:
- Creates `receipts` bucket (private, 10MB limit)
- Configures allowed MIME types (JPEG, PNG, PDF)

✅ Implements Row Level Security:
- Users can only access receipts from their entities
- Separate policies for SELECT, INSERT, UPDATE, DELETE
- Storage bucket policies match table RLS

✅ Adds indexes for performance:
- Transaction, account, entity lookups
- Processing status filtering
- Created date sorting

## Verification

After running the migration, verify:

```sql
-- Check table exists
SELECT COUNT(*) FROM receipts;

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'receipts';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'receipts';
```

## Rollback (if needed)

```sql
-- Drop table and related objects
DROP TABLE IF EXISTS receipts CASCADE;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'receipts';
```

## Next Steps

After migration completes:
1. ✅ Verify storage bucket in Dashboard
2. ⏭️ Create upload API endpoint
3. ⏭️ Build receipt upload UI component
4. ⏭️ Set up Google Cloud Vision for OCR
