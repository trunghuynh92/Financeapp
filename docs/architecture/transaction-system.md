# Main Transaction System - Feature Documentation

## 🎯 Goal for Version 2.0

**Transform the finance app from a basic transaction tracker into a comprehensive business intelligence tool** by adding a categorization and analysis layer on top of raw imported transactions.

### Key Objectives:
1. **Preserve Data Integrity** - Keep `original_transaction` as immutable source of truth
2. **Enable Business Analysis** - Categorize, split, and tag transactions for reporting
3. **Multi-entity Support** - Handle both business and personal transactions
4. **Transfer Matching** - Link transfers between accounts to avoid double-counting
5. **Flexible Splitting** - Break single transactions into multiple categories/branches

---

## 🏗️ System Architecture

### Two-Layer Design

```
┌─────────────────────────────────┐
│   original_transaction          │  ← Immutable source (bank imports)
│   - Raw bank data               │
│   - Used for reconciliation     │
└─────────────────────────────────┘
              ↓ (1:N relationship)
┌─────────────────────────────────┐
│   main_transaction              │  ← Working layer (categorization)
│   - Transaction types           │
│   - Categories & branches       │
│   - Split support               │
│   - Transfer matching           │
└─────────────────────────────────┘
```

### Database Tables Created

| Table | Purpose | Status |
|-------|---------|--------|
| `transaction_types` | 7 types: Income, Expense, Transfer, Debt, Investment | ✅ Created, Seeded |
| `categories` | 50+ hierarchical categories for business & personal | ✅ Created, Seeded |
| `branches` | Store/location tracking tied to entities | ✅ Created |
| `main_transaction` | Working layer with categorization & splits | ✅ Created, Backfilled (510 records) |

---

## ✅ Completed Work

### Phase 1: Database Schema & Foundation ✅

#### 1.1 Core Tables
- [x] **transaction_types** table with 7 pre-seeded types
  - Income, Expense, Transfer Out, Transfer In, Debt Acquired, Debt Payback, Investment
- [x] **categories** table with 50+ pre-seeded categories
  - Business: COGS, OPEX, Salaries, Marketing, etc.
  - Personal: Food, Transportation, Healthcare, Entertainment, etc.
  - Hierarchical structure (parent_category_id)
  - Entity type filtering (business/personal/both)
- [x] **branches** table for store/location tracking
- [x] **main_transaction** table with full feature set
  - Link to original_transaction (1:N)
  - Transaction type, category, branch
  - Amount (always positive) + direction (debit/credit)
  - Split tracking (is_split, split_sequence)
  - Transfer matching (transfer_matched_transaction_id)
  - Notes and editable description

#### 1.2 Data Integrity & Automation
- [x] Split validation trigger (amounts must sum to original)
- [x] Transfer matching validation (OUT must match IN)
- [x] Auto-create trigger (new originals → auto-create main)
- [x] Optimized backfill function (batch INSERT)
- [x] Fixed recursive trigger issue

#### 1.3 Views & Helper Functions
- [x] `unmatched_transfers` view - for transfer matching UI
- [x] `main_transaction_details` view - full joined data for reports
- [x] `get_unprocessed_originals()` function - health check
- [x] `backfill_main_transactions()` function - batch processing

#### 1.4 API Endpoints
- [x] `/api/admin/main-transactions/backfill` (GET/POST)
  - Check for unprocessed originals
  - Batch-create main_transactions

#### 1.5 TypeScript Types
- [x] Complete type definitions in `types/main-transaction.ts`
  - Core types (TransactionType, Category, Branch, MainTransaction)
  - Extended types with joins (MainTransactionDetails, UnmatchedTransfer)
  - Request/Response types
  - Utility types

### Phase 2: Data Migration ✅
- [x] Successfully backfilled 510 existing original_transaction records
- [x] All records have default types (Expense for debit, Income for credit)
- [x] Verified counts: 510 original = 510 main ✅

---

## 📋 To-Do List

### Phase 3: Core CRUD API Endpoints 🚧 (Next Priority)

#### 3.1 Main Transaction Management
- [ ] `GET /api/main-transactions` - List main transactions with filters
  - Query params: account_id, transaction_type, category, branch, date range, search
  - Pagination support
  - Include joined data (account, type, category, branch)
- [ ] `GET /api/main-transactions/[id]` - Get single transaction details
- [ ] `PATCH /api/main-transactions/[id]` - Update transaction
  - Update type, category, branch, description, notes
  - Cannot update amount, date, or raw_transaction_id
