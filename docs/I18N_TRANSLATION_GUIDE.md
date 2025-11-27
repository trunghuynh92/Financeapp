# Internationalization (i18n) Translation Guide

## Overview

This app uses **next-intl** for multi-language support. Currently supports:
- English (`en`)
- Vietnamese (`vi`)

## File Structure

```
Financeapp/
├── i18n/
│   ├── config.ts          # Locale configuration
│   └── request.ts         # Server-side locale detection
├── messages/
│   ├── en.json            # English translations
│   └── vi.json            # Vietnamese translations
├── components/
│   └── language-switcher.tsx  # Language dropdown component
├── middleware.ts          # Locale cookie handling
└── next.config.js         # next-intl plugin configuration
```

## How to Add Translations to a Page/Component

### Step 1: Import the hook

**For Client Components (`"use client"`):**
```typescript
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
```

**For Server Components:**
```typescript
import { getTranslations } from 'next-intl/server';

export default async function MyPage() {
  const t = await getTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
```

### Step 2: Add translation keys to JSON files

Add keys to both `messages/en.json` and `messages/vi.json`:

```json
{
  "namespace": {
    "key": "English text",
    "greeting": "Hello, {name}!"
  }
}
```

```json
{
  "namespace": {
    "key": "Vietnamese text",
    "greeting": "Xin chào, {name}!"
  }
}
```

### Step 3: Use in component

```typescript
const t = useTranslations('namespace');

// Simple key
<h1>{t('key')}</h1>

// With interpolation
<p>{t('greeting', { name: 'John' })}</p>
```

## Translation Namespaces

Current namespaces in `messages/*.json`:

| Namespace | Purpose |
|-----------|---------|
| `common` | Shared UI text (buttons, labels, status) |
| `auth` | Authentication (sign in, sign up, password) |
| `navigation` | Sidebar menu items |
| `dashboard` | Dashboard page content |
| `accounts` | Accounts page and components |
| `transactions` | Transactions page and components |
| `transfers` | Transfer matching |
| `budgets` | Budget management |
| `cashFlow` | Cash flow projections |
| `contracts` | Contract management |
| `scheduledPayments` | Scheduled payments |
| `entities` | Entity management |
| `reports` | Reports page |
| `settings` | Settings page |
| `profile` | User profile |
| `errors` | Error messages |
| `success` | Success messages |

## Example: Translating a New Page

### Before (hardcoded English):
```typescript
"use client"

export default function AccountsPage() {
  return (
    <div>
      <h1>Accounts</h1>
      <p>Manage your accounts</p>
      <button>Add Account</button>
    </div>
  );
}
```

### After (with translations):
```typescript
"use client"

import { useTranslations } from 'next-intl';

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('addAccount')}</button>
    </div>
  );
}
```

Then add to `messages/en.json`:
```json
{
  "accounts": {
    "title": "Accounts",
    "description": "Manage your accounts",
    "addAccount": "Add Account"
  }
}
```

And `messages/vi.json`:
```json
{
  "accounts": {
    "title": "Tài khoản",
    "description": "Quản lý tài khoản của bạn",
    "addAccount": "Thêm tài khoản"
  }
}
```

## Using Multiple Namespaces

When a component needs text from multiple namespaces:

```typescript
const t = useTranslations('accounts');
const tCommon = useTranslations('common');
const tErrors = useTranslations('errors');

return (
  <div>
    <h1>{t('title')}</h1>
    <button>{tCommon('save')}</button>
    {error && <p>{tErrors('serverError')}</p>}
  </div>
);
```

## Dynamic Values & Interpolation

### Simple interpolation:
```json
{
  "welcome": "Welcome, {name}!"
}
```
```typescript
t('welcome', { name: 'John' })  // "Welcome, John!"
```

### Pluralization:
```json
{
  "items": "You have {count, plural, =0 {no items} =1 {one item} other {# items}}"
}
```
```typescript
t('items', { count: 5 })  // "You have 5 items"
```

### Number formatting:
```json
{
  "price": "Price: {amount, number, currency}"
}
```

## Pages Already Translated

- [x] `app/layout.tsx` - Root layout with NextIntlClientProvider
- [x] `components/sidebar.tsx` - Navigation menu
- [x] `app/dashboard/page.tsx` - Dashboard
- [x] `app/signin/page.tsx` - Sign in page

## Pages Needing Translation

- [ ] `app/signup/page.tsx`
- [ ] `app/auth/forgot-password/page.tsx`
- [ ] `app/auth/reset-password/page.tsx`
- [ ] `app/dashboard/accounts/page.tsx`
- [ ] `app/dashboard/accounts/[id]/page.tsx`
- [ ] `app/dashboard/main-transactions/page.tsx`
- [ ] `app/dashboard/budgets/page.tsx`
- [ ] `app/dashboard/cash-flow/page.tsx`
- [ ] `app/dashboard/contracts/page.tsx`
- [ ] `app/dashboard/scheduled-payments/page.tsx`
- [ ] `app/dashboard/entities/page.tsx`
- [ ] `app/dashboard/entities/new/page.tsx`
- [ ] `app/dashboard/reports/page.tsx`
- [ ] `app/dashboard/settings/page.tsx`
- [ ] `app/dashboard/profile/page.tsx`
- [ ] `app/dashboard/audit/page.tsx`

## Components Needing Translation

- [ ] `components/EntitySwitcher.tsx`
- [ ] `components/main-transactions/*.tsx`
- [ ] `components/budgets/*.tsx`
- [ ] Dialog components (confirm delete, forms, etc.)
- [ ] Data table headers and actions
- [ ] Form validation messages

## Adding a New Language

1. Add locale to `i18n/config.ts`:
```typescript
export const locales = ['en', 'vi', 'ja'] as const;

export const localeNames: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
};
```

2. Create `messages/ja.json` with all translated keys

3. Update middleware locale array in `middleware.ts`:
```typescript
const locales = ['en', 'vi', 'ja']
```

## Best Practices

1. **Use namespaces** - Group related translations together
2. **Reuse common keys** - Use `common` namespace for shared text
3. **Keep keys descriptive** - `addAccount` not `btn1`
4. **Always update both files** - Keep `en.json` and `vi.json` in sync
5. **Test both languages** - Switch language to verify translations appear
6. **Use interpolation** - For dynamic values like names, counts, dates

## Debugging

If translations aren't showing:

1. Check the key exists in both JSON files
2. Verify the namespace matches: `useTranslations('accounts')` needs `"accounts": {...}` in JSON
3. Check for JSON syntax errors (trailing commas, missing quotes)
4. Restart dev server after changing `next.config.js`

## Language Switcher

The language switcher is in the sidebar. It:
1. Reads current locale from cookie
2. Sets `NEXT_LOCALE` cookie on change
3. Calls `router.refresh()` to reload with new locale

To add it elsewhere:
```typescript
import { LanguageSwitcher } from '@/components/language-switcher';

<LanguageSwitcher />
```

## Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
