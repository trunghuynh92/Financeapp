/**
 * API Route: /api/accounts/[id]/available-credit
 * Get available credit for a credit account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Use RPC function to get available credit
    const { data, error } = await supabase.rpc('get_available_credit', {
      p_account_id: accountId
    })

    if (error) {
      console.error('Error fetching available credit:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Account not found or not a credit account' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: data[0]
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch available credit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
