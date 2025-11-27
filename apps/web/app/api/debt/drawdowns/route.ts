/**
 * API Route: /api/debt/drawdowns
 * Purpose: Get all drawdowns for a specific debt account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id parameter is required' },
        { status: 400 }
      )
    }

    // Fetch all drawdowns for the specified account
    const { data: drawdowns, error } = await supabase
      .from('debt_drawdown')
      .select(`
        drawdown_id,
        drawdown_reference,
        original_amount,
        remaining_balance,
        status,
        drawdown_date,
        due_date,
        is_overpaid,
        account_id
      `)
      .eq('account_id', parseInt(accountId))
      .order('drawdown_date', { ascending: false })

    if (error) {
      console.error('Error fetching drawdowns:', error)
      return NextResponse.json(
        { error: 'Failed to fetch drawdowns' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: drawdowns || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
