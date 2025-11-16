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
    const entityId = searchParams.get('entity_id')

    if (!accountId && !entityId) {
      return NextResponse.json(
        { error: 'Either account_id or entity_id query parameter is required' },
        { status: 400 }
      )
    }

    let query = supabase
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

    // Filter by account_id or entity_id
    if (accountId) {
      query = query.eq('account_id', parseInt(accountId, 10))
    } else if (entityId) {
      // For entity_id, we need to join through accounts table
      // First get all loan_receivable account IDs for this entity
      const { data: loanAccounts, error: accountError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', entityId)
        .eq('account_type', 'loan_receivable')

      if (accountError) {
        console.error('Error fetching loan accounts:', accountError)
        return NextResponse.json(
          { error: accountError.message },
          { status: 500 }
        )
      }

      if (!loanAccounts || loanAccounts.length === 0) {
        // No loan receivable accounts for this entity
        return NextResponse.json({
          data: [],
          count: 0,
        })
      }

      const accountIds = loanAccounts.map(acc => acc.account_id)
      query = query.in('account_id', accountIds)
    }

    const { data: disbursements, error } = await query.order('disbursement_date', { ascending: false })

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

    // Debug logging
    console.log('=== Loan Disbursement Creation Request ===')
    console.log('existing_source_transaction_id:', body.existing_source_transaction_id)
    console.log('source_account_id:', body.source_account_id)
    console.log('account_id:', body.account_id)
    console.log('=========================================')

    // Validation - now account_id is optional (will be auto-created)
    if (!body.source_account_id || !body.partner_id ||
        !body.loan_category || !body.principal_amount || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: source_account_id, partner_id, loan_category, principal_amount, disbursement_date' },
        { status: 400 }
      )
    }

    if (body.principal_amount <= 0) {
      return NextResponse.json(
        { error: 'Principal amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Get source account to determine entity_id
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

    // Auto-create or find Loan Receivable account
    let loanAccountId: number
    let loanAccount: any

    if (body.account_id) {
      // If account_id provided, verify it exists and is correct type
      const { data: existingAccount, error: existingError } = await supabase
        .from('accounts')
        .select('account_id, account_type, entity_id')
        .eq('account_id', body.account_id)
        .single()

      if (existingError || !existingAccount) {
        return NextResponse.json(
          { error: 'Loan receivable account not found' },
          { status: 404 }
        )
      }

      if (existingAccount.account_type !== 'loan_receivable') {
        return NextResponse.json(
          { error: 'Account must be of type loan_receivable' },
          { status: 400 }
        )
      }

      if (existingAccount.entity_id !== sourceAccount.entity_id) {
        return NextResponse.json(
          { error: 'Loan receivable and source accounts must belong to the same entity' },
          { status: 400 }
        )
      }

      loanAccount = existingAccount
      loanAccountId = existingAccount.account_id
    } else {
      // Auto-create logic: Check if entity already has a Loan Receivable account
      const { data: existingLoanAccounts, error: searchError } = await supabase
        .from('accounts')
        .select('account_id, account_type, entity_id')
        .eq('entity_id', sourceAccount.entity_id)
        .eq('account_type', 'loan_receivable')
        .limit(1)

      if (searchError) {
        return NextResponse.json(
          { error: 'Error searching for loan receivable account: ' + searchError.message },
          { status: 500 }
        )
      }

      if (existingLoanAccounts && existingLoanAccounts.length > 0) {
        // Use existing Loan Receivable account
        loanAccount = existingLoanAccounts[0]
        loanAccountId = existingLoanAccounts[0].account_id
        console.log('Using existing Loan Receivable account:', loanAccountId)
      } else {
        // Create new Loan Receivable account
        const { data: newLoanAccount, error: createError } = await supabase
          .from('accounts')
          .insert([{
            entity_id: sourceAccount.entity_id,
            account_name: 'Loan Receivable',
            account_type: 'loan_receivable',
            currency: 'VND',
          }])
          .select('account_id, account_type, entity_id')
          .single()

        if (createError || !newLoanAccount) {
          return NextResponse.json(
            { error: 'Failed to create Loan Receivable account: ' + (createError?.message || 'Unknown error') },
            { status: 500 }
          )
        }

        loanAccount = newLoanAccount
        loanAccountId = newLoanAccount.account_id
        console.log('Created new Loan Receivable account:', loanAccountId)
      }
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
        account_id: loanAccountId,
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

    // Step 2: Handle source account transaction
    // If existing_source_transaction_id is provided, link to it instead of creating new
    const description = `Loan disbursement to ${partner.partner_name}`
    let raw_transaction_id_1: string
    let sourceMainTransactionId: number | null = null

    if (body.existing_source_transaction_id) {
      // Link to existing transaction - get its raw_transaction_id
      const { data: existingMainTxn, error: existingError } = await supabase
        .from('main_transaction')
        .select('raw_transaction_id, main_transaction_id')
        .eq('main_transaction_id', body.existing_source_transaction_id)
        .single()

      if (existingError || !existingMainTxn) {
        console.error('Error finding existing transaction:', existingError)
        // Rollback
        await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
        return NextResponse.json(
          { error: 'Existing source transaction not found' },
          { status: 404 }
        )
      }

      raw_transaction_id_1 = existingMainTxn.raw_transaction_id
      sourceMainTransactionId = existingMainTxn.main_transaction_id
    } else {
      // Create new source account transaction (money out)
      const timestamp = Date.now()
      const random1 = Math.random().toString(36).substring(2, 9)
      raw_transaction_id_1 = `TXN-${timestamp}-${random1}`

      const { data: originalTxn, error: originalError } = await supabase
        .from('original_transaction')
        .insert([{
          raw_transaction_id: raw_transaction_id_1,
          account_id: body.source_account_id,
          transaction_date: body.disbursement_date,
          description: description,
          debit_amount: body.principal_amount, // Debit = money out from bank/cash
          credit_amount: null,
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
    }

    // Step 3: Get LOAN_DISBURSE transaction type
    const { data: loanDisburseType, error: loanDisburseError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'LOAN_DISBURSE')
      .single()

    if (loanDisburseError || !loanDisburseType) {
      console.error('Error finding LOAN_DISBURSE type:', loanDisburseError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

      return NextResponse.json(
        { error: 'LOAN_DISBURSE transaction type not found. Ensure Migration 042 has been run.' },
        { status: 500 }
      )
    }

    // Step 4: Update source main_transaction with type and loan info
    // Only update if we created a new transaction (not when linking to existing)
    if (!body.existing_source_transaction_id) {
      const { error: mainTxnError } = await supabase
        .from('main_transaction')
        .update({
          transaction_type_id: loanDisburseType.transaction_type_id,
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

      // Get the main_transaction_id for the newly created transaction
      const { data: newMainTxn, error: getMainError } = await supabase
        .from('main_transaction')
        .select('main_transaction_id')
        .eq('raw_transaction_id', raw_transaction_id_1)
        .single()

      if (getMainError || !newMainTxn) {
        console.error('Error getting new main transaction:', getMainError)
        // Rollback
        await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

        return NextResponse.json(
          { error: 'Failed to get new main transaction' },
          { status: 500 }
        )
      }

      sourceMainTransactionId = newMainTxn.main_transaction_id
    } else {
      // When linking to existing transaction, update it with disbursement info
      const { error: linkError } = await supabase
        .from('main_transaction')
        .update({
          loan_disbursement_id: disbursement.loan_disbursement_id,
          transaction_type_id: loanDisburseType.transaction_type_id,
        })
        .eq('main_transaction_id', body.existing_source_transaction_id)

      if (linkError) {
        console.error('Error linking existing transaction:', linkError)
        // Rollback
        await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)

        return NextResponse.json(
          { error: 'Failed to link existing transaction: ' + linkError.message },
          { status: 500 }
        )
      }
    }

    // Step 5: Create second LOAN_DISBURSE transaction on loan_receivable account (asset increases)
    const timestamp2 = Date.now()
    const random2 = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id_2 = `TXN-${timestamp2}-${random2}`

    const { data: loanReceivableOriginal, error: receivableOriginalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: raw_transaction_id_2,
        account_id: loanAccountId, // Loan receivable account
        transaction_date: body.disbursement_date,
        description: description,
        credit_amount: body.principal_amount, // Credit = asset increases (loan receivable)
        debit_amount: null,
        balance: null,
        transaction_source: 'user_manual',
        created_by_user_id: null, // original_transaction uses INTEGER, not UUID
      }])
      .select()
      .single()

    if (receivableOriginalError) {
      console.error('Error creating loan receivable transaction:', receivableOriginalError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      // Only delete source transaction if we created it (not if we linked to existing)
      if (!body.existing_source_transaction_id) {
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      }

      return NextResponse.json(
        { error: 'Failed to create loan receivable transaction: ' + receivableOriginalError.message },
        { status: 500 }
      )
    }

    // Step 6: Update loan receivable main_transaction - also use LOAN_DISBURSE type
    // Both sides of loan disbursement use LOAN_DISBURSE
    // (LOAN_COLLECT is only used when borrower pays back)
    const { error: receivableMainError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: loanDisburseType.transaction_type_id, // Reuse LOAN_DISBURSE type
        loan_disbursement_id: disbursement.loan_disbursement_id,
        description: description,
      })
      .eq('raw_transaction_id', raw_transaction_id_2)

    if (receivableMainError) {
      console.error('Error updating loan receivable main transaction:', receivableMainError)
      // Rollback
      await supabase.from('loan_disbursement').delete().eq('loan_disbursement_id', disbursement.loan_disbursement_id)
      // Only delete source transaction if we created it (not if we linked to existing)
      if (!body.existing_source_transaction_id) {
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      }
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_2)

      return NextResponse.json(
        { error: 'Failed to update loan receivable main transaction: ' + receivableMainError.message },
        { status: 500 }
      )
    }

    // Get the loan receivable main_transaction_id for potential auto-matching
    const { data: loanReceivableMainTxn, error: getLoanMainError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('raw_transaction_id', raw_transaction_id_2)
      .single()

    const loanReceivableMainTransactionId = loanReceivableMainTxn?.main_transaction_id || null

    // When using existing_source_transaction_id, transactions are NOT auto-matched
    // The user will be prompted to match them using QuickMatchLoanDialog
    // Detect if we should proactively suggest matching
    let suggestMatch = false
    let sourceTransactionForMatch = null

    if (body.existing_source_transaction_id) {
      // When created from existing transaction, always suggest matching
      suggestMatch = true
      sourceTransactionForMatch = {
        main_transaction_id: sourceMainTransactionId,
        loan_receivable_transaction_id: loanReceivableMainTransactionId,
      }
    } else if (sourceMainTransactionId && loanReceivableMainTransactionId) {
      // When both transactions are newly created, suggest matching them
      suggestMatch = true
      sourceTransactionForMatch = {
        main_transaction_id: sourceMainTransactionId,
        loan_receivable_transaction_id: loanReceivableMainTransactionId,
      }
    }

    // Determine if account was auto-created
    const accountAutoCreated = !body.account_id

    return NextResponse.json({
      data: disbursement,
      message: 'Loan disbursement created successfully with accounting transactions',
      loan_receivable_account_id: loanAccountId,
      account_auto_created: accountAutoCreated,
      suggest_match: suggestMatch,
      match_data: sourceTransactionForMatch,
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
