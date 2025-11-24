# Cash Flow Projection System 3.0

**Version**: 3.0
**Date**: 2025-11-23
**Status**: ✅ Implemented and Deployed
**Previous Version**: [Cash Flow System 2.0](./CASHFLOW_SYSTEM_2.0.md)

## Overview

Cash Flow System 3.0 introduces **Liquidity & Solvency Analysis** to provide executives with a complete picture of financial health when cash flow is burning. The system now shows not just cash runway, but total liquid assets (investments + receivables) that can be liquidated or collected to extend runway.

## What's New in v3.0

### Executive Dashboard Enhancements

1. **Total Liquidity Position**
   - Shows cash + investments + receivables
   - Breakdown of each asset type
   - One-glance view of all liquid assets

2. **Extended Runway Analysis**
   - **Cash Runway**: How long until cash depletes
   - **Liquidity Runway**: How long if you liquidate investments/collect receivables
   - Side-by-side comparison for decision making

3. **Smart Alerts**
   - Warning when cash will run low but liquidity extends runway
   - Helps executives understand available options before cash crisis

## Problem Statement (v2.0 Limitation)

Version 2.0 successfully predicted income and expenses, but executives asked:

> "When you see cashflow burning in the next 6 months, would you wanna see total available assets and receivables too? So you have options to liquidate or collect."

**Scenario**: Cash flow shows you'll run out of cash in 3 months, but you have:
- 500M VND in investment accounts
- 300M VND in outstanding receivables (loans to others)

**Without v3.0**: Dashboard only shows "3 months until negative balance" 😱
**With v3.0**: Dashboard shows "3 months cash runway, 6 months liquidity runway" ✅

This gives executives time to plan liquidation strategies instead of panicking.

## Architecture Changes

### Data Sources for Liquidity

```
Total Liquid Assets = Cash + Investments + Receivables

Cash:
├─ Source: account_balances table
├─ Filter: account_type IN ('checking', 'savings', 'cash')
└─ Sum: current_balance across all cash accounts

Investments:
├─ Source: account_balances table
├─ Filter: account_type IN ('investment', 'stocks', 'bonds')
└─ Sum: current_balance across all investment accounts
    Note: Investments are accounts, NOT investment_contribution table

Receivables:
├─ Source: loan_disbursement table
├─ Filter: status = 'active' (loans not yet paid back)
├─ Sum: remaining_balance
└─ Track: overdue_receivables separately
```

### Key Design Decision: Investments as Accounts

**IMPORTANT**: In this system, investments are NOT tracked via `investment_contribution` table. Instead:
- Each investment is an **account** with `account_type = 'investment'`
- Money going into investments = credit transactions to investment account
- Money withdrawn from investments = debit transactions from investment account
- Investment value = `current_balance` in `account_balances` table

This approach allows unified balance tracking across all asset types.

## Implementation Components

### 1. Liquidity Analyzer Functions

**File**: `lib/cash-flow-analyzer.ts`

**New Interfaces**:
```typescript
interface AccountBalance {
  account_id: string
  account_name: string
  account_type: string
  current_balance: number
}

interface ReceivableLoan {
  loan_id: string
  borrower_name: string
  loan_amount: number
  remaining_balance: number
  due_date: string
  is_overdue: boolean
}

interface LiquidityPosition {
  cash_balance: number
  cash_accounts: AccountBalance[]
  investment_balance: number
  investment_accounts: AccountBalance[]
  receivables_balance: number
  receivables: ReceivableLoan[]
  overdue_receivables: number
  overdue_count: number
  total_liquid_assets: number
}

interface RunwayAnalysis {
  cash_runway_months: number
  liquidity_runway_months: number
  monthly_burn_rate: number
  monthly_income: number
  net_monthly_burn: number
  will_run_out_of_cash: boolean
  quick_ratio: number
  liquidity_buffer_months: number
}
```

**New Functions**:

```typescript
// Separate cash accounts from investment accounts
export async function getAccountBalancesByType(entityId: string): Promise<{
  cashAccounts: AccountBalance[]
  investmentAccounts: AccountBalance[]
  totalCash: number
  totalInvestments: number
}>

// Get outstanding loans (money owed to us)
export async function analyzeReceivables(entityId: string): Promise<{
  receivables: ReceivableLoan[]
  total_receivables: number
  overdue_receivables: number
  overdue_count: number
}>

// Combine all liquid assets
export async function analyzeLiquidityPosition(entityId: string): Promise<LiquidityPosition>

// Calculate cash runway vs liquidity runway
export function calculateRunwayAnalysis(
  liquidity: LiquidityPosition,
  monthlyBurnRate: number,
  monthlyIncome: number,
  monthsAhead: number = 6
): RunwayAnalysis
```

