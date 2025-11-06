/**
 * API Route: /api/admin/main-transactions/backfill
 * Purpose: Check for and backfill main_transactions for existing original_transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==============================================================================
// GET - Check for unprocessed original_transactions
// ==============================================================================

export async function GET() {
  try {
    // Call the database function to get unprocessed originals
    const { data, error } = await supabase.rpc('get_unprocessed_originals')

    if (error) {
      console.error('Error fetching unprocessed originals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch unprocessed originals', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      unprocessed: data || [],
      message:
        data && data.length > 0
          ? `Found ${data.length} original transaction${data.length === 1 ? '' : 's'} without main_transaction records`
          : 'All original transactions have corresponding main_transaction records',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Backfill main_transactions for all unprocessed originals
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    // Call the database function to backfill main_transactions
    const { data, error } = await supabase.rpc('backfill_main_transactions')

    if (error) {
      console.error('Error during backfill:', error)
      return NextResponse.json(
        { error: 'Failed to backfill main_transactions', details: error.message },
        { status: 500 }
      )
    }

    // Extract result from function
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null

    if (!result) {
      return NextResponse.json(
        { error: 'Backfill function returned no result' },
        { status: 500 }
      )
    }

    const { processed_count, error_count, errors } = result

    // Log any errors
    if (error_count > 0 && errors && errors.length > 0) {
      console.error('Backfill errors:', errors)
    }

    return NextResponse.json({
      success: true,
      processedCount: processed_count || 0,
      errorCount: error_count || 0,
      errors: errors || [],
      message: `Successfully created ${processed_count || 0} main_transaction record${
        processed_count === 1 ? '' : 's'
      }${error_count > 0 ? ` with ${error_count} error${error_count === 1 ? '' : 's'}` : ''}`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
