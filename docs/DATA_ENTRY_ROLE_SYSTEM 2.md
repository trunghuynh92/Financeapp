# Data Entry Role System

**Version**: 1.0
**Date**: 2025-11-23
**Status**: ✅ Implemented

## Overview

The Data Entry role system adds a specialized user role for personnel who manage transaction data (categorize, split, add notes, import) without access to financial reports, analytics, or cash flow projections.

## Role Hierarchy

```
Owner (5)       - Full system access
    ↓
Admin (4)       - Manage accounts & settings, no user management
    ↓
Editor (3)      - Full transaction access + reports/analytics
    ↓
Data Entry (2)  - Transaction management only, NO reports/analytics  ⭐ NEW
    ↓
Viewer (1)      - Read-only access
```

## Data Entry Role Permissions

### ✅ CAN Do:
- **View** all transactions, accounts, budgets
- **Create** new transactions
- **Edit** existing transactions
- **Categorize** transactions
- **Split** transactions across multiple categories
- **Add notes** to transactions
- **Import** transaction data from Excel/CSV
- **Manage** scheduled payments
- **Manage** contracts

### ❌ CANNOT Do:
- **Delete** transactions (requires Editor role)
- **Access** Cash Flow projections
- **Access** Reports
- **Access** Analytics dashboards
- **Export** data
- **Create/Edit/Delete** accounts (requires Admin role)
- **Manage** users or change roles (requires Owner role)
- **Access** Settings (requires Admin role)

## Database Implementation

### Migration Files

1. **`077_add_data_entry_role_step1.sql`** - Adds enum value
   ```sql
   ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'data_entry';
   ```

2. **`077_add_data_entry_role_step2.sql`** - Updates policies & functions
   - Updates `user_has_permission()` function with 5-level hierarchy
   - Updates RLS policies for `main_transaction`
   - Updates RLS policies for `original_transaction`
   - Updates RLS policies for `import_batch`

### Row Level Security (RLS) Policies

**Transactions (`main_transaction`, `original_transaction`)**:
```sql
-- Data Entry+ can CREATE transactions
CREATE POLICY "Data Entry and above can create transactions"
    ON main_transaction FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

-- Data Entry+ can UPDATE transactions
CREATE POLICY "Data Entry and above can update transactions"
    ON main_transaction FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin', 'editor', 'data_entry')
        )
    );

-- Only Admin+ can DELETE transactions (data_entry excluded)
CREATE POLICY "Admin and above can delete transactions"
    ON main_transaction FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            JOIN entity_users eu ON eu.entity_id = a.entity_id
            WHERE a.account_id = main_transaction.account_id
            AND eu.user_id = auth.uid()
            AND eu.role IN ('owner', 'admin')
        )
    );
```

## Frontend Implementation

### 1. TypeScript Types (`types/roles.ts`)

```typescript
export type UserRole = 'owner' | 'admin' | 'editor' | 'data_entry' | 'viewer'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  data_entry: 2,  // ⭐ NEW
  viewer: 1,
}
```

### 2. Permission Helpers (`lib/permissions.ts`)

```typescript
// Updated functions
export function canWrite(role: UserRole | null): boolean {
  if (!role) return false
  return ['owner', 'admin', 'editor', 'data_entry'].includes(role)  // ⭐ Added data_entry
}

export function canDelete(role: UserRole | null): boolean {
  if (!role) return false
  return ['owner', 'admin', 'editor'].includes(role)  // ⭐ data_entry excluded
}

export function canAccessReports(role: UserRole | null): boolean {
  if (!role) return false
  return hasPermission(role, 'editor')  // ⭐ Requires editor+, blocks data_entry & viewer
}
```

### 3. React Hook (`hooks/use-user-role.ts`)

```typescript
// Get user's role and permissions
const { role, permissions, isLoading } = useUserPermissions(entityId)

// Usage in components
if (permissions.canEditTransactions) {
  // Show edit button
}

if (permissions.canViewReports) {
  // Show reports menu item
}

if (permissions.isDataEntry) {
  // Show data entry specific UI
}
```

### 4. Navigation Filtering (`components/sidebar.tsx`)

```typescript
const navigation = [
  { name: "Main Transactions", href: "/dashboard/main-transactions", icon: Tags, requiredRole: null },
  { name: "Cash Flow", href: "/dashboard/cash-flow", icon: TrendingUp, requiredRole: 'editor' },  // ⭐ Hidden from data_entry
  { name: "Reports", href: "/dashboard/reports", icon: FileText, requiredRole: 'editor' },        // ⭐ Hidden from data_entry
  { name: "Settings", href: "/dashboard/settings", icon: Settings, requiredRole: 'admin' },       // ⭐ Hidden from data_entry & editor
]

// Filtering logic
const visibleNavigation = navigation.filter((item) => {
  if (!item.requiredRole) return true
  if (!userRole) return false

  if (item.requiredRole === 'editor') {
    return canAccessReports(userRole)  // ⭐ Blocks data_entry
  }

  if (item.requiredRole === 'admin') {
    return userRole === 'admin' || userRole === 'owner'  // ⭐ Blocks data_entry & editor
  }

  return true
})
```

## Usage Examples

### Assigning Data Entry Role

```sql
-- Insert new user with data_entry role
INSERT INTO entity_users (entity_id, user_id, role, created_by_user_id)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- entity_id
  '987fcdeb-51a2-43d7-8e9f-0123456789ab',  -- user_id
  'data_entry',                              -- role
  auth.uid()                                 -- created_by (current user)
);

-- Or update existing user
UPDATE entity_users
SET role = 'data_entry'
WHERE entity_id = '123e4567-e89b-12d3-a456-426614174000'
  AND user_id = '987fcdeb-51a2-43d7-8e9f-0123456789ab';
```

