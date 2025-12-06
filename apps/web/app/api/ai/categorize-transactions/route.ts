/**
 * API Route: AI Transaction Categorization
 *
 * POST /api/ai/categorize-transactions
 *
 * Accepts single or batch transactions for AI-powered categorization.
 * Uses Claude to analyze transaction descriptions and suggest types/categories.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  categorizeTransaction,
  categorizeTransactionsBatch,
  quickCategorize,
  TransactionInput,
} from '@/lib/ai-transaction-categorizer'

// ============================================================================
// Types
// ============================================================================

interface SingleCategorizationRequest {
  description: string
  amount: number
  direction: 'debit' | 'credit'
  entityType: 'business' | 'personal'
  bankName?: string
  transactionDate?: string
  useQuickMatch?: boolean // Try rule-based first, fall back to AI
}

interface BatchCategorizationRequest {
  transactions: SingleCategorizationRequest[]
  useQuickMatch?: boolean
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's a batch request
    if (body.transactions && Array.isArray(body.transactions)) {
      return handleBatchRequest(body as BatchCategorizationRequest)
    }

    // Single transaction request
    return handleSingleRequest(body as SingleCategorizationRequest)
  } catch (error) {
    console.error('AI categorization API error:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transaction(s)' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Request Handlers
// ============================================================================

async function handleSingleRequest(body: SingleCategorizationRequest) {
  // Validate required fields
  if (!body.description || body.amount === undefined || !body.direction || !body.entityType) {
    return NextResponse.json(
      { error: 'Missing required fields: description, amount, direction, entityType' },
      { status: 400 }
    )
  }

  const input: TransactionInput = {
    description: body.description,
    amount: body.amount,
    direction: body.direction,
    entityType: body.entityType,
    bankName: body.bankName,
    transactionDate: body.transactionDate,
  }

  // Try quick rule-based matching first if enabled
  if (body.useQuickMatch !== false) {
    const quickResult = quickCategorize(input)
    if (quickResult) {
      return NextResponse.json({
        success: true,
        data: quickResult,
        method: 'quick_match',
      })
    }
  }

  // Use AI categorization
  const result = await categorizeTransaction(input)

  return NextResponse.json({
    success: true,
    data: result,
    method: 'ai',
  })
}

async function handleBatchRequest(body: BatchCategorizationRequest) {
  const { transactions, useQuickMatch = true } = body

  if (!transactions || transactions.length === 0) {
    return NextResponse.json(
      { error: 'No transactions provided' },
      { status: 400 }
    )
  }

  // Limit batch size
  if (transactions.length > 50) {
    return NextResponse.json(
      { error: 'Batch size exceeds limit of 50 transactions' },
      { status: 400 }
    )
  }

  // Validate all transactions
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!tx.description || tx.amount === undefined || !tx.direction || !tx.entityType) {
      return NextResponse.json(
        { error: `Transaction at index ${i} missing required fields` },
        { status: 400 }
      )
    }
  }

  // Process transactions
  const results: any[] = []
  const needsAI: { index: number; input: TransactionInput }[] = []

  // First pass: try quick matching
  if (useQuickMatch) {
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]
      const input: TransactionInput = {
        description: tx.description,
        amount: tx.amount,
        direction: tx.direction,
        entityType: tx.entityType,
        bankName: tx.bankName,
        transactionDate: tx.transactionDate,
      }

      const quickResult = quickCategorize(input)
      if (quickResult) {
        results[i] = { ...quickResult, method: 'quick_match' }
      } else {
        needsAI.push({ index: i, input })
      }
    }
  } else {
    // All go to AI
    transactions.forEach((tx, i) => {
      needsAI.push({
        index: i,
        input: {
          description: tx.description,
          amount: tx.amount,
          direction: tx.direction,
          entityType: tx.entityType,
          bankName: tx.bankName,
          transactionDate: tx.transactionDate,
        },
      })
    })
  }

  // Second pass: AI categorization for remaining
  if (needsAI.length > 0) {
    const aiInputs = needsAI.map(item => item.input)
    const aiResults = await categorizeTransactionsBatch(aiInputs)

    for (let i = 0; i < needsAI.length; i++) {
      const originalIndex = needsAI[i].index
      results[originalIndex] = { ...aiResults.results[i], method: 'ai' }
    }
  }

  return NextResponse.json({
    success: true,
    data: results,
    summary: {
      total: transactions.length,
      quickMatched: transactions.length - needsAI.length,
      aiProcessed: needsAI.length,
    },
  })
}
