import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Parse Vietnamese currency shortcuts: 110tr, 110m, 500k, 1.5tr
function parseVietnameseAmount(str: string): number | null {
  // Match patterns like: 110tr, 110m, 500k, 1.5tr, 1,5tr
  const match = str.match(/^([\d.,]+)\s*(tr|trieu|m|mil|k|nghin|nghìn)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  if (isNaN(num)) return null;

  const suffix = (match[2] || '').toLowerCase();
  switch (suffix) {
    case 'tr':
    case 'trieu':
    case 'm':
    case 'mil':
      return num * 1000000;
    case 'k':
    case 'nghin':
    case 'nghìn':
      return num * 1000;
    default:
      return num;
  }
}

// Month name to index mapping
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

// Parse relative dates
function parseRelativeDate(str: string): { start: string; end: string } | null {
  const today = new Date();
  const lowerStr = str.toLowerCase().trim();

  // Today
  if (lowerStr === 'today' || lowerStr === 'hôm nay' || lowerStr === 'homnay') {
    const dateStr = today.toISOString().split('T')[0];
    return { start: dateStr, end: dateStr };
  }

  // Yesterday
  if (lowerStr === 'yesterday' || lowerStr === 'hôm qua' || lowerStr === 'homqua') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return { start: dateStr, end: dateStr };
  }

  // This week
  if (lowerStr === 'this week' || lowerStr === 'tuần này' || lowerStr === 'tuannay') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  }

  // Last week
  if (lowerStr === 'last week' || lowerStr === 'tuần trước' || lowerStr === 'tuantruoc') {
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    return {
      start: startOfLastWeek.toISOString().split('T')[0],
      end: endOfLastWeek.toISOString().split('T')[0],
    };
  }

  // This month
  if (lowerStr === 'this month' || lowerStr === 'tháng này' || lowerStr === 'thangnay') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  }

  // Last month
  if (lowerStr === 'last month' || lowerStr === 'tháng trước' || lowerStr === 'thangtruoc') {
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      start: startOfLastMonth.toISOString().split('T')[0],
      end: endOfLastMonth.toISOString().split('T')[0],
    };
  }

  // Just month name: "nov", "september"
  for (const [name, monthIndex] of Object.entries(monthNames)) {
    if (lowerStr === name) {
      const year = monthIndex > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0);
      return {
        start: startOfMonth.toISOString().split('T')[0],
        end: endOfMonth.toISOString().split('T')[0],
      };
    }
  }

  return null;
}

// Parse specific date like "sep 26", "nov11", "26 sep", "11/26"
function parseSpecificDate(tokens: string[]): { date: string; usedTokens: string[] } | null {
  const today = new Date();

  // Try to find month + day combination in tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();

    // Check for combined format like "nov11", "sep26"
    for (const [monthName, monthIndex] of Object.entries(monthNames)) {
      const pattern = new RegExp(`^(${monthName})(\\d{1,2})$`);
      const match = token.match(pattern);
      if (match) {
        const day = parseInt(match[2], 10);
        if (day >= 1 && day <= 31) {
          const year = monthIndex > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
          const date = new Date(year, monthIndex, day);
          return {
            date: date.toISOString().split('T')[0],
            usedTokens: [token],
          };
        }
      }
    }

    // Check if current token is a month name
    if (monthNames[token] !== undefined) {
      const monthIndex = monthNames[token];

      // Look for day in next token
      if (i + 1 < tokens.length) {
        const nextToken = tokens[i + 1];
        const day = parseInt(nextToken, 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          const year = monthIndex > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
          const date = new Date(year, monthIndex, day);
          return {
            date: date.toISOString().split('T')[0],
            usedTokens: [token, nextToken],
          };
        }
      }

      // Look for day in previous token
      if (i > 0) {
        const prevToken = tokens[i - 1];
        const day = parseInt(prevToken, 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          const year = monthIndex > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
          const date = new Date(year, monthIndex, day);
          return {
            date: date.toISOString().split('T')[0],
            usedTokens: [prevToken, token],
          };
        }
      }
    }
  }

  return null;
}

