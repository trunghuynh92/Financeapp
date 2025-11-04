/**
 * Balance Checkpoint Service
 * Implements core business logic for the "No money without origin" principle
 */

import { supabase } from './supabase'
import type {
  BalanceCheckpoint,
  CreateOrUpdateCheckpointParams,
  RecalculateCheckpointsParams,
  BalanceAdjustmentTransactionData,
  CheckpointRecalculationResult,
  BalanceCalculation,
} from '@/types/checkpoint'
import { CHECKPOINT_CONFIG } from '@/types/checkpoint'

// ==============================================================================
// Core Function 1: Calculate Balance Up To Date
// ==============================================================================

/**
 * Calculates account balance from all transactions up to (and including) a specific date
 * Excludes balance adjustment transactions from the calculation
 */
export async function calculateBalanceUpToDate(
  accountId: number,
  upToDate: Date
): Promise<BalanceCalculation> {
  try {
    // Use the database function for accurate calculation
    const { data, error } = await supabase.rpc('calculate_balance_up_to_date', {
      p_account_id: accountId,
      p_up_to_date: upToDate.toISOString(),
    })

    if (error) {
      console.error('Error calculating balance:', error)
      throw new Error(`Failed to calculate balance: ${error.message}`)
    }

    // Also get transaction count for metadata
    const { count } = await supabase
      .from('original_transaction')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .lte('transaction_date', upToDate.toISOString())
      .eq('is_balance_adjustment', false)

    return {
      account_id: accountId,
      up_to_date: upToDate.toISOString(),
      calculated_balance: data || 0,
      transaction_count: count || 0,
    }
  } catch (error) {
    console.error('Error in calculateBalanceUpToDate:', error)
    throw error
  }
}

// ==============================================================================
// Core Function 2: Create or Update Balance Adjustment Transaction
// ==============================================================================

/**
 * Creates or updates a balance adjustment transaction for a checkpoint
 * Positive adjustment = Credit (missing income)
 * Negative adjustment = Debit (missing expense)
 */