### 2. Enhanced API Endpoint

**File**: `app/api/cash-flow-projection/route.ts`

**Changes**:
```typescript
// Updated imports
import {
  calculatePredictedIncome,
  calculatePredictedExpenses,
  compareBudgets,
  getCategoriesWithScheduledPayments,
  analyzeLiquidityPosition,  // NEW
  calculateRunwayAnalysis    // NEW
} from '@/lib/cash-flow-analyzer'

// Added before return
const liquidityPosition = await analyzeLiquidityPosition(entityId)
const monthlyBurnRate = totalObligations / monthsAhead
const runwayAnalysis = calculateRunwayAnalysis(
  liquidityPosition,
  monthlyBurnRate,
  predictedMonthlyIncome,
  monthsAhead
)

console.log(`[Cash Flow 3.0] Total liquid assets: ${liquidityPosition.total_liquid_assets.toLocaleString()} VND`)
console.log(`[Cash Flow 3.0] Cash runway: ${runwayAnalysis.cash_runway_months.toFixed(1)} months`)
console.log(`[Cash Flow 3.0] Liquidity runway: ${runwayAnalysis.liquidity_runway_months.toFixed(1)} months`)

return NextResponse.json({
  data: {
    // ... existing v2.0 fields ...
    liquidity: liquidityPosition,  // NEW
    runway: runwayAnalysis,        // NEW
    version: '3.0'                 // Updated
  }
})
```

**Log Output Example**:
```
[Cash Flow 3.0] Total liquid assets: 1,340,000,000 VND
[Cash Flow 3.0] Cash runway: 7.2 months
[Cash Flow 3.0] Liquidity runway: 8.1 months
```

### 3. Executive Dashboard UI

**File**: `app/dashboard/cash-flow/page.tsx`

**New Components**:

**A. Liquidity Buffer Alert** (Shows when cash runs low but liquidity extends runway)
```tsx
{data.liquidity && data.runway && data.runway.will_run_out_of_cash && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-semibold text-blue-900">Liquidity Buffer Available</h3>
        <p className="text-sm text-blue-700 mt-1">
          Cash will run low in <strong>{data.runway.cash_runway_months.toFixed(1)} months</strong>,
          but you have <strong>{formatCurrency(data.liquidity.investment_balance + data.liquidity.receivables_balance, 'VND')}</strong> in
          investments and receivables that extend your runway to <strong>{data.runway.liquidity_runway_months.toFixed(1)} months</strong>.
        </p>
      </div>
    </div>
  </div>
)}
```

**B. Total Liquidity Card**
```tsx
{data.liquidity && (
  <Card className="border-blue-200 bg-blue-50/30">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-blue-600" />
        Total Liquidity
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-blue-600">
        {formatCurrency(data.liquidity.total_liquid_assets, 'VND')}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Cash + Investments + Receivables
      </p>
      <div className="mt-2 space-y-1 text-xs">
        {data.liquidity.investment_balance > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Investments:</span>
            <span className="font-medium">{formatCurrency(data.liquidity.investment_balance, 'VND')}</span>
          </div>
        )}
        {data.liquidity.receivables_balance > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Receivables:</span>
            <span className="font-medium">{formatCurrency(data.liquidity.receivables_balance, 'VND')}</span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

**C. Enhanced Runway Analysis Card**
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
      <AlertCircle className="h-4 w-4" />
      Runway Analysis
    </CardTitle>
  </CardHeader>
  <CardContent>
    {data.runway ? (
      <div className="space-y-2">
        {/* Cash-only runway */}
        <div>
          <div className="text-sm text-muted-foreground">Cash Runway</div>
          <div className="text-xl font-bold">
            {data.runway.cash_runway_months === Infinity
              ? `${monthsAhead}+`
              : `${data.runway.cash_runway_months.toFixed(1)}mo`}
          </div>
        </div>

        {/* Extended runway with liquidation */}
        {data.runway.liquidity_runway_months !== data.runway.cash_runway_months && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground">With Liquidation</div>
            <div className="text-xl font-bold text-blue-600">
              {data.runway.liquidity_runway_months === Infinity
                ? `${monthsAhead}+`
                : `${data.runway.liquidity_runway_months.toFixed(1)}mo`}
            </div>
          </div>
        )}
      </div>
    ) : (
      // Fallback to v2.0 display
    )}
  </CardContent>
</Card>
```

## API Response Structure (v3.0)

