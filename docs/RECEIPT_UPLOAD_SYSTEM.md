# Receipt Upload & OCR System

## Overview

Implement receipt upload functionality that extracts transaction data automatically using OCR (Optical Character Recognition). This feature will work on both web (file upload) and mobile (camera capture).

## System Architecture

```
┌─────────────────┐
│   User Action   │
│ Upload/Capture  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Image Upload   │
│   to Storage    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   OCR Service   │
│ Extract Receipt │
│      Data       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Parse & Map   │
│  to Transaction │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review & Confirm│
│  Save to DB     │
└─────────────────┘
```

## Phase 1: Basic Receipt Upload (Web)

### Features:
1. Upload receipt image (JPG, PNG, PDF)
2. Display image preview
3. Attach receipt to existing transaction
4. Store receipt in Supabase Storage

### Implementation Timeline: 1 week

## Phase 2: OCR Integration

### Features:
1. Extract text from receipt
2. Parse transaction details (date, amount, merchant)
3. Auto-fill transaction form
4. Manual review and correction

### Implementation Timeline: 2 weeks

## Phase 3: Mobile Camera Integration

### Features:
1. Camera capture on mobile
2. Real-time receipt detection
3. Edge detection and cropping
4. Same OCR pipeline as web

### Implementation Timeline: 1 week (after mobile app setup)

---

## OCR Service Options

### Option 1: Google Cloud Vision API (Recommended)

**Pros:**
- ✅ Excellent accuracy (best for receipts)
- ✅ Handles multiple languages (Vietnamese + English)
- ✅ Fast processing (~1-2 seconds)
- ✅ Built-in receipt parser
- ✅ Generous free tier (1,000 requests/month)

**Pricing:**
- First 1,000 requests/month: FREE
- After: $1.50 per 1,000 requests
- ~$0.0015 per receipt

**Example Response:**
```json
{
  "merchant": "Circle K",
  "date": "2025-11-21",
  "total": 125000,
  "currency": "VND",
  "items": [
    { "description": "Coca Cola", "amount": 15000 },
    { "description": "Sandwich", "amount": 35000 }
  ],
  "confidence": 0.95
}
```

### Option 2: Tesseract.js (Open Source)

**Pros:**
- ✅ Completely free
- ✅ Runs client-side (privacy)
- ✅ No API limits
- ✅ Works offline

**Cons:**
- ❌ Lower accuracy than Google Vision
- ❌ Slower processing (~5-10 seconds)
- ❌ Manual parsing required
- ❌ Less reliable with Vietnamese text

**Use Case:** Good for prototyping, not ideal for production

### Option 3: AWS Textract

**Pros:**
- ✅ Good accuracy
- ✅ Built-in receipt parsing
- ✅ Pay-as-you-go pricing

**Cons:**
- ❌ More expensive ($1.50 per 1,000 pages)
- ❌ No free tier
- ❌ Requires AWS setup

### Option 4: Mindee Receipt OCR API

**Pros:**
- ✅ Receipt-specific OCR
- ✅ Very accurate
- ✅ Free tier: 250 requests/month

**Cons:**
- ❌ Limited free tier
- ❌ Pricing: $0.10 per receipt after free tier

---

## Recommended Approach

### Phase 1: Start with Tesseract.js (Prototype)
- Fast implementation
- No cost
- Test user workflows
- Gather sample receipts

### Phase 2: Upgrade to Google Cloud Vision (Production)
- Better accuracy
- Handles Vietnamese receipts
- Scales with usage
- Reasonable pricing

---

## Database Schema

### New Table: `receipts`

```sql
CREATE TABLE receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  main_transaction_id INTEGER REFERENCES main_transaction(main_transaction_id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(account_id),
  entity_id UUID REFERENCES entities(entity_id),

  -- File storage
  file_url TEXT NOT NULL,                    -- Supabase Storage URL
  file_name TEXT NOT NULL,
  file_size INTEGER,                         -- Bytes
  file_type TEXT,                            -- image/jpeg, image/png, application/pdf

  -- OCR data
  ocr_raw_text TEXT,                         -- Full extracted text
  ocr_merchant_name TEXT,
  ocr_transaction_date DATE,
  ocr_total_amount DECIMAL(15,2),
  ocr_currency TEXT DEFAULT 'VND',
  ocr_items JSONB,                           -- Array of line items
  ocr_confidence DECIMAL(3,2),               -- 0.00 to 1.00
  ocr_processed_at TIMESTAMP WITH TIME ZONE,
  ocr_service TEXT,                          -- 'google_vision', 'tesseract', etc.

  -- Status
  processing_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  processing_error TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_receipts_transaction ON receipts(main_transaction_id);
CREATE INDEX idx_receipts_account ON receipts(account_id);
CREATE INDEX idx_receipts_entity ON receipts(entity_id);
CREATE INDEX idx_receipts_status ON receipts(processing_status);
```