export async function createOrUpdateBalanceAdjustmentTransaction(
  checkpoint: BalanceCheckpoint
): Promise<void> {
  try {
    const {
      checkpoint_id,
      account_id,
      checkpoint_date,
      adjustment_amount,
    } = checkpoint

    // Check if adjustment transaction already exists
    const { data: existing, error: fetchError } = await supabase
      .from('original_transaction')
      .select('*')
      .eq('checkpoint_id', checkpoint_id)
      .maybeSingle()

    if (fetchError) {
      throw new Error(`Failed to fetch existing transaction: ${fetchError.message}`)
    }

    // If adjustment is effectively 0 (within threshold), delete existing transaction
    if (Math.abs(adjustment_amount) < CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD) {
      if (existing) {
        const { error: deleteError } = await supabase
          .from('original_transaction')
          .delete()
          .eq('checkpoint_id', checkpoint_id)

        if (deleteError) {
          throw new Error(`Failed to delete adjustment transaction: ${deleteError.message}`)
        }
      }
      return
    }

    // Prepare transaction data
    const transactionData: Partial<BalanceAdjustmentTransactionData> = {
      account_id,
      transaction_date: new Date(checkpoint_date),
      description: CHECKPOINT_CONFIG.BALANCE_ADJUSTMENT_DESCRIPTION,
      credit_amount: adjustment_amount > 0 ? adjustment_amount : 0,
      debit_amount: adjustment_amount < 0 ? Math.abs(adjustment_amount) : 0,
      checkpoint_id,
      is_balance_adjustment: true,
      is_flagged: true,
    }

    if (existing) {
      // Update existing transaction
      const { error: updateError } = await supabase
        .from('original_transaction')
        .update({
          credit_amount: transactionData.credit_amount,
          debit_amount: transactionData.debit_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('checkpoint_id', checkpoint_id)

      if (updateError) {
        throw new Error(`Failed to update adjustment transaction: ${updateError.message}`)
      }
    } else {
      // Create new transaction
      const { error: insertError } = await supabase
        .from('original_transaction')
        .insert({
          account_id: transactionData.account_id,
          transaction_date: transactionData.transaction_date?.toISOString(),
          description: transactionData.description,
          credit_amount: transactionData.credit_amount,
          debit_amount: transactionData.debit_amount,
          checkpoint_id: transactionData.checkpoint_id,
          is_balance_adjustment: transactionData.is_balance_adjustment,
          is_flagged: transactionData.is_flagged,
        })

      if (insertError) {
        throw new Error(`Failed to create adjustment transaction: ${insertError.message}`)
      }
    }
  } catch (error) {
    console.error('Error in createOrUpdateBalanceAdjustmentTransaction:', error)
    throw error
  }
}

// ==============================================================================
// Core Function 3: Create or Update Checkpoint
// ==============================================================================

/**
 * Creates or updates a balance checkpoint for an account
 * This is the main entry point for checkpoint management
 */
export async function createOrUpdateCheckpoint(
  params: CreateOrUpdateCheckpointParams
): Promise<BalanceCheckpoint> {
  const {
    account_id,
    checkpoint_date,
    declared_balance,
    notes = null,
    user_id = null,
  } = params

  try {
    // Step 1: Calculate balance from transactions up to checkpoint date
    const balanceCalc = await calculateBalanceUpToDate(account_id, checkpoint_date)
    const calculated_balance = balanceCalc.calculated_balance

    // Step 2: Calculate adjustment amount
    const adjustment_amount = declared_balance - calculated_balance
    const is_reconciled = Math.abs(adjustment_amount) < CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD

    // Step 3: Check if checkpoint already exists for this account and date
    const { data: existing, error: fetchError } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', account_id)
      .eq('checkpoint_date', checkpoint_date.toISOString())
      .maybeSingle()

    if (fetchError) {
      throw new Error(`Failed to check for existing checkpoint: ${fetchError.message}`)
    }

    let checkpoint: BalanceCheckpoint

    if (existing) {
      // Update existing checkpoint
      const { data: updated, error: updateError } = await supabase
        .from('balance_checkpoints')
        .update({
          declared_balance,
          calculated_balance,
          adjustment_amount,
          is_reconciled,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('checkpoint_id', existing.checkpoint_id)
        .select()
        .single()

      if (updateError || !updated) {
        throw new Error(`Failed to update checkpoint: ${updateError?.message || 'No data returned'}`)
      }

      checkpoint = updated
    } else {
      // Create new checkpoint
      const { data: created, error: insertError } = await supabase
        .from('balance_checkpoints')
        .insert({
          account_id,
          checkpoint_date: checkpoint_date.toISOString(),
          declared_balance,
          calculated_balance,
          adjustment_amount,
          is_reconciled,
          notes,
          created_by_user_id: user_id,
        })
        .select()
        .single()

      if (insertError || !created) {
        throw new Error(`Failed to create checkpoint: ${insertError?.message || 'No data returned'}`)
      }

      checkpoint = created
    }

    // Step 4: Create or update balance adjustment transaction
    await createOrUpdateBalanceAdjustmentTransaction(checkpoint)

    // Step 5: Update account opening balance date
    await updateAccountOpeningBalanceDate(account_id)

    return checkpoint
  } catch (error) {
    console.error('Error in createOrUpdateCheckpoint:', error)
    throw error
  }
}

// ==============================================================================
// Core Function 4: Recalculate All Checkpoints
// ==============================================================================

/**
 * Recalculates all checkpoints for an account
 * Called when transactions are added/edited/deleted
 */
export async function recalculateAllCheckpoints(
  params: RecalculateCheckpointsParams
): Promise<CheckpointRecalculationResult[]> {
  const { account_id, from_date, to_date, checkpoint_ids } = params

  try {
    // Build query for checkpoints
    let query = supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', account_id)
      .order('checkpoint_date', { ascending: true })

    // Apply filters if provided
    if (from_date) {
      query = query.gte('checkpoint_date', from_date.toISOString())
    }
    if (to_date) {
      query = query.lte('checkpoint_date', to_date.toISOString())
    }
    if (checkpoint_ids && checkpoint_ids.length > 0) {
      query = query.in('checkpoint_id', checkpoint_ids)
    }

    const { data: checkpoints, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch checkpoints: ${fetchError.message}`)
    }

    if (!checkpoints || checkpoints.length === 0) {
      return []
    }

    // Recalculate each checkpoint
    const results: CheckpointRecalculationResult[] = []

    for (const checkpoint of checkpoints) {
      const oldCalculatedBalance = checkpoint.calculated_balance
      const oldAdjustmentAmount = checkpoint.adjustment_amount
      const oldIsReconciled = checkpoint.is_reconciled

      // Recalculate balance
      const balanceCalc = await calculateBalanceUpToDate(
        account_id,
        new Date(checkpoint.checkpoint_date)
      )
      const newCalculatedBalance = balanceCalc.calculated_balance

      // Calculate new adjustment
      const newAdjustmentAmount = checkpoint.declared_balance - newCalculatedBalance
      const newIsReconciled = Math.abs(newAdjustmentAmount) < CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD

      // Update checkpoint
      const { error: updateError } = await supabase
        .from('balance_checkpoints')
        .update({
          calculated_balance: newCalculatedBalance,
          adjustment_amount: newAdjustmentAmount,
          is_reconciled: newIsReconciled,
          updated_at: new Date().toISOString(),
        })
        .eq('checkpoint_id', checkpoint.checkpoint_id)

      if (updateError) {
        throw new Error(`Failed to update checkpoint ${checkpoint.checkpoint_id}: ${updateError.message}`)
      }

      // Update or create adjustment transaction
      await createOrUpdateBalanceAdjustmentTransaction({
        ...checkpoint,
        calculated_balance: newCalculatedBalance,
        adjustment_amount: newAdjustmentAmount,
        is_reconciled: newIsReconciled,
      })

      results.push({
        checkpoint_id: checkpoint.checkpoint_id,
        old_calculated_balance: oldCalculatedBalance,
        new_calculated_balance: newCalculatedBalance,
        old_adjustment_amount: oldAdjustmentAmount,
        new_adjustment_amount: newAdjustmentAmount,
        old_is_reconciled: oldIsReconciled,
        new_is_reconciled: newIsReconciled,
        adjustment_transaction_updated: true,
      })
    }

    // Update account opening balance date
    await updateAccountOpeningBalanceDate(account_id)

    return results
  } catch (error) {
    console.error('Error in recalculateAllCheckpoints:', error)
    throw error
  }
}

// ==============================================================================
// Core Function 5: Update Account Opening Balance Date
// ==============================================================================

/**
 * Updates account opening balance date to be before the earliest transaction
 */
export async function updateAccountOpeningBalanceDate(
  accountId: number
): Promise<void> {
  try {
    // Use the database function for accurate calculation
    const { error } = await supabase.rpc('update_account_opening_balance_date', {
      p_account_id: accountId,
    })

    if (error) {
      throw new Error(`Failed to update account opening balance date: ${error.message}`)
    }
  } catch (error) {
    console.error('Error in updateAccountOpeningBalanceDate:', error)
    throw error
  }
}

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Get all checkpoints for an account
 */
export async function getAccountCheckpoints(
  accountId: number,
  options?: {
    includeReconciled?: boolean
    orderBy?: 'date_asc' | 'date_desc'
    limit?: number
    offset?: number
  }
): Promise<BalanceCheckpoint[]> {
  try {
    let query = supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', accountId)

    // Filter reconciled if requested
    if (options?.includeReconciled === false) {
      query = query.eq('is_reconciled', false)
    }

    // Apply ordering
    const ascending = options?.orderBy === 'date_asc'
    query = query.order('checkpoint_date', { ascending })

    // Apply pagination
    if (options?.limit) {
      const from = options.offset || 0
      const to = from + options.limit - 1
      query = query.range(from, to)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch checkpoints: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Error in getAccountCheckpoints:', error)
    throw error
  }
}

/**
 * Get a single checkpoint by ID
 */
export async function getCheckpointById(
  checkpointId: number
): Promise<BalanceCheckpoint | null> {
  try {
    const { data, error } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpointId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch checkpoint: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Error in getCheckpointById:', error)
    throw error
  }
}

/**
 * Delete a checkpoint and its associated balance adjustment transaction
 */
export async function deleteCheckpoint(checkpointId: number): Promise<void> {
  try {
    // Get the checkpoint to find the account_id
    const checkpoint = await getCheckpointById(checkpointId)

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }

    // Delete the checkpoint (CASCADE will delete the adjustment transaction)
    const { error } = await supabase
      .from('balance_checkpoints')
      .delete()
      .eq('checkpoint_id', checkpointId)

    if (error) {
      throw new Error(`Failed to delete checkpoint: ${error.message}`)
    }

    // Update account opening balance date
    await updateAccountOpeningBalanceDate(checkpoint.account_id)
  } catch (error) {
    console.error('Error in deleteCheckpoint:', error)
    throw error
  }
}

/**
 * Get all flagged (balance adjustment) transactions for an account
 */
export async function getFlaggedTransactions(accountId: number) {
  try {
    const { data, error } = await supabase
      .from('original_transaction')
      .select(`
        *,
        checkpoint:balance_checkpoints(
          checkpoint_id,
          checkpoint_date,
          declared_balance,
          adjustment_amount,
          is_reconciled
        )
      `)
      .eq('account_id', accountId)
      .eq('is_flagged', true)
      .order('transaction_date', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch flagged transactions: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Error in getFlaggedTransactions:', error)
    throw error
  }
}

/**
 * Get checkpoint summary statistics for an account
 */
export async function getCheckpointSummary(accountId: number) {
  try {
    const { data, error } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', accountId)

    if (error) {
      throw new Error(`Failed to fetch checkpoint summary: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {
        total_checkpoints: 0,
        reconciled_checkpoints: 0,
        unreconciled_checkpoints: 0,
        total_adjustment_amount: 0,
        earliest_checkpoint_date: null,
        latest_checkpoint_date: null,
      }
    }

    const reconciledCount = data.filter(cp => cp.is_reconciled).length
    const totalAdjustment = data.reduce((sum, cp) => sum + cp.adjustment_amount, 0)
    const dates = data.map(cp => new Date(cp.checkpoint_date).getTime())

    return {
      total_checkpoints: data.length,
      reconciled_checkpoints: reconciledCount,
      unreconciled_checkpoints: data.length - reconciledCount,
      total_adjustment_amount: totalAdjustment,
      earliest_checkpoint_date: new Date(Math.min(...dates)).toISOString(),
      latest_checkpoint_date: new Date(Math.max(...dates)).toISOString(),
    }
  } catch (error) {
    console.error('Error in getCheckpointSummary:', error)
    throw error
  }
}
