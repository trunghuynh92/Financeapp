// Receipt Types

export type ReceiptProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ReceiptOCRService = 'google_vision' | 'tesseract' | 'manual'

export interface Receipt {
  receipt_id: string
  main_transaction_id: number | null
  account_id: number | null
  entity_id: string

  // File storage
  file_url: string
  file_path: string
  file_name: string
  file_size: number | null
  file_type: string | null

  // OCR extraction
  ocr_raw_text: string | null
  ocr_merchant_name: string | null
  ocr_transaction_date: string | null
  ocr_total_amount: number | null
  ocr_currency: string
  ocr_items: ReceiptLineItem[] | null
  ocr_confidence: number | null
  ocr_processed_at: string | null
  ocr_service: ReceiptOCRService | null

  // Processing status
  processing_status: ReceiptProcessingStatus
  processing_error: string | null

  // Metadata
  created_at: string
  created_by: string | null
  updated_at: string
}

export interface ReceiptLineItem {
  description: string
  amount: number
  quantity?: number
}

export interface ReceiptUploadRequest {
  account_id: number
  entity_id: string
  main_transaction_id?: number
  process_ocr?: boolean
}

export interface ReceiptUploadResponse {
  receipt_id: string
  file_url: string
  processing_status: ReceiptProcessingStatus
  ocr_data: ReceiptOCRData | null
}

export interface ReceiptOCRData {
  merchant_name: string | null
  transaction_date: string | null
  total_amount: number | null
  currency: string
  items: ReceiptLineItem[]
  confidence: number
  raw_text: string
}

export interface CreateTransactionFromReceiptRequest {
  receipt_id: string
  account_id: number
  transaction_type_id: number
  category_id?: number
  branch_id?: number
  date: string
  amount: number
  description: string
}
