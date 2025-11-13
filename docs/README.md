# Documentation

Welcome to the Finance SaaS documentation! This directory contains all project documentation organized by category.

## Directory Structure

```
docs/
├── features/        # Feature implementation documentation
├── architecture/    # System architecture and design
├── guides/          # How-to guides and tutorials
├── fixes/           # Bug fixes and patches documentation
└── migrations/      # Database migration notes
```

## 📚 Features

Documentation for major features and their implementations:

- **[Authentication](features/auth-implementation.md)** - User authentication system
- **[Bank Import](features/bank-import.md)** - Import transactions from bank files
- **[Cash Flow](features/cash-flow.md)** - Cash flow reporting and analysis
- **[Credit Cards](features/credit-cards.md)** - Credit card transaction mechanics
- **[Entity Switcher](features/entity-switcher.md)** - Multi-entity management
- **[Import Rollback](features/import-rollback.md)** - Undo imported transactions
- **[Loan Receivables](features/loan-receivables.md)** - Loan tracking system
- **[Import Rollback Testing](features/import-rollback-testing.md)** - Testing guide for rollback feature

## 🏗️ Architecture

System design and architectural documentation:

- **[System Overview](architecture/system-overview.md)** - High-level system architecture
- **[Checkpoint System](architecture/checkpoint-system.md)** - Balance checkpoint mechanism
- **[Checkpoint Integration](architecture/checkpoint-integration.md)** - How checkpoints integrate with imports
- **[Balance Terms](architecture/balance-terms.md)** - Balance calculation terminology
- **[Transaction System](architecture/transaction-system.md)** - Main transaction architecture
- **[Database Schema](architecture/database-schema.md)** - Database structure and relationships

## 📖 Guides

Step-by-step guides for developers:

- **[Checkpoint Debugging](guides/checkpoint-debugging.md)** - Debug checkpoint issues
- **[Multi-Tenant Testing](guides/multi-tenant-testing.md)** - Test multi-tenant features
- **[Week 2 Setup](guides/week-2-setup.md)** - Development setup guide

## 🔧 Fixes

Documentation of bug fixes and patches:

- **[Automatic Recalculation](fixes/automatic-recalculation.md)** - Fix for auto-recalc issues
- **[Checkpoint Fix](fixes/checkpoint-fix.md)** - Checkpoint system fixes
- **[Checkpoint Import Batch](fixes/checkpoint-import-batch.md)** - Import batch linking fix
- **[Checkpoint Integration](fixes/checkpoint-integration-complete.md)** - Integration completion notes
- **[Checkpoint UX](fixes/checkpoint-ux.md)** - UX improvements for checkpoints
- **[RLS Fix](fixes/rls-fix.md)** - Row Level Security fixes
- **[Security Fix 024](fixes/security-fix-024.md)** - Critical security patch
- **[Descending Order Fix](fixes/descending-order-fix.md)** - Transaction ordering fix
- **[Transaction Source Fix](fixes/transaction-source-fix.md)** - Transaction source tracking fix

## 🗄️ Migrations

Database migration documentation:

- **[Migration Instructions](migrations/migration-instructions.md)** - How to run migrations
- **[Migration 022 Corrected](migrations/migration-022-corrected.md)** - Corrected version of migration 022
- **[Migration 022 Ready](migrations/migration-022-ready.md)** - Migration 022 preparation notes

## 🔗 Related Documentation

- [Database Documentation](../database/README.md) - Database migrations and schema
- [Main README](../README.md) - Project overview

## 📝 Contributing to Documentation

When adding new documentation:

1. **Choose the right category**: Place docs in the appropriate subdirectory
2. **Use descriptive names**: Files should be kebab-case (e.g., `feature-name.md`)
3. **Add to this index**: Update this README with a link to your new doc
4. **Include context**: Add date, author, or related migration numbers where relevant
5. **Keep it current**: Update docs when features change

## 🔍 Finding Documentation

- **Looking for a feature?** → Check `features/`
- **Understanding the system?** → Check `architecture/`
- **Need to debug?** → Check `guides/`
- **Investigating a bug?** → Check `fixes/`
- **Running migrations?** → Check `migrations/` and `../database/README.md`

## 💡 Tips

- Use your IDE's search to find keywords across all docs
- Most docs include implementation dates and context
- Check git history for additional context on changes
- Cross-reference with database migrations for schema changes