- [ ] `DELETE /api/main-transactions/[id]` - Delete transaction
  - Only allow if not part of a split (or delete entire split group)

#### 3.2 Transaction Splitting
- [ ] `POST /api/main-transactions/[id]/split` - Split a transaction
  - Validate: splits sum to original amount
  - Delete old main_transaction
  - Create multiple new main_transactions with split_sequence
  - Set is_split = true for all
- [ ] `GET /api/main-transactions/splits/[raw_id]` - Get all splits for an original
- [ ] `DELETE /api/main-transactions/splits/[raw_id]` - Delete entire split group
  - Recreate single unsplit transaction

#### 3.3 Transfer Matching
- [ ] `GET /api/transfers/unmatched` - List unmatched transfers
  - Filter by date range, account, amount range
- [ ] `POST /api/transfers/match` - Match two transfers
  - Validate: one TRF_OUT + one TRF_IN
  - Set transfer_matched_transaction_id on both sides
- [ ] `DELETE /api/transfers/match/[id]` - Unmatch a transfer
  - Clear transfer_matched_transaction_id

#### 3.4 Categories & Types
- [ ] `GET /api/transaction-types` - List all transaction types
- [ ] `GET /api/categories` - List categories (with hierarchy)
  - Filter by transaction_type_id, entity_type
- [ ] `POST /api/categories` - Create custom category
- [ ] `PATCH /api/categories/[id]` - Update category
- [ ] `DELETE /api/categories/[id]` - Soft delete (set is_active = false)

#### 3.5 Branches
- [ ] `GET /api/branches` - List all branches
  - Filter by entity_id, is_active
- [ ] `POST /api/branches` - Create branch
- [ ] `PATCH /api/branches/[id]` - Update branch
- [ ] `DELETE /api/branches/[id]` - Soft delete

### Phase 4: User Interface 🔜

#### 4.1 Main Transactions Page
- [ ] `/dashboard/main-transactions` - List view
  - Table with: Date, Description, Type, Category, Branch, Amount, Direction
  - Filters: Account, Type, Category, Branch, Date range
  - Pagination (50/100/200 per page)
  - Search by description
  - Badge indicators (split, transfer matched, unmatched transfer)
  - Quick actions: Edit, Split, Delete

#### 4.2 Edit Transaction Dialog
- [ ] Click transaction → Open dialog
  - Transaction Type selector (Income, Expense, etc.)
  - Category dropdown (filtered by type and entity)
  - Branch dropdown (optional)
  - Description (editable)
  - Notes textarea
  - Display original data (read-only): Date, Amount, Direction, Account
  - Save/Cancel buttons
  - Validation feedback

#### 4.3 Split Transaction Dialog
- [ ] "Split" button → Open split dialog
  - Show original amount at top
  - Dynamic split rows:
    - Amount input
    - Type selector
    - Category dropdown
    - Branch dropdown (optional)
    - Description input
  - "+" button to add new split row
  - Last row shows remaining amount
  - Running total validation
  - "Confirm Split" / "Cancel" buttons
  - Warning if deleting existing split

#### 4.4 Transfer Matching Page
- [ ] `/dashboard/transfers/matching` - Matching view
  - Two-column layout: Transfer Out | Transfer In
  - Filters: Date range, Account, Amount range
  - Click OUT transaction → highlight potential IN matches
  - "Match" button → link transfers
  - "Unmatch" button on matched transfers
  - Visual indicators (matched ✓, unmatched ⚠️)

