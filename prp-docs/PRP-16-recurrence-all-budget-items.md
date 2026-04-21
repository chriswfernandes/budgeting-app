# PRP-16: Recurrence for All Budget Items + Projected Expense Transactions

## Status: Done

## Dependencies

- PRP-15 complete (Income categories tab and Sources tab exist in BudgetView)

---

## Problem Summary

Two issues:

1. **Regression** — After PRP-15, the "Define recurrence pattern" option in budget period forms was only available in the Sources tab (`showRecurrence={true}`). The new Income categories tab and the existing Outgoing tab were missing the prop, so users could not define recurrence patterns for expense or income-category periods.

2. **Missing feature** — When a budget period has a recurrence pattern, MonthView should show those as projected transactions with exact dates — the same way income source recurrence already works. Users want Google-Calendar-level precision to see exactly when planned expenses or income will hit their account.

---

## Solution

### 1. BudgetView.jsx — add `showRecurrence={true}`

Pass `showRecurrence={true}` to `EntryList` in the Outgoing and Income categories tabs. The Sources tab already had this prop.

### 2. utils.js — generalize the expansion engine

Added `expandRecurringEntry(item, entry, viewStart, viewEnd)` where `item = { id, label, category, type }`. This is the generic form of the old `expandIncomePeriod`. The old function is kept as a thin backward-compatible wrapper.

Returned projected transaction objects now carry an explicit `type: 'income'|'expense'` field.

### 3. MonthView.jsx — projected category transactions

- Added `projectedCatTxns` useMemo: iterates `budgetEntries` for any entry with `recurrence.enabled`, calls `expandRecurringEntry` with category ID/label/type.
- Added `unfulfilledCatProjected` useMemo: suppresses projections fulfilled by a same-date, same-category, ±$1 actual transaction.
- Renamed `incomeViewMode` → `txnViewMode`.
- Updated `baseTxnList`: `'projected'` mode = all projected (income sources + categories); `'combined'` = all actuals + unfulfilled from both.
- Toggle now shows when any projected transactions exist (not just income source ones).
- Amount sign and color driven by `t.type` field (not `isProjected`).

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetView.jsx` | Add `showRecurrence={true}` to Outgoing and Income category `EntryList` |
| `src/utils.js` | Add `expandRecurringEntry`; rewrite `expandIncomePeriod` as wrapper; add `type` field to projected transaction objects |
| `src/MonthView.jsx` | Import `expandRecurringEntry`; add `projectedCatTxns` + `unfulfilledCatProjected`; rename `incomeViewMode` → `txnViewMode`; generalize baseTxnList and toggle; fix amount sign/color |

---

## Acceptance Criteria

- [ ] Budget → Outgoing: "Define recurrence pattern" checkbox appears in Add/Edit period form
- [ ] Budget → Income: "Define recurrence pattern" checkbox appears in Add/Edit period form
- [ ] Budget → Sources: recurrence form unchanged
- [ ] MonthView: projected expense transactions appear (dashed border, opacity 0.72, "projected" badge, minus sign, primary color)
- [ ] MonthView: projected income-category transactions appear with plus sign and green color
- [ ] Fulfillment suppression: a real transaction on the same date/category/amount removes the projected entry in combined mode
- [ ] Toggle (Actual/Projected/Combined) appears when any projected transactions exist
- [ ] Income source recurrence still works (Sources tab + MonthView)
- [ ] No console errors
