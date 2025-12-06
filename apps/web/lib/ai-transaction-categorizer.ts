/**
 * AI-Powered Transaction Categorizer using Claude
 *
 * Uses Claude API to intelligently analyze bank transaction descriptions
 * and suggest transaction types and categories.
 *
 * Handles Vietnamese bank statement descriptions which often include:
 * - Transfer references (FT, TT, CK, IBFT)
 * - Payment codes and timestamps
 * - Abbreviated merchant names
 * - Mixed Vietnamese/English text
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ============================================================================
// Types
// ============================================================================

export interface TransactionInput {
  description: string
  amount: number
  direction: 'debit' | 'credit'
  entityType: 'business' | 'personal'
  bankName?: string
  transactionDate?: string
}

export interface CategorizedTransaction {
  // Suggested transaction type
  transactionTypeCode: string
  transactionTypeName: string

  // Suggested category
  categoryCode: string | null
  categoryName: string | null

  // Parsed details
  merchantName: string | null
  payeeName: string | null
  referenceNumber: string | null

  // Flags
  isTransfer: boolean
  isInternalTransfer: boolean // Transfer between own accounts
  isSalary: boolean
  isUtilityPayment: boolean
  isLoanRelated: boolean

  // AI confidence
  confidence: number

  // Reasoning for debugging
  reasoning: string
}

export interface BulkCategorizationResult {
  results: CategorizedTransaction[]
  processedCount: number
  errorCount: number
}

// ============================================================================
// Transaction Type and Category Reference
// ============================================================================

const TRANSACTION_TYPES = `
TRANSACTION TYPES (type_code -> display_name):
- INC: Income - Money received from sales, services, salary, etc.
- EXP: Expense - Money spent on costs, purchases, services
- TRF_OUT: Transfer Out - Transfer money out to another account (same owner)
- TRF_IN: Transfer In - Transfer money in from another account (same owner)
- DEBT_TAKE: Debt Taken - Borrowing money from bank/lender
- DEBT_PAY: Debt Payment - Paying back a loan or debt
- CC_CHARGE: Credit Card Charge - Purchase on credit card (not cash out)
- CC_PAY: Credit Card Payment - Paying credit card bill
- LOAN_DISBURSE: Loan Disbursement - Lending money to someone
- LOAN_COLLECT: Loan Collection - Receiving repayment from borrower
- INV_CONTRIB: Investment Contribution - Investing money
- INV_WITHDRAW: Investment Withdrawal - Withdrawing from investment
- CAPITAL_IN: Capital Contribution - Owner/shareholder investing in business
- CAPITAL_OUT: Owner's Drawings - Owner withdrawing from business
- DIVIDEND: Dividend Distribution - Profit distribution to shareholders
`

const BUSINESS_CATEGORIES = `
BUSINESS EXPENSE CATEGORIES:
- COGS: Cost of Goods Sold - Direct costs of producing goods
- RAW_MAT: Raw Materials - Materials used in production
- OPEX: Operating Expenses - Day-to-day business expenses
- RENT: Rent & Utilities - Rent, electricity, water, internet
- SALARY: Salaries & Wages - Employee salaries and wages
- MARKETING: Marketing & Advertising - Marketing campaigns
- OFFICE: Office Supplies - Stationery, equipment, supplies
- PROF_SVC: Professional Services - Legal, accounting, consulting
- TRAVEL: Travel & Transportation - Business travel and transport
- INSURANCE: Insurance - Business insurance premiums
- TAXES: Taxes & Fees - Business taxes and government fees
- MAINTENANCE: Maintenance & Repairs - Equipment and facility maintenance

BUSINESS INCOME CATEGORIES:
- SALES: Product Sales - Revenue from product sales
- SERVICE_REV: Service Revenue - Revenue from services provided
- INTEREST_INC: Interest Income - Interest earned on deposits
- RENTAL_INC: Rental Income - Income from property rentals
- COMMISSION: Commission - Commission earnings
- OTHER_REV: Other Revenue - Other business income
`

const PERSONAL_CATEGORIES = `
PERSONAL EXPENSE CATEGORIES:
- FOOD: Food & Dining - Groceries, restaurants, dining
- TRANSPORT: Transportation - Fuel, public transport, vehicle costs
- HOUSING: Housing - Rent, mortgage, home expenses
- HEALTH: Healthcare - Medical, dental, pharmacy
- ENTERTAINMENT: Entertainment - Movies, games, hobbies
- EDUCATION: Education - Tuition, courses, books
- SHOPPING: Shopping - Clothing, electronics, household items
- PERSONAL_CARE: Personal Care - Haircuts, spa, beauty products
- UTILITIES: Utilities - Electricity, water, internet, phone
- GIFTS: Gifts & Donations - Gifts and charitable donations

PERSONAL INCOME CATEGORIES:
- SALARY_INC: Salary - Employment salary
- FREELANCE: Freelance Income - Freelance work payments
- INVEST_INC: Investment Returns - Dividends and capital gains
- GIFTS_REC: Gifts Received - Money gifts received
- REFUNDS: Refunds - Tax refunds, purchase refunds
- OTHER_INC: Other Income - Other personal income
`

// ============================================================================
// Main Categorization Function
// ============================================================================

/**
 * Categorize a single transaction using Claude AI
 */
