/**
 * API Route: /api/budgets
 * Purpose: List budgets and create new budgets
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateBudgetRequest, BudgetOverview, BudgetSummary } from '@/types/budget'

// ==============================================================================
// GET - List budgets with spending data
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(request.url)

    // Query parameters
    const entityId = searchParams.get('entity_id')
    const categoryId = searchParams.get('category_id')
    const status = searchParams.get('status')
    const activeOnly = searchParams.get('active_only') === 'true'
    const includeSummary = searchParams.get('include_summary') === 'true'

    if (!entityId) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('budget_overview')
      .select('*')
      .eq('entity_id', entityId)
      .order('start_date', { ascending: false })

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', parseInt(categoryId))
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (activeOnly) {
      query = query.eq('is_active', true).eq('status', 'active')
    }

    const { data: budgets, error } = await query

    if (error) {
      console.error('Error fetching budgets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate summary if requested
    let summary: BudgetSummary | null = null
    if (includeSummary && budgets) {
      const activeBudgets = budgets.filter((b: BudgetOverview) => b.status === 'active' && b.is_active)

      summary = {
        total_budgets: budgets.length,
        active_budgets: activeBudgets.length,
        total_budget_amount: activeBudgets.reduce((sum: number, b: BudgetOverview) => sum + parseFloat(b.budget_amount.toString()), 0),
        total_spent: activeBudgets.reduce((sum: number, b: BudgetOverview) => sum + parseFloat(b.spent_amount.toString()), 0),
        total_remaining: activeBudgets.reduce((sum: number, b: BudgetOverview) => sum + parseFloat(b.remaining_amount.toString()), 0),
        budgets_exceeded: activeBudgets.filter((b: BudgetOverview) => b.budget_status === 'exceeded').length,
        budgets_warning: activeBudgets.filter((b: BudgetOverview) => b.budget_status === 'warning').length,
        budgets_on_track: activeBudgets.filter((b: BudgetOverview) => b.budget_status === 'on_track').length,
      }
    }

    return NextResponse.json({
      data: budgets,
      summary,
      count: budgets?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create new budget
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body: CreateBudgetRequest = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validation
    if (!body.entity_id || !body.category_id || !body.budget_amount || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, category_id, budget_amount, start_date, end_date' },
        { status: 400 }
      )
    }

    if (body.budget_amount <= 0) {
      return NextResponse.json(
        { error: 'Budget amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(body.start_date)
    const endDate = new Date(body.end_date)

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Check for overlapping budgets (optional warning, not blocking)
    const { data: overlapping } = await supabase
      .from('category_budgets')
      .select('budget_id, budget_name')
      .eq('entity_id', body.entity_id)
      .eq('category_id', body.category_id)
      .eq('is_active', true)
      .or(`start_date.lte.${body.end_date},end_date.gte.${body.start_date}`)

    // Create budget
    const { data, error } = await supabase
      .from('category_budgets')
      .insert([{
        entity_id: body.entity_id,
        category_id: body.category_id,
        budget_name: body.budget_name || null,
        budget_amount: body.budget_amount,
        start_date: body.start_date,
        end_date: body.end_date,
        recurring_period: body.recurring_period || 'one-time',
        auto_renew: body.auto_renew || false,
        alert_threshold: body.alert_threshold || 80,
        notes: body.notes || null,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating budget:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return with warning if overlapping budgets exist
    return NextResponse.json({
      data,
      message: 'Budget created successfully',
      warning: overlapping && overlapping.length > 0
        ? `Note: ${overlapping.length} overlapping budget(s) exist for this category`
        : null,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
