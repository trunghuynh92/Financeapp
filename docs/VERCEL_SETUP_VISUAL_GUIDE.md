# Vercel Environment Variables - Visual Step-by-Step Guide

**⏱️ Time:** 10 minutes
**✅ Difficulty:** Easy - Just copy and paste!

---

## Quick Start

Run this command in your terminal to get all the values you need:

```bash
node scripts/extract-vercel-env.js
```

This will display all your Google Cloud credentials formatted and ready to copy-paste into Vercel.

---

## Step 1: Go to Vercel Dashboard

1. Open https://vercel.com in your browser
2. Log in to your account
3. You'll see a list of your projects

**What you see:**
```
┌─────────────────────────────────────────┐
│ Vercel Dashboard                        │
│                                         │
│  Your Projects:                         │
│  ┌───────────────────────────────────┐ │
│  │ 📦 finance-app           [Open]   │ │ ← Click your project
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 📦 other-project         [Open]   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Step 2: Open Settings

Click the **"Settings"** tab at the top of your project page.

**Navigation bar looks like:**
```
┌──────────────────────────────────────────────────────┐
│  Overview  │  Deployments  │  [Settings]  │  ...    │ ← Click this
└──────────────────────────────────────────────────────┘
```

---

## Step 3: Navigate to Environment Variables

In the left sidebar, click **"Environment Variables"**

**Sidebar looks like:**
```
┌─────────────────────┐
│ General             │
│ Domains             │
│ Git                 │
│ [Environment Variables] │ ← Click this
│ Security            │
│ ...                 │
└─────────────────────┘
```

---

## Step 4: Add Environment Variables Page

You'll see a page that looks like this:

```
┌──────────────────────────────────────────────────────────────┐
│  Environment Variables                                        │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  🔍 [Search...]                                              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Key (Name)          [________________]                  │ │
│  │                                                          │ │
│  │ Value               [________________]                  │ │
│  │                                                          │ │
│  │ Environments:  ☐ Production  ☐ Preview  ☐ Development │ │
│  │                                                          │ │
│  │                                    [Add]                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  Existing Variables:                                         │
│  (list of already added variables will show here)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Step 5: Add Each Variable (Do this 6 times)

### Format for EVERY variable:

1. **Type the Key (name)** in the first box
2. **Paste the Value** in the second box
3. **Check ALL THREE boxes:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Add"** button

---

## The 6 Variables to Add

### Variable #1: Supabase URL

```
┌────────────────────────────────────────────────┐
│ Key:    NEXT_PUBLIC_SUPABASE_URL              │
│                                                │
│ Value:  https://abcdefgh.supabase.co          │ ← Your Supabase project URL
│                                                │
│ ☑ Production  ☑ Preview  ☑ Development       │ ← Check all three!
└────────────────────────────────────────────────┘
```

**Where to find it:**
- Go to Supabase Dashboard → Your Project → Settings → API
- Copy the "Project URL"

---

### Variable #2: Supabase Anon Key

```
┌────────────────────────────────────────────────┐
│ Key:    NEXT_PUBLIC_SUPABASE_ANON_KEY         │
│                                                │
│ Value:  eyJhbGciOiJIUzI1NiIsInR5cCI6...      │ ← Very long key
│                                                │
│ ☑ Production  ☑ Preview  ☑ Development       │
└────────────────────────────────────────────────┘
```

**Where to find it:**
- Same place as above: Supabase → Settings → API
- Copy the "anon public" key (the long one starting with `eyJ`)

---

### Variable #3: Anthropic API Key

```
┌────────────────────────────────────────────────┐
│ Key:    ANTHROPIC_API_KEY                     │
│                                                │
│ Value:  sk-ant-api03-...                      │ ← Your Claude API key
│                                                │
│ ☑ Production  ☑ Preview  ☑ Development       │
└────────────────────────────────────────────────┘
```

**Where to find it:**
- Go to https://console.anthropic.com/settings/keys
- Click "Create Key" if you don't have one
- Copy the key (starts with `sk-ant-api03-`)

---

### Variable #4: Google Cloud Project ID

