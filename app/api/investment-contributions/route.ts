/**
 * API Route: /api/investment-contributions
 * List and create investment contributions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateInvestmentContributionInput } from '@/types/investment'

// ==============================================================================
// GET - List investment contributions for an account or entity
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
      .from('investment_contribution')
      .select(`
        *,
        investment_account:investment_account_id(
          account_id,
          account_name,
          account_type,
          entity:entities(id, name)
        ),
        source_account:source_account_id(
          account_id,
          account_name,
          account_type
        )
      `)

    // Filter by account_id or entity_id
    if (accountId) {
      query = query.eq('investment_account_id', parseInt(accountId, 10))
    } else if (entityId) {
      // For entity_id, we need to join through accounts table
      // First get all investment account IDs for this entity
      const { data: investmentAccounts, error: accountError } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', entityId)
        .eq('account_type', 'investment')

      if (accountError) {
        console.error('Error fetching investment accounts:', accountError)
        return NextResponse.json(
          { error: accountError.message },
          { status: 500 }
        )
      }

      if (!investmentAccounts || investmentAccounts.length === 0) {
        // No investment accounts for this entity
        return NextResponse.json({
          data: [],
          count: 0,
        })
      }

      const accountIds = investmentAccounts.map(acc => acc.account_id)
      query = query.in('investment_account_id', accountIds)
    }

    const { data: contributions, error } = await query.order('contribution_date', { ascending: false })

    if (error) {
      console.error('Error fetching investment contributions:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: contributions,
      count: contributions?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch investment contributions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create a new investment contribution
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateInvestmentContributionInput = await request.json()

    // Debug logging
    console.log('=== Investment Contribution Creation Request ===')
    console.log('existing_source_transaction_id:', body.existing_source_transaction_id)
    console.log('source_account_id:', body.source_account_id)
    console.log('investment_account_id:', body.investment_account_id)
    console.log('=========================================')

    // Validation
    if (!body.source_account_id || !body.contribution_amount || !body.contribution_date) {
      return NextResponse.json(
        { error: 'Missing required fields: source_account_id, contribution_amount, contribution_date' },
        { status: 400 }
      )
    }

    if (body.contribution_amount <= 0) {
      return NextResponse.json(
        { error: 'Contribution amount must be greater than 0' },
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

    // Auto-create or find Investment account
    let investmentAccountId: number
    let investmentAccount: any

    if (body.investment_account_id) {
      // If investment_account_id provided, verify it exists and is correct type
      const { data: existingAccount, error: existingError } = await supabase
        .from('accounts')
        .select('account_id, account_type, entity_id')
        .eq('account_id', body.investment_account_id)
        .single()

      if (existingError || !existingAccount) {
        return NextResponse.json(
          { error: 'Investment account not found' },
          { status: 404 }
        )
      }

      if (existingAccount.account_type !== 'investment') {
        return NextResponse.json(
          { error: 'Account must be of type investment' },
          { status: 400 }
        )
      }

      if (existingAccount.entity_id !== sourceAccount.entity_id) {
        return NextResponse.json(
          { error: 'Investment and source accounts must belong to the same entity' },
          { status: 400 }
        )
      }

      investmentAccount = existingAccount
      investmentAccountId = existingAccount.account_id
    } else {
      // Auto-create logic: Check if entity already has an Investment account
      const { data: existingInvestmentAccounts, error: searchError } = await supabase
        .from('accounts')
        .select('account_id, account_type, entity_id')
        .eq('entity_id', sourceAccount.entity_id)
        .eq('account_type', 'investment')
        .limit(1)

      if (searchError) {
        return NextResponse.json(
          { error: 'Error searching for investment account: ' + searchError.message },
          { status: 500 }
        )
      }

      if (existingInvestmentAccounts && existingInvestmentAccounts.length > 0) {
        // Use existing Investment account
        investmentAccount = existingInvestmentAccounts[0]
        investmentAccountId = existingInvestmentAccounts[0].account_id
        console.log('Using existing Investment account:', investmentAccountId)
      } else {
        // Create new Investment account
        const { data: newInvestmentAccount, error: createError } = await supabase
          .from('accounts')
          .insert([{
            entity_id: sourceAccount.entity_id,
            account_name: 'Investment',
            account_type: 'investment',
            currency: 'VND',
          }])
          .select('account_id, account_type, entity_id')
          .single()

        if (createError || !newInvestmentAccount) {
          return NextResponse.json(
            { error: 'Failed to create Investment account: ' + (createError?.message || 'Unknown error') },
            { status: 500 }
          )
        }

        investmentAccount = newInvestmentAccount
        investmentAccountId = newInvestmentAccount.account_id
        console.log('Created new Investment account:', investmentAccountId)
      }
    }

    // Create investment contribution record
    const { data: contribution, error: insertError } = await supabase
      .from('investment_contribution')
      .insert([{
        entity_id: sourceAccount.entity_id,
        investment_account_id: investmentAccountId,
        source_account_id: body.source_account_id,
        contribution_amount: body.contribution_amount,
        contribution_date: body.contribution_date,
        notes: body.notes || null,
        status: 'active',
        created_by: user.id,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating investment contribution:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Step 2: Handle source account transaction (money out from bank/cash)
    const description = `Investment contribution`
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
        await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
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
          transaction_date: body.contribution_date,
          description: description,
          debit_amount: body.contribution_amount, // Debit = money out from bank/cash
          credit_amount: null,
          balance: null, // Will be calculated
          transaction_source: 'user_manual',
          created_by_user_id: null, // original_transaction uses INTEGER, not UUID
        }])
        .select()
        .single()

      if (originalError) {
        console.error('Error creating original transaction:', originalError)
        // Rollback: delete the contribution
        await supabase
          .from('investment_contribution')
          .delete()
          .eq('contribution_id', contribution.contribution_id)

        return NextResponse.json(
          { error: 'Failed to create transaction: ' + originalError.message },
          { status: 500 }
        )
      }
    }

    // Step 3: Get INV_CONTRIB transaction type
    const { data: invContribType, error: invContribError } = await supabase
      .from('transaction_types')
      .select('transaction_type_id')
      .eq('type_code', 'INV_CONTRIB')
      .single()

    if (invContribError || !invContribType) {
      console.error('Error finding INV_CONTRIB type:', invContribError)
      // Rollback
      await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
      if (!body.existing_source_transaction_id) {
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      }

      return NextResponse.json(
        { error: 'INV_CONTRIB transaction type not found. Ensure Migration 065 has been run.' },
        { status: 500 }
      )
    }

    // Step 4: Update source main_transaction with type and contribution info
    // Only update if we created a new transaction (not when linking to existing)
    if (!body.existing_source_transaction_id) {
      const { error: mainTxnError } = await supabase
        .from('main_transaction')
        .update({
          transaction_type_id: invContribType.transaction_type_id,
          description: description,
          investment_contribution_id: contribution.contribution_id,
        })
        .eq('raw_transaction_id', raw_transaction_id_1)

      if (mainTxnError) {
        console.error('Error updating main transaction:', mainTxnError)
        // Rollback
        await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
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
        await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)

        return NextResponse.json(
          { error: 'Failed to get new main transaction' },
          { status: 500 }
        )
      }

      sourceMainTransactionId = newMainTxn.main_transaction_id
    } else {
      // When linking to existing transaction, update it with contribution type
      const { error: linkError } = await supabase
        .from('main_transaction')
        .update({
          transaction_type_id: invContribType.transaction_type_id,
          investment_contribution_id: contribution.contribution_id,
        })
        .eq('main_transaction_id', body.existing_source_transaction_id)

      if (linkError) {
        console.error('Error linking existing transaction:', linkError)
        // Rollback
        await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)

        return NextResponse.json(
          { error: 'Failed to link existing transaction: ' + linkError.message },
          { status: 500 }
        )
      }
    }

    // Step 5: Create second INV_CONTRIB transaction on investment account (asset increases)
    const timestamp2 = Date.now()
    const random2 = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id_2 = `TXN-${timestamp2}-${random2}`

    const { data: investmentOriginal, error: investmentOriginalError } = await supabase
      .from('original_transaction')
      .insert([{
        raw_transaction_id: raw_transaction_id_2,
        account_id: investmentAccountId, // Investment account
        transaction_date: body.contribution_date,
        description: description,
        credit_amount: body.contribution_amount, // Credit = asset increases (investment)
        debit_amount: null,
        balance: null,
        transaction_source: 'user_manual',
        created_by_user_id: null, // original_transaction uses INTEGER, not UUID
      }])
      .select()
      .single()

    if (investmentOriginalError) {
      console.error('Error creating investment transaction:', investmentOriginalError)
      // Rollback
      await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
      // Only delete source transaction if we created it (not if we linked to existing)
      if (!body.existing_source_transaction_id) {
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      }

      return NextResponse.json(
        { error: 'Failed to create investment transaction: ' + investmentOriginalError.message },
        { status: 500 }
      )
    }

    // Step 6: Update investment main_transaction - also use INV_CONTRIB type
    // Both sides of investment contribution use INV_CONTRIB
    // (INV_WITHDRAW is only used when withdrawing from investment)
    const { error: investmentMainError } = await supabase
      .from('main_transaction')
      .update({
        transaction_type_id: invContribType.transaction_type_id, // Reuse INV_CONTRIB type
        description: description,
        investment_contribution_id: contribution.contribution_id,
      })
      .eq('raw_transaction_id', raw_transaction_id_2)

    if (investmentMainError) {
      console.error('Error updating investment main transaction:', investmentMainError)
      // Rollback
      await supabase.from('investment_contribution').delete().eq('contribution_id', contribution.contribution_id)
      // Only delete source transaction if we created it (not if we linked to existing)
      if (!body.existing_source_transaction_id) {
        await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_1)
      }
      await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_2)

      return NextResponse.json(
        { error: 'Failed to update investment main transaction: ' + investmentMainError.message },
        { status: 500 }
      )
    }

    // Get the investment main_transaction_id
    const { data: investmentMainTxn, error: getInvestmentMainError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id')
      .eq('raw_transaction_id', raw_transaction_id_2)
      .single()

    const investmentMainTransactionId = investmentMainTxn?.main_transaction_id || null

    // Update contribution with main_transaction_id link
    if (sourceMainTransactionId) {
      await supabase
        .from('investment_contribution')
        .update({ main_transaction_id: sourceMainTransactionId })
        .eq('contribution_id', contribution.contribution_id)
    }

    // Suggest matching for UI
    let suggestMatch = false
    let sourceTransactionForMatch = null

    if (body.existing_source_transaction_id) {
      suggestMatch = true
      sourceTransactionForMatch = {
        main_transaction_id: sourceMainTransactionId,
        investment_transaction_id: investmentMainTransactionId,
      }
    } else if (sourceMainTransactionId && investmentMainTransactionId) {
      suggestMatch = true
      sourceTransactionForMatch = {
        main_transaction_id: sourceMainTransactionId,
        investment_transaction_id: investmentMainTransactionId,
      }
    }

    // Determine if account was auto-created
    const accountAutoCreated = !body.investment_account_id

    return NextResponse.json({
      data: contribution,
      message: 'Investment contribution created successfully with accounting transactions',
      investment_account_id: investmentAccountId,
      account_auto_created: accountAutoCreated,
      suggest_match: suggestMatch,
      match_data: sourceTransactionForMatch,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create investment contribution',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
