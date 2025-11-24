# Multi-User Authentication System Implementation

## Overview
This document describes the multi-user authentication system with role-based access control (RBAC) that has been implemented in the Finance SaaS application.

## Features Implemented

### 1. User Authentication
- ✅ Sign up with email and password
- ✅ Sign in with email and password
- ✅ Automatic user profile creation on signup
- ✅ Session management with Supabase Auth
- ✅ Protected routes with middleware
- ✅ Automatic redirects based on auth state

### 2. Role-Based Access Control (RBAC)
Four roles with hierarchical permissions:

#### **Owner** (Highest privileges)
- Full access to everything
- Can manage users (invite, change roles, remove)
- Can delete entities and accounts
- Can manage all settings

#### **Admin**
- Can create/edit/delete transactions
- Can manage accounts
- Can manage categories, branches, transaction types
- Cannot delete accounts
- Cannot manage users

#### **Editor**
- Can create and edit transactions
- Can import transactions
- Cannot delete transactions
- Cannot manage accounts or settings

#### **Viewer** (Lowest privileges)
- Read-only access
- Can view transactions and reports
- Cannot create, edit, or delete anything

### 3. Multi-Entity Support
- Users can belong to multiple entities (companies/personal accounts)
- Different roles per entity (e.g., Owner in Company A, Viewer in Company B)
- Entity-level data isolation enforced by Row Level Security (RLS)

## Database Schema

### New Tables

#### `users`
Extends Supabase auth.users with profile information:
```sql
- id: UUID (references auth.users)
- email: TEXT
- full_name: TEXT
- avatar_url: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### `entity_users` (Junction Table)
Maps users to entities with roles:
```sql
- id: SERIAL PRIMARY KEY
- entity_id: INTEGER (references entities)
- user_id: UUID (references users)
- role: user_role ENUM
- created_at: TIMESTAMPTZ
- created_by_user_id: UUID
```

### Updated Tables
- `entities`: Added `owner_user_id` field

## Files Created

### Authentication Core
1. **`lib/supabase.ts`** - Updated with auth-aware client and type definitions
2. **`lib/supabase-server.ts`** - Server-side Supabase client utilities
3. **`contexts/AuthContext.tsx`** - React context for client-side auth state
4. **`middleware.ts`** - Route protection and auth middleware

### UI Pages
5. **`app/signup/page.tsx`** - User registration page
6. **`app/signin/page.tsx`** - User login page

### Utilities
7. **`hooks/useUserEntities.ts`** - Custom hooks for entity access and role checking
8. **`migrations/022_add_multi_user_auth_system.sql`** - Complete database migration

### Documentation
9. **`AUTH_IMPLEMENTATION.md`** - This file

## Row Level Security (RLS) Policies

All tables now have RLS policies that:
- Filter data based on user's entity access
- Enforce role-based permissions for INSERT, UPDATE, DELETE
- Ensure users can only see data for entities they belong to

### Policy Summary by Table

**entities**: Users can only see/manage entities they belong to
**accounts**: Filtered by entity access, Admin+ can create/edit
**main_transaction**: Filtered by account access, Editor+ can create/edit
**original_transaction**: Filtered by account access, Editor+ can create/edit
**categories/branches/transaction_types**: Admin+ can manage
**balance_checkpoints**: Admin+ can manage
**debt_drawdown/drawdown_payment**: Admin+ can manage
**import_batch**: Editor+ can manage

## How to Deploy

### Step 1: Run the Database Migration

You need to run the migration in your Supabase dashboard:

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**
4. Create a new query
5. Copy the entire contents of `migrations/022_add_multi_user_auth_system.sql`
6. Paste and run the migration
7. Verify there are no errors

### Step 2: Enable Email Authentication in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. Configure email templates if needed (optional)
4. Set up email confirmation (optional, can be disabled for development)

### Step 3: Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`
   - Should redirect to `/signin` (not authenticated)

3. Try signing up:
   - Go to `/signup`
   - Create a new account
   - Should redirect to `/dashboard` on success

4. Try signing in:
   - Sign out if logged in
   - Go to `/signin`
   - Sign in with your credentials

## Usage Examples

### Check User's Role
```typescript
import { useUserRole } from '@/hooks/useUserEntities'

function MyComponent() {
  const { role, isOwner, isAdmin, isEditor } = useUserRole(entityId)

  return (
    <div>
      {isAdmin && <AdminButton />}
      {isEditor && <EditButton />}
    </div>
  )
}
```

### Get User's Entities
```typescript
import { useUserEntities } from '@/hooks/useUserEntities'

function EntitySelector() {
  const { entities, loading } = useUserEntities()

  return (
    <select>
      {entities.map(entity => (
        <option key={entity.id} value={entity.id}>
          {entity.name} ({entity.user_role})
        </option>
      ))}
    </select>
  )
}
```

### Check Permissions
```typescript
import { useHasPermission } from '@/hooks/useUserEntities'

function DeleteButton({ entityId }: { entityId: number }) {
  const canDelete = useHasPermission(entityId, 'admin')

  if (!canDelete) return null

  return <button>Delete</button>
}
```

### Use Auth Context
```typescript
import { useAuth } from '@/contexts/AuthContext'

function UserMenu() {
  const { user, signOut } = useAuth()

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

## API Route Protection

To protect API routes, use the server-side utilities:

```typescript
import { requireAuth } from '@/lib/supabase-server'

export async function GET(request: Request) {
  // This will throw if not authenticated
  const user = await requireAuth()

  // Your API logic here
  return Response.json({ data: 'protected data' })
}
```

## Next Steps

### Immediate Next Steps
1. ✅ Run the database migration in Supabase
2. ✅ Test sign up and sign in flows
3. Update existing API routes to use auth
4. Add user management UI (invite users, change roles)

### Future Enhancements
- Password reset functionality
- Email verification
- OAuth providers (Google, GitHub, etc.)
- User profile management
- Audit logging
- Two-factor authentication (2FA)
- Session management (view/revoke sessions)

## Security Considerations

1. **RLS is Critical**: All data access is controlled by RLS policies. Never disable RLS on tables.

2. **Server-side Validation**: Always validate permissions on the server, not just in UI.

3. **Token Refresh**: Middleware automatically refreshes sessions.

4. **Password Requirements**: Minimum 6 characters (can be increased in Supabase settings).

5. **HTTPS Only**: In production, ensure all traffic is HTTPS.

## Troubleshooting

### Issue: "User not authenticated" after signup
- Check if email confirmation is required in Supabase settings
- Disable email confirmation for development

### Issue: RLS policies blocking queries
- Check if the migration ran successfully
- Verify user has entity_users record
- Check RLS policies in Supabase dashboard

### Issue: Redirect loops
- Clear browser cookies
- Check middleware configuration
- Verify Supabase environment variables

## Role Hierarchy Reference

```
Owner (4) ─── Can do everything
  ↓
Admin (3) ─── Cannot: manage users, delete accounts
  ↓
Editor (2) ─── Cannot: manage settings, delete anything
  ↓
Viewer (1) ─── Read-only access
```

## Migration Summary

The migration includes:
- 2 new tables (users, entity_users)
- 1 new enum type (user_role)
- 4 helper functions for role checking
- 2 triggers for automatic user/entity setup
- Updated RLS policies for all 11 existing tables
- Proper indexes for performance

Total: ~650 lines of SQL