### Supabase Storage Bucket

```sql
-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- RLS policy for receipts
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Users can view their receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete their receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');
```

---

## API Endpoints

### POST /api/receipts/upload

Upload receipt image and optionally process with OCR.

**Request:**
```typescript
// Form data
{
  file: File,                    // Image file
  account_id: number,            // Required
  process_ocr: boolean,          // Default: true
  main_transaction_id?: number   // Optional: attach to existing transaction
}
```

**Response:**
```json
{
  "receipt_id": "uuid",
  "file_url": "https://...",
  "processing_status": "processing",
  "ocr_data": null  // Will be populated when processing completes
}
```

### GET /api/receipts/[id]

Get receipt details including OCR results.

**Response:**
```json
{
  "receipt_id": "uuid",
  "file_url": "https://...",
  "processing_status": "completed",
  "ocr_data": {
    "merchant_name": "Circle K",
    "transaction_date": "2025-11-21",
    "total_amount": 125000,
    "currency": "VND",
    "items": [...],
    "confidence": 0.95
  }
}
```

### POST /api/receipts/[id]/process

Manually trigger OCR processing for uploaded receipt.

### DELETE /api/receipts/[id]

Delete receipt (file and database record).

### POST /api/receipts/[id]/create-transaction

Create transaction from OCR data.

**Request:**
```json
{
  "account_id": 123,
  "transaction_type_id": 5,
  "category_id": 10,
  // OCR data can be edited
  "date": "2025-11-21",
  "amount": 125000,
  "description": "Circle K - Convenience Store"
}
```

---

## UI Components

### 1. ReceiptUploadDialog (Web)

**Location:** `components/receipts/ReceiptUploadDialog.tsx`

**Features:**
- Drag & drop or click to upload
- Image preview
- File size validation (max 10MB)
- Supported formats: JPG, PNG, PDF
- Upload progress indicator

**Workflow:**
1. User selects/drops image
2. Preview shown immediately
3. Click "Upload & Scan" button
4. File uploads to Supabase Storage
5. OCR processing starts
6. Show extracted data
7. User reviews and creates transaction

### 2. ReceiptPreview Component

**Location:** `components/receipts/ReceiptPreview.tsx`

**Features:**
- Image viewer with zoom/pan
- OCR highlights (bounding boxes)
- Side-by-side: Image + Extracted Data
- Edit extracted fields
- Confidence indicators

### 3. ReceiptGallery Component

**Location:** `components/receipts/ReceiptGallery.tsx`

**Features:**
- Grid view of all receipts
- Filter by date, merchant, status
- Quick view modal
- Link to transaction
- Delete receipt

---

## OCR Processing Flow

### Google Cloud Vision Implementation

**1. Setup:**

```bash
npm install @google-cloud/vision
```

**2. API Route: `/api/receipts/process-ocr`**

