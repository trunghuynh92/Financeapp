# 🚀 Vercel Deployment Fix - Receipt OCR Issue

## Problem

Receipt upload works on Vercel ✅, but OCR/AI parsing doesn't auto-fill the form ❌

## Root Cause

Google Cloud Vision client initialization wasn't compatible with Vercel's serverless environment. Local development uses file-based credentials (`GOOGLE_APPLICATION_CREDENTIALS`), but Vercel needs explicit environment variables.

## Solution

The code has been fixed to support **both** local and Vercel environments automatically! 🎉

---

## What Was Changed

### Code Changes (Already Done ✅)

1. **`app/api/receipts/upload/route.ts`** - Updated Google Vision initialization
2. **`app/api/receipts/[id]/process-ocr/route.ts`** - Updated Google Vision initialization

The code now automatically detects the environment:
- **Local**: Uses `GOOGLE_APPLICATION_CREDENTIALS` file (no changes needed!)
- **Vercel**: Uses explicit environment variables (you need to add these)

---

## What You Need to Do

### Step 1: Extract Your Credentials

Run this script in your terminal:

```bash
node scripts/extract-vercel-env.js
```

This will display all the values you need to copy to Vercel.

### Step 2: Add to Vercel

Go to your Vercel project and add these 6 environment variables:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
3. `ANTHROPIC_API_KEY` - Your Claude API key
4. `GOOGLE_CLOUD_PROJECT_ID` - From the script output
5. `GOOGLE_CLOUD_CLIENT_EMAIL` - From the script output
6. `GOOGLE_CLOUD_PRIVATE_KEY` - From the script output (the long one!)

**Important:** Check ALL environments (Production, Preview, Development) for each variable!

### Step 3: Redeploy

```bash
git push origin main
```

Or use the "Redeploy" button in Vercel dashboard.

### Step 4: Test

Upload a receipt and verify the form auto-fills with merchant, amount, date, and category.

---

## Detailed Guides

Choose the guide that fits your learning style:

### 📖 Text Guide (Most Detailed)
**File:** `docs/VERCEL_ENV_SETUP.md`

Step-by-step instructions with explanations for:
- How to copy each value correctly
- Where to find Supabase and Anthropic keys
- Troubleshooting common issues
- What each environment variable does

### 🎨 Visual Guide (With "Screenshots")
**File:** `docs/VERCEL_SETUP_VISUAL_GUIDE.md`

ASCII art visual guide showing:
- What each screen looks like
- Where to click
- What you should see at each step
- Quick reference card

### 🛠️ Technical Documentation
**File:** `docs/VERCEL_DEPLOYMENT.md`

For developers who want to understand:
- Why the code was changed
- How dual environment support works
- Security best practices
- Advanced troubleshooting

---

## Quick Setup (TL;DR)

```bash
# 1. Get your values
node scripts/extract-vercel-env.js

# 2. Add to Vercel
# - Go to: Vercel Dashboard → Project → Settings → Environment Variables
# - Add all 6 variables from script output
# - Check all environments for each one

# 3. Redeploy
git push origin main

# 4. Test receipt upload on production
```

---

## Verification Checklist

Before testing, make sure:

- [ ] Ran `node scripts/extract-vercel-env.js` successfully
- [ ] Added all 6 environment variables to Vercel
- [ ] Each variable has 3 green checkmarks (Production, Preview, Development)
- [ ] `GOOGLE_CLOUD_PRIVATE_KEY` includes the full key with `\n` characters
- [ ] Redeployed the application (git push or manual redeploy)
- [ ] Deployment shows "Ready" status

Then test:

- [ ] Upload a receipt image
- [ ] See "Analyzing receipt..." message
- [ ] Preview dialog opens with auto-filled fields
- [ ] Merchant name ✅
- [ ] Amount ✅
- [ ] Date ✅
- [ ] Category ✅

---

## Troubleshooting

### Issue: Form still empty after setup

1. **Check Vercel Runtime Logs:**
   - Vercel Dashboard → Deployments → Latest → Runtime Logs
   - Look for errors containing `vision`, `anthropic`, or `credentials`

2. **Verify Private Key:**
   - The most common issue is `GOOGLE_CLOUD_PRIVATE_KEY` not copied correctly
   - Re-run script and copy the **entire** value including `\n` characters
   - It should start with `-----BEGIN PRIVATE KEY-----\n`
   - It should end with `\n-----END PRIVATE KEY-----\n`

3. **Check All Variables:**
   - All 6 must be present
   - All must have Production, Preview, AND Development checked
   - No typos in variable names (they're case-sensitive!)

### Issue: Script doesn't run

```bash
# Make sure you're in the project root
cd /path/to/Financeapp

# Make sure google-cloud-key.json exists
ls google-cloud-key.json

# Run the script
node scripts/extract-vercel-env.js
```

### Issue: Works locally but not on Vercel

This is expected! The fix enables both environments:
- Local uses `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- Vercel uses explicit env vars (you set these up)

Make sure you completed all steps for Vercel setup.

---

## Files Created/Modified

### Modified (Code fixes ✅)
- `app/api/receipts/upload/route.ts` - Google Vision dual environment support
- `app/api/receipts/[id]/process-ocr/route.ts` - Google Vision dual environment support

### Created (Documentation 📚)
- `scripts/extract-vercel-env.js` - Helper script to extract credentials
- `docs/VERCEL_ENV_SETUP.md` - Detailed setup guide
- `docs/VERCEL_SETUP_VISUAL_GUIDE.md` - Visual step-by-step guide
- `docs/VERCEL_DEPLOYMENT.md` - Technical documentation
- `VERCEL_SETUP_README.md` - This file (quick start)

---

## Local Development

**No changes needed!** Your local setup continues to work exactly as before:

- Uses `GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-key.json`
- No need to add individual env vars locally
- Everything works the same as before the fix

---

## Support

**If you're stuck:**

1. Start with the visual guide: `docs/VERCEL_SETUP_VISUAL_GUIDE.md`
2. Try the helper script: `node scripts/extract-vercel-env.js`
3. Check the detailed guide: `docs/VERCEL_ENV_SETUP.md`
4. Review Vercel Runtime Logs for specific errors
5. Verify all checkboxes are checked in Vercel env vars

**If it's still not working:**

Share the error from Vercel Runtime Logs - that will help identify the specific issue.

---

## Summary

✅ **Code fixed** - Supports both local and Vercel environments
✅ **Scripts created** - Easy credential extraction
✅ **Guides written** - Three levels of detail
✅ **Local dev unaffected** - No changes to your workflow

**Next step:** Run the script and add the env vars to Vercel! 🚀
