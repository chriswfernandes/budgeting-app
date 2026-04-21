# PRP-15: Budget Tab Income Categories

## Status: Done

## Dependencies

- PRP-14 complete (`isIncomeCat`, `isCCPaymentCat` imported in BudgetView; income categories excluded from Outgoing tab)

---

## Problem Summary

Income categories (`categories[]` with `isIncome: true`) — such as the built-in "income" category and user-created children like "Chris's Income" — are visible in CategoriesView but completely absent from the Budget tab. The Budget tab's Income sub-tab exclusively shows `incomeSources` (named planning streams), which is a separate construct.

This is asymmetric: the Outgoing tab lets users set budget limits for every expense category, but there is no equivalent surface for income categories. Users who create income categories expect to manage expected amounts for them in the Budget tab.

---

## Solution

Restructure the Budget tab from 2 tabs to 3 tabs:

| Tab | Description |
|---|---|
| **Outgoing** | Expense categories with budget limit entries (unchanged) |
| **Income** | Income categories with expected-amount entries (new) |
| **Sources** | Named income streams with recurrence (existing, renamed from "Income") |

The new Income tab mirrors the Outgoing tab exactly: income categories sidebar on the left, `EntryList` on the right for period-based expected monthly amounts. Storage uses the same `budgetEntries` object — category IDs are valid keys regardless of whether they are income or expense categories.

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetView.jsx` | Add `selectedIncomeCatId` state; add `activeIncomeCatTotal` helper; add "Income" tab button; add Income categories tab JSX block; rename existing "income" tab condition to "sources" and button label to "Sources" |
| `prp-docs/README.md` | Add PRP-15 entry |

---

## Acceptance Criteria

- [ ] Budget tab shows three tabs: Outgoing, Income, Sources
- [ ] Income tab sidebar lists all income categories (those where `isIncomeCat` returns true), excluding CC Payment
- [ ] Child income categories appear indented (same `marginLeft` rule as Outgoing tab)
- [ ] Selecting an income category shows EntryList — user can add/edit/delete budget periods
- [ ] Period data persists across navigation (stored in `budgetEntries` under the category ID)
- [ ] "Expected this month" footer shows sum of active income category budget entries for current month
- [ ] Sources tab retains all existing income source functionality (recurrence, labels, entries, toggle)
- [ ] Outgoing tab is unchanged — income categories do not appear there
- [ ] No console errors
