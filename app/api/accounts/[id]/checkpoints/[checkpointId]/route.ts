/**
 * API Route: /api/accounts/[id]/checkpoints/[checkpointId]
 * Handles individual checkpoint operations (get, update, delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCheckpointById,
  createOrUpdateCheckpoint,
  deleteCheckpoint,
} from '@/lib/checkpoint-service'
import type { UpdateCheckpointRequest } from '@/types/checkpoint'

// ==============================================================================
// GET /api/accounts/[id]/checkpoints/[checkpointId]
// Get a single checkpoint by ID
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; checkpointId: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)
    const checkpointId = parseInt(params.checkpointId, 10)

    if (isNaN(accountId) || isNaN(checkpointId)) {
      return NextResponse.json(
        { error: 'Invalid account ID or checkpoint ID' },
        { status: 400 }
      )
    }

    // Fetch checkpoint
    const checkpoint = await getCheckpointById(checkpointId)

    if (!checkpoint) {
      return NextResponse.json(
        { error: 'Checkpoint not found' },
        { status: 404 }
      )
    }

    // Verify checkpoint belongs to the account
    if (checkpoint.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Checkpoint does not belong to this account' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: checkpoint,
    })
  } catch (error) {
    console.error('Error fetching checkpoint:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PUT/PATCH /api/accounts/[id]/checkpoints/[checkpointId]
// Update a checkpoint's declared balance or notes
// Both PUT and PATCH supported for flexibility
// ==============================================================================

async function updateCheckpointHandler(
  request: NextRequest,
  { params }: { params: { id: string; checkpointId: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)
    const checkpointId = parseInt(params.checkpointId, 10)

    if (isNaN(accountId) || isNaN(checkpointId)) {
      return NextResponse.json(
        { error: 'Invalid account ID or checkpoint ID' },
        { status: 400 }
      )
    }

    // Fetch existing checkpoint
    const existingCheckpoint = await getCheckpointById(checkpointId)

    if (!existingCheckpoint) {
      return NextResponse.json(
        { error: 'Checkpoint not found' },
        { status: 404 }
      )
    }

    // Verify checkpoint belongs to the account
    if (existingCheckpoint.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Checkpoint does not belong to this account' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: UpdateCheckpointRequest = await request.json()

    // Validate at least one field is being updated
    if (body.declared_balance === undefined && body.notes === undefined) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Validate declared balance if provided
    if (body.declared_balance !== undefined && typeof body.declared_balance !== 'number') {
      return NextResponse.json(
        { error: 'declared_balance must be a number' },
        { status: 400 }
      )
    }

    // Update checkpoint (this will trigger recalculation of all checkpoints)
    const updatedCheckpoint = await createOrUpdateCheckpoint({
      account_id: accountId,
      checkpoint_date: new Date(existingCheckpoint.checkpoint_date),
      declared_balance: body.declared_balance ?? existingCheckpoint.declared_balance,
      notes: body.notes !== undefined ? body.notes : existingCheckpoint.notes,
    })

    return NextResponse.json({
      success: true,
      data: updatedCheckpoint,
      message: updatedCheckpoint.is_reconciled
        ? 'Checkpoint updated and fully reconciled'
        : 'Checkpoint updated with balance adjustment',
    })
  } catch (error) {
    console.error('Error updating checkpoint:', error)

    return NextResponse.json(
      {
        error: 'Failed to update checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const PUT = updateCheckpointHandler
export const PATCH = updateCheckpointHandler

// ==============================================================================
// DELETE /api/accounts/[id]/checkpoints/[checkpointId]
// Delete a checkpoint and its associated balance adjustment transaction
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; checkpointId: string } }
) {
  try {
    const accountId = parseInt(params.id, 10)
    const checkpointId = parseInt(params.checkpointId, 10)

    if (isNaN(accountId) || isNaN(checkpointId)) {
      return NextResponse.json(
        { error: 'Invalid account ID or checkpoint ID' },
        { status: 400 }
      )
    }

    // Fetch existing checkpoint
    const existingCheckpoint = await getCheckpointById(checkpointId)

    if (!existingCheckpoint) {
      return NextResponse.json(
        { error: 'Checkpoint not found' },
        { status: 404 }
      )
    }

    // Verify checkpoint belongs to the account
    if (existingCheckpoint.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Checkpoint does not belong to this account' },
        { status: 403 }
      )
    }

    // Delete checkpoint
    await deleteCheckpoint(checkpointId)

    return NextResponse.json({
      success: true,
      message: 'Checkpoint deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting checkpoint:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