```
┌────────────────────────────────────────────────┐
│ Key:    GOOGLE_CLOUD_PROJECT_ID               │
│                                                │
│ Value:  finance-saas-ocr                      │ ← From script output
│                                                │
│ ☑ Production  ☑ Preview  ☑ Development       │
└────────────────────────────────────────────────┘
```

**Where to get it:**
Run the script and copy from section 1️⃣:
```bash
node scripts/extract-vercel-env.js
```

---

### Variable #5: Google Cloud Client Email

```
┌────────────────────────────────────────────────┐
│ Key:    GOOGLE_CLOUD_CLIENT_EMAIL             │
│                                                │
│ Value:  receipt-ocr-service@finance-saas...   │ ← From script output
│                                                │
│ ☑ Production  ☑ Preview  ☑ Development       │
└────────────────────────────────────────────────┘
```

**Where to get it:**
Copy from section 2️⃣ of the script output.

---

### Variable #6: Google Cloud Private Key (The Tricky One!)

```
┌──────────────────────────────────────────────────────────────┐
│ Key:    GOOGLE_CLOUD_PRIVATE_KEY                            │
│                                                              │
│ Value:  -----BEGIN PRIVATE KEY-----\n                       │ ← VERY LONG!
│         MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n              │    Scroll down
│         [... lots more lines ...]\n                         │    in the box
│         -----END PRIVATE KEY-----\n                         │    to see all
│                                                              │
│ ☑ Production  ☑ Preview  ☑ Development                     │
└──────────────────────────────────────────────────────────────┘
```

**⚠️ IMPORTANT:**
- This is a VERY LONG value (multiple lines)
- Copy the ENTIRE thing from section 3️⃣ of the script
- It should start with: `-----BEGIN PRIVATE KEY-----\n`
- It should end with: `\n-----END PRIVATE KEY-----\n`
- The `\n` characters are important - don't remove them!

**Pro Tip:** Use the JSON format from the script output:
```bash
node scripts/extract-vercel-env.js
```
Scroll down to the JSON section and copy the `GOOGLE_CLOUD_PRIVATE_KEY` value from there.

---

## Step 6: Verify All Variables Are Added

After adding all 6, your page should look like:

```
┌──────────────────────────────────────────────────────────────┐
│  Environment Variables                                        │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  Current Variables:                                          │
│                                                               │
│  ✅ NEXT_PUBLIC_SUPABASE_URL                                 │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
│  ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY                            │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
│  ✅ ANTHROPIC_API_KEY                                        │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
│  ✅ GOOGLE_CLOUD_PROJECT_ID                                  │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
│  ✅ GOOGLE_CLOUD_CLIENT_EMAIL                                │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
│  ✅ GOOGLE_CLOUD_PRIVATE_KEY                                 │
│     💚 Production  💚 Preview  💚 Development               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Checklist:**
- [ ] All 6 variables are listed
- [ ] Each has green checkmarks for all 3 environments
- [ ] No red errors or warnings

---

## Step 7: Redeploy Your Application

Environment variables only take effect on **new deployments**.

### Option A: Git Push (Easiest)

```bash
# In your terminal, in your project folder:
git commit --allow-empty -m "chore: redeploy for env vars"
git push origin main
```

### Option B: Manual Redeploy

1. Go to your project → **Deployments** tab
2. Find the latest deployment (top of the list)
3. Click the **⋯** (three dots) button on the right
4. Click **"Redeploy"**
5. Confirm

**What you'll see:**
```
┌──────────────────────────────────────────────────────────────┐
│  Latest Deployment                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  🚀 Building...                      [Cancel]           │ │
│  │                                                          │ │
│  │  Progress: 45%                                          │ │
│  │  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Wait for it to show **"Ready"** (usually 1-2 minutes).

---

## Step 8: Test It!

1. **Visit your live site** (e.g., `https://your-app.vercel.app`)

2. **Upload a receipt:**
   - Go to Main Transactions or wherever you have the upload button
   - Click "Upload Receipt"
   - Select a receipt image (clear photo of a receipt)
   - Click "Upload"

