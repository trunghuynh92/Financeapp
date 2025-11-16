/**
 * API Route: /api/transactions/grouped
 * Get transactions grouped and aggregated by source
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const searchParams = request.nextUrl.searchParams

    // Filters
    const accountId = searchParams.get('account_id')
    const entityId = searchParams.get('entity_id')
    const transactionSource = searchParams.get('transaction_source')
    const search = searchParams.get('search')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // If entity_id filter is provided but no specific account, get all account IDs for that entity
    let effectiveAccountId = accountId
    if (entityId && !accountId) {
      const { data: entityAccounts } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', entityId)

      const accountIds = entityAccounts?.map(a => a.account_id) || []

      // If entity has no accounts, return empty result
      if (accountIds.length === 0) {
        return NextResponse.json({
          data: [],
          count: 0
        })
      }

      // For grouped view with entity filter, we need to filter results manually
      // since RPC doesn't support multiple account IDs
      // We'll fetch all and filter in-memory (not ideal but grouped view has fewer results)
      effectiveAccountId = null // We'll filter after fetching
    }

    // Use the dedicated RPC function for grouping
    const { data, error } = await supabase.rpc('get_grouped_transactions', {
      p_account_id: effectiveAccountId ? parseInt(effectiveAccountId) : null,
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
