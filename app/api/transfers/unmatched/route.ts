/**
 * API Route: /api/transfers/unmatched
 * Purpose: Get all unmatched transfer transactions (TRF_OUT and TRF_IN without matches)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('account_id')

    // Build query for unmatched transfers
    let query = supabase
      .from('main_transaction_details')
      .select('*')
      .in('transaction_type_code', ['TRF_OUT', 'TRF_IN'])
      .is('transfer_matched_transaction_id', null)

    // Filter by account if specified
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    // Order by date (most recent first)
    query = query.order('transaction_date', { ascending: false })
      .order('main_transaction_id', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching unmatched transfers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Separate into TRF_OUT and TRF_IN for easier UI handling
    const transfersOut = data?.filter(t => t.transaction_type_code === 'TRF_OUT') || []
    const transfersIn = data?.filter(t => t.transaction_type_code === 'TRF_IN') || []

    return NextResponse.json({
      data: data || [],
      transfersOut,
      transfersIn,
      total: data?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
