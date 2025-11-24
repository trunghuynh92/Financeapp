# Vercel Deployment Guide

**Last Updated:** 2025-01-24
**Status:** Production Ready

---

## Environment Variables Setup

To enable Receipt OCR and AI parsing on Vercel, you need to configure the following environment variables in your Vercel project settings.

### Required Environment Variables

#### 1. Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. Anthropic (Claude AI)
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Where to get it:**
- Go to https://console.anthropic.com/
- Navigate to API Keys
- Create a new API key or use existing one

#### 3. Google Cloud Vision API

You need to extract these values from your Google Cloud service account JSON file (`google-cloud-key.json`):

```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...
```

**How to extract from JSON file:**

Open your `google-cloud-key.json` and find these fields:

```json
{
  "project_id": "your-project-id",           // ← Copy this to GOOGLE_CLOUD_PROJECT_ID
  "client_email": "service-account@...",     // ← Copy this to GOOGLE_CLOUD_CLIENT_EMAIL
  "private_key": "-----BEGIN PRIVATE KEY..." // ← Copy this to GOOGLE_CLOUD_PRIVATE_KEY
}
```

**⚠️ Important Notes:**
- The `private_key` contains `\n` characters - keep them as-is
- Vercel will automatically handle the newlines
- Don't add extra quotes or formatting

---

## How to Add Environment Variables to Vercel

### Method 1: Using Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable one by one:
   - **Key:** Variable name (e.g., `ANTHROPIC_API_KEY`)
   - **Value:** The actual value
   - **Environments:** Select all (Production, Preview, Development)
4. Click **Save**

### Method 2: Using Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variables
vercel env add ANTHROPIC_API_KEY
vercel env add GOOGLE_CLOUD_PROJECT_ID
vercel env add GOOGLE_CLOUD_CLIENT_EMAIL
vercel env add GOOGLE_CLOUD_PRIVATE_KEY
```

### Method 3: Using .env File (For Initial Setup)

Create a `.env.production` file locally:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...
```

Then import to Vercel:

```bash
vercel env pull
```

---

## Testing the Deployment

After setting up environment variables:

1. **Redeploy your application:**
   ```bash
   git push origin main
   ```
   Or manually trigger a redeploy in Vercel dashboard

2. **Test receipt upload:**
   - Upload a receipt image in your deployed app
   - Check if the preview dialog auto-fills with OCR data
   - Verify merchant name, date, and amount are extracted

3. **Check logs if it fails:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the latest deployment
   - Go to **Runtime Logs**
   - Look for errors related to `vision` or `anthropic`

---

## Troubleshooting

### Issue: "OCR processing failed"

**Check:**
1. All environment variables are set correctly
2. Private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
3. No extra spaces or quotes in environment variables

**Verify in Vercel logs:**
```
Error: Could not load the default credentials
```
→ Google Cloud credentials are missing or incorrect

```
Error: Invalid API key
```
→ Anthropic API key is missing or incorrect

### Issue: "Receipt uploads but doesn't auto-fill"

**Possible causes:**
1. Environment variables not set
2. API keys expired or invalid
3. Google Cloud Vision API not enabled for your project

**Solution:**
- Check Vercel Runtime Logs for specific error messages
- Verify API keys are active and have correct permissions
- Ensure Google Cloud Vision API is enabled in GCP Console

### Issue: "Works locally but not on Vercel"

This is expected if you only set `GOOGLE_APPLICATION_CREDENTIALS` locally. The code now supports both:

- **Local**: Uses `GOOGLE_APPLICATION_CREDENTIALS` pointing to `./google-cloud-key.json`
- **Vercel**: Uses explicit environment variables (`GOOGLE_CLOUD_PROJECT_ID`, etc.)

---

## Code Changes for Dual Environment Support

The following files have been updated to support both local and Vercel environments:

### `app/api/receipts/upload/route.ts`
```typescript
// Support both file-based credentials (local) and explicit credentials (Vercel)
const client = process.env.GOOGLE_CLOUD_PROJECT_ID
  ? new vision.ImageAnnotatorClient({
      credentials: {
        project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      },
    })
  : new vision.ImageAnnotatorClient() // Uses GOOGLE_APPLICATION_CREDENTIALS
```

### `app/api/receipts/[id]/process-ocr/route.ts`
Same pattern as above.

---

## Security Best Practices

### DO:
✅ Use environment variables for all secrets
✅ Enable "Encrypt" option in Vercel for sensitive values
✅ Rotate API keys regularly
✅ Use different service accounts for dev/prod

### DON'T:
❌ Commit `.env.local` or `.env.production` to git
❌ Share API keys in Slack/email
❌ Use production keys in development
❌ Log API keys or credentials in console

---

## Environment Variable Checklist

Before deploying to Vercel, ensure you have:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `GOOGLE_CLOUD_PROJECT_ID`
- [ ] `GOOGLE_CLOUD_CLIENT_EMAIL`
- [ ] `GOOGLE_CLOUD_PRIVATE_KEY`
- [ ] All variables set for Production, Preview, and Development environments
- [ ] Redeployed after adding variables
- [ ] Tested receipt upload in production

---

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Google Cloud Vision API Setup](https://cloud.google.com/vision/docs/setup)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Supabase Environment Variables](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

---

## Support

If you encounter issues:

1. Check Vercel Runtime Logs first
2. Verify all environment variables are set
3. Test API keys using provided test scripts
4. Review the RECEIPT_OCR_SYSTEM.md documentation

For local development setup, see the main README.md.
