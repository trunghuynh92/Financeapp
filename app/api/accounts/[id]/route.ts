import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { UpdateAccountInput } from '@/types/account'

// GET /api/accounts/[id] - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('accounts')
      .select(`
        *,
        balance:account_balances(current_balance, last_updated, last_transaction_id),
        entity:entities(id, name, type)
      `)
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
      console.error('Error fetching account:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PATCH /api/accounts/[id] - Update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
    }

    const body: UpdateAccountInput = await request.json()

    // Check if account exists
    const { data: existingAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('account_id, entity_id')
      .eq('account_id', accountId)
      .single()

    if (fetchError || !existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // If updating account name or type, check for duplicates
    if (body.account_name || body.account_type) {
      const { data: duplicates } = await supabase
        .from('accounts')
        .select('account_id')
        .eq('entity_id', existingAccount.entity_id)
        .eq('account_name', body.account_name || '')
        .eq('account_type', body.account_type || '')
        .neq('account_id', accountId)

      if (duplicates && duplicates.length > 0) {
        return NextResponse.json(
          { error: 'An account with this name and type already exists for this entity' },
          { status: 409 }
        )
      }
    }

    // Update account
    const updateData: any = {}
    if (body.account_name !== undefined) updateData.account_name = body.account_name
    if (body.account_type !== undefined) updateData.account_type = body.account_type
    if (body.account_number !== undefined) updateData.account_number = body.account_number
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.credit_limit !== undefined) updateData.credit_limit = body.credit_limit
    if (body.loan_reference !== undefined) updateData.loan_reference = body.loan_reference
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('account_id', accountId)
      .select(`
        *,
        balance:account_balances(current_balance, last_updated),
        entity:entities(id, name, type)
      `)
      .single()

    if (updateError) {
      console.error('Error updating account:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updatedAccount)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounts/[id] - Delete account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
    }

    // Check if account exists
    const { data: existingAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('account_id, account_name')
      .eq('account_id', accountId)
      .single()

    if (fetchError || !existingAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // TODO: Check for existing transactions (when transaction table is created in Week 3)
    // For now, we'll allow deletion

    // Delete account (this will cascade delete the balance due to FK constraint)
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('account_id', accountId)

    if (deleteError) {
      console.error('Error deleting account:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
