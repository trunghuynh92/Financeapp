/**
 * API Route: /api/loan-disbursements
 * List and create loan disbursements
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateLoanDisbursementInput } from '@/types/loan'

// ==============================================================================
// GET - List loan disbursements for an account
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id query parameter is required' },
        { status: 400 }
      )
    }

    const { data: disbursements, error } = await supabase
      .from('loan_disbursement')
      .select(`
        *,
        account:accounts(
          account_id,
          account_name,
          account_type,
          entity:entities(id, name)
        ),
        partner:business_partners(
          partner_id,
          partner_name,
          display_name,
          partner_type,
          email,
          phone
        )
      `)
      .eq('account_id', parseInt(accountId, 10))
      .order('disbursement_date', { ascending: false })

    if (error) {
      console.error('Error fetching loan disbursements:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: disbursements,
      count: disbursements?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch loan disbursements',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create a new loan disbursement
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateLoanDisbursementInput = await request.json()

    // Validation
    if (!body.account_id || !body.partner_id || !body.loan_category ||
        !body.principal_amount || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, partner_id, loan_category, principal_amount, disbursement_date' },
        { status: 400 }
      )
    }

    if (body.principal_amount <= 0) {
      return NextResponse.json(
        { error: 'Principal amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify account exists and is loan_receivable type
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_id, account_type, entity_id')
      .eq('account_id', body.account_id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    if (account.account_type !== 'loan_receivable') {
      return NextResponse.json(
        { error: 'Account must be of type loan_receivable' },
        { status: 400 }
      )
    }

    // Verify partner exists
    const { data: partner, error: partnerError } = await supabase
      .from('business_partners')
      .select('partner_id, partner_name')
      .eq('partner_id', body.partner_id)
      .single()

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Business partner not found' },
        { status: 404 }
      )
    }

    // Create loan disbursement
    const { data: disbursement, error: insertError } = await supabase
      .from('loan_disbursement')
      .insert([{
        account_id: body.account_id,
        partner_id: body.partner_id,
        loan_category: body.loan_category,
        principal_amount: body.principal_amount,
        remaining_balance: body.principal_amount, // Initially, full amount is outstanding
        disbursement_date: body.disbursement_date,
        due_date: body.due_date || null,
        term_months: body.term_months || null,
        interest_rate: body.interest_rate || null,
        notes: body.notes || null,
        status: 'active',
        created_by_user_id: user.id,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating loan disbursement:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: disbursement,
      message: 'Loan disbursement created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create loan disbursement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
