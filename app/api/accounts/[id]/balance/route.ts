import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/accounts/[id]/balance - Get current balance for an account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Balance not found' }, { status: 404 })
      }
      console.error('Error fetching balance:', error)
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

// PATCH /api/accounts/[id]/balance - Update account balance
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
    }

    const body = await request.json()
    const { balance } = body

    if (balance === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: balance' },
        { status: 400 }
      )
    }

    // Update balance
    const { data, error } = await supabase
      .from('account_balances')
      .update({ current_balance: balance })
      .eq('account_id', accountId)
      .select()
      .single()

    if (error) {
      console.error('Error updating balance:', error)
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
