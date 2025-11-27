/**
 * Scenario Adjustments API
 * POST - Add adjustment to a scenario
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { id } = await params
  const scenarioId = parseInt(id)

  if (isNaN(scenarioId)) {
    return NextResponse.json(
      { error: 'Invalid scenario ID' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const {
      adjustment_type,
      name,
      amount,
      percentage,
      start_month,
      end_month,
      category_id,
      scheduled_payment_id,
      account_id,
      metadata
    } = body

    // Validate required fields
    if (!adjustment_type || !name) {
      return NextResponse.json(
        { error: 'adjustment_type and name are required' },
        { status: 400 }
      )
    }

    // Validate adjustment type specific requirements
    const amountTypes = ['one_time_income', 'one_time_expense', 'recurring_income', 'recurring_expense', 'debt_drawdown']
    const percentageTypes = ['modify_predicted', 'modify_income']

    if (amountTypes.includes(adjustment_type) && (amount === undefined || amount === null)) {
      return NextResponse.json(
        { error: `amount is required for ${adjustment_type}` },
        { status: 400 }
      )
    }

    if (percentageTypes.includes(adjustment_type) && (percentage === undefined || percentage === null)) {
      return NextResponse.json(
        { error: `percentage is required for ${adjustment_type}` },
        { status: 400 }
      )
    }

    // Verify scenario exists
    console.log('[Adjustment API] Checking scenario:', scenarioId)
    const { data: scenario, error: scenarioError } = await supabase
      .from('cashflow_scenarios')
      .select('scenario_id')
      .eq('scenario_id', scenarioId)
      .single()

    if (scenarioError) {
      console.error('[Adjustment API] Scenario check error:', JSON.stringify(scenarioError, null, 2))
      return NextResponse.json(
        { error: 'Scenario check failed', details: scenarioError.message },
        { status: 500 }
      )
    }

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    console.log('[Adjustment API] Scenario found, creating adjustment...')
    console.log('[Adjustment API] Adjustment data:', { adjustment_type, name, amount, percentage, start_month, end_month })

    // Convert YYYY-MM format to YYYY-MM-01 for database DATE type
    const formatMonthToDate = (month: string | null | undefined): string | null => {
      if (!month) return null
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(month)) return month
      // If in YYYY-MM format, append -01
      if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
      return month
    }

    const formattedStartMonth = formatMonthToDate(start_month)
    const formattedEndMonth = formatMonthToDate(end_month)

    console.log('[Adjustment API] Formatted dates:', { formattedStartMonth, formattedEndMonth })

    // Create adjustment
    const { data: adjustment, error } = await supabase
      .from('scenario_adjustments')
      .insert({
        scenario_id: scenarioId,
        adjustment_type,
        name,
        amount: amount || null,
        percentage: percentage || null,
        start_month: formattedStartMonth,
        end_month: formattedEndMonth,
        category_id: category_id || null,
        scheduled_payment_id: scheduled_payment_id || null,
        account_id: account_id || null,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('[Adjustment API] Error creating adjustment:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to create adjustment', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: adjustment }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
