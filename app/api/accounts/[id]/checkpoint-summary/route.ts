/**
 * API Route: /api/accounts/[id]/checkpoint-summary
 * Get checkpoint summary statistics for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCheckpointSummary } from '@/lib/checkpoint-service'

// ==============================================================================
// GET /api/accounts/[id]/checkpoint-summary
// Get checkpoint summary for an account
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

    // Fetch checkpoint summary
    const summary = await getCheckpointSummary(accountId)

    return NextResponse.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error('Error fetching checkpoint summary:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch checkpoint summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
