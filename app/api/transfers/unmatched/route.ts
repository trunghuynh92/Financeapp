/**
 * API Route: /api/transfers/unmatched
 * Purpose: Get all unmatched transfer transactions (TRF_OUT, TRF_IN, DEBT_DRAW, DEBT_ACQ without matches)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('account_id')

    // Build query for unmatched transfers and debt transactions
    let query = supabase
      .from('main_transaction_details')
      .select('*')
      .in('transaction_type_code', ['TRF_OUT', 'TRF_IN', 'DEBT_DRAW', 'DEBT_ACQ'])
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

    // Separate by type for easier UI handling
    const transfersOut = data?.filter(t => t.transaction_type_code === 'TRF_OUT') || []
    const transfersIn = data?.filter(t => t.transaction_type_code === 'TRF_IN') || []
    const debtDrawdowns = data?.filter(t => t.transaction_type_code === 'DEBT_DRAW') || []
    const debtAcquired = data?.filter(t => t.transaction_type_code === 'DEBT_ACQ') || []

    return NextResponse.json({
      data: data || [],
      transfersOut,
      transfersIn,
      debtDrawdowns,
      debtAcquired,
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
