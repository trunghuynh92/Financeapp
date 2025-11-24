/**
 * Vietnamese Receipt Parser
 *
 * Extracts structured data from Vietnamese receipt OCR text
 * Handles common Vietnamese receipt formats and patterns
 */

import { ReceiptLineItem } from '@/types/receipt'

export interface ParsedReceiptData {
  merchantName: string | null
  transactionDate: string | null
  totalAmount: number | null
  currency: string
  items: ReceiptLineItem[]
  confidence: number
  rawText: string
  suggestedDescription: string | null
  suggestedCategoryCode: string | null
  suggestedCategoryName: string | null
}

/**
 * Parse Vietnamese receipt OCR text into structured data
 */
export function parseVietnameseReceipt(ocrText: string): ParsedReceiptData {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(Boolean)
  const merchantName = extractMerchantName(lines)
  const items = extractLineItems(lines)
  const category = detectCategory(ocrText, merchantName, items)

  return {
    merchantName,
    transactionDate: extractDate(lines),
    totalAmount: extractTotalAmount(lines),
    currency: 'VND',
    items,
    confidence: 0.8, // Base confidence, can be improved
    rawText: ocrText,
    suggestedDescription: merchantName || 'Receipt',
    suggestedCategoryCode: category.code,
    suggestedCategoryName: category.name,
  }
}

/**
 * Extract merchant name from receipt text
 * Looks for company names in first few lines
 */
function extractMerchantName(lines: string[]): string | null {
  // Check first 5 lines for merchant name
  const merchantPatterns = [
    /^([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-ZÀ-ỹĐa-z\s&\.,-]+)$/i,
    /CÔNG TY.*/i,
    /CỬA HÀNG.*/i,
    /SIÊU THỊ.*/i,
    /NHÀ HÀNG.*/i,
    /QUÁN.*/i,
  ]

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]

    // Skip lines that look like addresses or phone numbers
    if (line.match(/^\d/) || line.match(/Đ[Tt]:/)) continue

    for (const pattern of merchantPatterns) {
      const match = line.match(pattern)
      if (match) {
        return match[1] || match[0]
      }
    }
  }

  return lines[0] || null
}

/**
 * Extract transaction date from receipt text
 * Handles Vietnamese date formats: DD/MM/YYYY, DD-MM-YYYY, etc.
 */
function extractDate(lines: string[]): string | null {
  const datePatterns = [
    // DD/MM/YYYY HH:MM
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})/,
    // DD/MM/YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // Ngày DD/MM/YYYY
    /[Nn]gày\s*:?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // DD-MM-YYYY
    /(\d{2})-(\d{2})-(\d{4})/,
  ]

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern)
      if (match) {
        const [_, day, month, year, hour, minute] = match

        // Validate date
        const dayNum = parseInt(day)
        const monthNum = parseInt(month)
        const yearNum = parseInt(year)

        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
          // Return ISO format
          const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          if (hour && minute) {
            return `${isoDate}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`
          }
          return isoDate
        }
      }
    }
  }

  return null
}

/**
 * Extract total amount from receipt text
 * Looks for Vietnamese currency patterns: VND, đ, VNĐ, etc.
 */