```typescript
{
  data: {
    // === v2.0 Fields (Unchanged) ===
    current_balance: number
    months_ahead: number
    total_obligations: number
    total_projected_income: number
    net_projected_change: number
    lowest_projected_balance: number
    months_until_negative: number | null
    projections: [...],

    // === NEW v3.0 Fields ===
    liquidity: {
      cash_balance: number,              // Sum of cash accounts
      cash_accounts: [                   // Detail of each cash account
        {
          account_id: string,
          account_name: string,
          account_type: string,
          current_balance: number
        }
      ],
      investment_balance: number,        // Sum of investment accounts
      investment_accounts: [             // Detail of each investment
        {
          account_id: string,
          account_name: string,
          account_type: string,
          current_balance: number
        }
      ],
      receivables_balance: number,       // Sum of outstanding loans
      receivables: [                     // Detail of each receivable
        {
          loan_id: string,
          borrower_name: string,
          loan_amount: number,
          remaining_balance: number,
          due_date: string,
          is_overdue: boolean
        }
      ],
      overdue_receivables: number,       // Amount overdue
      overdue_count: number,             // Number of overdue loans
      total_liquid_assets: number        // Cash + Investments + Receivables
    },

    runway: {
      cash_runway_months: number,        // Months until cash depletes
      liquidity_runway_months: number,   // Months if you liquidate all
      monthly_burn_rate: number,         // Average monthly expenses
      monthly_income: number,            // Average monthly income
      net_monthly_burn: number,          // burn_rate - income
      will_run_out_of_cash: boolean,     // True if cash < 0 within projection
      quick_ratio: number,               // Liquid assets / monthly burn
      liquidity_buffer_months: number    // liquidity_runway - cash_runway
    },

    version: '3.0'                       // API version marker
  }
}
```

## Executive Use Cases

### Scenario 1: Healthy Cash Flow
```
Current Cash: 1,000M VND
Cash Runway: 12+ months
Liquidity Runway: 12+ months

UI Display:
✅ No alerts
✅ Green health indicators
✅ "Cash Runway: 12+mo"
```

### Scenario 2: Cash Burning but Liquidity Buffer Available
```
Current Cash: 500M VND
Investments: 800M VND
Receivables: 200M VND
Monthly Burn: 100M VND/month

Cash Runway: 5 months ⚠️
Liquidity Runway: 15 months ✅

UI Display:
🔵 Blue alert: "Cash will run low in 5 months, but you have 1,000M in investments
   and receivables that extend your runway to 15 months"
📊 Total Liquidity Card: 1,500M VND
   - Investments: 800M
   - Receivables: 200M
📈 Runway Analysis:
   - Cash Runway: 5.0mo
   - With Liquidation: 15.0mo
```

**Executive Action**: Plan to liquidate 500M from investments over next 3-4 months, or accelerate receivable collections.

### Scenario 3: Critical - Both Cash and Liquidity Running Low
```
Current Cash: 200M VND
Investments: 100M VND
Receivables: 50M VND
Monthly Burn: 100M VND/month

Cash Runway: 2 months ⚠️
Liquidity Runway: 3.5 months ⚠️

UI Display:
🔴 Red alert: "Cash will run out in 2 months"
🔵 Blue alert: "Even with liquidation, runway only extends to 3.5 months"
```

**Executive Action**: Urgent cost cutting, revenue acceleration, or external funding needed.

## Calculation Formulas

### Cash Runway
```typescript
netMonthlyBurn = monthlyExpenses - monthlyIncome
cashRunway = currentCashBalance / netMonthlyBurn

// If netMonthlyBurn <= 0 (making money), runway = Infinity
```

### Liquidity Runway
```typescript
totalLiquidAssets = cash + investments + receivables
liquidityRunway = totalLiquidAssets / netMonthlyBurn

// Assumes all investments can be liquidated
// Assumes all receivables can be collected
```

### Quick Ratio
```typescript
quickRatio = totalLiquidAssets / monthlyExpenses

// Financial health indicator
// < 1: Less than 1 month of expenses covered
// 1-3: Healthy short-term liquidity
// > 3: Very strong liquidity position
```

## Database Queries

### Get Cash Accounts
```sql
SELECT a.account_id, a.account_name, a.account_type, ab.current_balance
FROM accounts a
LEFT JOIN account_balances ab ON a.account_id = ab.account_id
WHERE a.entity_id = $1
  AND a.is_active = true
  AND a.account_type IN ('checking', 'savings', 'cash')
```

### Get Investment Accounts
```sql
SELECT a.account_id, a.account_name, a.account_type, ab.current_balance
FROM accounts a
LEFT JOIN account_balances ab ON a.account_id = ab.account_id
WHERE a.entity_id = $1
  AND a.is_active = true
  AND a.account_type IN ('investment', 'stocks', 'bonds')
```