// Known account name keywords
const accountKeywords = ['acb', 'bidv', 'tcb', 'techcombank', 'vietcombank', 'vcb', 'mb', 'mbbank', 'tpbank', 'vpbank', 'cash', 'tien mat'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const search = searchParams.get('search');
  const amount = searchParams.get('amount');
  const date = searchParams.get('date');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!entityId) {
    return NextResponse.json({ error: 'entity_id is required' }, { status: 400 });
  }

  // Parse search query intelligently
  let textSearch = '';
  let amountSearch: number | null = null;
  let dateRange: { start: string; end: string } | null = null;
  let specificDate: string | null = null;
  let accountSearch = '';
  let directionFilter: 'credit' | 'debit' | null = null;

  if (search) {
    const tokens = search.toLowerCase().split(/\s+/);
    const usedTokens = new Set<string>();
    const textTokens: string[] = [];

    // First, try to parse specific date like "sep 26", "nov 11"
    const specificDateResult = parseSpecificDate(tokens);
    if (specificDateResult) {
      specificDate = specificDateResult.date;
      specificDateResult.usedTokens.forEach(t => usedTokens.add(t.toLowerCase()));
    }

    for (const token of tokens) {
      // Skip tokens already used for date parsing
      if (usedTokens.has(token.toLowerCase())) {
        continue;
      }

      // Check for Vietnamese amount shortcuts (110tr, 500k, etc.)
      const vnAmount = parseVietnameseAmount(token);
      if (vnAmount !== null && vnAmount >= 1000) {
        amountSearch = vnAmount;
        continue;
      }

      // Check for relative dates (only if no specific date found)
      if (!specificDate) {
        const relDate = parseRelativeDate(token);
        if (relDate) {
          dateRange = relDate;
          continue;
        }
      }

      // Check for direction indicators
      if (token.startsWith('-') || token === 'expense' || token === 'chi' || token === 'out') {
        directionFilter = 'debit';
        const remaining = token.startsWith('-') ? token.slice(1) : '';
        if (remaining) {
          const amt = parseVietnameseAmount(remaining);
          if (amt) amountSearch = amt;
        }
        continue;
      }
      if (token.startsWith('+') || token === 'income' || token === 'thu' || token === 'in') {
        directionFilter = 'credit';
        const remaining = token.startsWith('+') ? token.slice(1) : '';
        if (remaining) {
          const amt = parseVietnameseAmount(remaining);
          if (amt) amountSearch = amt;
        }
        continue;
      }

      // Check for account keywords
      if (accountKeywords.some(kw => token.includes(kw))) {
        accountSearch = token;
        continue;
      }

      // Check for plain numbers (could be partial amount) - only if not a small day number
      const plainNum = parseFloat(token.replace(/,/g, ''));
      if (!isNaN(plainNum) && plainNum > 31) {
        // If it's a large number (not a day), treat as amount
        if (plainNum >= 1000) {
          amountSearch = plainNum;
        }
        continue;
      }

      // Otherwise it's text search (but skip month names already processed)
      if (monthNames[token] === undefined) {
        textTokens.push(token);
      }
    }

    textSearch = textTokens.join(' ').trim();

    // Also check for multi-word date phrases (only if no date found yet)
    if (!dateRange && !specificDate) {
      const multiWordDate = parseRelativeDate(search.trim());
      if (multiWordDate) {
        dateRange = multiWordDate;
        textSearch = '';
      }
    }
  }

  // Build query
  let query = supabase
    .from('main_transaction_details')
    .select(`
      main_transaction_id,
      transaction_date,
      description,
      amount,
      transaction_type_code,
      transaction_type,
      transaction_direction,
      account_name,
      category_name
    `)
    .eq('entity_id', entityId)
    .order('transaction_date', { ascending: false })
    .limit(limit);

  // Apply text search on description
  if (textSearch) {
    query = query.ilike('description', `%${textSearch}%`);
  }

  // Apply account search
  if (accountSearch) {
    query = query.ilike('account_name', `%${accountSearch}%`);
  }

  // Apply direction filter
  if (directionFilter) {
    query = query.eq('transaction_direction', directionFilter);
  }

  // Apply specific date or date range
  if (specificDate) {
    query = query.eq('transaction_date', specificDate);
  } else if (dateRange) {
    query = query.gte('transaction_date', dateRange.start).lte('transaction_date', dateRange.end);
  }

  // Apply amount search with smart matching
  if (amountSearch) {
    if (amountSearch >= 1000000) {
      // For millions, allow 5% tolerance
      const tolerance = amountSearch * 0.05;
      query = query.gte('amount', amountSearch - tolerance).lte('amount', amountSearch + tolerance);
    } else if (amountSearch >= 1000) {
      // For thousands, search as prefix (28016 matches 28,016,xxx)
      const lowerBound = amountSearch * 1000;
      const upperBound = (amountSearch + 1) * 1000;
      query = query.gte('amount', lowerBound).lt('amount', upperBound);
    } else {
      // Small amounts - exact match with 1% tolerance
      const tolerance = amountSearch * 0.01;
      query = query.gte('amount', amountSearch - tolerance).lte('amount', amountSearch + tolerance);
    }
  }

  // Legacy exact amount parameter
  if (amount && !amountSearch) {
    const numAmount = parseFloat(amount);
    const tolerance = numAmount * 0.01;
    query = query.gte('amount', numAmount - tolerance).lte('amount', numAmount + tolerance);
  }

  // Type filter
  if (type) {
    const typeMap: Record<string, string> = {
      'TRANSFER_OUT': 'TRF_OUT',
      'TRANSFER_IN': 'TRF_IN',
      'EXPENSE': 'EXP',
      'INCOME': 'INC',
    };
    const mappedType = typeMap[type] || type;
    query = query.eq('transaction_type_code', mappedType);
  }

  // Date filter (legacy)
  if (date && !dateRange) {
    query = query.eq('transaction_date', date);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Transaction search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to match expected format
  const transactions = (data || []).map(t => ({
    id: t.main_transaction_id,
    transaction_date: t.transaction_date,
    description: t.description,
    amount: t.amount,
    transaction_type: t.transaction_type_code,
    transaction_direction: t.transaction_direction,
    account: { name: t.account_name },
    category: { name: t.category_name }
  }));

  return NextResponse.json({ transactions });
}
