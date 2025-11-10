/**
 * API Route: /api/accounts/[id]/transaction-dates
 * Get earliest and latest transaction dates for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Get count of transactions
    const { count, error: countError } = await supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('is_balance_adjustment', false)

    if (countError) {
      console.error('Error counting transactions:', countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if (!count || count === 0) {
      return NextResponse.json({
        data: {
          earliest_date: null,
          latest_date: null,
          transaction_count: 0,
        },
      })
    }

    // Get earliest transaction date
    const { data: earliestData, error: earliestError } = await supabase
      .from('original_transaction')
      .select('transaction_date')
      .eq('account_id', accountId)
      .eq('is_balance_adjustment', false)
      .order('transaction_date', { ascending: true })
      .limit(1)

    // Get latest transaction date
    const { data: latestData, error: latestError } = await supabase
      .from('original_transaction')
      .select('transaction_date')
      .eq('account_id', accountId)
      .eq('is_balance_adjustment', false)
      .order('transaction_date', { ascending: false })
      .limit(1)

    if (earliestError || latestError) {
      console.error('Error fetching transaction dates:', earliestError || latestError)
      return NextResponse.json({ error: 'Failed to fetch transaction dates' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        earliest_date: earliestData?.[0]?.transaction_date || null,
        latest_date: latestData?.[0]?.transaction_date || null,
        transaction_count: count,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
