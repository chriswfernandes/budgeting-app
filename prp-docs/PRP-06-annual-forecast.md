# PRP-06: Annual Forecast View

## Status: Not started

## Overview

Add a **Forecast** tab to the app. For a selected year, it shows each month's planned income, planned expenses, actual income, and actual expenses side by side — with a running projected balance. Past months show actuals; future months show plan (budget). This lets users answer: "How much money will I have by December?"

---

## Prerequisites

- PRP-02: `globalBudgets`, `monthOverrides`, `incomeSources`, `incomeAdjusts` in place
- PRP-05: Category plan vs. actual logic (reuse `resolveMonthBudget`, `resolveMonthIncome`)
- PRP-07 (optional): If implemented, the starting balance can be pre-populated from the last known bank balance

---

## Data Model

### Starting balance

The user inputs a starting balance for the year — the amount in their bank account on January 1 (or the first month of the year they have data for). This is stored per year.

Storage key: `forecast-start-{year}` → `number`

This is the only new storage key introduced by this PRP.

---

## Navigation

Add a **Forecast** tab to the main navigation, between Overview and Scenarios:

```
Budget | Overview | Forecast | Scenarios | [Month] | [Classify]
```

Add `'forecast'` as a valid `view` value.

---

## The Forecast Engine

A pure function — no side effects. Returns one `ForecastMonth` per month in the year.

```js
/**
 * @typedef {Object} ForecastMonth
 * @property {number} year
 * @property {number} month          // 0-indexed
 * @property {string} label          // "Jan 2026"
 * @property {number} plannedIncome
 * @property {number} plannedExpenses
 * @property {number} actualIncome   // 0 if no transactions yet
 * @property {number} actualExpenses // 0 if no transactions yet
 * @property {boolean} isActual      // true if the month has real transaction data
 * @property {number} net            // isActual ? actual income - actual expenses : planned income - planned expenses
 * @property {number} runningBalance // startingBalance + cumulative net to this month
 */

function buildForecast(
  year,
  startingBalance,
  incomeSources,
  globalBudgets,
  allTxns,           // { [key: string]: Transaction[] }  — t-{year}-{month}
  allIncomeAdjusts,  // { [key: string]: IncomeAdjustment[] }
  allOverrides,      // { [key: string]: MonthOverrides }
  categories
)
```

### Logic per month (Jan–Dec of the given year)

1. **isActual**: `allTxns['t-{year}-{month}']` exists and has ≥ 1 transaction.

2. **actualIncome**: Sum of transactions where `type === 'income'` or `isIncomeCat(category)`.

3. **actualExpenses**: Sum of transactions where `type === 'expense'` and `!isIncomeCat(category)`.

4. **plannedIncome**: `resolveMonthIncome(year, month, incomeSources, allIncomeAdjusts[key])`.

5. **plannedExpenses**: Sum of `resolveMonthBudget(catId, year, month, globalBudgets, allOverrides)` for all categories that are not income categories. Categories with no budget set contribute $0.

6. **net**: If `isActual`, use `actualIncome - actualExpenses`. Otherwise use `plannedIncome - plannedExpenses`.

7. **runningBalance**: `startingBalance + sum of net for all months up to and including this one`.

---

## `ForecastView` Component

Props:
```js
{
  year: number,
  years: number[],
  incomeSources,
  globalBudgets,
  categories,
  allTxns,
  allIncomeAdjusts,
  allOverrides,
  onNavigateToMonth: (year, month) => void
}
```

State:
- `startingBalance: number` — loaded from `forecast-start-{year}`, defaults to `0`
- `editingBalance: boolean` — toggles the inline balance editor

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Forecast  [2026 ▼]                                              │
│                                                                   │
│  Starting balance   $12,400  [Edit]                              │
│  (Balance in account on Jan 1, 2026)                             │
│                                                                   │
│  SUMMARY TILES                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Planned net  │  │ Actual net   │  │ Year-end est.│           │
│  │ +$63,600     │  │ +$14,200     │  │ $76,000      │           │
│  │ (full year)  │  │ (to date)    │  │ (balance)    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

**Summary tile definitions:**
- **Planned net**: Sum of `(plannedIncome - plannedExpenses)` for all 12 months
- **Actual net**: Sum of `net` for `isActual` months only
- **Year-end estimate**: `startingBalance + sum of net for all 12 months`

