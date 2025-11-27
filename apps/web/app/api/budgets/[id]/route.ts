/**
 * API Route: /api/budgets/[id]
 * Purpose: Get, update, or delete a single budget
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateBudgetRequest } from '@/types/budget'

// ==============================================================================
// GET - Get single budget with spending data
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const budgetId = parseInt(params.id, 10)

    if (isNaN(budgetId)) {
      return NextResponse.json(
        { error: 'Invalid budget ID' },
        { status: 400 }
      )
    }

    // Get budget from view (includes spending data)
    const { data, error } = await supabase
      .from('budget_overview')
      .select('*')
      .eq('budget_id', budgetId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Budget not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching budget:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update budget
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const budgetId = parseInt(params.id, 10)

    if (isNaN(budgetId)) {
      return NextResponse.json(
        { error: 'Invalid budget ID' },
        { status: 400 }
      )
    }

    const body: UpdateBudgetRequest = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if budget exists
    const { data: existing, error: fetchError } = await supabase
      .from('category_budgets')
      .select('budget_id, entity_id')
      .eq('budget_id', budgetId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      )
    }

    // Build updates object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (body.budget_name !== undefined) updates.budget_name = body.budget_name
    if (body.budget_amount !== undefined) {
      if (body.budget_amount <= 0) {
        return NextResponse.json(
          { error: 'Budget amount must be greater than 0' },
          { status: 400 }
        )
      }
      updates.budget_amount = body.budget_amount
    }
    if (body.start_date !== undefined) updates.start_date = body.start_date
    if (body.end_date !== undefined) updates.end_date = body.end_date
    if (body.recurring_period !== undefined) updates.recurring_period = body.recurring_period
    if (body.auto_renew !== undefined) updates.auto_renew = body.auto_renew
    if (body.status !== undefined) updates.status = body.status
    if (body.alert_threshold !== undefined) {
      if (body.alert_threshold < 0 || body.alert_threshold > 100) {
        return NextResponse.json(
          { error: 'Alert threshold must be between 0 and 100' },
          { status: 400 }
        )
      }
      updates.alert_threshold = body.alert_threshold
    }
    if (body.notes !== undefined) updates.notes = body.notes

    // Validate date range if both dates are being updated
    if (updates.start_date && updates.end_date) {
      const startDate = new Date(updates.start_date)
      const endDate = new Date(updates.end_date)

      if (endDate < startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updates).length === 1) {  // Only updated_at
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update budget
    const { data, error } = await supabase
      .from('category_budgets')
      .update(updates)
      .eq('budget_id', budgetId)
      .select()
      .single()

    if (error) {
      console.error('Error updating budget:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get full details with spending data
    const { data: fullData, error: fullError } = await supabase
      .from('budget_overview')
      .select('*')
      .eq('budget_id', budgetId)
      .single()

    if (fullError) {
      console.error('Error fetching updated budget:', fullError)
      // Still return the basic data
      return NextResponse.json({ data })
    }

    return NextResponse.json({
      data: fullData,
      message: 'Budget updated successfully',
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
// DELETE - Delete budget (soft delete)
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const budgetId = parseInt(params.id, 10)

    if (isNaN(budgetId)) {
      return NextResponse.json(
        { error: 'Invalid budget ID' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if budget exists
    const { data: existing, error: fetchError } = await supabase
      .from('category_budgets')
      .select('budget_id, budget_name')
      .eq('budget_id', budgetId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('category_budgets')
      .update({
        is_active: false,
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('budget_id', budgetId)

    if (deleteError) {
      console.error('Error deleting budget:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Budget deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
