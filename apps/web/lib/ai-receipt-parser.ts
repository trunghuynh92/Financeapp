/**
 * AI-Powered Receipt Parser using Claude
 *
 * Uses Claude API to intelligently parse OCR text from Vietnamese receipts
 * Much more accurate than rule-based parsing
 */

import Anthropic from '@anthropic-ai/sdk'
import { ParsedReceiptData } from './receipt-parser'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Parse Vietnamese receipt using Claude AI
 *
 * @param ocrText - Raw text extracted from OCR
 * @returns Parsed receipt data
 */
export async function parseReceiptWithAI(ocrText: string): Promise<ParsedReceiptData> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cheap model
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a Vietnamese receipt parser. Extract structured data from this receipt OCR text.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Extract:
1. merchantName: Business/merchant name (string or null)
2. transactionDate: Date in YYYY-MM-DD format (string or null)
3. totalAmount: Total amount as a number, no commas (number or null)
4. currency: "VND"
5. suggestedDescription: Short description for transaction (use merchant name or "Receipt")
6. suggestedCategoryCode: MUST be one of these EXACT codes (case-sensitive):
   - FOOD: Restaurants, cafes, food delivery, dining
   - SHOPPING: Supermarkets, convenience stores, retail, groceries
   - TRANSPORT: Grab, taxi, fuel, parking, transportation
   - HEALTH: Pharmacies, clinics, hospitals, healthcare
   - ENTERTAINMENT: Cinema, parks, karaoke, games, recreation
   - UTILITIES: Electricity, water, internet, phone
   - PERSONAL_CARE: Salon, spa, beauty, haircuts
   - OFFICE: Office supplies, business services
7. suggestedCategoryName: The display name matching the code (e.g., FOOD -> "Food & Dining")

OCR Text:
${ocrText}

Return JSON only:`,
        },
      ],
    })

    // Parse Claude's response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const jsonText = content.text.trim()
    const parsed = JSON.parse(jsonText)

    return {
      merchantName: parsed.merchantName || null,
      transactionDate: parsed.transactionDate || null,
      totalAmount: parsed.totalAmount || null,
      currency: 'VND',
      items: [], // Claude doesn't extract line items in this quick version
      confidence: 0.95, // AI parsing typically has high confidence
      rawText: ocrText,
      suggestedDescription: parsed.suggestedDescription || null,
      suggestedCategoryCode: parsed.suggestedCategoryCode || null,
      suggestedCategoryName: parsed.suggestedCategoryName || null,
    }
  } catch (error) {
    console.error('AI parsing error:', error)

    // Fallback to returning minimal data
    return {
      merchantName: null,
      transactionDate: null,
      totalAmount: null,
      currency: 'VND',
      items: [],
      confidence: 0,
      rawText: ocrText,
      suggestedDescription: null,
      suggestedCategoryCode: null,
      suggestedCategoryName: null,
    }
  }
}