---

### Monthly Forecast Table

```
         │ Planned In │ Planned Out │ Actual In  │ Actual Out │ Net      │ Balance  │
─────────┼────────────┼─────────────┼────────────┼────────────┼──────────┼──────────┤
Jan ✓    │ $8,500     │ $3,520      │ $8,500     │ $3,200     │ +$5,300  │ $17,700  │
Feb ✓    │ $8,500     │ $3,520      │ $8,500     │ $3,780     │ +$4,720  │ $22,420  │
Mar ✓    │ $8,500     │ $3,520      │ $8,800     │ $3,100     │ +$5,700  │ $28,120  │
Apr →    │ $8,500     │ $3,520      │ —          │ —          │ +$4,980  │ $33,100  │  ← projected
...
Dec →    │ $8,500     │ $3,520      │ —          │ —          │ +$4,980  │ $76,000  │
```

- `✓` label for past months (isActual), `→` for projected future months
- Projected rows have a subtly different background (`var(--color-background-secondary)`)
- Planned In / Planned Out always show (even for past months — for comparison)
- Actual In / Actual Out show `—` for future months
- Net column: green if positive, red if negative
- Balance column: the running balance — always calculated
- Clicking any month row navigates to that month's `MonthView` (`onNavigateToMonth`)

---

### Balance Chart

Below the table, an inline SVG line chart showing the running balance month by month.

- X axis: Jan–Dec
- Y axis: balance in $
- The line transitions from solid (actual months) to dashed (projected months) at the current month boundary
- A horizontal reference line at `startingBalance` (grey dashed) — lets the user see if they're ahead or behind their opening position
- A horizontal line at `$0` if the scale goes near or below zero
- Y axis: 4–5 tick marks, auto-scaled to data range
- X axis: month abbreviations (Jan, Feb, …)

SVG approach (consistent with existing pattern in `ScenarioProjectionView`):
```js
function toSVGCoords(values, svgWidth, svgHeight, padding) {
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  return values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * (svgWidth - padding * 2),
    y: padding + (1 - (v - minV) / range) * (svgHeight - padding * 2)
  }));
}
```

Draw actual segment as a solid `<polyline>` in `var(--color-text-success)`. Draw projected segment as a dashed `<polyline>` (same colour, `stroke-dasharray="4 3"`). Connect them at the boundary.

---

## Starting Balance Editor

Clicking [Edit] next to the starting balance shows an inline input (no modal):

```
Starting balance  [$12,400.00]  [Save]  [Cancel]
```

On save: persist to `forecast-start-{year}`, update state, rebuild the forecast. The year selector (if the user switches years) loads the stored balance for that year or defaults to `0`.

If PRP-07 is implemented: show a helper below the input:
```
Last recorded balance: $12,618 (from March statement)  [Use this →]
```

---

## App State Changes

Add to root state:
```js
const [forecastStartBalances, setForecastStartBalances] = useState({});

// On startup, load all years' starting balances:
for (const year of years) {
  const bal = await store.get(`forecast-start-${year}`);
  if (bal != null) forecastStartBalances[year] = bal;
}

// Save helper:
const saveForecastStart = async (year, amount) => {
  const updated = { ...forecastStartBalances, [year]: amount };
  setForecastStartBalances(updated);
  await store.set(`forecast-start-${year}`, amount);
};
```

---

## Acceptance Criteria

- [ ] "Forecast" tab appears in main navigation and renders `ForecastView`
- [ ] Year selector defaults to current year; switching year reloads data
- [ ] Starting balance input saves to `forecast-start-{year}` and persists across reloads
- [ ] Summary tiles show planned net (full year), actual net (past months only), and year-end estimate
- [ ] Table shows all 12 months with correct columns
- [ ] Past months show actual income and actual expenses
- [ ] Future months show `—` in actual columns
- [ ] Net column uses actuals for past months and planned for future months
- [ ] Running balance column compounds correctly from starting balance
- [ ] Past/future rows are visually distinct
- [ ] Clicking a month row navigates to that month's MonthView
- [ ] SVG chart renders with solid/dashed line split at current month
- [ ] No regression to any existing views