3. **Watch for:**
   ```
   ┌──────────────────────────────────────┐
   │  Uploading receipt...                │ ← Should appear
   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%         │
   └──────────────────────────────────────┘

   ┌──────────────────────────────────────┐
   │  ✨ Analyzing receipt...             │ ← Then this
   │  🔍 Extracting data with AI...       │
   └──────────────────────────────────────┘

   ┌──────────────────────────────────────┐
   │  Review Receipt & Create Transaction │ ← Dialog opens
   │  ──────────────────────────────────  │
   │  Merchant: ✅ Auto-filled!           │ ← Should be filled
   │  Amount:   ✅ Auto-filled!           │ ← Should be filled
   │  Date:     ✅ Auto-filled!           │ ← Should be filled
   │  Category: ✅ Auto-selected!         │ ← Should be filled
   └──────────────────────────────────────┘
   ```

4. **Success!** If all fields are filled automatically, it's working! 🎉

---

## Troubleshooting

### ❌ Form is empty after upload

**Check Runtime Logs:**

1. Go to Vercel → Your Project → Deployments
2. Click the latest deployment
3. Click "Runtime Logs" tab
4. Look for errors with these keywords:
   - `vision`
   - `anthropic`
   - `ImageAnnotatorClient`
   - `Could not load`

**Common Issues:**

**Error in logs:** `"Could not load the default credentials"`
**Fix:**
- The `GOOGLE_CLOUD_PRIVATE_KEY` was not copied correctly
- Re-run the script and copy the ENTIRE private key value
- Make sure it includes the `\n` characters

**Error in logs:** `"Invalid API key"` or `"Authentication failed"`
**Fix:**
- Check your `ANTHROPIC_API_KEY` is correct
- Go to https://console.anthropic.com/settings/keys
- Copy the key again (it should start with `sk-ant-api03-`)

**No errors in logs, but form still empty:**
**Fix:**
- Check all 6 variables are set for ALL environments
- Make sure you redeployed after adding variables
- Try a different receipt image (clear, well-lit photo)

---

## Visual Checklist

Before closing this guide, verify:

```
✅ Step 1: Opened Vercel Dashboard
✅ Step 2: Clicked Settings tab
✅ Step 3: Clicked Environment Variables
✅ Step 4: Added all 6 variables
✅ Step 5: Each variable has ✅✅✅ (3 environments checked)
✅ Step 6: Verified all variables are listed
✅ Step 7: Redeployed the application
✅ Step 8: Tested receipt upload → Form auto-fills! 🎉
```

---

## Quick Reference Card

Copy this to keep handy:

```
═══════════════════════════════════════════════════════════
  VERCEL ENVIRONMENT VARIABLES - QUICK REFERENCE
═══════════════════════════════════════════════════════════

1. NEXT_PUBLIC_SUPABASE_URL
   → From: Supabase Dashboard → Settings → API

2. NEXT_PUBLIC_SUPABASE_ANON_KEY
   → From: Supabase Dashboard → Settings → API

3. ANTHROPIC_API_KEY
   → From: https://console.anthropic.com/settings/keys

4-6. GOOGLE_CLOUD_PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY
   → Run: node scripts/extract-vercel-env.js
   → Copy values from output

═══════════════════════════════════════════════════════════
  TO APPLY CHANGES
═══════════════════════════════════════════════════════════

git commit --allow-empty -m "chore: redeploy"
git push origin main

═══════════════════════════════════════════════════════════
```

---

## Done! 🎉

Your Vercel deployment should now support:
- ✅ Receipt OCR (Google Cloud Vision)
- ✅ AI parsing (Claude 3.5 Haiku)
- ✅ Auto-filling transaction forms
- ✅ Smart category suggestions

The same code works both locally and on Vercel - no changes needed!

---

**Need more help?** Check:
- `docs/VERCEL_ENV_SETUP.md` - Detailed written guide
- `docs/VERCEL_DEPLOYMENT.md` - Full deployment documentation
- `docs/RECEIPT_OCR_SYSTEM.md` - How the OCR system works
