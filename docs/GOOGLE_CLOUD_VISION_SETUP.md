# Google Cloud Vision API Setup Guide

This guide will help you set up Google Cloud Vision API for OCR receipt processing.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

## Step 2: Enable Cloud Vision API

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Cloud Vision API"
3. Click **Enable**

## Step 3: Create Service Account & Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in details:
   - **Service account name**: `receipt-ocr-service`
   - **Service account ID**: Auto-generated
   - **Description**: "Service account for receipt OCR processing"
4. Click **Create and Continue**
5. Grant role: **Cloud Vision AI Service Agent**
6. Click **Continue** > **Done**

## Step 4: Generate JSON Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create**
6. A JSON file will be downloaded - **keep this safe!**

## Step 5: Add Credentials to Your Project

### Option A: Using JSON Key File (Recommended for Development)

1. Save the downloaded JSON file to your project root as `google-cloud-key.json`
2. Add to `.gitignore`:
   ```
   google-cloud-key.json
   ```
3. Add to `.env.local`:
   ```bash
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-key.json
   ```

### Option B: Using Base64 Encoded Credentials (Recommended for Production)

1. Convert JSON to base64:
   ```bash
   cat google-cloud-key.json | base64
   ```
2. Add to `.env.local`:
   ```bash
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_CREDENTIALS_BASE64=paste-base64-here
   ```

## Step 6: Install Dependencies

```bash
npm install @google-cloud/vision
```

## Step 7: Verify Setup

Test the connection by running:
```bash
node scripts/test-vision-api.js
```

## Pricing

- **Free Tier**: 1,000 requests/month
- **After Free Tier**: $1.50 per 1,000 requests
- **Cost per receipt**: ~$0.0015

For 100 receipts/month: **FREE**
For 1,000 receipts/month: **FREE**
For 10,000 receipts/month: **$13.50**

## Security Best Practices

1. ✅ Never commit `google-cloud-key.json` to git
2. ✅ Use environment variables for credentials
3. ✅ Use base64 encoding for production deployment
4. ✅ Restrict service account permissions to Vision API only
5. ✅ Enable Cloud Audit Logs to monitor API usage

## Troubleshooting

### Error: "Permission denied"
- Make sure the service account has "Cloud Vision AI Service Agent" role
- Verify the JSON key is valid and not expired

### Error: "API not enabled"
- Make sure Cloud Vision API is enabled in your project
- Wait a few minutes after enabling (can take up to 5 minutes)

### Error: "Invalid credentials"
- Check that `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Verify the JSON file is not corrupted
- Try using base64 encoded credentials instead

## Next Steps

After setup is complete:
1. Test with a sample receipt
2. Implement Vietnamese text parsing
3. Fine-tune extraction patterns
4. Add confidence thresholds
