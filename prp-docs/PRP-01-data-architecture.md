# PRP-01: Data Architecture & Storage Schema

## Status: Foundation — implement this first, all other PRPs depend on it

## Overview
Establish the complete storage schema and shared data models for the budget tracker. This PRP introduces no new UI — it refactors the existing storage layer and defines all data shapes that future PRPs will consume.

---

## Current State

The app (`BudgetTracker.jsx`) currently stores:

| Key pattern | Value |
|---|---|
| `budget-years` | `number[]` — list of active years |
| `t-{year}-{month}` | `Transaction[]` — transactions for a month |
| `i-{year}-{month}` | `number` — manual income override for a month |

The `store` helper wraps `window.storage.get/set` with JSON parse/stringify. Keep this helper — extend it.

---

## New Storage Keys

Add the following keys. Do not remove or rename existing keys.

### Global category budgets
```
budget-global
```
Value type:
```ts
type GlobalBudgets = {
  [categoryId: string]: number  // monthly spend limit in CAD
}
// Example:
// { "food": 800, "housing": 2200, "transport": 300 }
```
Default: `{}` (no limits set — unlimited)

---

### Per-month budget overrides
```
budget-override-{year}-{month}
```
Value type:
```ts
type MonthOverrides = {
  [categoryId: string]: number  // overrides the global limit for this month only
}
// Example (July override for travel):
// { "travel": 3000 }
```
Default: `{}` (no overrides — falls back to global)

---

### Income sources
```
income-sources
```
Value type:
```ts
type IncomeSource = {
  id: string           // uuid
  label: string        // e.g. "Chris salary", "Wife salary"
  amount: number       // monthly amount in CAD
  active: boolean      // whether it's currently included in baseline
}
type IncomeSources = IncomeSource[]
```
Default: `[]`

These replace the existing flat `i-{year}-{month}` manual income system. The old key stays for backwards compatibility — when loading a month's income, sum `income-sources` active amounts as the default, then apply any per-month income adjustments (see below).

---

### Per-month income adjustments
```
income-adjust-{year}-{month}
```
Value type:
```ts
type IncomeAdjustment = {
  sourceId: string     // references IncomeSource.id — or "manual" for one-off
  label: string        // human-readable reason
  amount: number       // absolute amount for this month (replaces, not adds to, the source amount)
  // amount: 0 means this source is removed for this month
}
type MonthIncomeAdjustments = IncomeAdjustment[]
```
Default: `[]`

---

### Scenarios
```
scenarios
```
Value type: see PRP-04 for full `Scenario` type. Store as `Scenario[]`.
Default: `[]`

---

### Savings goals
```
savings-goals
```
Value type: see PRP-05. Store as `SavingsGoal[]`.
Default: `[]`

---

## Updated `store` Helper

Replace the existing `store` object with this extended version:

```ts
const store = {
  async get(key) {
    try {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  },
  async set(key, val) {
    try {
      await window.storage.set(key, JSON.stringify(val));
    } catch {}
  },
  async delete(key) {
    try {
      await window.storage.delete(key);
    } catch {}
  },
  async list(prefix) {
    try {
      const r = await window.storage.list(prefix);
      return r ? r.keys : [];
    } catch { return []; }
  }
}
```

---

## New Utility Functions

Add these pure functions to the module. They are shared across all views.

### `resolveMonthBudget(globalBudgets, monthOverrides, categoryId)`
Returns the effective budget limit for a category in a given month.
```ts
function resolveMonthBudget(
  globalBudgets: GlobalBudgets,
  monthOverrides: MonthOverrides,
  categoryId: string
): number | null {
  // If override exists for this category this month, use it
  if (monthOverrides[categoryId] !== undefined) return monthOverrides[categoryId];
  // Otherwise fall back to global
  if (globalBudgets[categoryId] !== undefined) return globalBudgets[categoryId];
  // No budget set
  return null;
}
```

### `resolveMonthIncome(incomeSources, manualLegacy, monthAdjustments)`
Returns the effective total income for a month.
```ts
function resolveMonthIncome(
  incomeSources: IncomeSource[],
  manualLegacy: number,           // from old i-{year}-{month} key
  monthAdjustments: IncomeAdjustment[]
): number {
  if (incomeSources.length === 0) return manualLegacy; // backwards compat

  return incomeSources
    .filter(s => s.active)
    .reduce((sum, source) => {
      const adj = monthAdjustments.find(a => a.sourceId === source.id);
      return sum + (adj ? adj.amount : source.amount);
    }, 0);
}
```

### `getCategorySpend(transactions, categoryId)`
```ts
function getCategorySpend(transactions: Transaction[], categoryId: string): number {
  return transactions
    .filter(t => t.type === 'expense' && t.category === categoryId)
    .reduce((s, t) => s + t.amount, 0);
}
```

### `getBudgetStatus(spent, limit)`
```ts
type BudgetStatus = 'under' | 'warning' | 'over' | 'none'

function getBudgetStatus(spent: number, limit: number | null): BudgetStatus {
  if (limit === null) return 'none';
  const pct = spent / limit;
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'under';
}
```

---

## Migration on App Load

On app startup (inside the existing `useEffect` that loads years), run this migration once:

```ts
async function migrateStorage() {
  const migrated = await store.get('migration-v1');
  if (migrated) return;
  // Nothing to migrate yet — this hook exists for future migrations
  await store.set('migration-v1', true);
}
```

Call `migrateStorage()` before any other data loads.

---

## What Does NOT Change in This PRP

- No UI changes
- No new components
- `CATEGORIES`, `MONTHS`, `MONTHS_SHORT` constants stay identical
- `parseCSV` stays identical
- All existing storage keys (`t-{year}-{month}`, `i-{year}-{month}`, `budget-years`) stay and continue to work

---

## Acceptance Criteria

- [ ] `store.delete` and `store.list` are implemented and don't throw
- [ ] `resolveMonthBudget` returns override when present, global as fallback, null when neither set
- [ ] `resolveMonthIncome` returns `manualLegacy` when `incomeSources` is empty (backwards compat)
- [ ] `resolveMonthIncome` sums active sources, respects per-source adjustments
- [ ] `getBudgetStatus` returns `'warning'` at 80–99%, `'over'` at 100%+, `'none'` when limit is null
- [ ] Migration hook runs once on startup without errors
- [ ] No existing functionality is broken — import CSV, classify, month view, overview all still work
