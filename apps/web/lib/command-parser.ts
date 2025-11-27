// Natural language parser for financial commands

export type CommandType =
  | 'transfer_out'
  | 'transfer_in'
  | 'expense'
  | 'income'
  | 'cc_charge'
  | 'cc_pay'
  | 'debt_take'
  | 'debt_pay'
  | 'search'
  | 'navigate'
  | 'unknown';

export interface ParsedCommand {
  type: CommandType;
  amount?: number;
  date?: Date;
  description?: string;
  category?: string;
  account?: string;
  toAccount?: string;
  rawQuery: string;
  confidence: number;
}

// Month name mappings
const monthNames: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

// Vietnamese month mappings
const vietnameseMonths: Record<string, number> = {
  'tháng 1': 0, 'thang 1': 0, 't1': 0,
  'tháng 2': 1, 'thang 2': 1, 't2': 1,
  'tháng 3': 2, 'thang 3': 2, 't3': 2,
  'tháng 4': 3, 'thang 4': 3, 't4': 3,
  'tháng 5': 4, 'thang 5': 4, 't5': 4,
  'tháng 6': 5, 'thang 6': 5, 't6': 5,
  'tháng 7': 6, 'thang 7': 6, 't7': 6,
  'tháng 8': 7, 'thang 8': 7, 't8': 7,
  'tháng 9': 8, 'thang 9': 8, 't9': 8,
  'tháng 10': 9, 'thang 10': 9, 't10': 9,
  'tháng 11': 10, 'thang 11': 10, 't11': 10,
  'tháng 12': 11, 'thang 12': 11, 't12': 11,
};

// Command patterns
const commandPatterns: Array<{ pattern: RegExp; type: CommandType; keywords: string[] }> = [
  {
    pattern: /transfer\s*out|chuyển\s*đi|chuyển\s*ra|trf\s*out/i,
    type: 'transfer_out',
    keywords: ['transfer out', 'trf out', 'send', 'chuyển đi', 'chuyển ra']
  },
  {
    pattern: /transfer\s*in|chuyển\s*đến|chuyển\s*vào|trf\s*in|received/i,
    type: 'transfer_in',
    keywords: ['transfer in', 'trf in', 'receive', 'chuyển đến', 'chuyển vào', 'nhận']
  },
  {
    pattern: /expense|chi\s*phí|chi\s*tiêu|spent|pay\s+for|paid\s+for/i,
    type: 'expense',
    keywords: ['expense', 'spent', 'pay for', 'chi phí', 'chi tiêu', 'trả']
  },
  {
    pattern: /income|thu\s*nhập|received\s*income|salary|lương/i,
    type: 'income',
    keywords: ['income', 'salary', 'thu nhập', 'lương', 'doanh thu']
  },
  {
    pattern: /cc\s*charge|credit\s*card\s*charge|card\s*purchase|quẹt\s*thẻ/i,
    type: 'cc_charge',
    keywords: ['cc charge', 'card charge', 'credit card', 'quẹt thẻ']
  },
  {
    pattern: /cc\s*pay|credit\s*card\s*pay|pay\s*card|trả\s*thẻ/i,
    type: 'cc_pay',
    keywords: ['cc pay', 'pay card', 'trả thẻ']
  },
  {
    pattern: /debt\s*take|borrow|vay|take\s*loan/i,
    type: 'debt_take',
    keywords: ['borrow', 'loan', 'vay', 'debt take']
  },
  {
    pattern: /debt\s*pay|repay|trả\s*nợ|pay\s*loan/i,
    type: 'debt_pay',
    keywords: ['repay', 'pay loan', 'trả nợ', 'debt pay']
  },
  {
    pattern: /^(go\s*to|open|navigate|mở|đi\s*đến)\s/i,
    type: 'navigate',
    keywords: ['go to', 'open', 'navigate', 'mở', 'đi đến']
  },
  {
    pattern: /^(search|find|tìm|tìm\s*kiếm)\s/i,
    type: 'search',
    keywords: ['search', 'find', 'tìm', 'tìm kiếm']
  },
];

// Parse amount from string (handles various formats)
function parseAmount(text: string): number | undefined {
  // Remove command keywords first
  let cleanText = text;

  // Match various number formats:
  // - 110,000,000 or 110.000.000 (thousand separators)
  // - 110000000 (no separators)
  // - 110tr or 110m (million shorthand)
  // - 110k (thousand shorthand)
  // - $110 or 110$ or 110 VND

  // Try to find amount with million/thousand shorthand
  const shorthandMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(tr|m|triệu|million|k|nghìn|thousand)/i);
  if (shorthandMatch) {
    const num = parseFloat(shorthandMatch[1].replace(',', '.'));
    const unit = shorthandMatch[2].toLowerCase();
    if (unit === 'tr' || unit === 'm' || unit === 'triệu' || unit === 'million') {
      return num * 1000000;
    }
    if (unit === 'k' || unit === 'nghìn' || unit === 'thousand') {
      return num * 1000;
    }
  }

  // Try to find amount with thousand separators (comma or dot)
  const separatedMatch = cleanText.match(/(\d{1,3}(?:[,.]?\d{3})+)/);
  if (separatedMatch) {
    // Remove separators and parse
    const numStr = separatedMatch[1].replace(/[,.]/g, '');
    const num = parseInt(numStr, 10);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Try simple number
  const simpleMatch = cleanText.match(/(\d+)/);
  if (simpleMatch) {
    return parseInt(simpleMatch[1], 10);
  }

  return undefined;
}

