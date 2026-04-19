# PRP-12: Fix Transaction Double-Counting

## Status: Not started

## Dependencies

- PRP-11 complete (CC Payment category exists)

---

## Problem Summary

Two independent bugs cause transactions to be counted multiple times, inflating both income and expense totals.

---

## Bug 1 — Income sources + transaction income always summed

### Where

`BudgetTracker.jsx` — `monthData()` function, line 352:

```js
const totalIncome = resolveMonthIncome(incomeSources, legacyInc, adjustments, y, m);
const txnIncome = list.filter(t => (isIncomeCatLocal(t.category) || t.type === 'income') && !isCCPaymentCatLocal(t.category)).reduce((s,t) => s + t.amount, 0);
const effectiveIncome = totalIncome + txnIncome; // ← always adds both
```

### What goes wrong

`totalIncome` is the **planned** income derived from income sources (e.g. "Salary $5,000/mo"). `txnIncome` is the **actual** income pulled from imported transactions (e.g. a $5,000 paycheque deposit from a checking CSV classified as income type).

They are always added together. A user with income sources configured who also imports CSV files sees both counted simultaneously — income shows $10,000 instead of $5,000.

This also means the "Income plan vs actual" comparison row in MonthView is comparing income sources (planned) against income sources + transaction income (actual), which is incorrect.

### Root cause

Income sources were designed for planning/forecasting. Transaction income is the real observed data. They represent the same money and should not be summed — transaction income should take priority when it exists, and income sources should serve as a fallback for months with no imported data.

This is consistent with how `buildForecast` already works: for actual months it uses `actualIncome` (transactions only), for projected months it uses `plannedIncome` (income sources only).

### Fix

In `monthData()`, replace:

```js
const effectiveIncome = totalIncome + txnIncome;
```

With:

```js
// Use transaction income when available; income sources are planning-only fallback
const effectiveIncome = txnIncome > 0 ? txnIncome : totalIncome;
```

**Behaviour after fix:**

| Scenario | Before | After |
|---|---|---|
| Income sources set, no CSV imported | shows income sources ✓ | shows income sources ✓ |
| CSV imported, no income sources | shows transaction income ✓ | shows transaction income ✓ |
| Income sources set + CSV imported | shows sources + transactions (double) ✗ | shows transaction income only ✓ |
| CC-only CSV imported (no salary deposit) | shows income sources + CC receipt inflated ✗ | shows income sources (txnIncome = 0) ✓ |

---

## Bug 2 — Existing transactions not retroactively classified by rules

### What goes wrong

Rules only apply at import time — they do not update transactions already in storage. A user who:
1. Imported CSVs first
2. Created CC Payment rules later

...still has old transactions sitting in storage with `category: null` or a wrong category. Those transactions are counted in totals as if the CC Payment rule never existed:

- `TD VISA PREAUTH PYMT` (checking, type: expense, category: null) → counted in expenses
- Individual CC purchases (credit, type: expense, various categories) → counted in expenses
- `PREAUTHORIZED PAYMENT` (credit, type: income, category: null) → counted in income

The first and third are double-counting artefacts that CC Payment classification was meant to eliminate. The first causes expense totals to include both the CC payment debit AND all the individual CC transactions (same money counted twice).

### Fix — "Re-apply rules" button

Add a **Re-apply rules** button to `RulesView`. When clicked, it:

1. Iterates over every transaction across all stored months and all years
2. For each transaction, runs the same rule-matching logic used at import time:
   ```js
   const matchedRule = activeRules.find(r =>
     txn.description.toLowerCase().includes(r.trigger.toLowerCase())
   );
   ```
3. If a rule matches, updates `transaction.category` and `transaction.type` (income vs expense based on the matched category)
4. Saves the updated transaction arrays back to storage
5. Shows a summary: "X transactions reclassified across Y months"

The button requires an inline confirmation before running (same pattern used elsewhere in the app — no modals).

### Scope

- Applies to ALL years and months in `budget-years` storage key
- Only reclassifies transactions where a rule matches — unmatched transactions are left alone
- A transaction already correctly classified is overwritten only if a rule now matches it to a different (or more specific) category — last-matching rule wins, same as import
- Does not affect income source data, budget entries, or overrides

### Where the button lives

In `RulesView`, below the rules list — visually separated, styled with a warning-level border to signal it's a bulk operation:

```
─────────────────────────────────────────
Bulk actions
[Re-apply rules to all imported transactions]
"Runs your active rules against all stored transactions and updates their categories. X active rules."
```

### New prop and callback needed

`RulesView` needs access to all transaction data and a save callback. Currently it only receives `rules`, `categories`, and `onSaveRules`.

New props:
```js
allTxns       // the full txns state object from BudgetTracker
years         // array of known years, to know which keys to iterate
onReapply     // async (updatedTxns) => void — saves the full updated txns map
```

`BudgetTracker` wires up `onReapply`:
```js
const reapplyRules = async (updatedTxns) => {
  // Save each changed month back to storage
  for (const [key, list] of Object.entries(updatedTxns)) {
    const [y, m] = key.split('-').map(Number);
    await store.set(`t-${y}-${m}`, list);
  }
  setTxns(updatedTxns);
};
```

---

## Files changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | Fix `effectiveIncome` in `monthData()`; add `reapplyRules` helper; pass `allTxns`, `years`, `onReapply` to `RulesView` |
| `src/RulesView.jsx` | Add bulk actions section with Re-apply rules button + inline confirm + result summary |

No changes to `utils.js`, `MonthView.jsx`, `OverviewView.jsx`, or `ForecastView.jsx` — the income fix in `monthData` propagates through all views automatically since they all consume `monthData`.

---

## Acceptance Criteria

- [ ] A month with income sources configured AND a salary deposit transaction imported shows the transaction amount in the income tile, not sources + transaction
- [ ] The "Income plan vs actual" row in MonthView correctly compares income sources (planned) against transaction income (actual)
- [ ] OverviewView annual income tile reflects actual transaction income for imported months, not inflated totals
- [ ] "Re-apply rules" button exists in RulesView, visible below the rules list
- [ ] Clicking "Re-apply rules" shows inline confirmation before executing
- [ ] After confirming, all stored transactions matching active rules are updated to the correct category
- [ ] A result summary is shown ("X transactions reclassified")
- [ ] Transactions with no matching rule are unchanged
- [ ] `TD VISA PREAUTH PYMT` and `PREAUTHORIZED PAYMENT` are reclassified to CC Payment if those rules exist, and disappear from expense/income totals
- [ ] No regression in months with no income transactions (income sources still display correctly as fallback)
