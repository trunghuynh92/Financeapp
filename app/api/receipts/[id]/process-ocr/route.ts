/**
 * API Route: POST /api/receipts/[id]/process-ocr
 *
 * Purpose: Process receipt image with Google Cloud Vision OCR
 *
 * Flow:
 * 1. Get receipt from database
 * 2. Download image from Supabase Storage
 * 3. Process with Google Cloud Vision API
 * 4. Parse Vietnamese receipt data
 * 5. Update database with OCR results
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import vision from '@google-cloud/vision'
import { parseVietnameseReceipt, calculateConfidence } from '@/lib/receipt-parser'
import { parseReceiptWithAI } from '@/lib/ai-receipt-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const receiptId = params.id

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch receipt (RLS will automatically filter by user's entities)
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('*')
      .eq('receipt_id', receiptId)
      .single()

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found or access denied' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (receipt.processing_status === 'completed' && receipt.ocr_raw_text) {
      return NextResponse.json({
        message: 'Receipt already processed',
        data: {
          merchant_name: receipt.ocr_merchant_name,
          transaction_date: receipt.ocr_transaction_date,
          total_amount: receipt.ocr_total_amount,
          currency: receipt.ocr_currency,
          items: receipt.ocr_items,
          confidence: receipt.ocr_confidence,
        },
      })
    }

    // Update status to processing
    await supabase
      .from('receipts')
      .update({ processing_status: 'processing' })
      .eq('receipt_id', receiptId)

    // Download image from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(receipt.file_path)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      await supabase
        .from('receipts')
        .update({
          processing_status: 'failed',
          processing_error: 'Failed to download receipt file',
        })
        .eq('receipt_id', receiptId)

      return NextResponse.json(
        { error: 'Failed to download receipt file' },
        { status: 500 }
      )
    }

    // Convert blob to buffer for Google Cloud Vision
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Initialize Google Cloud Vision client
    const client = new vision.ImageAnnotatorClient()

    // Perform OCR
    const [result] = await client.textDetection({
      image: { content: buffer },
    })

    const detections = result.textAnnotations
    const rawText = detections?.[0]?.description || ''

    if (!rawText) {
      await supabase
        .from('receipts')
        .update({
          processing_status: 'failed',
          processing_error: 'No text found in receipt image',
        })
        .eq('receipt_id', receiptId)

      return NextResponse.json(
        { error: 'No text found in receipt' },
        { status: 400 }
      )
    }

    // Parse Vietnamese receipt with AI
    const parsedData = await parseReceiptWithAI(rawText)
    const confidence = parsedData.confidence

    // Update database with OCR results
    const { data: updatedReceipt, error: updateError } = await supabase
      .from('receipts')
      .update({
        ocr_raw_text: rawText,
        ocr_merchant_name: parsedData.merchantName,
        ocr_transaction_date: parsedData.transactionDate,
        ocr_total_amount: parsedData.totalAmount,
        ocr_currency: parsedData.currency,
        ocr_items: parsedData.items,
        ocr_confidence: confidence,
        ocr_processed_at: new Date().toISOString(),
        ocr_service: 'google_vision',
        processing_status: 'completed',
        processing_error: null,
        suggested_description: parsedData.suggestedDescription,
        suggested_category_code: parsedData.suggestedCategoryCode,
        suggested_category_name: parsedData.suggestedCategoryName,
      })
      .eq('receipt_id', receiptId)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save OCR results' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        receipt_id: updatedReceipt.receipt_id,
        merchant_name: updatedReceipt.ocr_merchant_name,
        transaction_date: updatedReceipt.ocr_transaction_date,
        total_amount: updatedReceipt.ocr_total_amount,
        currency: updatedReceipt.ocr_currency,
        items: updatedReceipt.ocr_items,
        confidence: updatedReceipt.ocr_confidence,
        raw_text: updatedReceipt.ocr_raw_text,
        suggested_description: updatedReceipt.suggested_description,
        suggested_category_code: updatedReceipt.suggested_category_code,
        suggested_category_name: updatedReceipt.suggested_category_name,
      },
    })
  } catch (error) {
    console.error('OCR processing error:', error)

    // Try to update receipt status to failed
    try {
      const supabase = createSupabaseServerClient()
      await supabase
        .from('receipts')
        .update({
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('receipt_id', params.id)
    } catch (dbError) {
      console.error('Failed to update error status:', dbError)
    }

    return NextResponse.json(
      {
        error: 'OCR processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
