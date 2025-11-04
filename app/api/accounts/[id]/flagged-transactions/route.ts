/**
 * API Route: /api/accounts/[id]/flagged-transactions
 * Get all flagged (balance adjustment) transactions for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFlaggedTransactions } from '@/lib/checkpoint-service'

// ==============================================================================
// GET /api/accounts/[id]/flagged-transactions
// Get all flagged transactions for an account
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Fetch flagged transactions
    const transactions = await getFlaggedTransactions(accountId)

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      summary: {
        total_flagged: transactions.length,
        total_adjustment_amount: transactions.reduce(
          (sum, tx) => sum + (tx.credit_amount - tx.debit_amount),
          0
        ),
      },
    })
  } catch (error) {
    console.error('Error fetching flagged transactions:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch flagged transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
