/**
 * API Route: /api/transfers/matched
 * Purpose: Get all matched transfer transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('account_id')

    // Build query for matched transfers
    let query = supabase
      .from('main_transaction_details')
      .select('*')
      .in('transaction_type_code', ['TRF_OUT', 'TRF_IN'])
      .not('transfer_matched_transaction_id', 'is', null)

    // Filter by account if specified
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    // Order by date (most recent first)
    query = query.order('transaction_date', { ascending: false })
      .order('main_transaction_id', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching matched transfers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
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
