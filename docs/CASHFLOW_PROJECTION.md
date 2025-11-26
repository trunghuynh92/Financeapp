# Cash Flow Projection System

## Overview

The Cash Flow Projection system provides intelligent forecasting of future cash positions by analyzing historical data, scheduled payments, debt obligations, and budget allocations. It includes scenario planning capabilities for "what-if" analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CASH FLOW PAGE                                │
│                    /app/dashboard/cash-flow/page.tsx                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   Summary Cards │  │  Scenario Mgr   │  │    Projection Charts    │ │
│  │  - Balance      │  │  - Create/Edit  │  │  - Cash Flow Bars       │ │
│  │  - Runway       │  │  - Adjustments  │  │  - Balance Line         │ │
│  │  - Liquidity    │  │  - Apply        │  │  - Credit Availability  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CASH FLOW PROJECTION API                           │
│                /app/api/cash-flow-projection/route.ts                   │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Priority   │  │   Scenario   │  │   Liquidity  │  │   Credit    │ │
│  │   System     │  │ Adjustments  │  │   Analysis   │  │   Lines     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CASH FLOW ANALYZER                               │
│                       /lib/cash-flow-analyzer.ts                        │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │  calculatePredicted  │  │  analyzeLiquidity    │                    │
│  │  Income/Expenses     │  │  Position            │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE DATABASE                             │
│                                                                         │
│  ┌────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐ │
│  │  transactions  │  │ scheduled_payments   │  │ cashflow_scenarios  │ │
│  │  accounts      │  │ scheduled_instances  │  │ scenario_adjustments│ │
│  │  categories    │  │ category_budgets     │  │ debt_drawdown       │ │
│  └────────────────┘  └──────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Hierarchical Priority System

The system uses a priority hierarchy to prevent double-counting expenses:

```
Priority 1: Debt Payments (debt_drawdown table)
    ↓
Priority 2: Scheduled Payments (scheduled_payment_instances)
    ↓
Priority 3: Predicted Expenses (ML-based from transaction history)
    ↓
Priority 4: Budget Allocations (category_budgets)
```

**Why this matters:** If a category has scheduled payments, we use those amounts instead of predicted expenses. If a category has neither, we fall back to budget allocations.

### 2. Income Prediction

Income is predicted using historical transaction analysis:

```typescript
// From lib/cash-flow-analyzer.ts
calculatePredictedIncome(entityId: string): {
  total: number,
  breakdown: IncomeSource[]
}
```

The system analyzes:
- Last 6 months of income transactions
- Recurring patterns (monthly, quarterly)
- Categorizes by source (sales, services, etc.)

### 3. Expense Prediction

Expenses are predicted per category using weighted moving averages:

```typescript
calculatePredictedExpenses(entityId: string, monthKey: string): PredictedExpense[]
```

For each category:
1. Get last 6 months of expense data
2. Calculate weighted average (recent months weighted higher)
3. Exclude categories with scheduled payments (to avoid double-counting)

### 4. Monthly Projection Structure

Each month's projection contains:

```typescript
interface MonthlyProjection {
  month: string                    // "2025-11"
  month_label: string              // "November 2025"
  opening_balance: number          // Starting cash
  projected_income: number         // Expected income

  // Priority 1
  debt_payments: DebtPayment[]     // Loan repayments due
  total_debt: number

  // Priority 2
  scheduled_payments: Payment[]    // Recurring bills, contracts
  total_scheduled: number

  // Priority 3
  predicted_expenses: Expense[]    // ML-predicted expenses
  total_predicted: number

  // Priority 4
  budgets: Budget[]                // Budget allocations
  total_budgets: number

  // Calculated
  total_obligations: number        // Sum of all expenses
  closing_balance: number          // opening + income - obligations
  health: 'surplus' | 'tight' | 'deficit'

  // Scenario adjustments (if applied)
  scenario_debt_drawdown?: number
  scenario_debt_repayment?: number
  scenario_income?: number
  scenario_expense?: number
  scenario_items?: ScenarioItem[]
}
```

## Scenario Planning

### Overview

Scenarios allow "what-if" analysis without modifying actual data.

### Database Schema

```sql
-- Scenario definition
CREATE TABLE cashflow_scenarios (
  scenario_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adjustments within a scenario
CREATE TABLE scenario_adjustments (
  adjustment_id SERIAL PRIMARY KEY,
  scenario_id INTEGER REFERENCES cashflow_scenarios,
  adjustment_type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  amount DECIMAL(15,2),
  percentage DECIMAL(5,2),
  start_month DATE,
  end_month DATE,
  category_id INTEGER,
  scheduled_payment_id INTEGER,
  account_id INTEGER,
  metadata JSONB DEFAULT '{}'
);
```

