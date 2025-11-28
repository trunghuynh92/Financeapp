/**
 * API Route: POST /api/mobile/scan-receipt
 *
 * Purpose: Mobile-friendly receipt scanning endpoint that extracts transaction data
 * using OCR and returns the parsed results for transaction creation.
 *
 * Request: FormData with:
 * - file: File (image)
 *
 * Response:
 * - amount: number (extracted total amount)
 * - description: string (merchant name or generated description)
 * - date: string (YYYY-MM-DD format)
 * - vendor: string (merchant name)
 * - items: array (line items if detected)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import vision from '@google-cloud/vision'
import { parseReceiptWithAI } from '@/lib/ai-receipt-parser'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // Get authorization header for mobile auth
    const authHeader = request.headers.get('authorization')

    // Create Supabase client with anon key for token verification
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    })

    // Verify the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process with Google Cloud Vision
    let client: vision.ImageAnnotatorClient

    if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
      client = new vision.ImageAnnotatorClient({
        credentials: {
          project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        },
      })
    } else {
      client = new vision.ImageAnnotatorClient() // Uses GOOGLE_APPLICATION_CREDENTIALS
    }

    const [result] = await client.textDetection({
      image: { content: buffer },
    })

    const detections = result.textAnnotations
    const rawText = detections?.[0]?.description || ''

    if (!rawText) {
      return NextResponse.json(
        { error: 'No text found in receipt' },
        { status: 422 }
      )
    }

    // Parse with AI
    const parsedData = await parseReceiptWithAI(rawText)

    // Return mobile-friendly response
    return NextResponse.json({
      success: true,
      amount: parsedData.totalAmount,
      description: parsedData.suggestedDescription || parsedData.merchantName || 'Receipt',
      date: parsedData.transactionDate || new Date().toISOString().split('T')[0],
      vendor: parsedData.merchantName,
      items: parsedData.items,
      currency: parsedData.currency,
      confidence: parsedData.confidence,
      category_code: parsedData.suggestedCategoryCode,
      category_name: parsedData.suggestedCategoryName,
    })
  } catch (error) {
    console.error('Receipt scan error:', error)
    return NextResponse.json(
      { error: 'Failed to process receipt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
