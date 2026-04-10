# PRP-04: Scenario Builder — Core Engine

## Status: Implement after PRP-02 (can be parallel with PRP-03)

## Overview
Add a "Scenarios" section to the app. Users can create named "what-if" scenarios with a time window, income modifications, and expense modifications. The engine projects monthly financials for each scenario month by month. Scenarios never modify real transaction or budget data — they are always a parallel layer.

---

## Prerequisites
- PRP-01: Storage schema, `resolveMonthIncome`, `resolveMonthBudget` in place
- PRP-02: `incomeSources`, `globalBudgets` in state

---

## Data Model

Add these types to the module (as JSDoc or comments):

```ts
type ScenarioIncomeChange = {
  sourceId: string      // references IncomeSource.id, or 'new' for a new source in the scenario
  label: string         // display name
  monthlyAmount: number // 0 = removed entirely
  isNew?: boolean       // true if this source doesn't exist in real incomeSources
}

type ScenarioCategoryChange = {
  categoryId: string
  monthlyLimit: number  // new spend limit for this category during scenario window
  // Note: this is a budget limit change, not a spend injection
}

type ScenarioOneOffCost = {
  id: string
  label: string         // e.g. "Nursery setup", "Vacation flights"
  amount: number        // one-time cost in CAD
  month: number         // 0-indexed month index (relative to scenario start) when this hits
}

type Scenario = {
  id: string                              // uuid
  name: string                            // e.g. "Maternity leave 2026"
  description: string                     // optional notes
  color: string                           // hex, chosen by user from a palette
  startYear: number
  startMonth: number                      // 0-indexed
  endYear: number
  endMonth: number                        // 0-indexed, inclusive
  incomeChanges: ScenarioIncomeChange[]
  categoryChanges: ScenarioCategoryChange[]
  oneOffCosts: ScenarioOneOffCost[]
  savingsTarget?: number                  // optional: target to have saved by end of scenario
  floorAmount?: number                    // optional: never let projected balance drop below this
  createdAt: string                       // ISO date
  status: 'active' | 'archived'
}
```

Store all scenarios in `window.storage` under key `scenarios` as `Scenario[]`.

---

## Projection Engine

This is a pure function — no side effects, no storage access. It takes the current real data and a scenario and returns projected monthly summaries.

```ts
type ProjectedMonth = {
  year: number
  month: number          // 0-indexed
  label: string          // "Jan 2026"
  income: number         // projected total income after scenario changes
  expenses: number       // projected total expenses (actuals if past, budget limits if future)
  oneOffCosts: number    // sum of one-off costs landing in this month
  net: number            // income - expenses - oneOffCosts
  cumulativeNet: number  // running sum from scenario start
  isBelowFloor: boolean  // true if cumulativeNet < scenario.floorAmount
  isActual: boolean      // true if this month has real transaction data
}

function projectScenario(
  scenario: Scenario,
  incomeSources: IncomeSource[],
  globalBudgets: GlobalBudgets,
  allTxns: { [key: string]: Transaction[] },
  allIncomeAdjusts: { [key: string]: IncomeAdjustment[] },
  allOverrides: { [key: string]: MonthOverrides }
): ProjectedMonth[]
```

### Implementation logic

Iterate over every month in the scenario window (`startYear/startMonth` → `endYear/endMonth` inclusive):

**For each month:**

1. **Income**: Start with the real income sources. Apply scenario `incomeChanges` — replace the monthly amount for any matching `sourceId`. For sources with `isNew: true`, add them as an additional source. Sum all resulting active sources.

