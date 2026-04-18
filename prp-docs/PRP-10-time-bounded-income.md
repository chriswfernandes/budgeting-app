# PRP-10: Time-Bounded Income Sources

## Status: Not started

## Overview

Extends income sources with the same time-bounded entry model introduced for category budgets in PRP-09. Instead of a single static amount per income source, each source holds a list of `IncomeEntry` objects — each with an amount, a mandatory start month, and an optional end month. This lets the user record a salary change, a period of reduced hours, or a temporary contract without disturbing historical plan-vs-actual comparisons.

---

## Motivation

The current model stores one amount per income source. If your salary changes in June, updating the source retroactively changes every forecasted month. With time-bounded entries, you add a new entry starting June and the old entry's history stays intact.

---

## Data model change

### Updated `IncomeSource` type

```js
{
  id: string,
  label: string,
  active: boolean,
  entries: IncomeEntry[],   // NEW — replaces the top-level `amount` field
}
```

### New type: `IncomeEntry`

```js
{
  id: string,          // e.g. "ie-1714000000000"
  amount: number,      // monthly amount in CAD
  startDate: string,   // "YYYY-MM" — inclusive, mandatory
  endDate: string | null, // "YYYY-MM" — inclusive, null = open-ended
}
```

### Storage key

The same `income-sources` key is used. The shape of each record changes from  
`{ id, label, amount, active }` to `{ id, label, active, entries: [...] }`.

### Migration on load

When reading `income-sources` from storage, if any source has a top-level `amount` field and no `entries` array, convert it in-memory (and re-save) before mounting:

```js
const migrated = raw.map(s => {
  if (s.entries) return s;  // already new format
  const { amount, ...rest } = s;
  return {
    ...rest,
    entries: amount > 0
      ? [{ id: `ie-${Date.now()}-${Math.random()}`, amount, startDate: '2000-01', endDate: null }]
      : [],
  };
});
await store.set('income-sources', migrated);
```

This preserves existing data: an old `$8,500/mo` salary becomes a single open-ended entry starting January 2000, which resolves to `$8,500` for every month going forward.

---

## `resolveMonthIncome` changes

### New signature

```js
resolveMonthIncome(incomeSources, manualLegacy, monthAdjustments, year, month)
```

`year` and `month` (0-indexed) are added at the end so existing call sites that pass only three arguments continue to work safely — if `year` is `undefined`, fall back to the old flat `source.amount` field so nothing breaks before all call sites are updated.

### Implementation

```js
export function resolveMonthIncome(incomeSources, manualLegacy, monthAdjustments, year, month) {
  if (!incomeSources || incomeSources.length === 0) return manualLegacy;

  return incomeSources
    .filter(s => s.active)
    .reduce((sum, source) => {
      // Month-level adjustment wins
      const adj = (monthAdjustments || []).find(a => a.sourceId === source.id);
      if (adj) return sum + adj.amount;

      // Time-bounded entry
      if (source.entries && year !== undefined) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const entry = source.entries.find(e =>
          e.startDate <= key && (e.endDate === null || e.endDate >= key)
        );
        return sum + (entry ? entry.amount : 0);
      }

      // Legacy fallback (source.amount, no entries)
      return sum + (source.amount || 0);
    }, 0);
}
```

### Call site updates

Four call sites need `year` and `month` added:

| File | Location | What to add |
|---|---|---|
| `BudgetTracker.jsx` | `monthData(y, m)` helper | `resolveMonthIncome(incomeSources, legacyInc, adjustments, y, m)` |
| `MonthView.jsx` | `plannedIncome` calculation | `resolveMonthIncome(incomeSources, 0, incomeAdjustments, year, month)` |
| `utils.js` | `buildForecast` loop | `resolveMonthIncome(incomeSources, 0, adjustments, year, m)` |
| `utils.js` | `projectScenario` (if it calls resolveMonthIncome) | add `year, m` |

---

## `BudgetView.jsx` — Income tab redesign