// Parse date from string
function parseDate(text: string): Date | undefined {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Relative dates
  if (/today|hôm\s*nay/i.test(text)) {
    return now;
  }
  if (/yesterday|hôm\s*qua/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (/tomorrow|ngày\s*mai/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // "last week", "tuần trước"
  if (/last\s*week|tuần\s*trước/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }

  // Try various date formats

  // Nov11, Nov 11, November 11, Nov-11
  const monthDayMatch = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[\s\-]?(\d{1,2})\b/i);
  if (monthDayMatch) {
    const month = monthNames[monthDayMatch[1].toLowerCase()];
    const day = parseInt(monthDayMatch[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(currentYear, month, day);
    }
  }

  // 11 Nov, 11-Nov, 11 November
  const dayMonthMatch = text.match(/\b(\d{1,2})[\s\-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const month = monthNames[dayMonthMatch[2].toLowerCase()];
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(currentYear, month, day);
    }
  }

  // DD/MM or DD-MM or DD.MM (assume current year)
  const shortDateMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})\b/);
  if (shortDateMatch) {
    const day = parseInt(shortDateMatch[1], 10);
    const month = parseInt(shortDateMatch[2], 10) - 1; // 0-indexed
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(currentYear, month, day);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const fullDateMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    let year = parseInt(fullDateMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // "ngày 11" or "ngay 11" (day of current month)
  const vietnameseDayMatch = text.match(/ngày?\s*(\d{1,2})/i);
  if (vietnameseDayMatch) {
    const day = parseInt(vietnameseDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return new Date(currentYear, now.getMonth(), day);
    }
  }

  // "on the 11th" or "the 11th"
  const ordinalMatch = text.match(/(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)/i);
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return new Date(currentYear, now.getMonth(), day);
    }
  }

  return undefined;
}

// Extract description/notes from command
function extractDescription(text: string, type: CommandType): string | undefined {
  // Remove amount patterns
  let cleaned = text.replace(/(\d{1,3}(?:[,.]?\d{3})+|\d+)\s*(tr|m|triệu|million|k|nghìn|thousand|vnd|đ|\$)?/gi, '');

  // Remove date patterns
  cleaned = cleaned.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[\s\-]?\d{1,2}\b/gi, '');
  cleaned = cleaned.replace(/\b\d{1,2}[\s\-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/gi, '');
  cleaned = cleaned.replace(/\b\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?\b/g, '');
  cleaned = cleaned.replace(/today|yesterday|tomorrow|hôm\s*nay|hôm\s*qua|ngày\s*mai|last\s*week|tuần\s*trước/gi, '');
  cleaned = cleaned.replace(/(?:on\s+)?(?:the\s+)?\d{1,2}(?:st|nd|rd|th)/gi, '');
  cleaned = cleaned.replace(/ngày?\s*\d{1,2}/gi, '');

  // Remove command keywords
  for (const { pattern } of commandPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove common words
  cleaned = cleaned.replace(/\b(on|for|to|from|at|in|of|the|a|an)\b/gi, '');

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned.length > 0 ? cleaned : undefined;
}

// Main parse function
export function parseCommand(query: string): ParsedCommand {
  const normalizedQuery = query.trim();

  // Detect command type
  let detectedType: CommandType = 'unknown';
  let confidence = 0;

  for (const { pattern, type } of commandPatterns) {
    if (pattern.test(normalizedQuery)) {
      detectedType = type;
      confidence = 0.8;
      break;
    }
  }

  // If no command type detected but has amount, assume search
  if (detectedType === 'unknown') {
    const hasAmount = /\d/.test(normalizedQuery);
    if (hasAmount) {
      detectedType = 'search';
      confidence = 0.5;
    }
  }

  // Parse components
  const amount = parseAmount(normalizedQuery);
  const date = parseDate(normalizedQuery);
  const description = extractDescription(normalizedQuery, detectedType);

  // Boost confidence if we found amount and date
  if (amount && date) {
    confidence = Math.min(confidence + 0.15, 1);
  } else if (amount || date) {
    confidence = Math.min(confidence + 0.05, 1);
  }

  return {
    type: detectedType,
    amount,
    date,
    description,
    rawQuery: normalizedQuery,
    confidence,
  };
}

// Format parsed command for display
export function formatParsedCommand(parsed: ParsedCommand): string {
  const parts: string[] = [];

  // Type label
  const typeLabels: Record<CommandType, string> = {
    transfer_out: 'Transfer Out',
    transfer_in: 'Transfer In',
    expense: 'Expense',
    income: 'Income',
    cc_charge: 'CC Charge',
    cc_pay: 'CC Payment',
    debt_take: 'Borrow',
    debt_pay: 'Debt Payment',
    search: 'Search',
    navigate: 'Navigate',
    unknown: 'Unknown',
  };

  parts.push(typeLabels[parsed.type]);

  if (parsed.amount) {
    parts.push(new Intl.NumberFormat('vi-VN').format(parsed.amount) + ' VND');
  }

  if (parsed.date) {
    parts.push('on ' + parsed.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: parsed.date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    }));
  }

  if (parsed.description) {
    parts.push(`"${parsed.description}"`);
  }

  return parts.join(' • ');
}

// Get suggestions based on partial input
export function getSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Suggest command types
  if (lowerQuery.length < 3) {
    suggestions.push(
      'transfer out [amount] on [date]',
      'transfer in [amount] on [date]',
      'expense [amount] for [description]',
      'income [amount] on [date]',
    );
  } else {
    // Context-aware suggestions
    if (lowerQuery.includes('transfer') || lowerQuery.includes('trf')) {
      if (!lowerQuery.includes('out') && !lowerQuery.includes('in')) {
        suggestions.push('transfer out', 'transfer in');
      }
    }
    if (/\d/.test(lowerQuery) && !parseDate(lowerQuery)) {
      suggestions.push('... on today', '... on yesterday', '... on Nov 15');
    }
  }

  return suggestions.slice(0, 4);
}
