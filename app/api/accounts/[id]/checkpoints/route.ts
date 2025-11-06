/**
 * API Route: /api/accounts/[id]/checkpoints
 * Handles checkpoint creation and listing for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createOrUpdateCheckpoint,
  getAccountCheckpoints,
  recalculateAllCheckpoints,
} from '@/lib/checkpoint-service'
import type {
  CreateCheckpointRequest,
  CheckpointListQuery,
} from '@/types/checkpoint'

// ==============================================================================
// GET /api/accounts/[id]/checkpoints
// Get all checkpoints for an account
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const includeReconciled = searchParams.get('include_reconciled') !== 'false'
    const orderBy = (searchParams.get('order_by') as 'date_asc' | 'date_desc') || 'date_desc'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined

    // Fetch checkpoints
    const checkpoints = await getAccountCheckpoints(accountId, {
      includeReconciled,
      orderBy,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: checkpoints,
      count: checkpoints.length,
    })
  } catch (error) {
    console.error('Error fetching checkpoints:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch checkpoints',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST /api/accounts/[id]/checkpoints
// Create a new balance checkpoint
// ==============================================================================

export async function POST(
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

    // Parse request body
    const body: CreateCheckpointRequest = await request.json()

    // Validate required fields
    if (!body.checkpoint_date) {
      return NextResponse.json(
        { error: 'checkpoint_date is required' },
        { status: 400 }
      )
    }

    if (body.declared_balance === undefined || body.declared_balance === null) {
      return NextResponse.json(
        { error: 'declared_balance is required' },
        { status: 400 }
      )
    }

    // Validate date format
    const checkpointDate = new Date(body.checkpoint_date)
    if (isNaN(checkpointDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid checkpoint_date format' },
        { status: 400 }
      )
    }

    // Set checkpoint to END of day to ensure all same-day transactions are included in calculation
    // This prevents race conditions where imported transactions at 00:00:00 might be calculated
    // before the checkpoint adjustment at 00:00:00
    checkpointDate.setHours(23, 59, 59, 999)

    // Validate declared balance is a number
    if (typeof body.declared_balance !== 'number') {
      return NextResponse.json(
        { error: 'declared_balance must be a number' },
        { status: 400 }
      )
    }

    // Create checkpoint
    const checkpoint = await createOrUpdateCheckpoint({
      account_id: accountId,
      checkpoint_date: checkpointDate,
      declared_balance: body.declared_balance,
      notes: body.notes || null,
    })

    return NextResponse.json(
      {
        success: true,
        data: checkpoint,
        message: checkpoint.is_reconciled
          ? 'Checkpoint created and fully reconciled'
          : 'Checkpoint created with balance adjustment',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating checkpoint:', error)

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique_account_checkpoint_date')) {
      return NextResponse.json(
        {
          error: 'Checkpoint already exists for this date',
          message: 'A checkpoint already exists for this account and date. Use PUT to update it.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PUT /api/accounts/[id]/checkpoints/recalculate
// Recalculate all checkpoints for an account
// ==============================================================================

export async function PUT(
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

    // Parse query parameters for filters
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action !== 'recalculate') {
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=recalculate' },
        { status: 400 }
      )
    }

    // Recalculate all checkpoints
    const results = await recalculateAllCheckpoints({ account_id: accountId })

    return NextResponse.json({
      success: true,
      data: results,
      message: `Recalculated ${results.length} checkpoint(s)`,
      summary: {
        total: results.length,
        now_reconciled: results.filter(r => r.new_is_reconciled).length,
        still_unreconciled: results.filter(r => !r.new_is_reconciled).length,
      },
    })
  } catch (error) {
    console.error('Error recalculating checkpoints:', error)

    return NextResponse.json(
      {
        error: 'Failed to recalculate checkpoints',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
