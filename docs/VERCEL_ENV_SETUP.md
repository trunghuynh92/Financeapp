# Step-by-Step: Setting Up Vercel Environment Variables

**Time Required:** 10-15 minutes
**Difficulty:** Easy

---

## Overview

You need to add **6 environment variables** to your Vercel project. This guide shows you exactly how to do it.

---

## Step 1: Extract Google Cloud Credentials

### Open Your Google Cloud Key File

In your project folder, open the file: `google-cloud-key.json`

You'll see something like this:

```json
{
  "type": "service_account",
  "project_id": "finance-saas-ocr",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n",
  "client_email": "receipt-ocr-service@finance-saas-ocr.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  ...
}
```

### Copy These 3 Values

From your `google-cloud-key.json` file, you need:

1. **`project_id`**
   Example: `finance-saas-ocr`

2. **`client_email`**
   Example: `receipt-ocr-service@finance-saas-ocr.iam.gserviceaccount.com`

3. **`private_key`** (THE ENTIRE VALUE including the quotes)
   Example: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"`

**⚠️ IMPORTANT for `private_key`:**
- Copy the entire value starting with `"-----BEGIN` and ending with `-----\n"`
- Include the `\n` characters - they are important!
- Do NOT remove or change the newlines

---

## Step 2: Go to Vercel Dashboard

1. **Open your browser** and go to: https://vercel.com
2. **Login** to your account
3. **Click on your project** (the one you want to configure)

---

## Step 3: Navigate to Environment Variables

1. In your project dashboard, click **"Settings"** tab (top navigation)
2. In the left sidebar, click **"Environment Variables"**

You should now see a page with:
- A search box at the top
- A table showing existing environment variables (if any)
- An "Add New" button or input fields

---

## Step 4: Add Each Environment Variable

You'll add **6 variables** one by one. For each variable:

### Variable 1: NEXT_PUBLIC_SUPABASE_URL

1. **Key (Name):** `NEXT_PUBLIC_SUPABASE_URL`
2. **Value:** Your Supabase URL (looks like: `https://abcdefgh.supabase.co`)
   - Find this in your Supabase dashboard → Settings → API
3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"** or **"Add"**

---

### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

1. **Key (Name):** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. **Value:** Your Supabase anon/public key (long string starting with `eyJ...`)
   - Find this in your Supabase dashboard → Settings → API → Project API keys → `anon` `public`
3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"** or **"Add"**

---

### Variable 3: ANTHROPIC_API_KEY

1. **Key (Name):** `ANTHROPIC_API_KEY`
2. **Value:** Your Claude API key (starts with `sk-ant-api03-...`)
   - Get this from: https://console.anthropic.com/settings/keys
   - Click "Create Key" if you don't have one
3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"** or **"Add"**

---

### Variable 4: GOOGLE_CLOUD_PROJECT_ID

1. **Key (Name):** `GOOGLE_CLOUD_PROJECT_ID`
2. **Value:** Copy the `project_id` from your `google-cloud-key.json`
   - Example: `finance-saas-ocr`
3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"** or **"Add"**

---

### Variable 5: GOOGLE_CLOUD_CLIENT_EMAIL

1. **Key (Name):** `GOOGLE_CLOUD_CLIENT_EMAIL`
2. **Value:** Copy the `client_email` from your `google-cloud-key.json`
   - Example: `receipt-ocr-service@finance-saas-ocr.iam.gserviceaccount.com`
3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"** or **"Add"**

---

### Variable 6: GOOGLE_CLOUD_PRIVATE_KEY

**⚠️ This one is tricky - read carefully!**

1. **Key (Name):** `GOOGLE_CLOUD_PRIVATE_KEY`

2. **Value:** Copy the **entire** `private_key` value from your `google-cloud-key.json`

   **HOW TO COPY IT CORRECTLY:**

   Open `google-cloud-key.json` in a text editor (VS Code, Notepad++, etc.)

   Find the line that says `"private_key":` and copy **everything** from the opening quote to the closing quote, like this:

   ```json
   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...[LONG STRING]...\n-----END PRIVATE KEY-----\n"
   ```

   **What you should copy:**
   ```
   -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...[LONG STRING]...\n-----END PRIVATE KEY-----\n
   ```

   **⚠️ IMPORTANT NOTES:**
   - Do NOT include the `"private_key":` part
   - Do NOT include the outer quotes
   - DO include all the `\n` characters (they represent newlines)
   - The value should start with: `-----BEGIN PRIVATE KEY-----\n`
   - The value should end with: `\n-----END PRIVATE KEY-----\n`

3. **Select Environments:** Check all boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. Click **"Save"** or **"Add"**

---

## Step 5: Verify All Variables Are Added

After adding all 6 variables, scroll through the list and verify you see:

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `ANTHROPIC_API_KEY`
- ✅ `GOOGLE_CLOUD_PROJECT_ID`
- ✅ `GOOGLE_CLOUD_CLIENT_EMAIL`
- ✅ `GOOGLE_CLOUD_PRIVATE_KEY`

Each one should have green checkmarks next to "Production", "Preview", and "Development".

---

## Step 6: Redeploy Your Application

Environment variables are **only applied to new deployments**, so you need to trigger a redeploy.

