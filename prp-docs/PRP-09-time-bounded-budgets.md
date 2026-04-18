# PRP-09: Time-Bounded Category Budgets

## Status: Not started

## Overview

Replace the current single-value global budget per category with a list of time-bounded budget entries. Each entry has an amount, a mandatory start month, and an optional end month. Multiple entries per category are allowed as long as they don't overlap. This lets the user set `$100/mo on Groceries` from Jan–May, then `$120/mo` from June onwards, without retroactively changing their historical plan-vs-actual comparisons.

The Outgoing sub-tab is also renamed from "Category Budgets" to "Outgoing", and the Income sub-tab renamed from "Income Sources" to "Income".

---

## Motivation

The current model stores one number per category per year (`budget-global-{year}`). If you update that number mid-year, every month in that year is affected — including months you've already tracked. Time-bounded entries fix this by letting the user say explicitly "this limit applies from month X to month Y".

---

## Data model change

### New type: `BudgetEntry`

```js
{
  id: string,          // e.g. "be-1714000000000"
  amount: number,      // monthly limit in CAD
  startDate: string,   // "YYYY-MM" — inclusive, mandatory
  endDate: string | null, // "YYYY-MM" — inclusive, null = open-ended (applies forever)
}
```

### New storage key

| Key | Value |
|---|---|
| `budget-entries` | `{ [categoryId]: BudgetEntry[] }` |

This is a single global key — not per-year. Each category's array is sorted by `startDate` ascending.

The old per-year keys (`budget-global`, `budget-global-{year}`) are **abandoned**. Because this is an active dev project with no important historical budget data, no migration is required. Month-level overrides (`budget-override-{year}-{month}`) are **unchanged** — they continue to take precedence over the time-bounded global entries.

### Resolution logic

`resolveMonthBudget` signature changes from:
```js
resolveMonthBudget(globalBudgets, monthOverrides, categoryId)
```
to:
```js
resolveMonthBudget(budgetEntries, monthOverrides, categoryId, year, month)
```

Implementation:
```js
export function resolveMonthBudget(budgetEntries, monthOverrides, categoryId, year, month) {
  // Month override wins
  if (monthOverrides && monthOverrides[categoryId] !== undefined) {
    return monthOverrides[categoryId];
  }
  // Find the active time-bounded entry
  const entries = budgetEntries?.[categoryId] || [];
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  const entry = entries.find(e =>
    e.startDate <= key && (e.endDate === null || e.endDate >= key)
  );
  return entry ? entry.amount : null;
}
```

**Note:** `month` is 0-indexed (consistent with the rest of the codebase). The comparison uses the `YYYY-MM` string format which sorts lexicographically correctly.

---

## State changes in `BudgetTracker.jsx`

### Remove
- `globalBudgets` state
- `saveGlobalBudgets(data)` helper
- All `store.get('budget-global')` and `store.get('budget-global-{year}')` loads
- `onSaveGlobalBudgets` prop threading

### Add
```js
const [budgetEntries, setBudgetEntries] = useState({});

const saveBudgetEntries = async (data) => {
  setBudgetEntries(data);
  await store.set('budget-entries', data);
};
```

Load in the startup `useEffect`:
```js
const be = await store.get('budget-entries') || {};
setBudgetEntries(be);
```

### Prop threading

Pass `budgetEntries` and `onSaveBudgetEntries={saveBudgetEntries}` to `BudgetView`.

Replace every `globalBudgets` prop with `budgetEntries` in:
- `MonthView` (receives `budgetEntries`, passes down to `resolveMonthBudget` calls with `year, month`)
- `OverviewView` (same)
- `ForecastView` (same, in `buildForecast` call)

All `buildForecast` and `projectScenario` call sites that receive `globalBudgets` are updated to `budgetEntries`.

---

## `utils.js` changes

### `resolveMonthBudget`

New signature and implementation as described above. All four existing call sites change:

| File | Old call | New call |
|---|---|---|
| `MonthView.jsx` | `resolveMonthBudget(globalBudgets, monthOverrides, catId)` | `resolveMonthBudget(budgetEntries, monthOverrides, catId, year, month)` |
| `OverviewView.jsx` (×2) | `resolveMonthBudget(globalBudgets, monthOverrides[key], c.id)` | `resolveMonthBudget(budgetEntries, monthOverrides[key], c.id, year, i)` |
| `utils.js` buildForecast | `resolveMonthBudget(globalBudgets, overrides, c.id)` | `resolveMonthBudget(budgetEntries, overrides, c.id, year, m)` |
| `utils.js` projectScenario | `resolveMonthBudget(globalBudgets, allOverrides[key], cat.id)` | `resolveMonthBudget(budgetEntries, allOverrides[key], cat.id, year, m)` |

### `buildForecast`

Signature changes from `(year, startingBalance, incomeSources, globalBudgets, ...)` to `(year, startingBalance, incomeSources, budgetEntries, ...)`.

