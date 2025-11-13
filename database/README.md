# Database Organization

This directory contains all database-related files organized for easy navigation and maintenance.

## Directory Structure

```
database/
├── migrations/           # Numbered SQL migrations (001-047+)
├── schema/               # Initial schema and reference files
├── scripts/
│   ├── diagnostics/      # Troubleshooting and analysis scripts
│   ├── maintenance/      # One-time fixes and verification scripts
│   └── utilities/        # Helper scripts for development
└── archive/              # Deprecated or historical scripts
```

## Migrations

All database migrations are numbered sequentially and should be applied in order. Migration files follow the naming convention: `###_description.sql`

### Migration History

- **001-004**: Initial transaction features and balance tracking
- **005-014**: Balance checkpoint system and transaction sequencing
- **015-021**: Debt/loan management system (drawdowns, receivables, payback)
- **022-034**: Multi-user authentication and Row Level Security (RLS) fixes
- **035-036**: Editor permission improvements
- **037-040**: Loan receivable system and business partners
- **041-043**: Transfer matching and drawdown balance fixes
- **044-047**: Credit card charge and payment types

### Applying Migrations

Migrations should be applied in numerical order. Use Supabase CLI or your preferred migration tool:

```bash
# Example with Supabase CLI
supabase db push

# Or apply individually
psql -f database/migrations/001_add_missing_transaction_features.sql
```

**Important**: Never skip migrations or apply them out of order, as they may have dependencies on previous schema changes.

## Schema Files

- **initial-schema.sql**: The original database schema (account-based)
- **seed-data.sql**: Initial seed data for testing
- **full-schema.sql**: Complete current schema export from Supabase

## Scripts

### Diagnostics

Scripts for troubleshooting issues:

- `check-amount-mismatch.sql`: Verify transaction amounts match across tables
- `check-main-transaction.sql`: Validate main transaction integrity
- `check-split-transactions.sql`: Verify split transaction consistency
- `diagnostic-balance-issue.sql`: Troubleshoot balance calculation issues
- `transaction-examples.sql`: Sample queries for transaction analysis

### Maintenance

One-time scripts for data fixes:

- `fix-existing-checkpoints.sql`: Repair checkpoint data
- `verify-checkpoint-system.sql`: Validate checkpoint system integrity
- `verification-queries.sql`: General verification queries

### Utilities

Development and management helpers:

- `check-migration-status.sql`: View applied migrations
- `check-rls-policies.sql`: Inspect Row Level Security policies
- `cleanup-failed-rollback.sql`: Clean up after failed rollbacks
- `export-schema.sql`: Export current schema
- `find-orphaned-main-transactions.sql`: Find transactions without proper links

## Archive

Deprecated scripts kept for reference:

- `rollback-transaction-tables.sql`: Historical rollback script (deprecated)

## Best Practices

1. **Always backup before migrations**: Create a database snapshot before applying new migrations
2. **Test migrations locally first**: Apply to development environment before production
3. **Never edit applied migrations**: Create a new migration to modify previous changes
4. **Document complex migrations**: Add comments explaining non-obvious changes
5. **Keep migrations atomic**: Each migration should do one logical thing
6. **Use transactions**: Wrap migrations in BEGIN/COMMIT blocks where appropriate

## Creating New Migrations

When creating a new migration:

1. Use the next available number: `###_descriptive_name.sql`
2. Include a header comment describing the change
3. Add both UP and DOWN (rollback) logic if possible
4. Test thoroughly before committing

Example template:

```sql
-- Migration: ###_description
-- Purpose: Brief description of what this migration does
-- Date: YYYY-MM-DD

BEGIN;

-- Your changes here

COMMIT;
```

## Troubleshooting

If you encounter issues:

1. Check `diagnostics/` scripts for relevant queries
2. Verify migration status with `utilities/check-migration-status.sql`
3. Review RLS policies with `utilities/check-rls-policies.sql`
4. Check for orphaned data with relevant utility scripts

## Questions?

For questions about specific migrations or database structure, refer to:
- Migration comments within each SQL file
- Git history for context on when/why changes were made
- Team documentation or Slack channels