The Income tab adopts the same two-column layout as the Outgoing tab: a sidebar listing all sources on the left, and a right panel that shows the selected source's entries.

### Left sidebar

Each row shows:
- Toggle (active/inactive) — unchanged
- Source label
- Resolved amount for the current month (or "No active entry" in muted text if no entry covers today)

At the bottom of the sidebar:
```
Active this month: $X,XXX
```
(sum of `resolveMonthIncome` for current year + current calendar month)

A "Add income source" button at the top of the sidebar opens an inline form **in the right panel** for a new source.

### Right panel — new source form

When adding a new source, the right panel shows:

```
Label          [                    ]
               [Save]  [Cancel]
```

Label is required. The source is created with `entries: []` (empty). After saving, the source is selected and the user is taken directly to the entry list where they can add their first entry.

### Right panel — existing source selected

Header: source label with edit-in-place (click to rename). Below the header, an active/inactive toggle.

Entry table:

```
┌──────────────┬───────────────┬───────────┬──────────────────┐
│  From        │  To           │  Amount   │                  │
│  Jan 2000    │  (onwards)    │  $8,500   │ [Edit] [Delete]  │
│  Jun 2025    │  (onwards)    │  $9,200   │ [Edit] [Delete]  │
└──────────────┴───────────────┴───────────┴──────────────────┘
```

"No end date" entries display as "onwards" in the To column. Entries are sorted by `startDate` ascending.

Below the table, an "Add entry" button opens an inline form:

```
Monthly amount (CAD)  [          ]
Start month           [month picker]   ← mandatory
End month             [month picker]   [✓] No end date
                      [Save]  [Cancel]
```

#### Validation rules

Same rules as PRP-09 budget entries:
1. **Overlap** (blocking): if the proposed date range overlaps an existing entry for the same source, show: "This period overlaps with [startDate] – [endDate or 'onwards']. Adjust the dates."
2. **Gap** (informational): if a gap exists between entries, a muted note below the table reads: "No income entry covers [month range]."

#### Delete

Clicking Delete shows inline confirmation on that row: "Delete this entry? [Confirm] [Cancel]".

#### Remove source

A "Remove source" button (danger style) at the bottom of the right panel. Inline confirmation: "Remove [label] and all its entries? [Confirm] [Cancel]". Matches the existing `window.confirm` pattern in spirit but stays inline.

---

## What this PRP does NOT change

- Month-level income adjustments (`income-adjust-{year}-{month}`) — unchanged, still take priority
- Legacy `i-{year}-{month}` fallback for months before income sources were configured
- Category budget logic (PRP-09)
- Any other view or data model

---

## Dependency

This PRP depends on PRP-09 being implemented first, because:
- The `budget-entries` state and `saveBudgetEntries` helper in `BudgetTracker.jsx` need to exist before this PRP replaces the parallel income structure
- The BudgetView two-column layout introduced in PRP-09's Outgoing tab is reused here for consistency

If PRP-09 and PRP-10 are implemented together in a single session, the `BudgetView` layout only needs to be built once.

---

## Acceptance Criteria

- [ ] Existing income sources with a flat `amount` are migrated to a single open-ended entry on load
- [ ] `resolveMonthIncome` returns the correct time-bounded amount for a given year+month
- [ ] Month-level adjustments still override time-bounded entries
- [ ] Income tab sidebar shows resolved current-month amount per source
- [ ] Right panel lists entries with From / To / Amount columns
- [ ] Overlap validation blocks saving conflicting date ranges
- [ ] "No end date" entries display as "onwards"
- [ ] Adding, editing, and deleting entries persists correctly to `income-sources`
- [ ] Renaming a source works inline
- [ ] Active/inactive toggle on source still disables all entries for that source
- [ ] `buildForecast` planned income reflects time-bounded entries for each forecast month
- [ ] MonthView plan-vs-actual income row reflects time-bounded amount
- [ ] No regressions in existing month-level income adjustments or legacy income fallback