function extractTotalAmount(lines: string[]): number | null {
  // Total label patterns (may have amount on same line or next line)
  const totalLabels = [
    /THÀNH\s*TIỀN\s*:?/i,
    /TỔNG\s*TIỀN\s*:?/i,
    /THANH\s*TOÁN\s*:?/i,
    /Total\s*:?/i,
  ]

  // Amount pattern (flexible to match various formats)
  const amountPattern = /^[\s\d,.]+$/

  // Search from bottom up for total labels
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()

    // Skip lines that are clearly not totals
    if (line.match(/seri|serial|check\s*in|barcode|số\s*seri/i)) {
      continue
    }

    // Check if line contains total label
    for (const labelPattern of totalLabels) {
      if (line.match(labelPattern)) {
        // Try to extract amount from same line first
        const sameLine = line.replace(labelPattern, '').trim()
        const sameLineAmount = extractAmountFromString(sameLine)
        if (sameLineAmount && sameLineAmount >= 1000 && sameLineAmount <= 100000000) {
          return sameLineAmount
        }

        // If not found on same line, check next few lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim()

          // Skip empty lines
          if (!nextLine) {
            continue
          }

          // Skip serial numbers and non-amount lines
          if (nextLine.match(/seri|serial|check\s*in|barcode|số\s*seri/i)) {
            continue
          }

          // Skip lines that are just label abbreviations (like "T.TIỀN")
          if (nextLine.length <= 7 && nextLine.match(/[A-Z\.]/i)) {
            continue
          }

          const nextLineAmount = extractAmountFromString(nextLine)
          if (nextLineAmount && nextLineAmount >= 1000 && nextLineAmount <= 100000000) {
            return nextLineAmount
          }
        }
      }
    }
  }

  // Fallback: look for "Tổng cộng" or amounts with VND
  const fallbackPatterns = [
    /Tổng\s*cộng\s*:?\s*([\d,.]+)/i,
    /Cộng\s*:?\s*([\d,.]+)/i,
    /([\d,.]+)\s*VN[DĐ]/i,
  ]

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]

    if (line.match(/seri|serial|check\s*in|barcode|số\s*seri/i)) {
      continue
    }

    for (const pattern of fallbackPatterns) {
      const match = line.match(pattern)
      if (match) {
        const amount = extractAmountFromString(match[1])
        if (amount && amount >= 1000 && amount <= 100000000) {
          return amount
        }
      }
    }
  }

  return null
}

/**
 * Helper function to extract numeric amount from a string
 */
function extractAmountFromString(str: string): number | null {
  if (!str) return null

  // Remove all spaces, commas, dots (Vietnamese number format uses . or , as thousands separator)
  const cleaned = str.replace(/[,.\s]/g, '')

  // Extract just the numbers
  const numbers = cleaned.match(/\d+/)
  if (!numbers) return null

  const amount = parseInt(numbers[0])
  return isNaN(amount) ? null : amount
}

/**
 * Extract line items from receipt
 * Tries to identify product names and prices
 */
function extractLineItems(lines: string[]): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = []

  // Pattern: Item name followed by price
  // Example: "Coca Cola 15,000"
  const itemPattern = /^(.+?)\s+([\d,.]+)\s*[đĐ]?$/

  for (const line of lines) {
    // Skip lines that are clearly headers or totals
    if (
      line.match(/^(HÓA|ĐƠN|BILL|RECEIPT)/i) ||
      line.match(/TỔNG|TOTAL|CỘNG/i) ||
      line.match(/NGÀY|DATE/i) ||
      line.match(/SĐT|PHONE/i) ||
      line.match(/ĐỊA CHỈ|ADDRESS/i)
    ) {
      continue
    }

    const match = line.match(itemPattern)
    if (match) {
      const [_, description, amountStr] = match
      const amount = parseInt(amountStr.replace(/[,.\s]/g, ''))

      // Validate item (reasonable price range)
      if (amount >= 100 && amount <= 10000000 && description.length >= 2) {
        items.push({
          description: description.trim(),
          amount,
          quantity: 1, // Default quantity
        })
      }
    }
  }

  return items
}

/**
 * Detect category based on merchant name and receipt content
 * Returns category code and name suggestion
 */