export async function categorizeTransaction(
  input: TransactionInput
): Promise<CategorizedTransaction> {
  try {
    const categories = input.entityType === 'business'
      ? BUSINESS_CATEGORIES
      : PERSONAL_CATEGORIES

    const prompt = buildCategorizationPrompt(input, categories)

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    return parseCategorizationResponse(content.text, input)
  } catch (error) {
    console.error('AI categorization error:', error)
    return getDefaultCategorization(input)
  }
}

/**
 * Categorize multiple transactions in a single API call (more efficient)
 */
export async function categorizeTransactionsBatch(
  inputs: TransactionInput[]
): Promise<BulkCategorizationResult> {
  if (inputs.length === 0) {
    return { results: [], processedCount: 0, errorCount: 0 }
  }

  // For small batches, process individually
  if (inputs.length <= 3) {
    const results: CategorizedTransaction[] = []
    let errorCount = 0

    for (const input of inputs) {
      try {
        const result = await categorizeTransaction(input)
        results.push(result)
      } catch {
        results.push(getDefaultCategorization(input))
        errorCount++
      }
    }

    return {
      results,
      processedCount: inputs.length,
      errorCount,
    }
  }

  // For larger batches, use batch prompt
  try {
    const categories = inputs[0].entityType === 'business'
      ? BUSINESS_CATEGORIES
      : PERSONAL_CATEGORIES

    const prompt = buildBatchCategorizationPrompt(inputs, categories)

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    return parseBatchCategorizationResponse(content.text, inputs)
  } catch (error) {
    console.error('Batch categorization error:', error)

    // Fallback to defaults
    return {
      results: inputs.map(input => getDefaultCategorization(input)),
      processedCount: inputs.length,
      errorCount: inputs.length,
    }
  }
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildCategorizationPrompt(
  input: TransactionInput,
  categories: string
): string {
  return `You are a Vietnamese financial transaction categorizer. Analyze this bank transaction and categorize it.

${TRANSACTION_TYPES}

${categories}

TRANSACTION TO ANALYZE:
- Description: "${input.description}"
- Amount: ${input.amount.toLocaleString('vi-VN')} VND
- Direction: ${input.direction} (${input.direction === 'debit' ? 'money out' : 'money in'})
- Entity Type: ${input.entityType}
${input.bankName ? `- Bank: ${input.bankName}` : ''}
${input.transactionDate ? `- Date: ${input.transactionDate}` : ''}

VIETNAMESE BANK DESCRIPTION PATTERNS:
- "CK" or "Chuyen khoan" = Bank transfer
- "TT" = Payment (Thanh toan)
- "NTDT" = Tax payment (Nop thue dien tu)
- "BHXH" = Social insurance payment
- "Tra lai" = Interest payment
- "FT" followed by numbers = Interbank transfer reference
- "TRUNG CK" = Transfer/deposit consolidation
- Names in ALL CAPS often are company/person names
- Numbers at end are often timestamps or reference codes

RULES:
1. For debit transactions (money out):
   - Default to EXP (Expense) unless clearly a transfer or loan
   - If description mentions transfer to own account, use TRF_OUT
   - If description mentions loan/lending, use LOAN_DISBURSE
   - If paying salary, use EXP with SALARY category
   - If paying tax/BHXH, use EXP with TAXES category

2. For credit transactions (money in):
   - Default to INC (Income) unless clearly a transfer
   - If from own account transfer, use TRF_IN
   - If receiving loan repayment, use LOAN_COLLECT
   - If interest payment, use INC with INTEREST_INC category
   - If salary/wages, use INC with SALARY_INC category

3. Transfer detection:
   - Look for transfer keywords: CK, chuyen khoan, transfer
   - Check if same owner transfer (e.g., "qua MBYAC", "qua TCBYAC" patterns)

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Return this exact JSON structure:
{
  "transactionTypeCode": "EXP",
  "transactionTypeName": "Expense",
  "categoryCode": "OPEX",
  "categoryName": "Operating Expenses",
  "merchantName": "Company Name or null",
  "payeeName": "Person/Company receiving payment or null",
  "referenceNumber": "FT12345 or null",
  "isTransfer": false,
  "isInternalTransfer": false,
  "isSalary": false,
  "isUtilityPayment": false,
  "isLoanRelated": false,
  "confidence": 0.85,
  "reasoning": "Brief explanation of categorization"
}`
}

function buildBatchCategorizationPrompt(
  inputs: TransactionInput[],
  categories: string
): string {
  const transactionsList = inputs.map((input, index) => `
[${index + 1}]
- Description: "${input.description}"
- Amount: ${input.amount.toLocaleString('vi-VN')} VND
- Direction: ${input.direction}
${input.bankName ? `- Bank: ${input.bankName}` : ''}`).join('\n')

  return `You are a Vietnamese financial transaction categorizer. Analyze these bank transactions and categorize each one.

${TRANSACTION_TYPES}

${categories}

TRANSACTIONS TO ANALYZE:
${transactionsList}

VIETNAMESE BANK DESCRIPTION PATTERNS:
- "CK" or "Chuyen khoan" = Bank transfer
- "TT" = Payment (Thanh toan)
- "NTDT" = Tax payment
- "BHXH" = Social insurance
- "Tra lai" = Interest payment
- "FT" followed by numbers = Transfer reference
- "TRUNG CK" = Transfer consolidation

IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation.

Return an array of objects, one for each transaction in order:
[
  {
    "transactionTypeCode": "EXP",
    "categoryCode": "OPEX",
    "categoryName": "Operating Expenses",
    "merchantName": null,
    "isTransfer": false,
    "confidence": 0.85
  },
  ...
]`
}

// ============================================================================
// Response Parsers
// ============================================================================

function parseCategorizationResponse(
  responseText: string,
  input: TransactionInput
): CategorizedTransaction {
  try {
    // Clean up the response - remove markdown if present
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(jsonText)

    return {
      transactionTypeCode: parsed.transactionTypeCode || getDefaultTypeCode(input),
      transactionTypeName: parsed.transactionTypeName || getDefaultTypeName(input),
      categoryCode: parsed.categoryCode || null,
      categoryName: parsed.categoryName || null,
      merchantName: parsed.merchantName || null,
      payeeName: parsed.payeeName || null,
      referenceNumber: parsed.referenceNumber || extractReferenceNumber(input.description),
      isTransfer: parsed.isTransfer || false,
      isInternalTransfer: parsed.isInternalTransfer || false,
      isSalary: parsed.isSalary || false,
      isUtilityPayment: parsed.isUtilityPayment || false,
      isLoanRelated: parsed.isLoanRelated || false,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI categorization',
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error, responseText)
    return getDefaultCategorization(input)
  }
}

function parseBatchCategorizationResponse(
  responseText: string,
  inputs: TransactionInput[]
): BulkCategorizationResult {
  try {
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(jsonText)

    if (!Array.isArray(parsed)) {
      throw new Error('Expected array response')
    }

    const results: CategorizedTransaction[] = inputs.map((input, index) => {
      const item = parsed[index]
      if (!item) {
        return getDefaultCategorization(input)
      }

      return {
        transactionTypeCode: item.transactionTypeCode || getDefaultTypeCode(input),
        transactionTypeName: item.transactionTypeName || getDefaultTypeName(input),
        categoryCode: item.categoryCode || null,
        categoryName: item.categoryName || null,
        merchantName: item.merchantName || null,
        payeeName: item.payeeName || null,
        referenceNumber: extractReferenceNumber(input.description),
        isTransfer: item.isTransfer || false,
        isInternalTransfer: item.isInternalTransfer || false,
        isSalary: item.isSalary || false,
        isUtilityPayment: item.isUtilityPayment || false,
        isLoanRelated: item.isLoanRelated || false,
        confidence: item.confidence || 0.5,
        reasoning: item.reasoning || 'Batch AI categorization',
      }
    })

    return {
      results,
      processedCount: inputs.length,
      errorCount: 0,
    }
  } catch (error) {
    console.error('Failed to parse batch AI response:', error)
    return {
      results: inputs.map(input => getDefaultCategorization(input)),
      processedCount: inputs.length,
      errorCount: inputs.length,
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultTypeCode(input: TransactionInput): string {
  return input.direction === 'debit' ? 'EXP' : 'INC'
}

function getDefaultTypeName(input: TransactionInput): string {
  return input.direction === 'debit' ? 'Expense' : 'Income'
}

function getDefaultCategorization(input: TransactionInput): CategorizedTransaction {
  return {
    transactionTypeCode: getDefaultTypeCode(input),
    transactionTypeName: getDefaultTypeName(input),
    categoryCode: null,
    categoryName: null,
    merchantName: null,
    payeeName: null,
    referenceNumber: extractReferenceNumber(input.description),
    isTransfer: false,
    isInternalTransfer: false,
    isSalary: false,
    isUtilityPayment: false,
    isLoanRelated: false,
    confidence: 0,
    reasoning: 'Default categorization (AI failed or unavailable)',
  }
}

function extractReferenceNumber(description: string): string | null {
  // Match common reference patterns
  const patterns = [
    /FT\d{10,}/i,           // MB Bank format: FT25335771037539
    /\d{4}-\d{14}/,         // Account-date format
    /Trace\s*\d+/i,         // Trace number
    /Ma giao dich[/:]\s*\d+/i, // Vietnamese transaction code
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

/**
 * Quick rule-based categorization for common patterns
 * Use this for faster processing when pattern is clear
 */
export function quickCategorize(input: TransactionInput): CategorizedTransaction | null {
  const desc = input.description.toLowerCase()

  // Salary patterns
  if (desc.includes('luong') || desc.includes('salary') || desc.includes('wages')) {
    if (input.direction === 'debit') {
      return {
        transactionTypeCode: 'EXP',
        transactionTypeName: 'Expense',
        categoryCode: 'SALARY',
        categoryName: 'Salaries & Wages',
        merchantName: null,
        payeeName: null,
        referenceNumber: extractReferenceNumber(input.description),
        isTransfer: false,
        isInternalTransfer: false,
        isSalary: true,
        isUtilityPayment: false,
        isLoanRelated: false,
        confidence: 0.95,
        reasoning: 'Salary payment detected from keywords',
      }
    } else {
      return {
        transactionTypeCode: 'INC',
        transactionTypeName: 'Income',
        categoryCode: input.entityType === 'personal' ? 'SALARY_INC' : 'SERVICE_REV',
        categoryName: input.entityType === 'personal' ? 'Salary' : 'Service Revenue',
        merchantName: null,
        payeeName: null,
        referenceNumber: extractReferenceNumber(input.description),
        isTransfer: false,
        isInternalTransfer: false,
        isSalary: true,
        isUtilityPayment: false,
        isLoanRelated: false,
        confidence: 0.95,
        reasoning: 'Salary income detected from keywords',
      }
    }
  }

  // Tax/BHXH patterns
  if (desc.includes('bhxh') || desc.includes('thue') || desc.includes('ntdt')) {
    return {
      transactionTypeCode: 'EXP',
      transactionTypeName: 'Expense',
      categoryCode: 'TAXES',
      categoryName: 'Taxes & Fees',
      merchantName: null,
      payeeName: null,
      referenceNumber: extractReferenceNumber(input.description),
      isTransfer: false,
      isInternalTransfer: false,
      isSalary: false,
      isUtilityPayment: false,
      isLoanRelated: false,
      confidence: 0.95,
      reasoning: 'Tax/social insurance payment detected',
    }
  }

  // Interest patterns
  if (desc.includes('tra lai') || desc.includes('interest')) {
    return {
      transactionTypeCode: 'INC',
      transactionTypeName: 'Income',
      categoryCode: 'INTEREST_INC',
      categoryName: 'Interest Income',
      merchantName: null,
      payeeName: null,
      referenceNumber: extractReferenceNumber(input.description),
      isTransfer: false,
      isInternalTransfer: false,
      isSalary: false,
      isUtilityPayment: false,
      isLoanRelated: false,
      confidence: 0.95,
      reasoning: 'Interest income detected',
    }
  }

  // No quick match - return null to use AI
  return null
}
