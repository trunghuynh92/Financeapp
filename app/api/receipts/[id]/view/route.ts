/**
 * API Route: GET /api/receipts/[id]/view
 *
 * Purpose: Serve receipt file with authentication
 * Returns the actual image/PDF file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(
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

    // Get receipt metadata (RLS will check access)
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('file_path, file_type')
      .eq('receipt_id', receiptId)
      .single()

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found or access denied' },
        { status: 404 }
      )
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(receipt.file_path)

    if (downloadError || !fileData) {
      console.error('Error downloading receipt:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download receipt file' },
        { status: 500 }
      )
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Return file with appropriate content type
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': receipt.file_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="receipt-${receiptId}"`,
      },
    })
  } catch (error) {
    console.error('Error serving receipt:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