#### 4.5 Categories Management Page
- [ ] `/dashboard/settings/categories` - CRUD view
  - Tree view of category hierarchy
  - Group by transaction type
  - Filter by entity type (business/personal/both)
  - Add/Edit/Delete categories
  - Drag-and-drop reordering
  - Show usage count (# transactions using category)

#### 4.6 Branches Management Page
- [ ] `/dashboard/settings/branches` - CRUD view
  - Table of branches by entity
  - Add/Edit/Delete branches
  - Show usage count
  - Active/Inactive toggle

### Phase 5: Enhanced Features 🔮 (Future)

#### 5.1 Bulk Operations
- [ ] Bulk categorization (select multiple → assign category)
- [ ] Bulk branch assignment
- [ ] Bulk type assignment
- [ ] Auto-categorization rules (description patterns → category)

#### 5.2 Import Enhancements
- [ ] Import wizard step: "Review & Categorize"
  - Show imported transactions before finalizing
  - Quick-assign categories during import
  - Auto-suggest categories based on description

#### 5.3 Reports & Analytics
- [ ] Income Statement (by category)
- [ ] Expense Breakdown (by category/branch)
- [ ] Cash Flow Report (with transfer handling)
- [ ] Trend Analysis (category spending over time)
- [ ] Branch Performance (revenue/expenses by location)

#### 5.4 Advanced Features
- [ ] Recurring transaction templates
- [ ] Budget tracking (by category)
- [ ] Alerts (unusual spending, budget exceeded)
- [ ] Export to Excel/PDF with categorization
- [ ] Multi-currency support

---

## 🗂️ File Structure

```
/Users/trunghuynh/Documents/finance-saas/Financeapp/
├── migrations/
│   ├── 006_main_transaction_system.sql          ✅ Core tables & seed data
│   ├── 007_auto_create_main_transaction.sql     ✅ Auto-create trigger
│   ├── 008_optimized_backfill.sql               ✅ Batch INSERT backfill
│   └── 009_fix_recursive_trigger.sql            ✅ Fixed validation trigger
├── app/api/
│   └── admin/main-transactions/backfill/
│       └── route.ts                             ✅ Backfill API
├── types/
│   └── main-transaction.ts                      ✅ TypeScript types
└── MAIN_TRANSACTION_SYSTEM.md                   ✅ This file
```

---

## 🚀 What to Do Next

### Immediate Next Steps (Recommended Order):

1. **Phase 3.1** - Build main transaction listing API
   - Start with `GET /api/main-transactions` with filters
   - This unblocks UI development

2. **Phase 4.1** - Build main transactions page UI
   - Create list view with table
   - Add filters and search
   - Test with existing 510 records

3. **Phase 3.2** - Build edit transaction API
   - `PATCH /api/main-transactions/[id]`
   - Enable type, category, branch updates

4. **Phase 4.2** - Build edit transaction dialog
   - Allow users to categorize transactions
   - Test categorization workflow

5. **Phase 3.3 & 4.3** - Build split functionality
   - API endpoint for splitting
   - UI dialog for split creation
   - Test split validation

6. **Phase 3.4 & 4.4** - Build transfer matching
   - List unmatched transfers
   - UI for matching transfers
   - Test matching validation

---

## 📊 Current Status

| Component | Status | Records |
|-----------|--------|---------|
| Database Schema | ✅ Complete | - |
| Transaction Types | ✅ Seeded | 7 types |
| Categories | ✅ Seeded | 50+ categories |
| Branches | ✅ Ready | 0 (create via UI) |
| Main Transactions | ✅ Backfilled | 510 records |
| API Endpoints | 🚧 1/15 complete | Backfill only |
| UI Pages | ⏸️ Not started | 0/6 pages |

**Overall Progress: ~25% Complete**

---

## 🔗 Related Documentation

- [Main Schema Documentation](./SUPABASE_SCHEMA.sql)
- [Checkpoint System Guide](./CHECKPOINT_FIX_SUMMARY.md)
- [Import System Documentation](./types/import.ts)

---

## 🐛 Known Issues & Limitations

### Current Limitations:
1. **No UI yet** - All categorization must be done via SQL
2. **Default types only** - All transactions default to Income/Expense based on direction
3. **No categories assigned** - All category_id and branch_id are NULL
4. **No transfer matching** - All transfers are unmatched

### Performance Considerations:
- ✅ Optimized batch INSERT for backfill (510 records in <1 second)
- ✅ Indexes on common query columns (account_id, date, type, category, branch)
- ⚠️ May need composite indexes for complex filtered queries (to be determined during Phase 4)

---

## 📝 Notes

### Design Decisions:

1. **Amount always positive + direction field**
   - Simplifies split calculations
   - Direction preserved for filtering/display
   - User thinks in absolute values ("spent 600", not "-600")

2. **Separate Transfer Out/In types**
   - Clear user intent
   - Easy to find unmatched transfers
   - Supports transfer matching validation

3. **Soft deletes for categories/branches**
   - Preserve historical data integrity
   - Use `is_active` flag instead of DELETE

4. **Split validation at database level**
   - Cannot save invalid splits
   - Prevents data corruption
   - Enforced by trigger

5. **Auto-create via trigger**
   - Future-proof: all new originals get main automatically
   - Backfill handles existing data
   - No manual maintenance needed

---

**Last Updated:** 2025-01-07
**Version:** 2.0.0-alpha
**Status:** Foundation Complete, API & UI In Progress
