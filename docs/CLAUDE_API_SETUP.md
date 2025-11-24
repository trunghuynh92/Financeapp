# Claude API Setup for Receipt Parsing

## Overview

We're using Claude API (Anthropic) to intelligently parse receipt OCR text. This provides much more accurate extraction than rule-based parsing.

## Cost Estimate

- **Model**: Claude 3.5 Haiku (fastest, cheapest)
- **Cost**: ~$0.001 per receipt (~1000 tokens input + 200 tokens output)
- **Monthly estimate**:
  - 100 receipts/month = $0.10
  - 1000 receipts/month = $1.00
  - 10,000 receipts/month = $10.00

Very affordable! 🎉

## Setup Steps

### 1. Get Your Claude API Key

1. Go to: https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy your API key (starts with `sk-ant-...`)

### 2. Add to Environment Variables

Add this line to your `.env.local` file:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### 3. Restart Dev Server

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

## How It Works

**Old Flow (Rule-based):**
```
OCR Text → Pattern Matching → Extract Fields
         ❌ Misses context
         ❌ Can't handle variations
```

**New Flow (AI-powered):**
```
OCR Text → Claude AI → Extract Fields
         ✅ Understands Vietnamese context
         ✅ Handles messy receipts
         ✅ Better category detection
```

## Testing

Once you've added the API key, upload a receipt and you should see:
- More accurate merchant name extraction
- Better category detection (e.g., tiNiWorld → Entertainment, not Food)
- Smarter date parsing
- Better amount extraction from messy OCR

## Fallback Behavior

If Claude API fails or is unavailable:
- Returns minimal data with confidence = 0
- Upload still succeeds
- You can manually enter data

## API Limits

**Free Tier:**
- $5 credit to start
- ~5,000 receipts before needing to pay

**Rate Limits:**
- 50 requests per minute
- Should be plenty for receipt uploads

## Need Help?

Check Claude API docs: https://docs.anthropic.com/en/api/getting-started
