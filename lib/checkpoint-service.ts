/**
 * Balance Checkpoint Service
 * Implements core business logic for the "No money without origin" principle
 */

import { createSupabaseServerClient } from './supabase-server'
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
  const supabase = createSupabaseServerClient()
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
 * For normal accounts: Positive adjustment = Credit (missing income), Negative = Debit (missing expense)
 * For credit accounts: Positive adjustment = Debit (missing borrowing), Negative = Credit (excess debt/payment)
 */
export async function createOrUpdateBalanceAdjustmentTransaction(
  checkpoint: BalanceCheckpoint
): Promise<void> {
  const supabase = createSupabaseServerClient()
  try {
    const {
      checkpoint_id,
      account_id,
      checkpoint_date,
      adjustment_amount,
    } = checkpoint

    // Fetch account to check type
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_type')
      .eq('account_id', account_id)
      .single()

    if (accountError) {
      throw new Error(`Failed to fetch account: ${accountError.message}`)
    }

    const isCreditAccount = ['credit_line', 'term_loan', 'credit_card'].includes(account.account_type)

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
    // NOTE: Database constraint requires that either debit OR credit is NULL, not 0
    // For credit accounts, invert the debit/credit logic
    const creditAmount = isCreditAccount
      ? (adjustment_amount < 0 ? Math.abs(adjustment_amount) : null)  // Inverted
      : (adjustment_amount > 0 ? adjustment_amount : null)             // Normal

    const debitAmount = isCreditAccount
      ? (adjustment_amount > 0 ? adjustment_amount : null)             // Inverted
      : (adjustment_amount < 0 ? Math.abs(adjustment_amount) : null)  // Normal

    const transactionData = {
      account_id,
      transaction_date: new Date(checkpoint_date),
      description: CHECKPOINT_CONFIG.BALANCE_ADJUSTMENT_DESCRIPTION,
      credit_amount: creditAmount,
      debit_amount: debitAmount,
      checkpoint_id,
      is_balance_adjustment: true,
      is_flagged: true,
    }

    if (existing) {
      // Update existing transaction
      // NOTE: Must use null (not 0) for the unused amount field
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
      // Generate unique transaction ID for balance adjustment
      const raw_transaction_id = `BAL-ADJ-${checkpoint_id}`

      const { error: insertError } = await supabase
        .from('original_transaction')
        .insert({
          raw_transaction_id: raw_transaction_id,
          account_id: transactionData.account_id,
          transaction_date: transactionData.transaction_date?.toISOString(),
          description: transactionData.description,
          credit_amount: transactionData.credit_amount,
          debit_amount: transactionData.debit_amount,
          transaction_source: 'auto_adjustment',  // Mark as system-generated adjustment
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
 *
 * IMPORTANT: After creating/updating, this triggers recalculation of ALL checkpoints
 * to ensure adjustments are correct regardless of creation order
 */
export async function createOrUpdateCheckpoint(
  params: CreateOrUpdateCheckpointParams
): Promise<BalanceCheckpoint> {
  const supabase = createSupabaseServerClient()

  const {
    account_id,
    checkpoint_date,
    declared_balance,
    notes = null,
    import_batch_id = null,
    user_id = null,
  } = params

  try {
    // Step 1: Check if checkpoint already exists for this account and date
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
      // Update existing checkpoint (just update declared balance and notes)
      const { data: updated, error: updateError } = await supabase
        .from('balance_checkpoints')
        .update({
          declared_balance,
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
      // Create new checkpoint (calculated values will be set by recalculation)
      const { data: created, error: insertError } = await supabase
        .from('balance_checkpoints')
        .insert({
          account_id,
          checkpoint_date: checkpoint_date.toISOString(),
          declared_balance,
          calculated_balance: 0, // Will be recalculated
          adjustment_amount: 0,   // Will be recalculated
          is_reconciled: false,   // Will be recalculated
          notes,
          import_batch_id,
          created_by_user_id: user_id,
        })
        .select()
        .single()

      if (insertError || !created) {
        throw new Error(`Failed to create checkpoint: ${insertError?.message || 'No data returned'}`)
      }

      checkpoint = created
    }

    // Step 2: Recalculate ALL checkpoints for this account
    // This ensures adjustments are correct regardless of creation order
    await recalculateAllCheckpoints({ account_id })

    // Step 3: Fetch the updated checkpoint after recalculation
    const { data: finalCheckpoint, error: finalError } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpoint.checkpoint_id)
      .single()

    if (finalError || !finalCheckpoint) {
      throw new Error(`Failed to fetch recalculated checkpoint: ${finalError?.message}`)
    }

    // Step 4: Update account opening balance date
    await updateAccountOpeningBalanceDate(account_id)

    // Step 5: Sync account_balances table with calculated balance
    await syncAccountBalance(account_id)

    return finalCheckpoint
  } catch (error) {
    console.error('Error in createOrUpdateCheckpoint:', error)
    throw error
  }
}

// ==============================================================================
// Helper Function: Sync account_balances from Calculated Balance
// ==============================================================================

/**
 * Syncs account_balances.current_balance with the latest calculated balance
 * Called after checkpoint creation/update to keep balance cache in sync
 *
 * account_balances table now serves as a cached/computed value:
 * - Source of truth = checkpoints + transactions
 * - account_balances = cached for quick queries
 */
export async function syncAccountBalance(accountId: number): Promise<void> {
  const supabase = createSupabaseServerClient()

  try {
    console.log(`Syncing account_balances for account ${accountId}...`)

    // Get the most recent checkpoint to determine current balance
    const { data: latestCheckpoint, error: checkpointError } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', accountId)
      .order('checkpoint_date', { ascending: false })
      .order('checkpoint_id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkpointError) {
      throw new Error(`Failed to fetch latest checkpoint: ${checkpointError.message}`)
    }

    let calculatedBalance = 0

    if (latestCheckpoint) {
      // If checkpoint exists, current balance = calculated + adjustment
      // (adjustment represents the unexplained amount)
      calculatedBalance = latestCheckpoint.calculated_balance + latestCheckpoint.adjustment_amount
      console.log(`Latest checkpoint found:`, {
        checkpoint_date: latestCheckpoint.checkpoint_date,
        declared_balance: latestCheckpoint.declared_balance,
        calculated_balance: latestCheckpoint.calculated_balance,
        adjustment_amount: latestCheckpoint.adjustment_amount,
        total: calculatedBalance,
      })
    } else {
      // No checkpoint - calculate from all transactions
      // Use pagination to avoid 1000 row limit
      let totalCredit = 0
      let totalDebit = 0
      let page = 0
      const pageSize = 1000
      let transactionCount = 0

      while (true) {
        const { data: transactions, error: txError } = await supabase
          .from('original_transaction')
          .select('credit_amount, debit_amount')
          .eq('account_id', accountId)
          .eq('is_balance_adjustment', false)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (txError) {
          throw new Error(`Failed to fetch transactions: ${txError.message}`)
        }

        if (!transactions || transactions.length === 0) {
          break
        }

        // Calculate balance: sum(credits) - sum(debits)
        for (const tx of transactions) {
          if (tx.credit_amount) totalCredit += tx.credit_amount
          if (tx.debit_amount) totalDebit += tx.debit_amount
        }

        transactionCount += transactions.length

        if (transactions.length < pageSize) {
          break
        }

        page++
      }

      calculatedBalance = totalCredit - totalDebit
      console.log(`No checkpoint found, calculated from ${transactionCount} transactions: ${calculatedBalance}`)
    }

    // Update account_balances table
    const { error: updateError } = await supabase
      .from('account_balances')
      .update({
        current_balance: calculatedBalance,
        last_updated: new Date().toISOString(),
      })
      .eq('account_id', accountId)

    if (updateError) {
      throw new Error(`Failed to update account_balances: ${updateError.message}`)
    }

    console.log(`✅ account_balances synced successfully for account ${accountId}: ${calculatedBalance}`)
  } catch (error) {
    console.error('Error in syncAccountBalance:', error)
    throw error
  }
}

// ==============================================================================
// Core Function 4: Recalculate All Checkpoints
// ==============================================================================

/**
 * Recalculates all checkpoints for an account IN CHRONOLOGICAL ORDER
 * This ensures adjustments are calculated correctly regardless of creation order
 *
 * Key algorithm:
 * 1. Process all checkpoints sorted by checkpoint_date ASC
 * 2. For each checkpoint, calculate balance from:
 *    - All non-adjustment transactions up to checkpoint date
 *    - Adjustment transactions from PREVIOUS checkpoints only (by date, not creation time)
 * 3. This ensures that a checkpoint dated Oct 5 created AFTER a checkpoint dated Oct 15
 *    will have the correct adjustment amount
 */
export async function recalculateAllCheckpoints(
  params: RecalculateCheckpointsParams
): Promise<CheckpointRecalculationResult[]> {
  const supabase = createSupabaseServerClient()
  const { account_id, from_date, to_date, checkpoint_ids } = params

  try {
    // Fetch account to check type (for credit account logic)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_type')
      .eq('account_id', account_id)
      .single()

    if (accountError) {
      throw new Error(`Failed to fetch account: ${accountError.message}`)
    }

    // Check if this is a credit-type account (where positive balance = debt owed)
    const isCreditAccount = ['credit_line', 'term_loan', 'credit_card'].includes(account.account_type)

    // Fetch ALL checkpoints for the account in chronological order
    // We need to recalculate all, not just filtered ones, to get correct adjustment chain
    const { data: allCheckpoints, error: fetchError } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('account_id', account_id)
      .order('checkpoint_date', { ascending: true })
      .order('checkpoint_id', { ascending: true }) // Tie-breaker for same dates

    if (fetchError) {
      throw new Error(`Failed to fetch checkpoints: ${fetchError.message}`)
    }

    if (!allCheckpoints || allCheckpoints.length === 0) {
      return []
    }

    // Determine which checkpoints to actually recalculate (for return results)
    let checkpointsToRecalculate = allCheckpoints
    if (from_date || to_date || checkpoint_ids) {
      checkpointsToRecalculate = allCheckpoints.filter(cp => {
        const cpDate = new Date(cp.checkpoint_date)
        if (from_date && cpDate < from_date) return false
        if (to_date && cpDate > to_date) return false
        if (checkpoint_ids && !checkpoint_ids.includes(cp.checkpoint_id)) return false
        return true
      })
    }

    const results: CheckpointRecalculationResult[] = []

    // Process each checkpoint in chronological order
    for (const checkpoint of allCheckpoints) {
      const checkpointDate = new Date(checkpoint.checkpoint_date)

      // Calculate balance from:
      // 1. Non-adjustment transactions up to checkpoint date
      // Fetch ALL transactions using pagination to avoid 1000 row limit
      let totalCredits = 0
      let totalDebits = 0
      let page = 0
      const pageSize = 1000

      while (true) {
        const { data: nonAdjustmentTxs, error: txError } = await supabase
          .from('original_transaction')
          .select('credit_amount, debit_amount')
          .eq('account_id', account_id)
          .eq('is_balance_adjustment', false)
          .lte('transaction_date', checkpointDate.toISOString())
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (txError) {
          throw new Error(`Failed to fetch transactions: ${txError.message}`)
        }

        if (!nonAdjustmentTxs || nonAdjustmentTxs.length === 0) {
          break
        }

        // Sum this page of transactions
        for (const tx of nonAdjustmentTxs) {
          if (tx.credit_amount) totalCredits += tx.credit_amount
          if (tx.debit_amount) totalDebits += tx.debit_amount
        }

        if (nonAdjustmentTxs.length < pageSize) {
          break
        }

        page++
      }

      // 2. Adjustment transactions from PREVIOUS checkpoints only (by date)
      // Get checkpoints with earlier dates
      const previousCheckpoints = allCheckpoints.filter(cp =>
        new Date(cp.checkpoint_date) < checkpointDate
      )

      if (previousCheckpoints.length > 0) {
        const previousCheckpointIds = previousCheckpoints.map(cp => cp.checkpoint_id)

        const { data: previousAdjustments, error: adjError } = await supabase
          .from('original_transaction')
          .select('credit_amount, debit_amount')
          .eq('account_id', account_id)
          .eq('is_balance_adjustment', true)
          .in('checkpoint_id', previousCheckpointIds)

        if (adjError) {
          throw new Error(`Failed to fetch previous adjustments: ${adjError.message}`)
        }

        // Sum previous adjustments
        if (previousAdjustments && previousAdjustments.length > 0) {
          for (const tx of previousAdjustments) {
            if (tx.credit_amount) totalCredits += tx.credit_amount
            if (tx.debit_amount) totalDebits += tx.debit_amount
          }
        }
      }

      const newCalculatedBalance = totalCredits - totalDebits
      const newAdjustmentAmount = checkpoint.declared_balance - newCalculatedBalance
      const newIsReconciled = Math.abs(newAdjustmentAmount) < CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD

      // Store old values for results
      const oldCalculatedBalance = checkpoint.calculated_balance
      const oldAdjustmentAmount = checkpoint.adjustment_amount
      const oldIsReconciled = checkpoint.is_reconciled

      // Update checkpoint record
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

      // Delete old adjustment transaction
      await supabase
        .from('original_transaction')
        .delete()
        .eq('checkpoint_id', checkpoint.checkpoint_id)
        .eq('is_balance_adjustment', true)

      // Create new adjustment transaction if needed
      if (Math.abs(newAdjustmentAmount) >= CHECKPOINT_CONFIG.RECONCILIATION_THRESHOLD) {
        const raw_transaction_id = `BAL-ADJ-${checkpoint.checkpoint_id}`

        // For credit accounts (credit_line, term_loan, credit_card):
        // - Positive balance = debt owed (increases with DEBITS, not credits)
        // - Positive adjustment means need more debt → DEBIT
        // - Negative adjustment means too much debt → CREDIT (payment)
        // For normal accounts (bank, cash):
        // - Positive balance = asset (increases with CREDITS)
        // - Positive adjustment means missing income → CREDIT
        // - Negative adjustment means missing expense → DEBIT
        const creditAmount = isCreditAccount
          ? (newAdjustmentAmount < 0 ? Math.abs(newAdjustmentAmount) : null)  // Inverted
          : (newAdjustmentAmount > 0 ? newAdjustmentAmount : null)             // Normal

        const debitAmount = isCreditAccount
          ? (newAdjustmentAmount > 0 ? newAdjustmentAmount : null)             // Inverted
          : (newAdjustmentAmount < 0 ? Math.abs(newAdjustmentAmount) : null)  // Normal

        const { error: insertError } = await supabase
          .from('original_transaction')
          .insert({
            raw_transaction_id,
            account_id,
            transaction_date: checkpointDate.toISOString(),
            description: CHECKPOINT_CONFIG.BALANCE_ADJUSTMENT_DESCRIPTION,
            credit_amount: creditAmount,
            debit_amount: debitAmount,
            transaction_source: 'auto_adjustment',
            checkpoint_id: checkpoint.checkpoint_id,
            is_balance_adjustment: true,
            is_flagged: true,
          })

        if (insertError) {
          throw new Error(`Failed to create adjustment transaction: ${insertError.message}`)
        }
      }

      // Add to results if this checkpoint was requested for recalculation
      if (checkpointsToRecalculate.find(cp => cp.checkpoint_id === checkpoint.checkpoint_id)) {
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
    }

    // Update account opening balance date
    await updateAccountOpeningBalanceDate(account_id)

    // Sync account_balances with latest calculated balance
    await syncAccountBalance(account_id)

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
  const supabase = createSupabaseServerClient()
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
  const supabase = createSupabaseServerClient()
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
  const supabase = createSupabaseServerClient()
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
 * After deletion, recalculates all remaining checkpoints
 */
export async function deleteCheckpoint(checkpointId: number): Promise<void> {
  const supabase = createSupabaseServerClient()
  try {
    // Get the checkpoint to find the account_id
    const checkpoint = await getCheckpointById(checkpointId)

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }

    const accountId = checkpoint.account_id

    // IMPORTANT: Delete the adjustment transaction FIRST
    // We do this explicitly because CASCADE may not be set up in the database
    const { error: txDeleteError } = await supabase
      .from('original_transaction')
      .delete()
      .eq('checkpoint_id', checkpointId)
      .eq('is_balance_adjustment', true)

    if (txDeleteError) {
      console.error('Error deleting adjustment transaction:', txDeleteError)
      // Continue anyway - the checkpoint deletion is more important
    }

    // Delete the checkpoint
    const { error: checkpointDeleteError } = await supabase
      .from('balance_checkpoints')
      .delete()
      .eq('checkpoint_id', checkpointId)

    if (checkpointDeleteError) {
      throw new Error(`Failed to delete checkpoint: ${checkpointDeleteError.message}`)
    }

    // Recalculate all remaining checkpoints
    // This ensures that if we deleted a checkpoint with an earlier date,
    // later checkpoints get their adjustments recalculated correctly
    await recalculateAllCheckpoints({ account_id: accountId })

    // Update account opening balance date
    await updateAccountOpeningBalanceDate(accountId)

    // Sync account balance
    await syncAccountBalance(accountId)
  } catch (error) {
    console.error('Error in deleteCheckpoint:', error)
    throw error
  }
}

/**
 * Get all flagged (balance adjustment) transactions for an account
 */
export async function getFlaggedTransactions(accountId: number) {
  const supabase = createSupabaseServerClient()
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
  const supabase = createSupabaseServerClient()
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
