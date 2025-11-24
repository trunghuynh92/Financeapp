/**
 * API Route: /api/investment-contributions/[id]
 * Purpose: Delete investment contribution (unmatch)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const contributionId = parseInt(params.id)

    if (isNaN(contributionId)) {
      return NextResponse.json(
        { error: 'Invalid contribution ID' },
        { status: 400 }
      )
    }

    // Get the contribution to find linked transactions
    const { data: contribution, error: fetchError } = await supabase
      .from('investment_contribution')
      .select('*')
      .eq('contribution_id', contributionId)
      .single()

    if (fetchError || !contribution) {
      return NextResponse.json(
        { error: 'Investment contribution not found' },
        { status: 404 }
      )
    }

    // Find the source transaction (bank/cash account)
    // When we clear its investment_contribution_id, the trigger will:
    // 1. Delete the paired investment account transaction
    // 2. Delete the investment_contribution record
    const { data: sourceTransaction, error: fetchTxError } = await supabase
      .from('main_transaction')
      .select('main_transaction_id, account_id')
      .eq('investment_contribution_id', contributionId)
      .neq('account_id', contribution.investment_account_id) // Get the NON-investment account transaction
      .maybeSingle()

    if (fetchTxError) {
      console.error('Error fetching source transaction:', fetchTxError)
      return NextResponse.json(
        { error: 'Failed to fetch source transaction' },
        { status: 500 }
      )
    }

    if (!sourceTransaction) {
      console.warn('Source transaction not found for contribution:', contributionId)
      // If no source transaction found, manually delete the contribution record
      const { error: deleteError } = await supabase
        .from('investment_contribution')
        .delete()
        .eq('contribution_id', contributionId)

      if (deleteError) {
        console.error('Error deleting investment contribution:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete investment contribution' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Investment contribution deleted successfully (no source transaction found)',
        contribution_id: contributionId,
      })
    }

    console.log('Found source transaction:', sourceTransaction)

    // Clear the investment_contribution_id on the source transaction
    // The database trigger (Migration 070) will automatically:
    // 1. Find and delete the paired investment account transaction
    // 2. Delete the investment_contribution record
    const { error: clearError } = await supabase
      .from('main_transaction')
      .update({ investment_contribution_id: null })
      .eq('main_transaction_id', sourceTransaction.main_transaction_id)

    if (clearError) {
      console.error('Error clearing investment link:', clearError)
      return NextResponse.json(
        { error: 'Failed to unmatch investment' },
        { status: 500 }
      )
    }

    console.log(`Cleared investment_contribution_id on source transaction ${sourceTransaction.main_transaction_id}`)
    console.log('Database trigger will handle cleanup of paired transaction and contribution record')

    return NextResponse.json({
      message: 'Investment contribution deleted successfully',
      contribution_id: contributionId,
    })
  } catch (error) {
    console.error('Unexpected error deleting investment contribution:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