### Adjustment Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `one_time_income` | Single income event (bonus, sale) | amount, start_month |
| `one_time_expense` | Single expense event (repair, purchase) | amount, start_month |
| `recurring_income` | Monthly income (new contract) | amount, start_month, end_month |
| `recurring_expense` | Monthly expense (subscription) | amount, start_month, end_month |
| `debt_drawdown` | New loan/credit draw | amount, start_month, metadata.repayment_months |
| `modify_predicted` | % change to predicted expenses | percentage, start_month, end_month |
| `modify_income` | % change to predicted income | percentage, start_month, end_month |
| `exclude_scheduled` | Remove a scheduled payment | scheduled_payment_id |

### Debt Drawdown Logic

When a debt drawdown adjustment is created:

```typescript
// 1. In the drawdown month: Add as income (cash inflow)
if (adj.adjustment_type === 'debt_drawdown' && matchesMonth) {
  adjustedIncome += adj.amount
  scenarioDebtDrawdown += adj.amount  // Track separately for credit impact
}

// 2. In the repayment month: Add as expense (cash outflow)
if (adj.metadata?.repayment_month === monthKey) {
  adjustedPredicted += adj.amount
  scenarioDebtRepayment += adj.amount
}
```

The metadata stores:
```typescript
interface DebtDrawdownMetadata {
  repayment_month: string      // "2026-06" - calculated from repayment_months
  repayment_months: number     // User selection: 1, 3, 6, 12, 18, 24
  credit_line_account_id?: number
  interest_rate?: number
}
```

### Applying Scenarios to Projections

```typescript
function applyScenarioAdjustments(
  monthKey: string,
  baseIncome: number,
  basePredictedExpenses: number,
  adjustments: ScenarioAdjustment[]
): {
  adjustedIncome: number,
  adjustedPredicted: number,
  scenarioDebtDrawdown: number,
  scenarioDebtRepayment: number,
  scenarioIncome: number,
  scenarioExpense: number,
  scenarioItems: ScenarioItem[]
}
```

## Credit Line Analysis

### Current Availability

```typescript
// For each credit line account
const availableCredit = creditLimit - usedAmount

// Used amount = sum of active debt drawdowns
const { data: drawdowns } = await supabase
  .from('debt_drawdown')
  .select('remaining_balance')
  .eq('account_id', account.account_id)
  .in('status', ['active', 'overdue'])
```

### Availability Projection

Credit availability changes over time based on:
1. **Debt repayments** → Free up credit (positive)
2. **Scenario drawdowns** → Use credit (negative)
3. **Scenario repayments** → Restore credit (positive)

```typescript
const creditAvailabilityProjection = creditProjections.map((proj) => {
  cumulativeRepayments += proj.repayment_amount
  cumulativeScenarioDrawdowns += proj.scenario_drawdown
  cumulativeScenarioRepayments += proj.scenario_repayment

  const netCreditChange = cumulativeRepayments
                        - cumulativeScenarioDrawdowns
                        + cumulativeScenarioRepayments

  return {
    month: proj.month,
    available_credit: totalCreditAvailable + netCreditChange,
    // ... other fields
  }
})
```

## Liquidity Analysis

### Metrics Calculated

```typescript
interface LiquidityPosition {
  current_ratio: number      // Current Assets / Current Liabilities
  quick_ratio: number        // (Current Assets - Inventory) / Current Liabilities
  cash_ratio: number         // Cash / Current Liabilities
  working_capital: number    // Current Assets - Current Liabilities
  total_liquid_assets: number
  total_investments: number
  investment_balance: number
  receivables_balance: number
}
```

### Runway Analysis

```typescript
interface RunwayAnalysis {
  will_run_out_of_cash: boolean
  months_of_runway: number | null
  runout_date: string | null
  cash_runway_months: number      // Based on cash only
  liquidity_runway_months: number // Based on all liquid assets
}
```

## API Reference

### GET /api/cash-flow-projection

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| entity_id | UUID | Yes | Business entity ID |
| months_ahead | number | No | Projection period (default: 6) |
| scenario_id | number | No | Apply scenario adjustments |

