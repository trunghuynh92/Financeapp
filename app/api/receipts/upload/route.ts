/**
 * API Route: POST /api/receipts/upload
 *
 * Purpose: Upload receipt image/PDF and save to Supabase Storage
 *
 * Request: FormData with:
 * - file: File (image or PDF)
 * - account_id: number
 * - entity_id: string (UUID)
 * - main_transaction_id?: number (optional, link to existing transaction)
 * - process_ocr?: boolean (default: false, set true to trigger OCR)
 *
 * Response:
 * - receipt_id: UUID
 * - file_url: string (Supabase Storage URL)
 * - processing_status: 'pending' | 'processing'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const accountId = parseInt(formData.get('account_id') as string)
    const entityId = formData.get('entity_id') as string
    const mainTransactionId = formData.get('main_transaction_id')
      ? parseInt(formData.get('main_transaction_id') as string)
      : null
    const processOCR = formData.get('process_ocr') === 'true'

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!accountId || !entityId) {
      return NextResponse.json(
        { error: 'account_id and entity_id are required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Check if user has access to this entity
    const { data: entityUser, error: entityError } = await supabase
      .from('entity_users')
      .select('entity_id, role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .single()

    if (entityError || !entityUser) {
      return NextResponse.json(
        { error: 'Access denied to this entity' },
        { status: 403 }
      )
    }

    // Check if user can write (editor or admin)
    if (entityUser.role === 'viewer') {
      return NextResponse.json(
        { error: 'Viewers cannot upload receipts' },
        { status: 403 }
      )
    }

    // Generate receipt ID and file path
    const receiptId = crypto.randomUUID()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${entityId}/${receiptId}/${fileName}`

    // Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('receipts').getPublicUrl(filePath)

    // Create receipt record in database
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert({
        receipt_id: receiptId,
        main_transaction_id: mainTransactionId,
        account_id: accountId,
        entity_id: entityId,
        file_url: publicUrl,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        processing_status: processOCR ? 'pending' : 'completed',
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)

      // Cleanup: delete uploaded file if database insert fails
      await supabase.storage.from('receipts').remove([filePath])

      return NextResponse.json(
        { error: 'Failed to create receipt record' },
        { status: 500 }
      )
    }

    // TODO: If processOCR is true, trigger OCR processing
    // This will be implemented in the next phase with Google Cloud Vision

    return NextResponse.json(
      {
        success: true,
        data: {
          receipt_id: receipt.receipt_id,
          file_url: receipt.file_url,
          file_name: receipt.file_name,
          file_size: receipt.file_size,
          processing_status: receipt.processing_status,
          created_at: receipt.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