---

## `BudgetView.jsx` changes

### Props

```js
export default function BudgetView({
  categories,
  budgetEntries,
  onSaveBudgetEntries,
  incomeSources,
  onSaveIncomeSources,
  year,
})
```

### Tab labels

| Current | New |
|---|---|
| "Category Budgets" | "Outgoing" |
| "Income Sources" | "Income" |

Tab state key renames from `'categories'` / `'income'` to `'outgoing'` / `'income'`.

---

## Outgoing tab — new UI

### Left sidebar (unchanged structure, new display)

Shows all non-income categories. Instead of a single `fmt(globalBudgets[c.id])` value, show the count of budget entries:

- If 0 entries: "No limit" (muted)
- If 1 open-ended entry: show the amount, e.g. "$100"
- If multiple entries or a bounded entry: show count, e.g. "2 periods"

Clicking a category opens its entries in the right panel.

The sidebar total row changes to: "Active this month: $X" — sum of `resolveMonthBudget(budgetEntries, {}, c.id, year, currentMonth)` across all categories where a value exists.

### Right panel

#### When no category selected

Prompt text: "Select a category to manage its budget periods."

#### When a category is selected

Header: category name + color dot (same as current).

Below the header, a list of existing budget entries for that category, sorted by `startDate`:

```
┌─────────────────────────────────────────────────┐
│  From     │  To           │  Amount   │         │
│  Jan 2025 │  May 2025     │  $100/mo  │ [Edit] [Delete] │
│  Jun 2025 │  (open-ended) │  $120/mo  │ [Edit] [Delete] │
└─────────────────────────────────────────────────┘
```

"No end date" is displayed as "onwards" in the To column.

Below the table, an "Add period" button opens an inline form (replaces the current simple input):

```
Monthly limit (CAD)   [          ]
Start month           [month picker]   ← mandatory
End month             [month picker]   [✓] No end date
                      [Save]  [Cancel]
```

#### Inline add/edit form fields

- **Monthly limit**: `<input type="number" min="0" step="0.01">` — required, must be > 0
- **Start month**: `<input type="month">` — required (renders as YYYY-MM picker in browser)
- **End month**: `<input type="month">` — disabled when "No end date" is checked
- **"No end date" checkbox**: defaults to checked for new entries

#### Validation rules

On Save, check the proposed `[newStart, newEnd]` against existing entries for the selected category (excluding the entry being edited):

1. **Gap check** (informational, not blocking): if there is a gap between two entries, a muted note says "Note: no budget is set for [month range]." This is not an error.
2. **Overlap check** (blocking): two entries overlap if `A.startDate <= (B.endDate ?? "9999-12")` AND `(A.endDate ?? "9999-12") >= B.startDate`. Show an inline error: "This period overlaps with an existing entry ([startDate] – [endDate]). Adjust the dates before saving."

#### Delete

Clicking Delete on a row shows an inline confirmation on the row: "Delete this period? [Confirm] [Cancel]" — no modal.

---

## Month-level overrides (unchanged)

The `budget-override-{year}-{month}` overrides in MonthView are **not changed by this PRP**. They continue to work the same way — a specific month can still be set to a different value which takes precedence over the time-bounded global entry.

---

## Implementation order

1. Update `resolveMonthBudget` in `utils.js` (new signature + logic)
2. Update `buildForecast` and `projectScenario` call sites in `utils.js`
3. Update `BudgetTracker.jsx`: replace `globalBudgets` state with `budgetEntries`, update all prop threading
4. Update `MonthView.jsx`, `OverviewView.jsx`, `ForecastView.jsx` call sites
5. Rewrite `BudgetView.jsx` Outgoing tab with the new entry list + form UI

---

## What this PRP does NOT change

- Income Sources tab (no changes to income model)
- Month-level budget overrides
- Category definitions or hierarchy
- Any transaction data
- Forecast or scenario logic beyond the `resolveMonthBudget` signature change

---

## Acceptance Criteria

- [ ] `budget-entries` is the storage key; old `budget-global-*` keys are no longer read or written
- [ ] Tabs are labelled "Outgoing" and "Income"
- [ ] Category sidebar shows entry count or active amount
- [ ] Right panel lists existing entries in a table with Edit and Delete per row
- [ ] "Add period" form includes amount, start month (required), end month (optional)
- [ ] Overlapping entries are rejected with an inline error message
- [ ] "No end date" entries display as "onwards" in the table
- [ ] Deleting an entry requires inline confirmation
- [ ] `resolveMonthBudget` correctly returns the active entry's amount for a given year+month
- [ ] Month-level overrides still take precedence over time-bounded entries
- [ ] MonthView plan-vs-actual column reflects the correct time-bounded budget
- [ ] OverviewView budget status badges remain correct
- [ ] ForecastView planned expenses reflect time-bounded entries
- [ ] No regressions in income tab, month overrides, or scenario projection
