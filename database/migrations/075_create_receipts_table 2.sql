/**
 * Migration 075: Create receipts table and storage setup
 *
 * Purpose: Add receipt upload functionality with OCR support
 *
 * Features:
 * - Store receipt images/PDFs linked to transactions
 * - OCR metadata for automatic data extraction
 * - Processing status tracking
 * - Supabase Storage bucket configuration
 *
 * Safety: This migration is completely additive - no existing tables modified
 */

-- ============================================================================
-- 1. Create receipts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations (linking to transactions)
  main_transaction_id INTEGER REFERENCES main_transaction(main_transaction_id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(account_id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,  -- Derived from account, no FK constraint (entities table structure unknown)

  -- File storage (Supabase Storage URLs)
  file_url TEXT NOT NULL,                           -- Full URL to receipt file
  file_path TEXT NOT NULL,                          -- Storage path (entity_id/receipt_id/filename)
  file_name TEXT NOT NULL,                          -- Original filename
  file_size INTEGER,                                -- File size in bytes
  file_type TEXT,                                   -- MIME type: image/jpeg, image/png, application/pdf

  -- OCR extraction results
  ocr_raw_text TEXT,                                -- Full extracted text from OCR
  ocr_merchant_name TEXT,                           -- Extracted merchant/vendor name
  ocr_transaction_date DATE,                        -- Extracted transaction date
  ocr_total_amount DECIMAL(15,2),                   -- Extracted total amount
  ocr_currency TEXT DEFAULT 'VND',                  -- Extracted currency
  ocr_items JSONB,                                  -- Array of line items with descriptions and amounts
  ocr_confidence DECIMAL(3,2),                      -- OCR confidence score (0.00 to 1.00)
  ocr_processed_at TIMESTAMP WITH TIME ZONE,        -- When OCR processing completed
  ocr_service TEXT,                                 -- OCR service used: 'google_vision', 'tesseract', etc.

  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,                            -- Error message if processing failed

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX idx_receipts_transaction ON receipts(main_transaction_id);
CREATE INDEX idx_receipts_account ON receipts(account_id);
CREATE INDEX idx_receipts_entity ON receipts(entity_id);
CREATE INDEX idx_receipts_status ON receipts(processing_status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX idx_receipts_created_by ON receipts(created_by);

-- ============================================================================
-- 3. Add updated_at trigger
-- ============================================================================

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view receipts from their entities
CREATE POLICY "Users can view receipts from their entities"
  ON receipts
  FOR SELECT
  TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert receipts to their entities
CREATE POLICY "Users can insert receipts to their entities"
  ON receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update receipts in their entities
CREATE POLICY "Users can update receipts in their entities"
  ON receipts
  FOR UPDATE
  TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete receipts in their entities
CREATE POLICY "Users can delete receipts in their entities"
  ON receipts
  FOR DELETE
  TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Create storage bucket for receipts (via SQL)
-- ============================================================================

-- Note: Supabase Storage buckets are usually created via Dashboard or API
-- This creates the bucket metadata in the database
-- You may need to also configure this in Supabase Dashboard

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,  -- Private bucket (not publicly accessible)
  10485760,  -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Create RLS policies for storage bucket
-- ============================================================================

-- Policy: Users can upload receipts to their entity folders
CREATE POLICY "Users can upload receipts to their entity folders"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts' AND
    -- Path format: entity_id/receipt_id/filename
    (storage.foldername(name))[1] IN (
      SELECT entity_id::text
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can view receipts from their entities
CREATE POLICY "Users can view receipts from their entities"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT entity_id::text
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update receipts in their entities
CREATE POLICY "Users can update receipts in their entities"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT entity_id::text
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete receipts from their entities
CREATE POLICY "Users can delete receipts from their entities"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT entity_id::text
      FROM entity_users
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. Add helpful comments
-- ============================================================================

COMMENT ON TABLE receipts IS 'Stores receipt images/PDFs with OCR extraction results';
COMMENT ON COLUMN receipts.receipt_id IS 'Unique identifier for the receipt';
COMMENT ON COLUMN receipts.main_transaction_id IS 'Link to transaction this receipt belongs to (optional)';
COMMENT ON COLUMN receipts.file_url IS 'Full Supabase Storage URL to access the receipt file';
COMMENT ON COLUMN receipts.file_path IS 'Storage path in format: entity_id/receipt_id/filename';
COMMENT ON COLUMN receipts.ocr_items IS 'JSON array of line items: [{description, amount, quantity}]';
COMMENT ON COLUMN receipts.processing_status IS 'OCR processing status: pending, processing, completed, failed';

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

-- Grant authenticated users access to receipts table
GRANT SELECT, INSERT, UPDATE, DELETE ON receipts TO authenticated;
-- No sequence needed - receipt_id is UUID with DEFAULT gen_random_uuid()

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verification queries (run these to verify migration worked):
-- SELECT * FROM receipts LIMIT 1;
-- SELECT * FROM storage.buckets WHERE id = 'receipts';
-- SELECT * FROM pg_policies WHERE tablename = 'receipts';