```typescript
import vision from '@google-cloud/vision'

export async function POST(request: Request) {
  const { receipt_id, file_url } = await request.json()

  // Initialize Google Vision client
  const client = new vision.ImageAnnotatorClient({
    credentials: {
      project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    }
  })

  // Download image from Supabase Storage
  const imageBuffer = await fetchImageBuffer(file_url)

  // Detect text
  const [result] = await client.textDetection(imageBuffer)
  const fullText = result.fullTextAnnotation?.text || ''

  // Parse receipt data
  const receiptData = parseReceiptText(fullText)

  // Save to database
  await supabase
    .from('receipts')
    .update({
      ocr_raw_text: fullText,
      ocr_merchant_name: receiptData.merchant,
      ocr_transaction_date: receiptData.date,
      ocr_total_amount: receiptData.amount,
      ocr_items: receiptData.items,
      ocr_confidence: receiptData.confidence,
      processing_status: 'completed',
      ocr_processed_at: new Date().toISOString(),
      ocr_service: 'google_vision'
    })
    .eq('receipt_id', receipt_id)

  return NextResponse.json({ success: true, data: receiptData })
}

function parseReceiptText(text: string) {
  // Smart parsing logic for Vietnamese receipts
  const lines = text.split('\n')

  // Extract merchant (usually first few lines)
  const merchant = extractMerchantName(lines)

  // Extract date (look for DD/MM/YYYY or DD-MM-YYYY)
  const date = extractDate(text)

  // Extract total amount (look for "TỔNG" or "TOTAL" or "THANH TOÁN")
  const amount = extractTotalAmount(text)

  // Extract line items
  const items = extractLineItems(lines)

  return {
    merchant,
    date,
    amount,
    items,
    confidence: calculateConfidence(merchant, date, amount)
  }
}
```

### Vietnamese Receipt Patterns

**Common Keywords:**
- Merchant: Usually in first 2-3 lines
- Date: "Ngày:", "Date:", "DD/MM/YYYY"
- Total: "TỔNG", "TOTAL", "THANH TOÁN", "Cộng"
- Currency: "VND", "đ", "VNĐ"

**Example Receipt:**
```
     CIRCLE K VIETNAM
  142 Nguyễn Trãi, Q.1
     Ngày: 21/11/2025
─────────────────────────
Coca Cola 330ml    15.000đ
Sandwich           35.000đ
Snack              12.000đ
─────────────────────────
TỔNG CỘNG:         62.000đ
Tiền mặt:         100.000đ
Tiền thối:         38.000đ
```

**Parsing Logic:**
```typescript
function extractTotalAmount(text: string): number {
  // Look for patterns like "TỔNG CỘNG: 62.000đ" or "TOTAL: 62,000 VND"
  const patterns = [
    /TỔNG\s*CỘNG[:\s]+([0-9,.]+)/i,
    /TOTAL[:\s]+([0-9,.]+)/i,
    /THANH\s*TOÁN[:\s]+([0-9,.]+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      // Remove dots/commas and parse
      return parseFloat(match[1].replace(/[.,]/g, ''))
    }
  }

  return 0
}
```

---

## Mobile Integration

### React Native Camera

**Installation:**
```bash
npx expo install expo-camera expo-image-picker
```

**Mobile Component: `ReceiptCameraScreen.tsx`**

```typescript
import { Camera, CameraView } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'

export function ReceiptCameraScreen() {
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    })()
  }, [])

  const takePicture = async () => {
    const photo = await cameraRef.current?.takePictureAsync()
    // Upload and process
    await uploadReceipt(photo.uri)
  }

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled) {
      await uploadReceipt(result.assets[0].uri)
    }
  }

  return (
    <View>
      <CameraView ref={cameraRef} />
      <Button onPress={takePicture}>Take Photo</Button>
      <Button onPress={pickFromGallery}>Choose from Gallery</Button>
    </View>
  )
}
```

---

## Implementation Plan

### Week 1: Basic Upload (Web)

**Day 1-2: Database & Storage**
- [ ] Create `receipts` table migration
- [ ] Set up Supabase Storage bucket
- [ ] Configure RLS policies

**Day 3-4: Upload API**
- [ ] POST /api/receipts/upload endpoint
- [ ] File validation (size, type)
- [ ] Save to Supabase Storage
- [ ] Create database record

**Day 5: UI Components**
- [ ] ReceiptUploadDialog component
- [ ] Image preview
- [ ] Attach to transaction

### Week 2-3: OCR Integration

**Day 1-2: Google Cloud Vision Setup**
- [ ] Create Google Cloud project
- [ ] Enable Vision API
- [ ] Set up service account
- [ ] Add credentials to environment

**Day 3-5: OCR Processing**
- [ ] POST /api/receipts/process-ocr endpoint
- [ ] Text extraction
- [ ] Receipt parsing logic
- [ ] Handle Vietnamese receipts

**Day 6-8: Review & Create Transaction**
- [ ] ReceiptPreview component
- [ ] Edit extracted data
- [ ] Create transaction from receipt
- [ ] Link receipt to transaction

