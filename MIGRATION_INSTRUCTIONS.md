# Cash Flow Type Migration - Next Steps

## ✅ Completed
1. Created migration SQL file: `supabase/migrations/20250112_add_cash_flow_type.sql`
2. Updated CategoriesManager UI with Cash Flow Type dropdown
3. Updated API endpoints to accept `cash_flow_type` field
4. Added Cash Flow Type to create category dialog

## 🔴 Required: Apply Database Migration

**You need to run the SQL migration to add the `cash_flow_type` column to your database.**

### Option 1: Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of `supabase/migrations/20250112_add_cash_flow_type.sql`
4. Paste and execute the SQL

### Option 2: Supabase CLI
```bash
cd /Users/trunghuynh/Documents/finance-saas/Financeapp
supabase db push
```

## What the Migration Does

1. **Adds column**: `cash_flow_type VARCHAR(20)` to `categories` table
   - Allowed values: 'operating', 'investing', 'financing', 'none', or NULL
   - Has check constraint for data validation

2. **Sets default values** for common template categories:
   - **Operating**: Sales Revenue, Salary, Rent, Utilities, etc. (day-to-day business)
   - **Financing**: Loan Payment, Owner Investment, etc. (loans/equity)
   - **Investing**: Equipment Purchase, Property Purchase, etc. (long-term assets)
   - **None**: Transfer, Internal Transfer (excluded from cash flow)

## After Migration

Once you've applied the migration:
1. Go to Settings → Categories
2. You'll see a new "Cash Flow Type" column
3. Template categories will have default classifications
4. You can edit Cash Flow Type for custom categories
5. All new categories can have Cash Flow Type set during creation

## What's Next

After the migration is complete, we can proceed to:
1. Create Cash Flow Statement API endpoint
2. Build Cash Flow report frontend page
