# PRP-17: Numbers Consistency — Forecast Income, Budget Date Fix, Income Categories in MonthView

## Status: Done

## Dependencies

- PRP-16 complete (recurrence for all budget items; all EntryLists use `showRecurrence={true}` and YYYY-MM-DD date format)

---

## Problem Summary

Three related gaps/bugs:

1. **`resolveMonthBudget` date comparison bug** — After PRP-16, all budget entry forms use `type="date"` (YYYY-MM-DD). `resolveMonthBudget` compared `e.startDate <= key` where `key` is `"YYYY-MM"`. String `"2025-01-01" > "2025-01"` lexicographically, so full-date entries were silently skipped. This broke MonthView budget column, Forecast Planned Out, and `getBudgetStatus` for any newly-created entries.

2. **Forecast Planned In ignores income category budget entries** — `buildForecast` called `resolveMonthIncome(incomeSources, ...)` only, which reads `incomeSources[]`. Expected amounts set in Budget → Income (categories) tab (`budgetEntries[catId]`) were never included in the forecast's planned income.

3. **Income categories invisible in MonthView category table** — `MonthView.jsx` filtered out income categories from `parents` (`!c.isIncome`). Income transactions appeared in the transaction list but not in the category summary table.

---

## Fixes

### 1. utils.js — `resolveMonthBudget`

Replace direct string comparison with `_entryCoversMonth(e, key)`, which uses `.substring(0, 7)` and handles both `"YYYY-MM"` and `"YYYY-MM-DD"` format dates. `_entryCoversMonth` is a named function declaration (hoisted) defined later in the same file.

### 2. utils.js — `buildForecast`

After computing `incomeFromSources = resolveMonthIncome(...)`, also sum income category budget entries from `budgetEntries`:
```js
incomeFromCategories = sum of resolveMonthBudget for top-level income categories (non-CC-payment)
plannedIncome = incomeFromSources + incomeFromCategories
```

### 3. MonthView.jsx — income categories section

- Added `getIncomeCatActual(catId)` helper: sums income transactions for a category and its children.
- Added `incomeParents` variable: income parent categories (not CC payment).
- Added "Income" divider row + income category rows at the bottom of the category budget table `<tbody>`.
- Income rows show: category name, expected amount (from `resolveMonthBudget`), actual received, variance (`actual - expected`).
- Variance: green if positive or zero, danger if negative ("short").
- Status dot: green if actual ≥ expected, danger if below, neutral if no target set.
- Only rows with actual income OR a budget target set are rendered.

---

## Files Changed

| File | Change |
|---|---|
| `src/utils.js` | `resolveMonthBudget` uses `_entryCoversMonth`; `buildForecast` adds income category entries to `plannedIncome` |
| `src/MonthView.jsx` | `getIncomeCatActual` helper; `incomeParents` variable; income section in category table |

---

## Acceptance Criteria

- [ ] Budget → Outgoing: add period with full date (e.g. Jan 1, 2025) → MonthView Jan shows correct budget amount
- [ ] Forecast Planned Out reflects newly-created budget entries
- [ ] Budget → Income: set expected amount for income category → Forecast Planned In includes this amount
- [ ] Forecast Planned Net = Planned In - Planned Out, correct across all 12 months
- [ ] MonthView: income categories with actual income appear in a separate "Income" section at the bottom of the category table
- [ ] Income row shows green "+" variance when actual ≥ expected, red "short" when below
- [ ] No regressions: old YYYY-MM format entries still work; CSV import / classify / scenarios unbroken
- [ ] No console errors