### Option A: Push a New Commit (Recommended)

```bash
# Make a small change (or use an empty commit)
git commit --allow-empty -m "chore: trigger Vercel redeploy for env vars"

# Push to main branch
git push origin main
```

### Option B: Manual Redeploy in Vercel

1. Go to your project → **"Deployments"** tab
2. Find the latest deployment
3. Click the **three dots menu** (⋯) on the right
4. Click **"Redeploy"**
5. Confirm the redeploy

---

## Step 7: Test the Receipt Upload

1. **Wait for deployment to complete** (usually 1-2 minutes)
   - You'll see "Building..." → "Ready"

2. **Visit your production site** (e.g., `https://your-app.vercel.app`)

3. **Upload a receipt:**
   - Go to your dashboard
   - Click "Upload Receipt" or the upload button
   - Select a receipt image (JPG, PNG, or PDF)
   - Click "Upload"

4. **Verify it works:**
   - You should see "Uploading..." → "Analyzing receipt..."
   - The preview dialog should open
   - The form should be **automatically filled** with:
     - ✅ Merchant name
     - ✅ Amount
     - ✅ Date
     - ✅ Suggested category

If the form is empty or shows errors, proceed to Step 8.

---

## Step 8: Troubleshooting (If It Doesn't Work)

### Check Runtime Logs

1. Go to Vercel Dashboard → Your Project → **"Deployments"**
2. Click on the **latest deployment**
3. Click the **"Runtime Logs"** tab
4. Look for errors containing:
   - `vision` or `ImageAnnotatorClient`
   - `anthropic` or `parseReceiptWithAI`
   - `Could not load the default credentials`

### Common Errors and Fixes

#### Error: "Could not load the default credentials"

**Problem:** Google Cloud credentials are incorrect or missing

**Fix:**
- Double-check you copied the entire `private_key` including `\n` characters
- Make sure you copied `-----BEGIN PRIVATE KEY-----\n` at the start
- Make sure you copied `\n-----END PRIVATE KEY-----\n` at the end
- Try deleting `GOOGLE_CLOUD_PRIVATE_KEY` and re-adding it carefully

#### Error: "Invalid API key" or "Authentication failed"

**Problem:** Anthropic API key is wrong

**Fix:**
- Go to https://console.anthropic.com/settings/keys
- Copy the key again (it should start with `sk-ant-api03-`)
- Make sure there are no extra spaces or quotes
- Update the `ANTHROPIC_API_KEY` variable in Vercel

#### Error: "Receipt uploaded but form is empty"

**Problem:** OCR might be failing silently

**Fix:**
- Check Runtime Logs for specific errors
- Verify all 6 environment variables are set
- Try a different receipt image (clear, well-lit photo)
- Make sure Google Cloud Vision API is enabled in your GCP project

---

## Quick Copy-Paste Reference

Use this as a checklist when adding variables:

```
Variable 1:
Key:   NEXT_PUBLIC_SUPABASE_URL
Value: https://[your-project].supabase.co

Variable 2:
Key:   NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJ[your-anon-key]...

Variable 3:
Key:   ANTHROPIC_API_KEY
Value: sk-ant-api03-[your-key]...

Variable 4:
Key:   GOOGLE_CLOUD_PROJECT_ID
Value: [from google-cloud-key.json "project_id"]

Variable 5:
Key:   GOOGLE_CLOUD_CLIENT_EMAIL
Value: [from google-cloud-key.json "client_email"]

Variable 6:
Key:   GOOGLE_CLOUD_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----\n[long-key]\n-----END PRIVATE KEY-----\n
       (from google-cloud-key.json "private_key", without outer quotes)
```

---

## Helper Script to Extract Values

If you want to use a script to extract the values, run this in your terminal:

```bash
# Navigate to your project folder
cd /path/to/your/project

# Extract values from google-cloud-key.json
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./google-cloud-key.json', 'utf8'));
console.log('=== Copy these values to Vercel ===\n');
console.log('GOOGLE_CLOUD_PROJECT_ID:');
console.log(data.project_id);
console.log('\nGOOGLE_CLOUD_CLIENT_EMAIL:');
console.log(data.client_email);
console.log('\nGOOGLE_CLOUD_PRIVATE_KEY:');
console.log(data.private_key);
console.log('\n=== End of values ===');
"
```

Then copy-paste the output directly into Vercel.

---

## Video Tutorial (Alternative)

If you prefer video instructions, Vercel has an official guide:
https://vercel.com/docs/concepts/projects/environment-variables#adding-environment-variables

---

## Need Help?

If you're still having issues after following this guide:

1. **Check your local `.env.local` file** - make sure Anthropic key works locally first
2. **Test Google Cloud Vision locally** - run `node scripts/test-vision-api.js`
3. **Compare your setup** with the working local configuration
4. **Share the Runtime Logs** from Vercel for specific error messages

---

## Summary

✅ You need to add 6 environment variables to Vercel
✅ The tricky one is `GOOGLE_CLOUD_PRIVATE_KEY` - copy it carefully with `\n` characters
✅ After adding variables, you must redeploy
✅ Test by uploading a receipt - the form should auto-fill

That's it! Your Vercel deployment should now support OCR and AI parsing just like your local development environment.
