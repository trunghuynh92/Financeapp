# Google OAuth Troubleshooting Guide

## Current Status: Google OAuth Not Working

**Date:** November 26, 2025

## What's Been Implemented

All code for Google OAuth authentication has been successfully implemented and committed:

✅ **Files Created/Modified:**
- `/app/auth/callback/route.ts` - OAuth callback handler
- `/app/auth/forgot-password/page.tsx` - Password reset request page
- `/app/auth/reset-password/page.tsx` - Password reset confirmation page
- `/app/dashboard/profile/page.tsx` - User profile with password change
- `/app/signin/page.tsx` - Added Google OAuth button
- `/app/signup/page.tsx` - Added Google OAuth button
- `/contexts/AuthContext.tsx` - Added OAuth methods

✅ **Configuration Completed:**
- **Google Cloud Console:** OAuth 2.0 Client ID created
  - Project: OCR receipt project (reused existing project)
  - Authorized redirect URIs: `https://mflyrbzriksgjutlalkf.supabase.co/auth/v1/callback`
  - Authorized JavaScript origins: `http://localhost:3000`, `https://app.foundations1st.com`

- **Supabase Dashboard:**
  - Google provider enabled with Client ID and Secret
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/**`

## The Problem

When clicking "Sign in with Google":

1. ✅ Google sign-in popup appears
2. ✅ User selects Google account
3. ✅ Google redirects to Supabase callback: `https://mflyrbzriksgjutlalkf.supabase.co/auth/v1/callback`
4. ✅ Supabase redirects to app callback: `http://localhost:3000/auth/callback?code=...`
5. ❌ **App callback route executes but doesn't log anything**
6. ❌ User is redirected back to `/signin` instead of `/dashboard`
7. ❌ No session is created

## Evidence from Testing

### Network Tab Observations:
- Request to `/auth/callback?code=...` returns **HTTP 307** (redirect)
- Response header `Location: /signin`
- Multiple 404 errors for Next.js static assets (layout.css, webpack.js, etc.)

### Terminal Logs:
- **NO** console logs from `/app/auth/callback/route.ts` appear
- Even with `console.error()` which should always show
- Route is being called (307 redirect proves this) but not logging

### Browser Behavior:
- After OAuth redirect, page shows `/signin`
- UI sometimes breaks with 404s for CSS/JS files
- No error messages displayed to user

## Code in Callback Route

Current implementation (`/app/auth/callback/route.ts`):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    console.error('=== OAUTH CALLBACK START ===')  // NEVER APPEARS IN LOGS
    console.error('Code present:', !!code)
    console.error('Full URL:', requestUrl.toString())

    if (!code) {
      console.log('No code found, redirecting to signin')
      return NextResponse.redirect(`${origin}/signin`)
    }

    const cookieStore = await cookies()
    const response = NextResponse.redirect(`${origin}/dashboard`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options) {
            try {
              cookieStore.set({ name, value, ...options })
              response.cookies.set({ name, value, ...options })
            } catch (err) {
              // Ignore cookie errors during streaming
            }
          },
          remove(name: string, options) {
            try {
              cookieStore.set({ name, value: '', ...options })
              response.cookies.set({ name, value: '', ...options })
            } catch (err) {
              // Ignore cookie errors during streaming
            }
          },
        },
      }
    )

    console.log('Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Exchange error:', error)
      return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(error.message)}`)
    }

    if (data.session) {
      console.log('✅ SUCCESS! User:', data.user?.email)
      console.log('Session created:', !!data.session)
      return response
    }

    console.log('❌ No session in response')
    return NextResponse.redirect(`${origin}/signin`)
  } catch (err) {
    console.error('=== CALLBACK ERROR ===', err)
    return NextResponse.redirect(`${request.url.split('/auth')[0]}/signin`)
  }
}
```

## Possible Causes

1. **Route Handler Not Executing:**
   - Next.js not picking up the route file
   - File is being cached despite restarts
   - Route handlers might not support console.log in this context

2. **Cookie/Session Issues:**
   - Cookies not being set properly across redirect chain
   - Supabase SSR package compatibility issue with Next.js 14
   - Cookie security settings preventing session storage

3. **Build/Cache Problems:**
   - `.next` cache corruption
   - Multiple dev servers running on different ports
   - Hot reload not picking up route changes

4. **Supabase Configuration:**
   - Redirect URL mismatch (unlikely - configuration verified correct)
   - Session not being created by Supabase
   - PKCE flow issue

## Troubleshooting Steps Attempted

1. ✅ Verified Google Cloud Console configuration
2. ✅ Verified Supabase configuration
3. ✅ Added extensive console logging (including console.error)
4. ✅ Restarted dev server multiple times
5. ✅ Cleared `.next` cache multiple times
6. ✅ Killed all Next.js processes
7. ✅ Touched route file to force recompilation
8. ✅ Changed console.log to console.error
9. ❌ Could not get logs to appear in terminal

## Next Steps to Try

### 1. Clean Restart (HIGHEST PRIORITY)
```bash
# Completely restart system
# Then:
cd /Users/trunghuynh/Documents/finance-saas/Financeapp
rm -rf .next
npm run dev
# Test OAuth again
```

### 2. Add Server-Side Debugging
Instead of console.log, try writing to a file:

```typescript
import fs from 'fs'

export async function GET(request: Request) {
  fs.appendFileSync('/tmp/oauth-debug.log', `Callback hit: ${new Date().toISOString()}\n`)
  // ... rest of code
}
```

Then check: `tail -f /tmp/oauth-debug.log`

### 3. Simplify Callback Route
Test with minimal implementation:

```typescript
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Just redirect to dashboard regardless
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
```

### 4. Check Middleware Interference
Review `/middleware.ts` to ensure it's not interfering with `/auth/callback` route.

### 5. Alternative Approach: Client-Side OAuth
Instead of PKCE flow with callback, use simpler client-side flow:

```typescript
// In AuthContext
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: false,
      // Let Supabase handle everything
    },
  })
  if (error) return { error }
  return { error: null }
}
```

### 6. Check Supabase Logs
- Go to Supabase Dashboard → Logs → Auth Logs
- Look for OAuth events when testing
- Check for errors in the Supabase side

### 7. Verify Environment Variables
```bash
# Make sure these are set correctly:
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 8. Test Password Reset (Should Work)
The password reset flow should work since it doesn't depend on OAuth:

1. Go to `/auth/forgot-password`
2. Enter email
3. Check email for reset link
4. Click link → should go to `/auth/reset-password`
5. Set new password

This will help determine if the issue is OAuth-specific or broader.

## Working Features

These features are fully implemented and should work:

✅ **Password Reset:**
- Forgot password page
- Email-based password reset
- Reset password confirmation page

✅ **Change Password:**
- User profile page at `/dashboard/profile`
- Change password form

✅ **Email/Password Auth:**
- Normal sign-in/sign-up flows still work

## References

- **Supabase Project URL:** `https://mflyrbzriksgjutlalkf.supabase.co`
- **Google Cloud Project:** OCR receipt project (reused)
- **Production URL:** `https://app.foundations1st.com`
- **Commit:** b7aaf66 - "feat: Add complete authentication features"

## Additional Notes

- All authentication features are FREE on Supabase free tier
- Email sending limit: 3 emails/hour (free), 100/hour (pro $25/month)
- Google OAuth requires no additional costs
- Code is production-ready, just needs OAuth callback to work

## Contact/Debugging Info

If this issue persists, consider:
1. Posting on Supabase Discord with callback route code
2. Checking Supabase GitHub issues for Next.js 14 SSR compatibility
3. Testing with Supabase's official Next.js example project
4. Trying the Supabase Auth Helpers package instead of direct SSR package