2. **Expenses**: 
   - If the month has real transactions (`allTxns[key]`), sum actual expense transactions — this is ground truth.
   - If the month has no transactions yet (future month), use the sum of all category budget limits (global, overridden by month overrides, then overridden by scenario `categoryChanges`). If a category has no budget set, contribute $0 (we don't know projected spend).
   - Apply scenario `categoryChanges` to the budget limits used for projection.

3. **One-off costs**: Sum any `ScenarioOneOffCost` items whose `month` index (relative to scenario start) matches this iteration index.

4. **Net**: `income - expenses - oneOffCosts`

5. **CumulativeNet**: Running sum of `net` from the first month.

6. **isBelowFloor**: `cumulativeNet < (scenario.floorAmount ?? -Infinity)`

Return the array of `ProjectedMonth`.

### Helper: month iteration

```js
function iterateMonths(startYear, startMonth, endYear, endMonth) {
  const months = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}
```

---

## App State Changes

Add to root `App`:
```js
const [scenarios, setScenarios] = useState([]);

// Load on startup:
const sc = await store.get('scenarios') || [];
setScenarios(sc);

// Save helper:
const saveScenarios = async (data) => {
  setScenarios(data);
  await store.set('scenarios', data);
};
```

---

## Navigation Changes

Add a "Scenarios" nav tab. It appears permanently alongside Budget and Overview.

Tab order:
```
Budget | Overview | Scenarios | [Month name] | [Classify]
```

Add `'scenarios'` as a valid `view` value.

---

## New Component: `ScenariosView`

Props:
```ts
{
  scenarios: Scenario[]
  incomeSources: IncomeSource[]
  globalBudgets: GlobalBudgets
  allTxns: object
  allIncomeAdjusts: object
  allOverrides: object
  onSave: (scenarios: Scenario[]) => void
}
```

### Layout: Scenario List (default state)

When no scenario is being edited:

```
┌─────────────────────────────────────────────────────┐
│  Scenarios                          [+ New scenario] │
├─────────────────────────────────────────────────────┤
│  ● Maternity leave 2026                             │
│    Apr 2026 → Mar 2027  ·  12 months                │
│    -$6,200/mo income  ·  +$3,410 EI                 │
│    [View projection]  [Edit]  [Archive]              │
├─────────────────────────────────────────────────────┤
│  ● Vacation fund — June                             │
│    Jan 2026 → Jun 2026  ·  6 months                 │
│    $4,000 one-off cost                              │
│    [View projection]  [Edit]  [Archive]              │
└─────────────────────────────────────────────────────┘
```

Each scenario card shows:
- Colour dot + name
- Date range + duration in months
- 1–2 line summary of the key changes
- Action buttons: View projection, Edit, Archive

Empty state (no scenarios):
```
No scenarios yet.
Scenarios let you model "what if" questions without touching your real data.
[+ Create your first scenario]
```

---

## New Component: `ScenarioBuilder`

This is a multi-step wizard rendered inside `ScenariosView` when creating or editing a scenario. It replaces the list view in the same panel.

Props:
```ts
{
  existing?: Scenario              // if editing, pre-populate
  incomeSources: IncomeSource[]
  globalBudgets: GlobalBudgets
  onSave: (scenario: Scenario) => void
  onCancel: () => void
}
```

### Step 1: Basics

Fields:
- **Name** (text input, required) — e.g. "Maternity leave 2026"
- **Description** (textarea, optional) — notes to self
- **Colour** (pick from 6 presets: blue, amber, teal, coral, green, purple)
- **Start date**: month + year selectors (dropdown)
- **End date**: month + year selectors (dropdown)

Derived display: "This scenario covers X months" — updates live as dates change.

Validation: end must be after start. Max 36 months (show error if exceeded).

Progress indicator at top: `Step 1 of 4 — Basics`

---

### Step 2: Income Changes

Header: "How does income change during this period?"

List each existing `IncomeSource` as a row:
```
Chris salary        $8,500/mo   [Keep as-is ▼]
Wife salary         $6,200/mo   [Keep as-is ▼]
```

The dropdown for each source has options:
- **Keep as-is** — no change
- **Reduced amount** — reveals a number input for the new monthly amount
- **Removed** — sets amount to 0 (greyed out row)

"+ Add temporary income source" link — adds a new row with label + amount inputs (this source exists only within the scenario, `isNew: true`).

Live preview below the list:
```
Baseline income:   $14,700/mo
Scenario income:    $8,500/mo
Monthly difference: -$6,200
```

---

### Step 3: Expense Changes

Header: "Do any spending patterns change during this period?"

Sub-section A — **Category budget adjustments**:
List all categories that have a global budget set. Each row:
```
Food & Dining   $800/mo   →   [____]  (leave blank to keep)
```
Filled-in values override the global budget for all months in the scenario window.

Add category not in list: "+ Adjust another category" dropdown.

Sub-section B — **One-off costs**:
"Add a one-time expense during this period" button. Each one-off cost has:
- Label (e.g. "Nursery setup")
- Amount
- Month it lands in (dropdown of months in the scenario window)

Each one-off cost appears as a pill that can be deleted.

---

### Step 4: Goals & Guardrails

**Savings floor** (optional):
"Alert me if projected balance drops below" — number input.
Helper text: "This triggers a warning on the projection chart if your cumulative net goes below this amount. Useful for preserving an emergency fund."

**Savings target** (optional):
"I want to have saved $____ by the end of this scenario."
If set, the projection view will show whether you hit the target.

**Review summary** — before Save, show a plain-language summary:
```
During Apr 2026 → Mar 2027 (12 months):
• Wife salary reduced from $6,200 to $0
• EI payment added: $3,410/mo
• Nursery setup: $5,000 in May 2026
• Food budget increased to $1,000/mo
• Alert if balance drops below $5,000
```

Buttons: [Save scenario] [Back] [Cancel]

---

## Scenario Projection View

When "View projection" is clicked on a scenario card, render `ScenarioProjectionView`.

Props:
```ts
{
  scenario: Scenario
  projection: ProjectedMonth[]   // pre-calculated by projectScenario()
  onEdit: () => void
  onBack: () => void
}
```

### Layout

Top: scenario name, date range, colour dot. [Edit] [Back] buttons.

**Summary tiles** (3 across):
```
Monthly income   Monthly deficit/surplus   Cumulative net
$8,500           -$1,290                   -$15,480 by end
```

**Monthly projection table** — a table with columns:
```
Month | Income | Expenses | One-offs | Net | Cumulative | Status
```

Rows alternate real (grey tint if `isActual`) and projected. Flag `isBelowFloor` rows with a red left border.

**Projection bar chart** — a simple bar chart showing cumulative net over the scenario window. Bars below zero are red. The floor line (if set) is a dashed horizontal rule.

Axis: months on X, cumulative net ($) on Y.

Use inline SVG for the chart (no external library needed for this simple chart).

If `scenario.savingsTarget` is set, show a horizontal target line on the chart and whether the final cumulative net meets it:
```
Target: $4,000  ✓ Met  (or ✕ Short by $840)
```

---

## Acceptance Criteria

- [ ] "Scenarios" nav tab renders `ScenariosView`
- [ ] Empty state shows call-to-action
- [ ] Scenario builder wizard has 4 steps with back/forward navigation
- [ ] Step 1 validates date range (end > start, ≤ 36 months)
- [ ] Step 2 shows all real income sources; each can be kept, reduced, or removed
- [ ] Step 2 allows adding a temporary new income source
- [ ] Step 2 live preview shows baseline vs scenario income delta
- [ ] Step 3 shows categories with existing global budgets; allows override amounts
- [ ] Step 3 allows adding one-off costs with month picker
- [ ] Step 4 collects optional floor amount and savings target
- [ ] Step 4 shows plain-language review summary before save
- [ ] `projectScenario()` uses real transaction totals for past months
- [ ] `projectScenario()` uses budget limits for future months
- [ ] `projectScenario()` applies income changes and one-off costs correctly
- [ ] `isBelowFloor` is true only when `cumulativeNet < floorAmount`
- [ ] Projection view table shows all months in scenario window
- [ ] Projection bar chart renders as SVG, bars below zero are red
- [ ] Floor line and savings target line render on chart when set
- [ ] Saving a scenario persists to `scenarios` storage key
- [ ] Editing a scenario pre-populates the wizard
- [ ] Archiving a scenario sets `status: 'archived'` and hides it from the list (add a "show archived" toggle)
- [ ] Scenarios never modify `t-{year}-{month}`, `i-{year}-{month}`, `budget-global`, or any real data keys
