import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateScheduledPaymentRequest, ScheduledPaymentOverview, ScheduledPaymentSummary } from '@/types/scheduled-payment'

// GET /api/scheduled-payments - List all scheduled payments with optional filters
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams

  // Get query parameters
  const entityId = searchParams.get('entity_id')
  const contractType = searchParams.get('contract_type')
  const status = searchParams.get('status')
  const payeeName = searchParams.get('payee_name')
  const categoryId = searchParams.get('category_id')
  const activeOnly = searchParams.get('active_only') === 'true'
  const includeSummary = searchParams.get('include_summary') === 'true'

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    // Build query for scheduled payment overview
    let query = supabase
      .from('scheduled_payment_overview')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (contractType) {
      query = query.eq('contract_type', contractType)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (payeeName) {
      query = query.ilike('payee_name', `%${payeeName}%`)
    }
    if (categoryId) {
      query = query.eq('category_id', parseInt(categoryId))
    }
    if (activeOnly) {
      query = query.eq('is_active', true).eq('status', 'active')
    }

    const { data: payments, error: paymentsError } = await query

    if (paymentsError) {
      console.error('Error fetching scheduled payments:', paymentsError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled payments', details: paymentsError.message },
        { status: 500 }
      )
    }

    // Calculate summary if requested
    let summary: ScheduledPaymentSummary | null = null
    if (includeSummary && payments) {
      const activePayments = payments.filter(p => p.is_active && p.status === 'active')

      // Calculate monthly obligation (sum of monthly recurring payments)
      const monthlyObligation = activePayments
        .filter(p => p.frequency === 'monthly')
        .reduce((sum, p) => sum + parseFloat(p.payment_amount.toString()), 0)

      summary = {
        total_contracts: payments.length,
        active_contracts: activePayments.length,
        total_monthly_obligation: monthlyObligation,
        upcoming_payments_count: activePayments.reduce((sum, p) => sum + p.pending_count, 0),
        overdue_payments_count: activePayments.reduce((sum, p) => sum + p.overdue_count, 0),
        total_paid_this_month: activePayments.reduce((sum, p) => sum + parseFloat(p.total_paid.toString()), 0),
        total_pending_this_month: activePayments.reduce((sum, p) => sum + parseFloat(p.total_pending.toString()), 0),
      }
    }

    return NextResponse.json({
      data: payments as ScheduledPaymentOverview[],
      summary,
      count: payments?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/scheduled-payments - Create new scheduled payment
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const body: CreateScheduledPaymentRequest = await request.json()

    // Validation
    if (!body.entity_id || !body.category_id || !body.contract_name || !body.payee_name) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, category_id, contract_name, payee_name' },
        { status: 400 }
      )
    }

    if (!body.payment_amount || body.payment_amount <= 0) {
      return NextResponse.json(
        { error: 'payment_amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!body.schedule_type) {
      return NextResponse.json(
        { error: 'schedule_type is required' },
        { status: 400 }
      )
    }

    // Validate schedule configuration
    if (body.schedule_type === 'recurring') {
      if (!body.frequency || !body.payment_day) {
        return NextResponse.json(
          { error: 'frequency and payment_day are required for recurring schedules' },
          { status: 400 }
        )
      }
      if (body.payment_day < 1 || body.payment_day > 31) {
        return NextResponse.json(
          { error: 'payment_day must be between 1 and 31' },
          { status: 400 }
        )
      }
    }

    if (body.schedule_type === 'custom_dates') {
      if (!body.custom_schedule || body.custom_schedule.length === 0) {
        return NextResponse.json(
          { error: 'custom_schedule is required for custom_dates schedule type' },
          { status: 400 }
        )
      }
    }

    // Validate date range
    if (body.end_date && new Date(body.end_date) < new Date(body.start_date)) {
      return NextResponse.json(
        { error: 'end_date must be after start_date' },
        { status: 400 }
      )
    }

    // Insert scheduled payment
    const { data: scheduledPayment, error: insertError } = await supabase
      .from('scheduled_payments')
      .insert([{
        entity_id: body.entity_id,
        category_id: body.category_id,
        contract_name: body.contract_name,
        contract_type: body.contract_type,
        payee_name: body.payee_name,
        contract_number: body.contract_number || null,
        payment_amount: body.payment_amount,
        schedule_type: body.schedule_type,
        frequency: body.frequency || null,
        payment_day: body.payment_day || null,
        start_date: body.start_date,
        end_date: body.end_date || null,
        custom_schedule: body.custom_schedule || null,
        notes: body.notes || null,
        status: 'active',
        is_active: true
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating scheduled payment:', insertError)
      return NextResponse.json(
        { error: 'Failed to create scheduled payment', details: insertError.message },
        { status: 500 }
      )
    }

    // Generate payment instances if requested (default: true)
    const generateInstances = body.generate_instances !== false
    const monthsAhead = body.months_ahead || 12

    if (generateInstances) {
      const { data: instanceData, error: instanceError } = await supabase
        .rpc('generate_payment_instances', {
          p_scheduled_payment_id: scheduledPayment.scheduled_payment_id,
          p_months_ahead: monthsAhead
        })

      if (instanceError) {
        console.error('Error generating instances:', instanceError)
        // Don't fail the request, just log the error
        console.warn('Created scheduled payment but failed to generate instances')
      }
    }

    // Fetch the created payment with overview data
    const { data: overview, error: overviewError } = await supabase
      .from('scheduled_payment_overview')
      .select('*')
      .eq('scheduled_payment_id', scheduledPayment.scheduled_payment_id)
      .single()

    if (overviewError) {
      // Return the basic data if overview fetch fails
      return NextResponse.json({
        data: scheduledPayment,
        message: 'Scheduled payment created successfully'
      }, { status: 201 })
    }

    return NextResponse.json({
      data: overview,
      message: 'Scheduled payment created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
