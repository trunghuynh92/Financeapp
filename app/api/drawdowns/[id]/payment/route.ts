/**
 * API Route: /api/drawdowns/[id]/payment
 * Record a payment (principal, interest, fee, penalty) for a drawdown
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { RecordDrawdownPaymentRequest } from '@/types/debt'

// ==============================================================================
// POST - Record a debt payment
// ==============================================================================

export async function POST(
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

    const body: RecordDrawdownPaymentRequest = await request.json()

    // Validation
    if (!body.account_id || !body.transaction_date || !body.amount || !body.transaction_subtype) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, transaction_date, amount, transaction_subtype' },
        { status: 400 }
      )
    }

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!['principal', 'interest', 'fee', 'penalty'].includes(body.transaction_subtype)) {
      return NextResponse.json(
        { error: 'Invalid transaction subtype' },
        { status: 400 }
      )
    }

    // Fetch drawdown
    const { data: drawdown, error: drawdownError } = await supabase
      .from('debt_drawdown')
      .select('*')
      .eq('drawdown_id', drawdownId)
      .single()

    if (drawdownError || !drawdown) {
      return NextResponse.json(
        { error: 'Drawdown not found' },
        { status: 404 }
      )
    }

    // Verify account matches
    if (drawdown.account_id !== body.account_id) {
      return NextResponse.json(
        { error: 'Account ID does not match drawdown account' },
        { status: 400 }
      )
    }

    // For principal payments, check if overpayment will occur
    let isOverpayment = false
    let overpaymentAmount = 0

    if (body.transaction_subtype === 'principal') {
      if (drawdown.status !== 'active' && drawdown.status !== 'overdue') {
        return NextResponse.json(
          {
            error: `Cannot make principal payment on ${drawdown.status} drawdown`,
            status: drawdown.status,
          },
          { status: 400 }
        )
      }

      // Check for overpayment (allow it, but flag it)
      if (body.amount > drawdown.remaining_balance) {
        isOverpayment = true
        overpaymentAmount = body.amount - drawdown.remaining_balance
        console.warn(`⚠️ Overpayment detected: Drawdown ${drawdown.drawdown_reference}, Owed: ${drawdown.remaining_balance}, Paid: ${body.amount}, Excess: ${overpaymentAmount}`)
      }
    }

    // Find appropriate transaction type
    // For debt payments, we use "expense" type (money going out)
    const { data: expenseType } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'EXP')
      .single()

    if (!expenseType) {
      throw new Error('Expense transaction type not found')
    }

    // Find appropriate category
    let categoryId = body.category_id || null

    if (!categoryId) {
      // Auto-assign category based on subtype
      const categoryMap: Record<string, string> = {
        'principal': 'LOAN_PAY',
        'interest': 'INTEREST_INC', // Note: This is actually an expense, might need adjustment
        'fee': 'PROF_SVC',
        'penalty': 'PROF_SVC',
      }

      const categoryCode = categoryMap[body.transaction_subtype]
      if (categoryCode) {
        const { data: category } = await supabase
          .from('categories')
          .select('category_id')
          .eq('category_code', categoryCode)
          .single()

        categoryId = category?.category_id || null
      }
    }

    // Create main_transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('main_transaction')
      .insert([{
        // Link to original (will be created separately if from bank import)
        raw_transaction_id: `DEBT_PAYMENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        account_id: body.account_id,
        transaction_type_id: expenseType.transaction_type_id,
        category_id: categoryId,
        amount: body.amount,
        transaction_direction: 'debit', // Payment out
        transaction_date: body.transaction_date,
        description: body.description || `${body.transaction_subtype.charAt(0).toUpperCase() + body.transaction_subtype.slice(1)} payment for ${drawdown.drawdown_reference}`,
        notes: body.notes || null,
        drawdown_id: drawdownId,
        transaction_subtype: body.transaction_subtype,
      }])
      .select()
      .single()

    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      return NextResponse.json(
        { error: transactionError.message },
        { status: 500 }
      )
    }

    // Note: The trigger `process_debt_payment_trigger` will automatically
    // update the drawdown remaining_balance for principal payments

    // Fetch updated drawdown
    const { data: updatedDrawdown } = await supabase
      .from('debt_drawdown')
      .select('*')
      .eq('drawdown_id', drawdownId)
      .single()

    // Build response
    const responseData: any = {
      data: {
        transaction,
        drawdown: updatedDrawdown,
      },
      message: `${body.transaction_subtype.charAt(0).toUpperCase() + body.transaction_subtype.slice(1)} payment recorded successfully`,
    }

    // Add overpayment warning if applicable
    if (isOverpayment) {
      responseData.warning = {
        type: 'overpayment',
        message: `Payment exceeded remaining balance by ${overpaymentAmount.toLocaleString()}`,
        overpayment_amount: overpaymentAmount,
        original_balance: drawdown.remaining_balance,
        payment_amount: body.amount,
      }
    }

    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to record payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