**Response:**
```typescript
{
  data: {
    current_balance: number,
    months_ahead: number,
    total_obligations: number,
    total_projected_income: number,
    net_projected_change: number,
    lowest_projected_balance: number,
    months_until_negative: number | null,
    projections: MonthlyProjection[],
    liquidity: LiquidityPosition,
    runway: RunwayAnalysis,
    credit_lines: {
      accounts: CreditLineAccount[],
      total_limit: number,
      total_used: number,
      total_available: number,
      overall_utilization: number,
      availability_projection: CreditAvailabilityProjection[],
      scenario_debt_drawdown: number,
      scenario_adjusted_available: number
    },
    scenario: { name: string, color: string } | null
  }
}
```

### Scenario APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scenarios` | GET | List all scenarios for entity |
| `/api/scenarios` | POST | Create new scenario |
| `/api/scenarios/[id]` | GET | Get scenario with adjustments |
| `/api/scenarios/[id]` | PATCH | Update scenario |
| `/api/scenarios/[id]` | DELETE | Delete scenario |
| `/api/scenarios/[id]/adjustments` | POST | Add adjustment |
| `/api/scenarios/[id]/adjustments/[adjustmentId]` | PATCH | Update adjustment |
| `/api/scenarios/[id]/adjustments/[adjustmentId]` | DELETE | Delete adjustment |

## UI Components

### ScenarioManager (`/components/scenario-manager.tsx`)

Handles:
- Listing existing scenarios
- Creating/editing scenarios
- Adding adjustments with type-specific forms
- Applying scenarios to projection

Key props:
```typescript
interface ScenarioManagerProps {
  entityId: string
  selectedScenarioId: number | null
  onScenarioChange: (id: number | null) => void
  creditLines?: CreditLineAccount[]  // For debt drawdown account selection
}
```

### Cash Flow Page (`/app/dashboard/cash-flow/page.tsx`)

Features:
- **View Modes:** Chart view (default) and Cards view
- **Chart Components:**
  - ComposedChart for income/expense bars + balance line
  - AreaChart for credit availability projection
- **Customization:** Exclude categories from projection
- **Scenario Integration:** Apply scenario and see impact

## Data Flow Example

```
User selects "Pessimistic" scenario with:
- $50,000 one-time expense in January
- -20% income modification for Q1

1. API receives: GET /api/cash-flow-projection?entity_id=xxx&scenario_id=5

2. Fetch base data:
   - Current balance from accounts
   - Scheduled payments for projection period
   - Historical transactions for predictions
   - Active debt drawdowns

3. Build monthly projections (without scenario):
   - January: income=$100K, expenses=$80K, balance=$120K

4. Apply scenario adjustments:
   - January:
     - income = $100K * 0.8 = $80K (modify_income -20%)
     - expenses = $80K + $50K = $130K (one_time_expense)
     - balance = $120K + $80K - $130K = $70K

5. Calculate running balance through all months

6. Return complete projection with scenario impact
```

## Best Practices

### For New Developers

1. **Understanding the Priority System**
   - Always check if a category has scheduled payments before using predictions
   - Budget allocations are last resort

2. **Working with Scenarios**
   - Scenarios never modify actual data
   - They only affect the projection calculation
   - Multiple scenarios can exist but only one applied at a time

3. **Credit Line Calculations**
   - Real credit usage comes from `debt_drawdown` table
   - Scenario credit impact is calculated separately
   - Both are combined for the final availability projection

4. **Date Handling**
   - All dates in database are stored as `DATE` type (YYYY-MM-DD)
   - API accepts `YYYY-MM` format and converts to `YYYY-MM-01`
   - Month comparisons use `format(date, 'yyyy-MM')`

### Performance Considerations

1. The API makes multiple database queries - consider caching for frequently accessed data
2. Historical transaction analysis looks at 6 months - may need adjustment for new entities
3. Credit line calculations iterate through all accounts - optimize for entities with many accounts

## Troubleshooting

### Common Issues

**Issue:** Predicted expenses seem too high/low
- Check: Historical data quality in last 6 months
- Check: Categories with scheduled payments being excluded correctly

**Issue:** Scenario not affecting projection
- Check: Adjustment dates match projection period
- Check: Correct adjustment type and required fields

**Issue:** Credit availability not changing
- Check: Debt repayments have valid `due_date`
- Check: Scenario drawdown has correct `start_month`

### Debug Logging

Enable detailed logging by checking console output for:
- `[Scenario Debug]` - Scenario loading and adjustment application
- `[Cash Flow 2.0]` - Income/expense calculations
- `[Cash Flow 3.0]` - Liquidity and credit analysis

## Version History

| Version | Features |
|---------|----------|
| 1.0 | Basic projection with scheduled payments |
| 2.0 | Added predicted income/expenses, budget fallbacks |
| 3.0 | Added liquidity analysis, runway calculation |
| 3.1 | Added scenario planning, credit line analysis, debt drawdown |