function detectCategory(
  rawText: string,
  merchantName: string | null,
  items: ReceiptLineItem[]
): { code: string | null; name: string | null } {
  const text = rawText.toLowerCase()
  const merchant = (merchantName || '').toLowerCase()

  // Category patterns (Vietnamese-aware)
  const categoryPatterns = [
    // Food & Dining
    {
      keywords: [
        'quán',
        'nhà hàng',
        'restaurant',
        'cafe',
        'cà phê',
        'phở',
        'bún',
        'cơm',
        'bánh',
        'ăn',
        'food',
        'kitchen',
        'dining',
        'buffet',
        'fastfood',
        'pizza',
        'burger',
        'kfc',
        'lotteria',
        'jollibee',
        'highland',
        'starbucks',
        'phúc long',
        'trà sữa',
        'trà chanh',
      ],
      code: 'FOOD',
      name: 'Food & Dining',
    },
    // Groceries / Shopping
    {
      keywords: [
        'siêu thị',
        'supermarket',
        'coopmart',
        'big c',
        'lotte mart',
        'vinmart',
        'circle k',
        'ministop',
        'gs25',
        'familymart',
        'cửa hàng',
        'shop',
        'store',
      ],
      code: 'SHOPPING',
      name: 'Shopping',
    },
    // Transportation
    {
      keywords: [
        'grab',
        'uber',
        'gojek',
        'be',
        'xăng',
        'petrol',
        'gas',
        'petrolimex',
        'pvoil',
        'taxi',
        'xe ôm',
        'parking',
        'bãi giữ xe',
      ],
      code: 'TRANSPORT',
      name: 'Transportation',
    },
    // Healthcare
    {
      keywords: [
        'phòng khám',
        'bệnh viện',
        'hospital',
        'clinic',
        'pharmacy',
        'nhà thuốc',
        'guardian',
        'pharmacity',
        'medicare',
        'medical',
      ],
      code: 'HEALTH',
      name: 'Healthcare',
    },
    // Entertainment
    {
      keywords: [
        'cinema',
        'rạp chiếu phim',
        'cgv',
        'lotte cinema',
        'galaxy',
        'game',
        'karaoke',
        'tini',
        'world',
        'park',
        'khu vui chơi',
        'vui chơi',
        'giải trí',
        'vé cổng',
      ],
      code: 'ENTERTAINMENT',
      name: 'Entertainment',
    },
    // Utilities
    {
      keywords: [
        'điện lực',
        'electric',
        'evn',
        'nước',
        'water',
        'internet',
        'vinaphone',
        'viettel',
        'mobifone',
        'fpt',
      ],
      code: 'UTILITIES',
      name: 'Utilities',
    },
    // Personal Care
    {
      keywords: [
        'salon',
        'spa',
        'barber',
        'tiệm cắt tóc',
        'làm đẹp',
        'beauty',
        'nails',
      ],
      code: 'PERSONAL_CARE',
      name: 'Personal Care',
    },
    // Office Supplies / Business
    {
      keywords: [
        'văn phòng phẩm',
        'office',
        'công ty',
        'dịch vụ',
        'service',
      ],
      code: 'OFFICE',
      name: 'Office Supplies',
    },
  ]

  // Check patterns
  for (const pattern of categoryPatterns) {
    for (const keyword of pattern.keywords) {
      if (merchant.includes(keyword) || text.includes(keyword)) {
        return { code: pattern.code, name: pattern.name }
      }
    }
  }

  // Default: assume expense shopping
  return { code: 'SHOPPING', name: 'Shopping' }
}

/**
 * Calculate confidence score based on extracted data
 */
export function calculateConfidence(data: ParsedReceiptData): number {
  let score = 0
  let maxScore = 0

  // Merchant name (30%)
  maxScore += 30
  if (data.merchantName) {
    score += data.merchantName.length >= 3 ? 30 : 15
  }

  // Date (30%)
  maxScore += 30
  if (data.transactionDate) {
    score += 30
  }

  // Total amount (30%)
  maxScore += 30
  if (data.totalAmount) {
    score += 30
  }

  // Line items (10%)
  maxScore += 10
  if (data.items.length > 0) {
    score += Math.min(10, data.items.length * 2)
  }

  return maxScore > 0 ? score / maxScore : 0
}