### Get Receivables (Outstanding Loans)
```sql
SELECT ld.*, a.account_name
FROM loan_disbursement ld
INNER JOIN accounts a ON ld.account_id = a.account_id
WHERE a.entity_id = $1
  AND ld.status = 'active'
  AND ld.remaining_balance > 0
ORDER BY ld.due_date ASC
```

## Migration Notes

### Database Changes
- **No schema changes required** ✅
- Uses existing tables:
  - `accounts` + `account_balances` for cash and investments
  - `loan_disbursement` for receivables
  - All other v2.0 tables unchanged

### Backward Compatibility
- v2.0 clients still work (ignore new fields)
- v3.0 is enhancement, not breaking change
- Frontend gracefully degrades if `liquidity` or `runway` fields missing

### Configuration
- No new environment variables
- No new database migrations
- Just code changes in analyzer, API, and UI

## Testing Checklist

- [x] Cash balance calculation (sum of all cash accounts)
- [x] Investment balance calculation (sum of investment accounts)
- [x] Receivables calculation (sum of active loan disbursements)
- [x] Total liquidity calculation (cash + investments + receivables)
- [x] Cash runway calculation (months until cash depletes)
- [x] Liquidity runway calculation (months with full liquidation)
- [x] Liquidity buffer alert display (when cash low but liquidity extends runway)
- [x] Total Liquidity card display (with investment/receivable breakdown)
- [x] Runway Analysis card display (cash vs liquidation runway)
- [x] Edge case: Infinite runway (when making money, not burning)
- [x] Edge case: No investments or receivables (liquidity = cash only)
- [ ] Edge case: Overdue receivables (should they count toward liquidity?)

## Known Limitations

1. **Liquidation Assumptions**
   - Assumes 100% of investment value can be realized
   - Doesn't account for liquidation costs/fees
   - Doesn't consider illiquid investments (e.g., real estate, private equity)

2. **Receivables Assumptions**
   - Assumes 100% collectability
   - Overdue receivables still counted (should they be discounted?)
   - Doesn't model probability of default

3. **Time to Liquidate**
   - Calculations assume instant liquidation
   - Real liquidation takes days/weeks
   - Should we discount based on time to convert to cash?

## Future Enhancements (v4.0?)

1. **Liquidation Scenarios**
   - Partial liquidation planning (sell X% of investments)
   - Staged liquidation over time
   - Cost of liquidation (fees, taxes, penalties)

2. **Receivables Management**
   - Collection probability scoring
   - Aging analysis (30/60/90 days overdue)
   - Discount overdue receivables in liquidity calculation

3. **What-If Analysis**
   - "What if I liquidate 50% of investments?"
   - "What if I collect all receivables within 30 days?"
   - "What if I cut expenses by 20%?"

4. **Asset Liquidity Scoring**
   - Highly liquid (cash): 100% value, instant
   - Medium liquid (public stocks): 95% value, 1-3 days
   - Low liquid (private equity): 70% value, 30+ days
   - Illiquid (real estate): 80% value, 90+ days

5. **Stress Testing**
   - Monte Carlo simulation of burn rates
   - Worst-case scenario planning
   - Sensitivity analysis on key assumptions

## Files Modified

1. **Created**:
   - `docs/CASHFLOW_SYSTEM_3.0.md` - This documentation

2. **Modified**:
   - `lib/cash-flow-analyzer.ts` - Added liquidity analysis functions
   - `app/api/cash-flow-projection/route.ts` - Integrated liquidity data
   - `app/dashboard/cash-flow/page.tsx` - Added liquidity UI components

## Version History

- **v1.0**: Basic cash flow with hard-coded 0 income, simple obligations
- **v2.0**: Intelligent predictions from historical data, hierarchical expense tracking
- **v3.0**: Liquidity & solvency analysis, extended runway calculations

## Support

For questions or issues with Cash Flow System 3.0:
- Review this documentation
- Check implementation in `lib/cash-flow-analyzer.ts`
- Test with sample data in development
- Monitor API logs for debugging output (search for "[Cash Flow 3.0]")

## Changelog

### v3.0 (2025-11-23)
- Added liquidity position analysis (cash + investments + receivables)
- Added extended runway calculations (cash runway vs liquidity runway)
- Added executive dashboard components (alerts, liquidity card, runway card)
- Implemented investment tracking via account balances (not investment_contribution)
- Implemented receivables tracking via loan_disbursement table
- Added comprehensive logging for liquidity metrics

### v2.0 (2025-11-23)
- Added historical income prediction
- Added historical expense prediction
- Implemented hierarchical priority system to prevent double-counting
- Added confidence scoring for predictions
- Added budget comparison warnings

### v1.0 (Initial)
- Basic cash flow projection
- Debt payment tracking
- Scheduled payment tracking
- Budget-based expense estimation