**Day 9-10: Testing & Refinement**
- [ ] Test with real Vietnamese receipts
- [ ] Improve parsing accuracy
- [ ] Error handling
- [ ] Loading states

### Week 4: Mobile Integration (After Mobile App Setup)

**Day 1-2: Camera Integration**
- [ ] Set up expo-camera
- [ ] Camera screen
- [ ] Photo gallery picker

**Day 3-4: Receipt Detection**
- [ ] Edge detection (optional)
- [ ] Auto-capture when receipt detected
- [ ] Image quality checks

**Day 5: Polish**
- [ ] Loading indicators
- [ ] Offline support
- [ ] Error handling

---

## Cost Estimation

### Google Cloud Vision Pricing

**Assumptions:**
- 100 receipts uploaded per month (small business)
- 1,000 receipts per month (medium business)

**Costs:**
| Monthly Receipts | Cost |
|-----------------|------|
| 0 - 1,000 | $0 (free tier) |
| 1,000 - 5,000 | $6 |
| 5,000 - 10,000 | $13.50 |

**Note:** Very affordable even at scale.

### Supabase Storage Pricing

- Free tier: 1GB storage
- Bandwidth: 2GB/month free
- Average receipt: 500KB - 2MB
- 1,000 receipts ≈ 500MB - 2GB

**Cost:** Free tier sufficient for most users

---

## User Experience Flow

### Web Flow

1. **Upload Receipt**
   - Click "Add Transaction" → "Upload Receipt"
   - Drag & drop or browse for image
   - Preview shows immediately

2. **OCR Processing**
   - "Scanning receipt..." loading state
   - Progress: Upload → OCR → Parsing
   - Takes 2-5 seconds

3. **Review & Edit**
   - Split screen: Image on left, Form on right
   - Extracted data pre-filled
   - Highlight fields with low confidence (yellow)
   - User can edit any field

4. **Create Transaction**
   - Click "Create Transaction"
   - Transaction saved
   - Receipt linked
   - Can view receipt from transaction details

### Mobile Flow

1. **Quick Add from Camera**
   - Tap "+" button → "Scan Receipt"
   - Camera opens with viewfinder
   - Tap capture or auto-capture when detected

2. **Instant Processing**
   - Upload starts immediately
   - Can continue using app
   - Notification when OCR completes

3. **Quick Review**
   - Swipe notification to review
   - Quick edit form (mobile optimized)
   - One-tap to save

---

## Advanced Features (Future)

### Auto-Categorization
- Use merchant name to auto-select category
- Machine learning to improve over time
- User can train by confirming suggestions

### Duplicate Detection
- Check for similar receipts (same date, amount, merchant)
- Warn before creating duplicate transaction

### Multi-Receipt Batch Upload
- Upload multiple receipts at once
- Process in background
- Queue system for OCR

### Receipt Analytics
- Most frequent merchants
- Category breakdown
- Monthly spending by merchant

### Export Receipts
- Generate PDF with all receipts for tax
- Include transaction details
- Filter by date range, category

---

## Technical Considerations

### Image Quality
- Minimum resolution: 640x480
- Maximum file size: 10MB
- Auto-compress images > 5MB
- Convert HEIC to JPG on iOS

### Privacy & Security
- Receipts contain sensitive data
- Store in private Supabase bucket (not public)
- RLS policies enforce access control
- Option to blur sensitive info

### Performance
- Lazy load receipt images
- Thumbnail generation
- CDN for faster delivery
- Background processing for OCR

### Error Handling
- OCR failed: Allow manual entry
- Low confidence: Highlight for review
- Network errors: Retry logic
- Corrupted images: Validation

---

## Next Steps

1. **Decide on OCR service:**
   - Start with Tesseract.js for prototype?
   - Or go directly to Google Cloud Vision?

2. **Create database migration:**
   - receipts table
   - Storage bucket setup

3. **Build basic upload UI:**
   - ReceiptUploadDialog
   - File upload to Supabase

4. **Integrate OCR:**
   - Google Cloud Vision setup
   - Parsing logic

5. **Test with real receipts:**
   - Vietnamese receipts
   - Different formats
   - Refine parsing

**Estimated Timeline:** 3-4 weeks for full implementation

Should I help you get started with Phase 1 (basic upload)?
