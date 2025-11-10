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
    if (!body.account_id || !body.source_account_id || !body.partner_id ||
        !body.loan_category || !body.principal_amount || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, source_account_id, partner_id, loan_category, principal_amount, disbursement_date' },
        { status: 400 }
      )
    }

    if (body.principal_amount <= 0) {
      return NextResponse.json(
        { error: 'Principal amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify loan receivable account exists and is correct type
    const { data: loanAccount, error: loanAccountError } = await supabase
      .from('accounts')
      .select('account_id, account_type, entity_id')
      .eq('account_id', body.account_id)
      .single()

    if (loanAccountError || !loanAccount) {
      return NextResponse.json(
        { error: 'Loan receivable account not found' },
        { status: 404 }
      )
    }

    if (loanAccount.account_type !== 'loan_receivable') {
      return NextResponse.json(
        { error: 'Account must be of type loan_receivable' },
        { status: 400 }
      )
    }

    // Verify source account exists and is bank/cash
    const { data: sourceAccount, error: sourceAccountError } = await supabase
      .from('accounts')
      .select('account_id, account_type, entity_id')
      .eq('account_id', body.source_account_id)
      .single()

    if (sourceAccountError || !sourceAccount) {
      return NextResponse.json(
        { error: 'Source account not found' },
        { status: 404 }
      )
    }

    if (!['bank', 'cash'].includes(sourceAccount.account_type)) {
      return NextResponse.json(
        { error: 'Source account must be bank or cash type' },
        { status: 400 }
      )
    }

    // Verify both accounts belong to same entity
    if (loanAccount.entity_id !== sourceAccount.entity_id) {
      return NextResponse.json(
        { error: 'Source and loan accounts must belong to the same entity' },
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

    // Create loan disbursement record
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

    // Step 2: Create LOAN_GIVE transaction on source account (money out)
    const description = `Loan disbursement to ${partner.partner_name}`

    // Generate unique transaction ID
    const timestamp = Date.now()
    const random1 = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id_1 = `TXN-${timestamp}-${random1}`

    const { data: originalTxn, error: originalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: raw_transaction_id_1,
        account_id: body.source_account_id,
        transaction_date: body.disbursement_date,
        description: description,
        credit_amount: body.principal_amount, // Credit = money out from bank/cash
        debit_amount: null,
        balance: null, // Will be calculated
        transaction_source: 'user_manual',
        created_by_user_id: null, // original_transaction uses INTEGER, not UUID
      }])
      .select()
      .single()

    if (originalError) {
      console.error('Error creating original transaction:', originalError)
      // Rollback: delete the disbursement
      await supabase
        .from('loan_disbursement')
        .delete()
        .eq('loan_disbursement_id', disbursement.loan_disbursement_id)

      return NextResponse.json(
        { error: 'Failed to create transaction: ' + originalError.message },
        { status: 500 }
      )
    }

    // Step 3: Get LOAN_GIVE transaction type
    const { data: loanGiveType } = await supabase
      .from('transaction_types')
      .select('type_id')
      .eq('type_code', 'LOAN_GIVE')
      .single()

    if (!loanGiveType) {
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

      return NextResponse.json(
        { error: 'LOAN_GIVE transaction type not found' },
        { status: 500 }
      )
    }

    // Step 4: Update main_transaction (auto-created by trigger) with type and loan info
    const { error: mainTxnError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanGiveType.type_id,
        loan_disbursement_id: disbursement.loan_disbursement_id,
        description: description,
      })
      .eq('raw_transaction_id', raw_transaction_id_1)

    if (mainTxnError) {
      console.error('Error updating main transaction:', mainTxnError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

      return NextResponse.json(
        { error: 'Failed to update main transaction: ' + mainTxnError.message },
        { status: 500 }
      )
    }

    // Step 5: Create LOAN_SETTLE transaction on loan_receivable account (asset increases)
    const random2 = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id_2 = `TXN-${timestamp}-${random2}`

    const { data: loanSettleOriginal, error: settleOriginalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: raw_transaction_id_2,
        account_id: body.account_id, // Loan receivable account
        transaction_date: body.disbursement_date,
        description: description,
        debit_amount: body.principal_amount, // Debit = asset increases
        credit_amount: null,
        balance: null,
        transaction_source: 'user_manual',
        created_by_user_id: null, // original_transaction uses INTEGER, not UUID
      }])
      .select()
      .single()

    if (settleOriginalError) {
      console.error('Error creating loan settle original transaction:', settleOriginalError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

      return NextResponse.json(
        { error: 'Failed to create loan settle transaction: ' + settleOriginalError.message },
        { status: 500 }
      )
    }

    // Step 6: Get LOAN_SETTLE transaction type
    const { data: loanSettleType } = await supabase
      .from('transaction_types')
      .select('type_id')
      .eq('type_code', 'LOAN_SETTLE')
      .single()

    if (!loanSettleType) {
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_2)

      return NextResponse.json(
        { error: 'LOAN_SETTLE transaction type not found' },
        { status: 500 }
      )
    }

    // Step 7: Update loan settle main_transaction
    const { error: settleMainError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanSettleType.type_id,
        loan_disbursement_id: disbursement.loan_disbursement_id,
        description: description,
      })
      .eq('raw_transaction_id', raw_transaction_id_2)

    if (settleMainError) {
      console.error('Error updating loan settle main transaction:', settleMainError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_2)

      return NextResponse.json(
        { error: 'Failed to update loan settle main transaction: ' + settleMainError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: disbursement,
      message: 'Loan disbursement created successfully with accounting transactions',
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
