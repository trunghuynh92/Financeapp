/**
 * API Route: /api/transactions/grouped
 * Get transactions grouped and aggregated by source
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Filters
    const accountId = searchParams.get('account_id')
    const transactionSource = searchParams.get('transaction_source')
    const search = searchParams.get('search')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Use the dedicated RPC function for grouping
    const { data, error } = await supabase.rpc('get_grouped_transactions', {
      p_account_id: accountId ? parseInt(accountId) : null,
      p_transaction_source: (transactionSource && transactionSource !== 'all') ? transactionSource : null,
      p_search: search || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    })

    if (error) {
      console.error('Error fetching grouped transactions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch grouped transactions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
