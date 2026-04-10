# PRP-02: Budget Tab — Global Budgets & Month Overrides

## Status: Implement after PRP-01

## Overview
Add a "Budget" tab to the top navigation. This tab has two sections: **Category Budgets** (global monthly limits per category) and **Income Sources** (named income streams that replace the current single manual income field). Month views gain a budget override panel so users can deviate from global limits for a specific month without affecting other months.

---

## Prerequisites
- PRP-01 complete: `resolveMonthBudget`, `resolveMonthIncome`, storage keys all in place

---

## Navigation Changes

Add "Budget" as a permanent nav tab alongside "Overview". The tab order is:

```
Budget | Overview | [Month name if selected] | [Classify if active]
```

The "Budget" tab is always visible regardless of selected year/month.

In the existing nav bar `div`, add:
```jsx
<button
  className={`nav-tab ${view === 'budget' ? 'active' : ''}`}
  onClick={() => { setView('budget'); setMonth(null); }}
>
  Budget
</button>
```

Add `'budget'` as a valid value for the `view` state.

---

## App State Changes

Add to the root `App` component state:

```js
const [globalBudgets, setGlobalBudgets]   = useState({});      // GlobalBudgets
const [incomeSources, setIncomeSources]   = useState([]);      // IncomeSource[]
const [monthOverrides, setMonthOverrides] = useState({});      // { "year-month": MonthOverrides }
const [incomeAdjusts, setIncomeAdjusts]   = useState({});      // { "year-month": MonthIncomeAdjustment[] }
```

Load these in the existing startup `useEffect`:
```js
const gb  = await store.get('budget-global')    || {};
const is  = await store.get('income-sources')   || [];
setGlobalBudgets(gb);
setIncomeSources(is);
// monthOverrides and incomeAdjusts load lazily when a month is opened (same pattern as txns)
```

Add save helpers:
```js
const saveGlobalBudgets = async (data) => {
  setGlobalBudgets(data);
  await store.set('budget-global', data);
};

const saveIncomeSources = async (data) => {
  setIncomeSources(data);
  await store.set('income-sources', data);
};

const saveMonthOverride = async (year, month, data) => {
  const key = `${year}-${month}`;
  setMonthOverrides(prev => ({ ...prev, [key]: data }));
  await store.set(`budget-override-${year}-${month}`, data);
};

const saveIncomeAdjust = async (year, month, data) => {
  const key = `${year}-${month}`;
  setIncomeAdjusts(prev => ({ ...prev, [key]: data }));
  await store.set(`income-adjust-${year}-${month}`, data);
};
```

When a month is opened (in the existing month load effect), also load:
```js
const ovr = await store.get(`budget-override-${y}-${m}`);
const iadj = await store.get(`income-adjust-${y}-${m}`);
if (ovr)  monthOverrides[`${y}-${m}`] = ovr;
if (iadj) incomeAdjusts[`${y}-${m}`]  = iadj;
```

---

## New Component: `BudgetView`

Props:
```ts
{
  globalBudgets: GlobalBudgets
  incomeSources: IncomeSource[]
  onSaveGlobalBudgets: (data: GlobalBudgets) => void
  onSaveIncomeSources: (data: IncomeSource[]) => void
}
```

### Layout

Two-column layout (sidebar + main panel) on desktop, stacked on narrow viewports.

```
┌─────────────────────────────────────────────────────┐
│  Section tabs: [Category Budgets] [Income Sources]  │
├───────────────┬─────────────────────────────────────┤
│               │                                     │
│  Category     │  Edit panel for selected section    │
│  list         │                                     │
│  (sidebar)    │                                     │
│               │                                     │
└───────────────┴─────────────────────────────────────┘
```

### Section 1: Category Budgets

Left sidebar lists all 12 categories with their current global limit (or "No limit" in muted text). Clicking a category opens it in the right panel for editing.

Right panel (when category selected):
- Category name + color dot as heading
- Input field: "Monthly limit (CAD)" — number input, empty = no limit
- Helper text: "This applies to all months unless overridden in a specific month's view."
- Save button — calls `onSaveGlobalBudgets` with updated value
- Clear limit button — sets that category's key to undefined in globalBudgets

Display the total of all category budgets at the bottom of the sidebar:
```
Total budgeted: $X,XXX / month
```

### Section 2: Income Sources

This replaces the per-month manual income field with named, persistent income streams.

List view shows each source as a row:
```
● Chris salary          $8,500/mo    [Active]   [Edit] [Remove]
● Wife salary           $6,200/mo    [Active]   [Edit] [Remove]
```

"Add income source" button opens an inline form:
- Label (text input) — e.g. "Chris salary", "Freelance", "Rental income"
- Monthly amount (number input)
- Save / Cancel