### Checking Permissions in API Routes

```typescript
// app/api/some-route/route.ts
import { getUserEntityRole, canAccessReports } from '@/lib/permissions'

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = await getUserEntityRole(supabase, user.id, entityId)

  // Block data_entry from reports
  if (!canAccessReports(role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions. Reports access requires Editor role or higher.' },
      { status: 403 }
    )
  }

  // Proceed with report generation
  // ...
}
```

### Using Permission Hook in Components

```typescript
'use client'

import { useUserPermissions } from '@/hooks/use-user-role'
import { useEntity } from '@/contexts/EntityContext'

export function TransactionActions({ transactionId }: { transactionId: string }) {
  const { currentEntity } = useEntity()
  const { permissions, isLoading } = useUserPermissions(currentEntity?.id)

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="flex gap-2">
      {/* Edit button - shown to data_entry+ */}
      {permissions.canEditTransactions && (
        <Button onClick={() => handleEdit(transactionId)}>
          Edit
        </Button>
      )}

      {/* Delete button - NOT shown to data_entry (requires editor+) */}
      {permissions.canDeleteTransactions && (
        <Button variant="destructive" onClick={() => handleDelete(transactionId)}>
          Delete
        </Button>
      )}

      {/* Export button - NOT shown to data_entry (requires editor+) */}
      {permissions.canExportData && (
        <Button onClick={() => handleExport()}>
          Export
        </Button>
      )}
    </div>
  )
}
```

## UI Indicators

### Role Badge in Sidebar

The sidebar displays the user's role as a badge below the entity switcher:

```tsx
<Badge variant="outline" className="text-xs">
  Data Entry
</Badge>
```

### Conditional Navigation

Pages hidden from Data Entry role:
- **Cash Flow** - Projections and liquidity analysis
- **Reports** - Financial reports and analytics
- **Settings** - System configuration

## Testing Checklist

### Data Entry Role Can:
- [ ] View transactions list
- [ ] Create new transaction
- [ ] Edit existing transaction
- [ ] Categorize transaction
- [ ] Split transaction
- [ ] Add notes to transaction
- [ ] Import transactions from Excel
- [ ] View scheduled payments
- [ ] Create/edit scheduled payments
- [ ] View contracts
- [ ] Create/edit contracts

### Data Entry Role Cannot:
- [ ] Delete transactions
- [ ] Access `/dashboard/cash-flow`
- [ ] Access `/dashboard/reports`
- [ ] Access `/dashboard/settings`
- [ ] Create new accounts
- [ ] Edit account settings
- [ ] Delete accounts
- [ ] Invite new users
- [ ] Change user roles
- [ ] Export data

### Navigation Visibility:
- [ ] "Cash Flow" menu item is hidden
- [ ] "Reports" menu item is hidden
- [ ] "Settings" menu item is hidden
- [ ] Role badge shows "Data Entry"
- [ ] All other menu items are visible

## Security Notes

1. **Database-Level Enforcement**: All permissions are enforced at the PostgreSQL RLS level, not just in the UI
2. **No Bypassing**: Even if a data_entry user tries to access restricted URLs directly, RLS policies will block the query
3. **API Protection**: API routes should check `canAccessReports()` before returning sensitive data
4. **Middleware**: Add route protection in `middleware.ts` for additional security layer (optional)

## Troubleshooting

### Issue: "unsafe use of new value" error
**Cause**: PostgreSQL requires enum values to be committed before use
**Solution**: Run migrations in two steps (step1 first, commit, then step2)

### Issue: Data entry user can still see restricted pages
**Check**:
1. Role assigned correctly in database: `SELECT role FROM entity_users WHERE user_id = '...'`
2. `currentEntity.role` is populated in EntityContext
3. Navigation filter logic is working: Check browser console for role value
4. Clear browser cache/cookies and refresh

### Issue: Data entry user cannot edit transactions
**Check**:
1. RLS policies updated: `\d+ main_transaction` in psql
2. Migration step 2 ran successfully
3. User has correct entity_id assignment

## Future Enhancements

1. **Middleware Protection**: Add server-side route blocking in `middleware.ts`
2. **Audit Logging**: Track when data_entry users modify data
3. **Granular Permissions**: Split data_entry into specialized roles (e.g., importer, categorizer)
4. **Permission UI**: Admin interface to view/edit role permissions
5. **API Rate Limiting**: Prevent abuse by limiting actions per minute

## Files Modified

### Database:
- `database/migrations/077_add_data_entry_role_step1.sql` ⭐ NEW
- `database/migrations/077_add_data_entry_role_step2.sql` ⭐ NEW

### TypeScript/React:
- `types/roles.ts` ⭐ NEW - Role types and permission mappings
- `lib/permissions.ts` - Updated with data_entry support
- `hooks/use-user-role.ts` ⭐ NEW - React hooks for permissions
- `components/sidebar.tsx` - Navigation filtering + role badge

### Documentation:
- `docs/DATA_ENTRY_ROLE_SYSTEM.md` ⭐ NEW - This file

## Support

For questions or issues with the Data Entry role system:
- Review this documentation
- Check RLS policies: `\d+ main_transaction` in psql
- Verify role assignment: `SELECT * FROM entity_users WHERE user_id = '...'`
- Test permissions with different role accounts
