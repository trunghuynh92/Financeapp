/**
 * API Route: /api/receipts/[id]
 *
 * Purpose: Get, update, or delete a single receipt
 *
 * GET: Retrieve receipt details with OCR data
 * DELETE: Delete receipt file and database record
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ==============================================================================
// GET - Get single receipt with full details
// ==============================================================================

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

    // Fetch receipt (RLS will automatically filter by user's entities)
    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('receipt_id', receiptId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Receipt not found or access denied' },
          { status: 404 }
        )
      }
      console.error('Error fetching receipt:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: receipt })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Delete receipt file and database record
// ==============================================================================

export async function DELETE(
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

    // Fetch receipt to get file_path and check permissions
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('receipt_id, file_path, entity_id')
      .eq('receipt_id', receiptId)
      .single()

    if (fetchError || !receipt) {
      return NextResponse.json(
        { error: 'Receipt not found or access denied' },
        { status: 404 }
      )
    }

    // Check write permissions
    const { data: entityUser } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', receipt.entity_id)
      .eq('user_id', user.id)
      .single()

    if (!entityUser || entityUser.role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete receipt' },
        { status: 403 }
      )
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('receipts')
      .remove([receipt.file_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue anyway to delete database record
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('receipt_id', receiptId)

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete receipt' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
