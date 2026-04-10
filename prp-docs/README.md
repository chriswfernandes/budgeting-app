# Budget Tracker — Product Roadmap

## Codebase context
Single-file React app: `BudgetTracker.jsx`
Storage: `window.storage` key-value API (persistent across sessions)
Stack: React with hooks, inline CSS, no external UI libraries, no router

---

## PRP Index

| # | Document | Summary | Depends on |
|---|---|---|---|
| 01 | `PRP-01-data-architecture.md` | Storage schema, shared utility functions, migration hook | — |
| 02 | `PRP-02-budget-tab.md` | Budget tab, global category limits, income sources, month override panel | PRP-01 |
| 03 | `PRP-03-budget-progress.md` | Progress bars, forecast warnings, over-budget indicators in month + overview | PRP-02 |
| 04 | `PRP-04-scenario-builder.md` | Scenario data model, projection engine, 4-step wizard, projection view | PRP-01, PRP-02 |
| 4.5 | `PRP-04.5-historical-data.md` | Historical data (previous years), year discovery during CSV import | — |
| 4.5.1 | `PRP-04.5.1-year-budgets.md` | Year-specific global budgets with migration | 4.5 |
| 4.5.2 | `PRP-04.5.2-advanced-classify.md` | Advanced classification UX, conditional rules, inline categories | 4.5.1 |
| 05 | `PRP-05-scenario-types.md` | 3 templates (savings goal, income loss, parental leave), EI estimator, break-even finder | PRP-04 |
| 06 | `PRP-06-comparison-apply.md` | Side-by-side comparison, sensitivity sliders, apply to plan, export | PRP-05 |

---

## Implementation order

```
PRP-01  →  PRP-02  →  PRP-03
                  ↘
                   PRP-04  →  PRP-05  →  PRP-06
                  ↘
                   PRP-04.5
```

PRP-03 and PRP-04 can be developed in parallel after PRP-02 is complete.

---

## Key design decisions (for agent context)

**Single file**: All components live in `BudgetTracker.jsx`. Do not split into multiple files unless explicitly instructed.

**No router**: View state is managed with a `view` string in React state (`'overview' | 'budget' | 'scenarios' | 'month' | 'classify'`). Use this pattern for all new views.

**Storage pattern**: All persistence goes through the `store` helper. Never call `window.storage` directly. Keys follow the patterns defined in PRP-01.

**No modals**: The app uses inline panels, collapsible sections, and drawer components. Never use `window.alert`, `window.confirm`, or `position: fixed` overlays. Confirmations are always inline JSX swaps.

**Pure projection engine**: `projectScenario()` is a pure function. It never reads from storage. All data it needs is passed as arguments.

**Backwards compatibility**: The old `i-{year}-{month}` income key must continue to work. When `incomeSources` is empty, fall back to the legacy key.

**Scenarios never mutate real data** (until explicitly applied via PRP-06's "Apply to plan" flow).

---

## Constants reference

```js
// Existing categories (do not rename IDs — they are storage keys)
['housing', 'food', 'transport', 'entertainment', 'shopping',
 'health', 'travel', 'utilities', 'subscriptions', 'income',
 'transfers', 'other']

// 2025 EI constants (PRP-05)
EI_MAX_WEEKLY_INSURABLE = 63200 / 52   // ~$1,215/week
EI_STANDARD_RATE = 0.55
EI_EXTENDED_RATE = 0.33
EI_MAX_WEEKLY_BENEFIT = 668
```

---

## Testing checklist (run after each PRP)

- [ ] CSV import still works (classify flow unbroken)
- [ ] Overview page renders all 12 months
- [ ] Month view opens and shows transactions
- [ ] No console errors on load
- [ ] `store.get('budget-years')` returns the years array
- [ ] Page refresh does not lose data
