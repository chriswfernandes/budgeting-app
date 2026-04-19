# PRP-11: CC Payment Category

## Status: Not started

## Dependencies

- PRP-10 complete (time-bounded income sources)

---

## Problem

When importing both a checking account CSV and a credit card CSV, two transactions cancel each other out but are both counted as real money movement:

| Source | Description | Type | Amount |
|---|---|---|---|
| Checking CSV | TD VISA PREAUTH PYMT | Expense | –$1,200 |
| Credit card CSV | PREAUTHORIZED PAYMENT | Income | +$1,200 |

Neither of these represents actual spending or income — the checking debit pays off the credit card, and the credit card credit records that payment being received. The real expenses are the individual CC transactions already imported (food, shopping, etc.). Counting these payment entries inflates both expense and income totals.

---

## Solution

A dedicated built-in **CC Payment** category with a system-level `isCCPayment: true` flag. Any transaction tagged to this category is excluded from expense totals, income totals, and net calculations everywhere in the app. Both sides of the CC payment (checking outflow + CC inflow) get classified here and effectively disappear from the numbers.

The existing **Transfers** category is unchanged — it continues to count as an expense (users may legitimately use it for savings transfers or other movements they want to track).

---

## New category

Added to `INITIAL_CATEGORIES` in `BudgetTracker.jsx`:

```js
{ id: 'cc-payment', label: 'CC Payment', color: '#5F7A9E', isCCPayment: true }
```

This category is permanent and system-owned. It must not be deletable or renameable in `CategoriesView`.

---

## New utility: `isCCPaymentCat`

Added to `utils.js`, parallel to the existing `isIncomeCat`:

```js
export function isCCPaymentCat(categories, catId) {
  if (!catId) return false;
  const cat = categories.find(c => c.id === catId);
  return !!(cat?.isCCPayment);
}
```

---

## Exclusion points

Every place that sums expenses or income must filter out `isCCPayment` transactions:

| File | Location | Change |
|---|---|---|
| `BudgetTracker.jsx` | `monthData()` — expense filter | Add `&& !isCCPaymentCatLocal(t.category)` |
| `utils.js` | `buildForecast()` — `actualExpenses` filter | Add `&& !isCCPaymentCat(...)` |
| `utils.js` | `projectScenario()` — actual month expense filter | Add `&& !isCCPaymentCat(...)` |
| `MonthView.jsx` | Expense total in tfoot | Exclude CC Payment transactions |
| `MonthView.jsx` | Category table parent filter | Hide CC Payment from the budget-vs-actual rows |
| `OverviewView.jsx` | Monthly expense KPI tile | Exclude CC Payment transactions |

---

## MonthView display

CC Payment transactions are not shown in the main category spend table (they are not expenses). Instead, a neutral informational row appears below the category table:

```
CC Payments    $1,200    (excluded from totals)
```

This row has no status indicator, no budget bar, and no colour coding. It is shown only when the month has at least one CC Payment transaction.

---

## Auto-rule tip in RulesView

A dismissable tip banner appears at the top of the Rules list when no rule exists that maps to the `cc-payment` category:

> 💳 Tip: create a rule with trigger **"VISA PREAUTH PYMT"** → category **CC Payment** to automatically exclude credit card bill payments from your expense totals. You may also want a rule for **"PREAUTHORIZED PAYMENT"** to handle the matching entry on your credit card statement.

---

## What is NOT in scope

- Making `isCCPayment` configurable per-category in the UI (this is a system flag only)
- Any changes to how the Transfers category works
- Credit card billing cycle forecasting (that is a separate, later feature)

---

## Acceptance Criteria

- [ ] CC Payment category exists in the default category list and cannot be deleted
- [ ] Transactions classified as CC Payment do not appear in expense or income totals in MonthView, OverviewView, or ForecastView
- [ ] MonthView shows a neutral "CC Payments — excluded from totals" row when CC Payment transactions exist for that month
- [ ] Auto-classification rules pointing to CC Payment work correctly
- [ ] Tip banner appears in RulesView when no cc-payment rule exists
- [ ] No regression in existing expense/income calculations for non-CC-Payment categories
- [ ] The Transfers category behaviour is completely unchanged
