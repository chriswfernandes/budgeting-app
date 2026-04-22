# Budget Tracker — Product Roadmap

## Codebase context
Single-file React app: `BudgetTracker.jsx`
Storage: `window.storage` key-value API (persistent across sessions)
Stack: React with hooks, inline CSS, no external UI libraries, no router

---

## PRP Index

| # | Document | Status | Summary | Depends on |
|---|---|---|---|---|
| 01 | `PRP-01-data-architecture.md` | ✅ Done | Storage schema, shared utility functions, migration hook | — |
| 02 | `PRP-02-budget-tab.md` | ✅ Done | Budget tab, global category limits, income sources, month override panel | PRP-01 |
| 03 | `PRP-03-budget-progress.md` | ✅ Done | Progress bars, forecast warnings, over-budget indicators in month + overview | PRP-02 |
| 04 | `PRP-04-scenario-builder.md` | ✅ Done | Scenario data model, projection engine, 4-step wizard, projection view | PRP-01, PRP-02 |
| 4.5 | `PRP-04.5-historical-data.md` | ✅ Done | Historical data (previous years), year discovery during CSV import | — |
| 4.5.1 | `PRP-04.5.1-year-budgets.md` | ✅ Done | Year-specific global budgets with migration | 4.5 |
| 4.5.2 | `PRP-04.5.2-advanced-classify.md` | ✅ Done | Advanced classification UX, conditional rules, inline categories | 4.5.1 |
| 11 | `PRP-11-cc-payment-category.md` | ✅ Done | CC Payment system category; excluded from all expense/income totals | — |
| 12 | `PRP-12-double-counting-fix.md` | ✅ Done | Fix income source + txn income double-count; Re-apply rules button | PRP-11 |
| 13 | `PRP-13-cc-payment-flag-migration.md` | ✅ Done | Fix missing isCCPayment flag in stored categories; re-apply rules cross-year; CategoriesView system guard | PRP-11, PRP-12 |
| 14 | `PRP-14-budget-tab-filtering-and-categories-cleanup.md` | ✅ Done | Fix Outgoing tab showing income categories; remove dead Target field from CategoriesView | PRP-13 |
| 15 | `PRP-15-income-categories-budget-tab.md` | ✅ Done | Add Income tab to Budget view for income categories; rename Sources tab | PRP-14 |
| 16 | `PRP-16-recurrence-all-budget-items.md` | ✅ Done | Recurrence patterns for Outgoing + Income category tabs; projected expense transactions in MonthView | PRP-15 |
| 17 | `PRP-17-numbers-consistency.md` | ✅ Done | Fix `resolveMonthBudget` full-date bug; Forecast includes income category entries; income categories in MonthView table | PRP-16 |
| 18 | `PRP-18-ui-redesign-sidebar-header.md` | ✅ Done | Left sidebar nav; two-row top header with year selector + month carousel; Import CSV in header | — |
| 18.5 | `PRP-18.5-month-view-sidebar.md` | ✅ Done | Month View moved to sidebar as expandable section; carousel removed from header | PRP-18 |
| 20 | `PRP-20-sidebar-tab-order.md` | ✅ Done | Reorder sidebar tabs: Overview → Forecast → Budget → Scenarios | PRP-18 |
| 21 | `PRP-21-design-system-shell.md` | 🔲 Not started | New color tokens (emerald), Inter font, card shadows, top nav + settings shell, month sub-nav | PRP-19, PRP-20 |
| 22 | `PRP-22-overview-redesign.md` | ✅ Done | Hero KPIs with sparklines, Recharts stacked bar chart, month card refresh | PRP-21 |
| 23 | `PRP-23-month-view-redesign.md` | ✅ Done | Hero KPIs, horizontal category spend bar chart (Recharts) | PRP-21, PRP-22 |
| 24 | `PRP-24-forecast-redesign.md` | ✅ Done | Replace SVG chart with Recharts AreaChart (solid actual, dashed projected) | PRP-21, PRP-22 |
| 25 | `PRP-25-budget-redesign.md` | ✅ Done | Category amount badges, donut chart showing budget allocation slice | PRP-21, PRP-22 |
| 26 | `PRP-26-scenarios-redesign.md` | ✅ Done | Card refresh, multi-scenario comparison chart, projection AreaChart | PRP-21, PRP-22 |
| 27 | `PRP-27-settings-shell.md` | ✅ Done | Settings shell nav, Classify progress bar, RulesView/CategoriesView polish | PRP-21 |
| 05 | `PRP-05-month-view-plan-vs-actual.md` | 🔲 Not started | Categories above the fold in MonthView; plan vs. actual columns; collapsible transaction list | PRP-02, PRP-03 |
| 06 | `PRP-06-annual-forecast.md` | 🔲 Not started | Annual Forecast tab: planned vs. actual per month, running projected balance, SVG chart | PRP-05 |
| 07 | `PRP-07-account-balance-tracking.md` | 🔲 Not started | Parse balance column from checking CSVs; store per month; display in Overview, Month, Forecast | PRP-06 |

---

## Implementation order

```
PRP-01  →  PRP-02  →  PRP-03  →  PRP-04
                                 ↘
                                  PRP-04.5  →  PRP-04.5.1  →  PRP-04.5.2
                                                                ↓
                                                           PRP-05  →  PRP-06  →  PRP-07
```

PRP-05, PRP-06, and PRP-07 build on each other and should be implemented in order.

---

## Deferred / archived PRPs

The following PRPs were scoped but superseded by the above roadmap. They are kept for reference.

| File | Was | Why deferred |
|---|---|---|
| `PRP-05-cash-flow-and-calendar-engine.md` | Old PRP-05 | Scheduling/calendar engine — useful later but not the current priority |
| `PRP-06-comparison-apply.md` | Old PRP-06 | Scenario comparison, sensitivity sliders, apply-to-plan — revisit after PRP-07 |

---

## Key design decisions (for agent context)

**Single file**: All components live in `BudgetTracker.jsx`. Do not split into multiple files unless explicitly instructed.

**No router**: View state is managed with a `view` string in React state (`'overview' | 'budget' | 'scenarios' | 'month' | 'classify'`). Use this pattern for all new views.

**Storage pattern**: All persistence goes through the `store` helper. Never call `window.storage` directly. Keys follow the patterns defined in PRP-01.

**No modals**: The app uses inline panels, collapsible sections, and drawer components. Never use `window.alert`, `window.confirm`, or `position: fixed` overlays. Confirmations are always inline JSX swaps.

**Pure projection engine**: `projectScenario()` is a pure function. It never reads from storage. All data it needs is passed as arguments.

**Backwards compatibility**: The old `i-{year}-{month}` income key must continue to work. When `incomeSources` is empty, fall back to the legacy key.

**Scenarios never mutate real data** (until explicitly applied via the deferred "Apply to plan" flow from the old PRP-06).

---

## Constants reference

```js
// Existing categories (do not rename IDs — they are storage keys)
['housing', 'food', 'transport', 'entertainment', 'shopping',
 'health', 'travel', 'utilities', 'subscriptions', 'income',
 'transfers', 'other']
```

---

## Testing checklist (run after each PRP)

- [ ] CSV import still works (classify flow unbroken)
- [ ] Overview page renders all 12 months
- [ ] Month view opens and shows transactions
- [ ] No console errors on load
- [ ] `store.get('budget-years')` returns the years array
- [ ] Page refresh does not lose data