Editing a source shows the same form pre-filled inline.

Removing a source prompts: "This will remove this income from all months that haven't been manually adjusted. Are you sure?" — a simple inline confirmation (not a modal, just a "Confirm remove / Cancel" swap on the button).

Toggle active/inactive per source — inactive sources are greyed out and excluded from income calculations but not deleted (useful for modelling "what if I lost this income" without touching scenarios).

Total of all active sources shown at bottom:
```
Combined monthly income: $14,700
```

---

## Month View Changes: Budget Override Panel

In `MonthView`, after the three KPI tiles (Income / Expenses / Net), add a collapsible **"Budget overrides for [Month]"** section.

Collapsed state (default): a single row reading:
```
Budget overrides  [N active overrides]  [▾ Expand]
```
If zero overrides: just `Budget overrides  [▾ Expand]`

Expanded state: a table listing all categories that have a global budget set, with columns:
```
Category | Global limit | This month | Status
Food     | $800         | $800       | (no override)
Travel   | $200         | $3,000     | Overridden ↩
```

Each row has an editable "This month" field (number input). If the value differs from global, show an orange "Override active" badge and a reset icon (↩) that restores global. If the user types a value that matches global exactly, the override is cleared automatically.

Changes call `saveMonthOverride(year, month, updatedOverrides)`.

### Income Override in Month View

Replace the existing flat income edit tile with a structured breakdown:

```
Income                           [Edit overrides ▾]

  Chris salary      $8,500
  Wife salary       $6,200
  ─────────────────────────
  Total             $14,700
```

When "Edit overrides" is expanded, each source shows:
- Its label and global amount
- A number input for "This month amount" (empty = use global)
- Setting to 0 explicitly means "no income from this source this month"
- A note field (optional): "On leave" / "Reduced hours"

Changes call `saveIncomeAdjust(year, month, adjustments)`.

The existing legacy `i-{year}-{month}` key continues to be read but is no longer written. If `incomeSources` is empty (no sources configured), fall back to the old flat input behaviour.

---

## Updated `monthData` Function

Update the `monthData(y, m)` helper in `App` to use the new resolution functions:

```js
const monthData = (y, m) => {
  const list        = txns[`${y}-${m}`]          || [];
  const legacyInc   = incomes[`${y}-${m}`]        || 0;
  const overrides   = monthOverrides[`${y}-${m}`] || {};
  const adjustments = incomeAdjusts[`${y}-${m}`]  || [];

  const totalIncome = resolveMonthIncome(incomeSources, legacyInc, adjustments);
  const expenses    = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const txnIncome   = list.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
  const effectiveIncome = totalIncome + txnIncome;

  return {
    list,
    totalIncome: effectiveIncome,
    expenses,
    net: effectiveIncome - expenses,
    overrides,      // pass through for MonthView to use
    adjustments,    // pass through for MonthView to use
  };
};
```

---

## Passing New Props Down

In `App`'s render, pass to `MonthView`:
```jsx
<MonthView
  ...existing props...
  globalBudgets={globalBudgets}
  incomeSources={incomeSources}
  monthOverrides={monthOverrides[`${year}-${month}`] || {}}
  incomeAdjustments={incomeAdjusts[`${year}-${month}`] || []}
  onSaveOverride={(data) => saveMonthOverride(year, month, data)}
  onSaveIncomeAdjust={(data) => saveIncomeAdjust(year, month, data)}
/>
```

Render `BudgetView` when `view === 'budget'`:
```jsx
{view === 'budget' && (
  <BudgetView
    globalBudgets={globalBudgets}
    incomeSources={incomeSources}
    onSaveGlobalBudgets={saveGlobalBudgets}
    onSaveIncomeSources={saveIncomeSources}
  />
)}
```

---

## Acceptance Criteria

- [ ] "Budget" tab appears in nav and renders `BudgetView`
- [ ] Setting a global budget for a category persists across page refreshes
- [ ] Setting limit to empty/zero clears the limit (not sets it to 0)
- [ ] Adding an income source persists; toggling active/inactive works
- [ ] Removing an income source removes it from the list immediately
- [ ] Month view shows budget overrides panel (collapsed by default)
- [ ] Override panel shows global limit alongside editable month limit
- [ ] Editing a month override and saving persists to `budget-override-{year}-{month}`
- [ ] Reset (↩) on an override row clears that category's override key
- [ ] Income breakdown in month view shows per-source rows when sources exist
- [ ] Setting a source to 0 for a month results in 0 contribution from that source
- [ ] Legacy `i-{year}-{month}` still works when no income sources are configured
- [ ] `monthData` total income reflects income sources + adjustments + txn income
