# Cash Flow Projection System 2.0

**Version**: 2.0
**Date**: 2025-11-23
**Status**: ✅ Implemented and Deployed

## Overview

Cash Flow System 2.0 introduces **intelligent predictive forecasting** to project future cash flows based on historical transaction patterns, while avoiding double-counting issues from overlapping data sources.

## Problem Statement (v1.0)

The original system had critical limitations:

1. **No Income Prediction**: `projected_income` was hard-coded to 0
2. **Simple Expense Tracking**: Only counted fixed obligations (debt + schedules + budgets)
3. **No Intelligence**: Didn't learn from historical spending patterns
4. **Double-Counting Risk**: Could count the same expense multiple times:
   - Rent in scheduled payments: 10M
   - Rent in budget: 10M
   - Rent in predictions: 10M
   - **Total**: 30M instead of 10M! ❌

## Solution: Hierarchical Priority System

### Data Source Hierarchy

To prevent double-counting, we apply a strict priority order:

```
Priority 1: KNOWN OBLIGATIONS (Committed, Must Happen)
├─ Debt Payments (loans, credit cards)
└─ Scheduled Fixed Payments (contracts, subscriptions)

Priority 2: HISTORICAL PATTERNS (Predicted from Past Data)
├─ For categories WITHOUT scheduled payments
├─ Requires 3+ months of transaction history
└─ Uses average spending from past 3-6 months

Priority 3: BUDGETS (Fallback & Comparison)
├─ Only for NEW categories (no history, no schedule)
├─ Used as warning threshold (actual vs budget)
└─ Lowest priority to avoid double-counting

INCOME: SEPARATE TRACK
├─ Predicted from historical income patterns
├─ Detects recurring income (salaries, contracts)
└─ Calculates average monthly income by category
```

## Implementation Components

### 1. Historical Transaction Analyzer

**File**: `lib/cash-flow-analyzer.ts`

**Purpose**: Analyze past transactions to detect patterns and calculate averages

**Functions**:
- `analyzeHistoricalIncome()`: Detect recurring income patterns
- `analyzeHistoricalExpenses()`: Calculate average spending by category
- `detectRecurringPatterns()`: Identify monthly/quarterly recurring items
- `getCategoriesWithScheduledPayments()`: Get categories already covered by contracts

### 2. Updated API Endpoint

**File**: `app/api/cash-flow-projection/route.ts`

**Changes**:
- Fetch historical transactions (past 3-6 months)
- Calculate predicted income from patterns
- Calculate predicted expenses (excluding scheduled categories)
- Apply hierarchy logic to prevent double-counting
- Return confidence scores for predictions

### 3. Enhanced Frontend

**File**: `app/dashboard/cash-flow/page.tsx`

**New Features**:
- Display predicted income vs actual obligations
- Show confidence indicators for predictions
- Budget comparison warnings (actual vs budget)
- Breakdown showing which method was used per category

## Data Flow

```
Step 1: Fetch Base Data
├─ Current account balances
├─ Debt payments (Priority 1)
├─ Scheduled payments (Priority 1)
├─ Budgets (Priority 3)
└─ Historical transactions (past 6 months)

Step 2: Analyze Historical Data
├─ Group transactions by category
├─ Calculate monthly averages
├─ Detect recurring patterns
└─ Identify categories covered by scheduled payments

Step 3: Build Predictions (Per Month)
├─ Income: Use historical average + detected patterns
└─ Expenses:
    ├─ Add all Priority 1 (debt + scheduled)
    ├─ For remaining categories:
    │   ├─ Has history? → Use historical average (Priority 2)
    │   └─ No history? → Use budget if exists (Priority 3)
    └─ Calculate total

Step 4: Calculate Cash Flow
├─ Opening Balance = Previous month's closing OR current balance
├─ Projected Income = Calculated from history
├─ Total Obligations = Priority 1 + 2 + 3 (no overlap!)
├─ Closing Balance = Opening + Income - Obligations
└─ Health Status = surplus | tight | deficit
```

## Example Scenario

**Monthly Projection for January 2025:**

| Item | Type | Amount | Priority | Included? |
|------|------|--------|----------|-----------|
| **INCOME** |
| Salary | Historical Pattern | +50M | Income Track | ✅ Yes |
| Freelance | Historical Average | +10M | Income Track | ✅ Yes |
| **EXPENSES** |
| Loan Payment | Debt | -5M | Priority 1 | ✅ Yes |
| Rent | Scheduled Contract | -10M | Priority 1 | ✅ Yes |
| Internet | Scheduled Contract | -500K | Priority 1 | ✅ Yes |
| Electricity | Historical (no contract) | -2M | Priority 2 | ✅ Yes |
| Groceries | Historical (no contract) | -8M | Priority 2 | ✅ Yes |
| Entertainment | Budget (new category) | -3M | Priority 3 | ✅ Yes |
| Rent | Budget | -10M | Priority 3 | ❌ **SKIP** (already in P1) |

**Result**:
- Projected Income: 60M
- Total Obligations: 28.5M (5M + 10M + 0.5M + 2M + 8M + 3M)
- Closing Balance: 60M - 28.5M = +31.5M ✅
- Health: Surplus

## API Response Structure

