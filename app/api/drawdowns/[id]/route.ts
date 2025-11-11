/**
 * API Route: /api/drawdowns/[id]
 * Get, update, or delete a specific drawdown
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { UpdateDrawdownRequest } from '@/types/debt'

// ==============================================================================
// GET - Get drawdown details with payment history
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const drawdownId = parseInt(params.id, 10)

    if (isNaN(drawdownId)) {
      return NextResponse.json(
        { error: 'Invalid drawdown ID' },
        { status: 400 }
      )
    }

    // Fetch drawdown
    const { data: drawdown, error: drawdownError } = await supabase
      .from('debt_drawdown')
      .select(`
        *,
        account:accounts(
          account_id,
          account_name,
          bank_name,
          account_type,
          credit_limit,
          entity:entities(id, name)
        )
      `)
      .eq('drawdown_id', drawdownId)
      .single()

    if (drawdownError || !drawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found' },
        { status: 404 }
      )
    }

    // Fetch payment history using RPC function
    const { data: payments, error: paymentsError } = await supabase.rpc('get_drawdown_payment_history', {
      p_drawdown_id: drawdownId
    })

    if (paymentsError) {
      console.error('Error fetching payment history:', paymentsError)
    }

    // Calculate totals
    const totalInterest = payments?.filter((p: any) => p.transaction_subtype === 'interest')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0

    const totalFees = payments?.filter((p: any) => ['fee', 'penalty'].includes(p.transaction_subtype))
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0

    const paid_amount = Number(drawdown.original_amount) - Number(drawdown.remaining_balance)

    return NextResponse.json({
      data: {
        ...drawdown,
        paid_amount,
        total_interest_paid: totalInterest,
        total_fees_paid: totalFees,
        payment_history: payments || [],
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update drawdown
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const drawdownId = parseInt(params.id, 10)

    if (isNaN(drawdownId)) {
      return NextResponse.json(
        { error: 'Invalid drawdown ID' },
        { status: 400 }
      )
    }

    const body: UpdateDrawdownRequest = await request.json()

    // Verify drawdown exists
    const { data: existingDrawdown, error: fetchError } = await supabase
      .from('debt_drawdown')
      .select('drawdown_id')
      .eq('drawdown_id', drawdownId)
      .single()

    if (fetchError || !existingDrawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (body.drawdown_reference !== undefined) updateData.drawdown_reference = body.drawdown_reference
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.interest_rate !== undefined) updateData.interest_rate = body.interest_rate
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.status !== undefined) updateData.status = body.status

    // Update drawdown
    const { data: updatedDrawdown, error: updateError } = await supabase
      .from('debt_drawdown')
      .update(updateData)
      .eq('drawdown_id', drawdownId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating drawdown:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updatedDrawdown,
      message: 'Drawdown updated successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Delete drawdown
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const drawdownId = parseInt(params.id, 10)

    if (isNaN(drawdownId)) {
      return NextResponse.json(
        { error: 'Invalid drawdown ID' },
        { status: 400 }
      )
    }

    // Check if drawdown has any payments
    const { count: paymentsCount } = await supabase
      .from('main_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('drawdown_id', drawdownId)

    if (paymentsCount && paymentsCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete drawdown with payment history',
          message: `This drawdown has ${paymentsCount} payment(s). Delete the payments first or mark the drawdown as written_off instead.`,
          payments_count: paymentsCount,
        },
        { status: 400 }
      )
    }

    // Delete drawdown
    const { error: deleteError } = await supabase
      .from('debt_drawdown')
      .delete()
      .eq('drawdown_id', drawdownId)

    if (deleteError) {
      console.error('Error deleting drawdown:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Drawdown deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete drawdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
