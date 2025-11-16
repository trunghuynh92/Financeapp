/**
 * API Route: /api/main-transactions/create
 * Purpose: Create a fully categorized transaction in one request
 * This combines: create original_transaction + wait for trigger + update main_transaction
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyWritePermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.account_id || !body.transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, transaction_date' },
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

    // Check write permissions
    try {
      await verifyWritePermission(supabase, user.id, body.account_id)
    } catch (permError: any) {
      return NextResponse.json(
        { error: permError.message },
        { status: 403 }
      )
    }

    // Validate that either debit or credit is provided, not both
    const hasDebit = body.debit_amount !== null && body.debit_amount !== undefined
    const hasCredit = body.credit_amount !== null && body.credit_amount !== undefined

    if (hasDebit && hasCredit) {
      return NextResponse.json(
        { error: 'Cannot have both debit_amount and credit_amount. Provide only one.' },
        { status: 400 }
      )
    }

    if (!hasDebit && !hasCredit) {
      return NextResponse.json(
        { error: 'Must provide either debit_amount or credit_amount' },
        { status: 400 }
      )
    }

    // Generate a unique transaction ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const raw_transaction_id = `TXN-${timestamp}-${random}`

    // Step 1: Create original transaction
    const { data: newTransaction, error: transactionError } = await supabase
      .from('original_transaction')
      .insert([
        {
          raw_transaction_id,
          account_id: body.account_id,
          transaction_date: body.transaction_date,
          description: body.description || null,
          debit_amount: body.debit_amount || null,
          credit_amount: body.credit_amount || null,
          balance: body.balance || null,
          bank_reference: body.bank_reference || null,
          transaction_source: body.transaction_source || 'user_manual',
          import_batch_id: body.import_batch_id || null,
          import_file_name: body.import_file_name || null,
          created_by_user_id: body.created_by_user_id || null,
        },
      ])
      .select()
      .single()

    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      return NextResponse.json({ error: transactionError.message }, { status: 500 })
    }

    // Step 2: Fetch the auto-created main_transaction (trigger creates it)
    // Retry up to 5 times with short delays
    let mainTransaction = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: mainTxData, error: mainTxError } = await supabase
        .from('main_transaction')
        .select('*')
        .eq('raw_transaction_id', raw_transaction_id)
        .single()

      if (!mainTxError && mainTxData) {
        mainTransaction = mainTxData
        break
      }

      // Wait briefly before retry
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    }

    if (!mainTransaction) {
      console.error('Main transaction was not created by trigger')
      return NextResponse.json(
        { error: 'Failed to create main transaction' },
        { status: 500 }
      )
    }

    // Step 3: Update main_transaction with type, category, branch, project if provided
    if (body.transaction_type_id || body.category_id || body.branch_id || body.project_id) {
      const updateData: any = {}

      if (body.transaction_type_id) {
        updateData.transaction_type_id = body.transaction_type_id
      }
      if (body.category_id) {
        updateData.category_id = body.category_id
      }
      if (body.branch_id) {
        updateData.branch_id = body.branch_id
      }
      if (body.project_id) {
        updateData.project_id = body.project_id
      }

      updateData.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('main_transaction')
        .update(updateData)
        .eq('main_transaction_id', mainTransaction.main_transaction_id)

      if (updateError) {
        console.error('Error updating main transaction:', updateError)
        return NextResponse.json(
          { error: 'Transaction created but failed to update categorization' },
          { status: 500 }
        )
      }
    }

    // Step 4: Handle LOAN_DISBURSE special logic
    // When user creates LOAN_DISBURSE transaction, auto-create:
    // - Loan Receivable account (if not exists)
    // - Matching loan receivable transaction
    // - Loan disbursement record
    // - Auto-match both transactions
    if (body.transaction_type_id) {
      const { data: transactionType } = await supabase
        .from('transaction_types')
        .select('type_code')
        .eq('transaction_type_id', body.transaction_type_id)
        .single()

      if (transactionType?.type_code === 'LOAN_DISBURSE' && body.partner_id) {
        console.log('🔄 Auto-processing LOAN_DISBURSE transaction...')

        // Get source account to determine entity_id
        const { data: sourceAccount } = await supabase
          .from('accounts')
          .select('entity_id, account_name')
          .eq('account_id', body.account_id)
          .single()

        if (!sourceAccount) {
          console.error('Source account not found for loan disbursement')
          return NextResponse.json(
            { error: 'Source account not found' },
            { status: 404 }
          )
        }

        // Find or create Loan Receivable account
        let loanAccountId: number

        const { data: existingLoanAccounts } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('entity_id', sourceAccount.entity_id)
          .eq('account_type', 'loan_receivable')
          .limit(1)

        if (existingLoanAccounts && existingLoanAccounts.length > 0) {
          loanAccountId = existingLoanAccounts[0].account_id
          console.log('✓ Using existing Loan Receivable account:', loanAccountId)
        } else {
          // Create new Loan Receivable account
          const { data: newLoanAccount, error: createAccountError } = await supabase
            .from('accounts')
            .insert([{
              entity_id: sourceAccount.entity_id,
              account_name: 'Loan Receivable',
              account_type: 'loan_receivable',
              currency: 'VND',
            }])
            .select('account_id')
            .single()

          if (createAccountError || !newLoanAccount) {
            console.error('Failed to create Loan Receivable account:', createAccountError)
            return NextResponse.json(
              { error: 'Failed to create Loan Receivable account' },
              { status: 500 }
            )
          }

          loanAccountId = newLoanAccount.account_id
          console.log('✓ Created new Loan Receivable account:', loanAccountId)
        }

        // Get partner name for description
        const { data: partner } = await supabase
          .from('business_partners')
          .select('partner_name')
          .eq('partner_id', body.partner_id)
          .single()

        const loanDescription = body.description || `Loan disbursement to ${partner?.partner_name || 'borrower'}`

        // Create matching loan receivable transaction (credit to asset)
        const timestamp2 = Date.now()
        const random2 = Math.random().toString(36).substring(2, 9)
        const raw_transaction_id_2 = `TXN-${timestamp2}-${random2}`

        const amount = body.debit_amount || body.credit_amount || 0

        const { data: loanReceivableOriginal } = await supabase
          .from('original_transaction')
          .insert([{
            raw_transaction_id: raw_transaction_id_2,
            account_id: loanAccountId,
            transaction_date: body.transaction_date,
            description: loanDescription,
            credit_amount: amount, // Credit = asset increases
            debit_amount: null,
            balance: null,
            transaction_source: 'user_manual',
            created_by_user_id: null,
          }])
          .select()
          .single()

        if (!loanReceivableOriginal) {
          console.error('Failed to create loan receivable transaction')
          return NextResponse.json(
            { error: 'Failed to create loan receivable transaction' },
            { status: 500 }
          )
        }

        // Wait for main_transaction to be created by trigger
        let loanReceivableMainTxn = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: mainTxData } = await supabase
            .from('main_transaction')
            .select('main_transaction_id')
            .eq('raw_transaction_id', raw_transaction_id_2)
            .single()

          if (mainTxData) {
            loanReceivableMainTxn = mainTxData
            break
          }

          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 20))
          }
        }

        if (!loanReceivableMainTxn) {
          console.error('Loan receivable main transaction not created')
          return NextResponse.json(
            { error: 'Failed to create loan receivable main transaction' },
            { status: 500 }
          )
        }

        // Update loan receivable main_transaction with type and description
        await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: body.transaction_type_id,
            description: loanDescription,
          })
          .eq('main_transaction_id', loanReceivableMainTxn.main_transaction_id)

        // Create loan_disbursement record
        const { data: disbursement } = await supabase
          .from('loan_disbursement')
          .insert([{
            account_id: loanAccountId,
            partner_id: body.partner_id,
            loan_category: 'short_term', // Default category
            principal_amount: amount,
            remaining_balance: amount,
            disbursement_date: body.transaction_date,
            status: 'active',
            created_by_user_id: user.id,
            notes: body.description || null,
          }])
          .select()
          .single()

        if (disbursement) {
          // Link both transactions to the disbursement
          await supabase
            .from('main_transaction')
            .update({ loan_disbursement_id: disbursement.loan_disbursement_id })
            .in('main_transaction_id', [
              mainTransaction.main_transaction_id,
              loanReceivableMainTxn.main_transaction_id
            ])

          console.log('✓ Created loan_disbursement record:', disbursement.loan_disbursement_id)
        }

        // Auto-match the two transactions
        try {
          const matchResponse = await fetch(`${request.nextUrl.origin}/api/transfers/match`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              transfer_out_id: mainTransaction.main_transaction_id,
              transfer_in_id: loanReceivableMainTxn.main_transaction_id,
            }),
          })

          if (matchResponse.ok) {
            console.log('✓ Auto-matched loan transactions')
          } else {
            console.warn('Failed to auto-match loan transactions')
          }
        } catch (matchError) {
          console.error('Error auto-matching:', matchError)
        }

        console.log('✅ LOAN_DISBURSE auto-processing complete')
      }

      // Handle LOAN_COLLECT (loan payment) special logic
      if (transactionType?.type_code === 'LOAN_COLLECT' && body.loan_disbursement_id) {
        console.log('🔄 Auto-processing LOAN_COLLECT transaction...')

        // Get the loan disbursement details
        const { data: disbursement } = await supabase
          .from('loan_disbursement')
          .select('account_id, partner_id, remaining_balance')
          .eq('loan_disbursement_id', body.loan_disbursement_id)
          .single()

        if (!disbursement) {
          console.error('Loan disbursement not found')
          return NextResponse.json(
            { error: 'Loan disbursement not found' },
            { status: 404 }
          )
        }

        const paymentAmount = body.credit_amount || body.debit_amount || 0

        // Get partner name for description
        const { data: partner } = await supabase
          .from('business_partners')
          .select('partner_name')
          .eq('partner_id', disbursement.partner_id)
          .single()

        const collectionDescription = body.description || `Loan payment from ${partner?.partner_name || 'borrower'}`

        // Create matching loan receivable transaction (debit - asset decreases)
        const timestamp3 = Date.now()
        const random3 = Math.random().toString(36).substring(2, 9)
        const raw_transaction_id_3 = `TXN-${timestamp3}-${random3}`

        const { data: loanReceivableDebit } = await supabase
          .from('original_transaction')
          .insert([{
            raw_transaction_id: raw_transaction_id_3,
            account_id: disbursement.account_id, // Loan receivable account
            transaction_date: body.transaction_date,
            description: collectionDescription,
            debit_amount: paymentAmount, // Debit = asset decreases
            credit_amount: null,
            balance: null,
            transaction_source: 'user_manual',
            created_by_user_id: null,
          }])
          .select()
          .single()

        if (!loanReceivableDebit) {
          console.error('Failed to create loan receivable debit transaction')
          return NextResponse.json(
            { error: 'Failed to create loan receivable transaction' },
            { status: 500 }
          )
        }

        // Wait for main_transaction to be created by trigger
        let loanReceivableDebitMainTxn = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: mainTxData } = await supabase
            .from('main_transaction')
            .select('main_transaction_id')
            .eq('raw_transaction_id', raw_transaction_id_3)
            .single()

          if (mainTxData) {
            loanReceivableDebitMainTxn = mainTxData
            break
          }

          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 20))
          }
        }

        if (!loanReceivableDebitMainTxn) {
          console.error('Loan receivable debit main transaction not created')
          return NextResponse.json(
            { error: 'Failed to create loan receivable main transaction' },
            { status: 500 }
          )
        }

        // Update loan receivable main_transaction with type, description, and link to disbursement
        await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: body.transaction_type_id,
            description: collectionDescription,
            loan_disbursement_id: body.loan_disbursement_id,
          })
          .eq('main_transaction_id', loanReceivableDebitMainTxn.main_transaction_id)

        // Update the bank transaction's type, description and link to disbursement
        await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: body.transaction_type_id, // Also set LOAN_COLLECT type
            description: collectionDescription,
            loan_disbursement_id: body.loan_disbursement_id,
          })
          .eq('main_transaction_id', mainTransaction.main_transaction_id)

        // Update loan disbursement remaining balance
        const newBalance = Math.max(0, disbursement.remaining_balance - paymentAmount)
        const newStatus = newBalance === 0 ? 'repaid' : 'active'

        await supabase
          .from('loan_disbursement')
          .update({
            remaining_balance: newBalance,
            status: newStatus,
          })
          .eq('loan_disbursement_id', body.loan_disbursement_id)

        console.log(`✓ Updated loan balance: ${disbursement.remaining_balance} → ${newBalance}`)

        // Auto-match the two transactions
        try {
          const matchResponse = await fetch(`${request.nextUrl.origin}/api/transfers/match`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              transfer_out_id: loanReceivableDebitMainTxn.main_transaction_id,
              transfer_in_id: mainTransaction.main_transaction_id,
            }),
          })

          if (matchResponse.ok) {
            console.log('✓ Auto-matched loan collection transactions')
          } else {
            console.warn('Failed to auto-match loan collection transactions')
          }
        } catch (matchError) {
          console.error('Error auto-matching:', matchError)
        }

        console.log('✅ LOAN_COLLECT auto-processing complete')
      }

      // Handle DEBT_TAKE (borrowing money) special logic
      // When user creates DEBT_TAKE transaction from bank/cash account with debt_account_id:
      // - Create drawdown record in debt_drawdown table
      // - Create matching transaction on term_loan/credit_line account
      // - Auto-match the two transactions
      if (transactionType?.type_code === 'DEBT_TAKE' && body.debt_account_id) {
        console.log('🔄 Auto-processing DEBT_TAKE transaction...')

        // Validate that source account is bank/cash
        const { data: sourceAccount } = await supabase
          .from('accounts')
          .select('account_type, entity_id')
          .eq('account_id', body.account_id)
          .single()

        if (!sourceAccount || !['bank', 'cash'].includes(sourceAccount.account_type)) {
          console.error('DEBT_TAKE must be on bank or cash account')
          return NextResponse.json(
            { error: 'DEBT_TAKE transaction must be on a bank or cash account' },
            { status: 400 }
          )
        }

        // Validate that debt account is term_loan or credit_line
        const { data: debtAccount } = await supabase
          .from('accounts')
          .select('account_type, entity_id')
          .eq('account_id', body.debt_account_id)
          .single()

        if (!debtAccount || !['term_loan', 'credit_line'].includes(debtAccount.account_type)) {
          console.error('debt_account_id must be term_loan or credit_line')
          return NextResponse.json(
            { error: 'Debt account must be a term loan or credit line' },
            { status: 400 }
          )
        }

        if (sourceAccount.entity_id !== debtAccount.entity_id) {
          return NextResponse.json(
            { error: 'Source account and debt account must belong to the same entity' },
            { status: 400 }
          )
        }

        // Create drawdown record
        const amount = body.credit_amount || 0
        const drawdownRef = `DD-${Date.now()}`

        const { data: drawdown, error: drawdownError } = await supabase
          .from('debt_drawdown')
          .insert([{
            account_id: body.debt_account_id,
            drawdown_reference: drawdownRef,
            drawdown_date: body.transaction_date,
            original_amount: amount,
            remaining_balance: amount,
            status: 'active',
          }])
          .select()
          .single()

        if (drawdownError) {
          console.error('Error creating drawdown:', drawdownError)
          return NextResponse.json(
            { error: 'Failed to create drawdown record: ' + drawdownError.message },
            { status: 500 }
          )
        }

        console.log('✓ Created drawdown:', drawdown.drawdown_id)

        // Create matching transaction on debt account (liability increases)
        const timestamp2 = Date.now()
        const random2 = Math.random().toString(36).substring(2, 9)
        const raw_transaction_id_2 = `TXN-${timestamp2}-${random2}`

        const { data: debtTransaction, error: debtTxError } = await supabase
          .from('original_transaction')
          .insert([{
            raw_transaction_id: raw_transaction_id_2,
            account_id: body.debt_account_id,
            transaction_date: body.transaction_date,
            description: body.description || `Debt drawdown ${drawdownRef}`,
            debit_amount: amount, // Debit on liability = liability increases
            credit_amount: null,
            balance: null,
            transaction_source: 'user_manual',
            created_by_user_id: null,
          }])
          .select()
          .single()

        if (debtTxError) {
          console.error('Error creating debt transaction:', debtTxError)
          // Rollback drawdown
          await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
          return NextResponse.json(
            { error: 'Failed to create debt account transaction' },
            { status: 500 }
          )
        }

        console.log('✓ Created debt account transaction')

        // Wait for main_transaction to be created by trigger
        let debtMainTransaction = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: debtMainTxData } = await supabase
            .from('main_transaction')
            .select('*')
            .eq('raw_transaction_id', raw_transaction_id_2)
            .single()

          if (debtMainTxData) {
            debtMainTransaction = debtMainTxData
            break
          }

          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 20))
          }
        }

        if (!debtMainTransaction) {
          console.error('Debt main transaction was not created')
          // Rollback
          await supabase.from('debt_drawdown').delete().eq('drawdown_id', drawdown.drawdown_id)
          await supabase.from('original_transaction').delete().eq('raw_transaction_id', raw_transaction_id_2)
          return NextResponse.json(
            { error: 'Failed to create debt main transaction' },
            { status: 500 }
          )
        }

        // Update debt main_transaction with type and drawdown link
        const { error: updateDebtError } = await supabase
          .from('main_transaction')
          .update({
            transaction_type_id: body.transaction_type_id,
            drawdown_id: drawdown.drawdown_id,
            description: body.description || `Debt drawdown ${drawdownRef}`,
          })
          .eq('main_transaction_id', debtMainTransaction.main_transaction_id)

        if (updateDebtError) {
          console.error('Error updating debt main transaction:', updateDebtError)
        }

        // Update source main_transaction with drawdown link
        const { error: updateSourceError } = await supabase
          .from('main_transaction')
          .update({
            drawdown_id: drawdown.drawdown_id,
          })
          .eq('main_transaction_id', mainTransaction.main_transaction_id)

        if (updateSourceError) {
          console.error('Error updating source main transaction:', updateSourceError)
        }

        // Auto-match the two transactions
        try {
          const matchResponse = await fetch(`${request.nextUrl.origin}/api/transfers/match`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              transfer_out_id: mainTransaction.main_transaction_id,
              transfer_in_id: debtMainTransaction.main_transaction_id,
            }),
          })

          if (matchResponse.ok) {
            console.log('✓ Auto-matched debt transactions')
          } else {
            console.warn('Failed to auto-match debt transactions')
          }
        } catch (matchError) {
          console.error('Error auto-matching:', matchError)
        }

        console.log('✅ DEBT_TAKE auto-processing complete')
      }
    }

    // Fetch the final main transaction with all details
    const { data: finalTransaction, error: finalError } = await supabase
      .from('main_transaction_details')
      .select('*')
      .eq('main_transaction_id', mainTransaction.main_transaction_id)
      .single()

    if (finalError) {
      console.error('Error fetching final transaction:', finalError)
      // Return basic info even if detailed fetch fails
      return NextResponse.json({
        data: mainTransaction,
        raw_transaction_id,
      }, { status: 201 })
    }

    return NextResponse.json({
      data: finalTransaction,
      raw_transaction_id,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