```typescript
{
  data: {
    current_balance: number
    months_ahead: number
    total_obligations: number
    total_projected_income: number  // NEW
    lowest_projected_balance: number
    months_until_negative: number | null
    projections: [
      {
        month: string                    // "2025-01"
        month_label: string              // "January 2025"
        opening_balance: number

        // Income (NEW)
        projected_income: number         // Total predicted income
        income_breakdown: [              // NEW: Detail by source
          {
            category_name: string
            amount: number
            confidence: 'high' | 'medium' | 'low'
            source: 'recurring' | 'average' | 'estimate'
          }
        ]

        // Expenses
        debt_payments: []                // Priority 1
        scheduled_payments: []           // Priority 1
        predicted_expenses: [            // NEW: Priority 2
          {
            category_name: string
            amount: number
            historical_average: number
            months_of_data: number
            confidence: 'high' | 'medium' | 'low'
          }
        ]
        budgets: []                      // Priority 3 (only unused categories)

        total_debt: number
        total_scheduled: number
        total_predicted: number          // NEW
        total_budgets: number            // Only unfilled categories
        total_obligations: number
        closing_balance: number
        health: 'surplus' | 'tight' | 'deficit'

        // Warnings (NEW)
        budget_warnings: [               // Categories over budget
          {
            category_name: string
            projected: number
            budget: number
            variance: number
          }
        ]
      }
    ]
  }
}
```

## Confidence Scoring

**High Confidence** (3+ consecutive months of similar amounts):
- Monthly salary (variance < 10%)
- Fixed contracts with scheduled payments
- Highly consistent recurring expenses

**Medium Confidence** (3+ months but variable):
- Variable income (freelance, commissions)
- Semi-regular expenses (utilities, groceries)
- Variance between 10-30%

**Low Confidence** (< 3 months or highly variable):
- New income sources
- Irregular expenses
- Variance > 30%

## Migration Notes

### Database Changes
- No schema changes required
- Uses existing tables/views:
  - `main_transaction_details` (view) - For historical transaction analysis
  - `account_balances` (table) - For current account balances
  - `loan_disbursement` - For debt payments
  - `scheduled_payment_instances` - For scheduled fixed payments
  - `category_budgets` - For budget comparisons

### Backward Compatibility
- v1.0 API still works (0 income, simple obligations)
- v2.0 is enhancement, not breaking change
- Can roll back by reverting route.ts

### Configuration
- Historical analysis period: 6 months (configurable)
- Minimum data points for prediction: 3 months
- Confidence thresholds: High < 10%, Medium < 30%, Low >= 30%

## Testing Checklist

- [x] Historical income calculation (with recurring salary)
- [x] Historical expense calculation (groceries, utilities)
- [x] Double-counting prevention (rent: scheduled vs budget)
- [x] New category handling (no history, use budget)
- [ ] Seasonal patterns (not yet implemented)
- [x] Edge cases (0 income months, negative balances)
- [x] Confidence scoring accuracy
- [x] Frontend display of all new fields
- [x] Current balance aggregation across all accounts

## Future Enhancements (v3.0?)

- Machine learning for better predictions
- Seasonal adjustment (holiday spending, tax season)
- Growth trend detection (increasing/decreasing patterns)
- User manual overrides (planned purchases, bonuses)
- What-if scenarios (what if I get a raise? pay off loan early?)
- Goal tracking integration (savings goals, debt payoff targets)

## Implementation Details

### Key Technical Decisions

**Database Schema Discovery**:
- The `main_transaction` table uses `amount` + `transaction_direction` (not `debit_amount`/`credit_amount`)
- Primary key is `main_transaction_id` (not `transaction_id`)
- Used `main_transaction_details` view for querying (includes all joins and computed fields)
- Account balances stored in `account_balances` table (plural, not singular)

**Query Optimization**:
- Filter by `transaction_direction = 'credit'` for income
- Filter by `transaction_direction = 'debit'` for expenses
- Avoided nested foreign key relationships (caused Supabase aliasing issues)
- Query `main_transaction_details` view directly for cleaner access to category names

**Double-Counting Prevention**:
- `getCategoriesWithScheduledPayments()` returns Set of category IDs
- Historical expense analyzer skips categories in this set
- Ensures rent paid via scheduled payment isn't also counted in predictions

### Common Issues & Solutions

**Issue**: Supabase error "column transaction_types_2.direction does not exist"
**Solution**: Removed nested relationship queries, used `main_transaction_details` view with flat column access

**Issue**: "Could not find table 'account_balance'"
**Solution**: Correct table name is `account_balances` (plural)

**Issue**: Current balance showing 0
**Solution**: Query `accounts` table to get account IDs, then query `account_balances` separately

## Files Modified

1. **Created**:
   - `lib/cash-flow-analyzer.ts` - Historical analysis logic
   - `docs/CASHFLOW_SYSTEM_2.0.md` - This documentation

2. **Modified**:
   - `app/api/cash-flow-projection/route.ts` - Enhanced API with predictions and balance fixes
   - `app/dashboard/cash-flow/page.tsx` - Updated UI for new data (already had v2.0 support)
   - `lib/cash-flow-analyzer.ts` - Fixed to use correct schema and view

## Rollback Plan

If v2.0 has issues:

```bash
# Revert the API endpoint
git checkout HEAD~1 app/api/cash-flow-projection/route.ts

# Remove analyzer
rm lib/cash-flow-analyzer.ts

# Revert frontend if needed
git checkout HEAD~1 app/dashboard/cash-flow/page.tsx
```

## Support

For questions or issues with Cash Flow System 2.0:
- Review this documentation
- Check implementation in `lib/cash-flow-analyzer.ts`
- Test with sample data first
- Monitor console for debugging output
