# PRP-06: Scenario Comparison, Sensitivity Analysis & Apply to Plan

## Status: Implement after PRP-05

## Overview
The final phase of the scenario system. Users can compare multiple scenarios side by side, run sensitivity analysis via sliders to see how changes affect outcomes, and apply a finalised scenario to their real budget months as a plan they'll actually track against.

---

## Prerequisites
- PRP-04: `projectScenario`, `ScenarioProjectionView`, scenario storage
- PRP-05: Templates, savings goals, break-even finder
- PRP-02: Month overrides, income adjustments save helpers

---

## Part 1: Scenario Comparison View

### Entry point
On the `ScenariosView` list, when 2 or more active scenarios exist, show a button:

```
[Compare scenarios →]
```

Also accessible from the individual projection view: a "Compare with..." dropdown button that lets you pick a second scenario to compare against.

### `ScenarioComparisonView` component

Props:
```ts
{
  scenarios: Scenario[]
  allProjections: { [scenarioId: string]: ProjectedMonth[] }
  onClose: () => void
}
```

State:
- `selectedIds: string[]` — which scenarios are selected for comparison (max 3)

### Layout

Top bar: scenario selector. Each scenario appears as a toggle pill (colour-coded). Active scenarios are highlighted. Max 3 can be selected simultaneously.

```
Compare:  [● Baseline]  [● Maternity leave]  [○ Vacation fund]  [○ Income loss]
```

"Baseline" is a virtual scenario auto-computed from real income sources + global budgets, no modifications. It always appears as an option.

### Month-by-month comparison table

The comparison table shows months as rows and selected scenarios as columns.

Time range: union of all selected scenario windows, padded to cover the full range. If scenarios don't overlap, show all months from the earliest start to the latest end.

```
         │ Baseline  │ Mat. leave │ Vacation  │
─────────┼───────────┼────────────┼───────────┤
Jan 2026 │  +$5,300  │   +$5,300  │  +$4,633  │
Feb 2026 │  +$5,300  │   +$4,010  │  +$4,633  │
Mar 2026 │  +$5,300  │   +$4,010  │  +$4,633  │  ← scenario month highlight
Apr 2026 │  +$5,300  │   +$4,010  │   —        │
         │           │            │            │
─────────┼───────────┼────────────┼───────────┤
Total    │  +$63,600 │  +$34,120  │  +$55,596 │
Delta vs │    —      │  -$29,480  │   -$8,004 │
Baseline │           │            │            │
```

Column headers use the scenario's colour as a top border. Months where a scenario is not active show "—". Negative values are red. Rows with any `isBelowFloor` flag get a red left border.

"Total" row sums all months shown. "Delta vs Baseline" row shows the difference from baseline total.

### Comparison chart

Below the table: a line chart showing cumulative net over time for each selected scenario.

Use inline SVG. Each scenario is a line in its scenario colour. The baseline is a grey dashed line. X axis: months. Y axis: cumulative net ($). A horizontal zero line.

SVG implementation approach:
```js
// Map data to SVG coordinates
function toSVGCoords(months, values, svgWidth, svgHeight, padding) {
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const range = maxV - minV || 1;
  return months.map((m, i) => ({
    x: padding + (i / (months.length - 1)) * (svgWidth - padding * 2),
    y: padding + (1 - (values[i] - minV) / range) * (svgHeight - padding * 2)
  }));
}
```

Draw each scenario as a `<polyline>` with the scenario's hex colour and `stroke-width="2"`.

Month labels on X axis: every 3rd month. Dollar amounts on Y axis: 3–5 tick marks.

### Key insights panel

Below the chart, auto-generate 2–4 plain-language insights:

```
● Maternity leave results in a $29,480 lower cumulative net vs baseline over 12 months.
● January and February 2027 are the tightest months — net drops to +$1,200.
● Your emergency fund floor ($5,000) is never breached in any scenario.
● Vacation fund is on track to be funded by June 2026.
```

Logic for generating insights:
- Largest monthly delta between any scenario and baseline
- Month with the lowest projected net across any scenario
- Whether any scenario's `isBelowFloor` is ever true
- Whether any scenario hits its `savingsTarget`

---

## Part 2: Sensitivity Analysis

Available from both `ScenarioProjectionView` and `ScenarioComparisonView`.

Entry point: a "Sensitivity" toggle button in the top bar of either view.

### `SensitivityPanel` component

Props:
```ts
{
  scenario: Scenario
  incomeSources: IncomeSource[]
  globalBudgets: GlobalBudgets
  onReproject: (modifiedScenario: Scenario) => void
}
```

The panel sits in a right-side drawer (a `<div>` with `position: absolute; right: 0`) — NOT a fixed overlay. It pushes the main content to the left by reducing its width.

The drawer contains sliders for the most impactful variables in the scenario. "Most impactful" = any `ScenarioIncomeChange` or `ScenarioCategoryChange` that affects ≥ $100/month.

Each slider:
```
Wife salary (EI)     $3,410/mo
|────────●──────────────────|
$0                    $6,200
```

- Min: 0 (for income changes) or 0 (for category budget changes)
- Max: original source amount (for income) or 2× the current limit (for category budgets)
- Step: $50
- Value label updates live above the slider

As sliders move, call `onReproject` with the modified scenario (the slider value replaces the `monthlyAmount` in `incomeChanges` or `monthlyLimit` in `categoryChanges`). The projection recalculates immediately.

Also show a summary at the top of the panel:
```
Monthly net (scenario):    -$1,290   → -$890  (with slider changes)
Cumulative net:           -$15,480   → -$10,680
```

Values update live.

"Reset to saved" button — restores all sliders to their scenario-saved values.

---

## Part 3: Apply Scenario to Plan

Once a user has finalised a scenario and is satisfied with the projection, they can "apply" it to their real budget months.

### Entry point
In `ScenarioProjectionView`, a primary action button:

```
[Apply to plan →]
```

### What "apply" does

Applying a scenario writes the scenario's modifications as real budget month overrides and income adjustments — the same data structures that PRP-02 introduced. It does **not** create or modify transactions.

Specifically, for each month in the scenario window:

1. **Income adjustments**: For each `ScenarioIncomeChange`, write an `IncomeAdjustment` to `income-adjust-{year}-{month}`. If `isNew: true`, skip (new sources only exist in scenarios, not in real income sources).

2. **Category budget overrides**: For each `ScenarioCategoryChange`, write to `budget-override-{year}-{month}`.

3. **One-off costs**: For each `ScenarioOneOffCost`, create a synthetic transaction in `t-{year}-{month}` with:
   - `id`: `scenario-${scenario.id}-oneoff-${oneoff.id}`
   - `description`: oneoff.label
   - `amount`: oneoff.amount
   - `type`: `'expense'`
   - `category`: `'other'`
   - `date`: first day of that month
   - `isScenarioGenerated: true` — a flag to identify it as scenario-derived

### Confirmation flow

Before applying, show a confirmation panel (not a browser alert):

```
┌──────────────────────────────────────────────────────────────────┐
│  Apply "Maternity leave 2026" to your plan?                      │
│                                                                   │
│  This will update budget overrides and income adjustments for     │
│  12 months (Apr 2026 → Mar 2027).                                │
│                                                                   │
│  Months with existing overrides will be updated, not replaced:   │
│  • July 2026 already has a Travel override — it will be kept     │
│                                                                   │
│  One-off costs will be added as transactions:                     │
│  • Nursery setup ($5,000) → May 2026                             │
│                                                                   │
│  You can undo this by removing the scenario's overrides from     │
│  each month view individually.                                    │
│                                                                   │
│  [Confirm & apply]  [Cancel]                                      │
└──────────────────────────────────────────────────────────────────┘
```

Conflict resolution (when a month already has an override):
- For income adjustments: the scenario's adjustment takes precedence (overwrite).
- For category budget overrides: if the month already has an override for the same category, the scenario's value takes precedence (overwrite) — and the confirmation panel calls this out explicitly per the example above.
- For other-category overrides in the month (not affected by the scenario): leave untouched.

### Post-apply indicator

After applying, the scenario card in the list shows a badge:

```
● Maternity leave 2026    [Applied to plan ✓]
```

Store `appliedAt: string (ISO date)` on the `Scenario` object when applied. Show this timestamp on the badge tooltip.

"Unapply" is not automated — the confirmation panel notes that overrides must be removed manually from each month. This is intentional to avoid destructive automated reversals.

---

## Part 4: Scenario-Aware Month View Indicators

When a month has scenario-applied overrides, add a subtle indicator in the month view.

In `MonthView`, check if any `incomeAdjusts` or `monthOverrides` for this month contain entries that were written by a scenario apply. We determine this by checking the `scenarios` list for any scenario with `appliedAt` set whose window includes this year/month.

If a match is found, show a subtle banner at the top of the month view:

```
┌─────────────────────────────────────────────────────────────┐
│  This month's budget is shaped by the "Maternity leave 2026" │
│  scenario plan.   [View scenario →]                          │
└─────────────────────────────────────────────────────────────┘
```

`[View scenario →]` sets the view to 'scenarios' and opens the projection for that scenario.

Use `var(--color-background-info)` and `var(--color-border-info)` for this banner.

---

## Part 5: Export Summary

From `ScenarioProjectionView` and `ScenarioComparisonView`, add an "Export summary" button.

This generates a plain-text summary of the scenario (or comparison) and copies it to the clipboard.

Format:
```
SCENARIO: Maternity leave 2026
Period: April 2026 – March 2027 (12 months)
---
INCOME CHANGES
  Wife salary: $6,200/mo → $0 (removed)
  EI benefit: +$3,410/mo (new)
  Net monthly income change: -$2,790/mo

EXPENSE CHANGES
  Food & Dining: $800 → $1,000/mo (+$200)
  Transport: $300 → $150/mo (-$150)

ONE-OFF COSTS
  Nursery setup: $5,000 in May 2026

PROJECTION SUMMARY
  Avg monthly net: -$1,290
  Cumulative net at end: -$15,480
  Floor breached: No (floor: $5,000)

MONTHLY BREAKDOWN
  Apr 2026  Income: $8,500  Expenses: $9,790  Net: -$1,290  Cumulative: -$1,290
  May 2026  Income: $8,500  Expenses: $9,790  Net: -$1,290  One-offs: $5,000  Cumulative: -$7,580
  ...

Generated by Budget Tracker on [date]
```

Implementation: build the string in JS and call `navigator.clipboard.writeText(str)`. Show a brief "Copied!" confirmation replacing the button text for 2 seconds.

---

## Acceptance Criteria

### Comparison
- [ ] "Compare scenarios" button appears when 2+ active scenarios exist
- [ ] Scenario pills toggle selection, max 3 at a time
- [ ] Baseline virtual scenario always available as a comparison option
- [ ] Month table shows correct net per scenario per month
- [ ] Months outside a scenario's window show "—"
- [ ] Total and delta rows render correctly
- [ ] Comparison SVG line chart renders with one line per selected scenario
- [ ] Auto-generated insights (2–4) render below the chart

### Sensitivity
- [ ] Sensitivity panel opens as a right-side drawer (not fixed overlay)
- [ ] Only shows sliders for variables affecting ≥ $100/month
- [ ] Moving a slider immediately recalculates the projection
- [ ] Summary delta values update live
- [ ] "Reset to saved" restores all slider positions

### Apply to Plan
- [ ] "Apply to plan" button appears in projection view
- [ ] Confirmation panel lists affected months, conflicts, and one-off costs
- [ ] Applying writes income adjustments to `income-adjust-{year}-{month}`
- [ ] Applying writes category overrides to `budget-override-{year}-{month}`
- [ ] Applying creates synthetic transactions for one-off costs
- [ ] Synthetic transactions have `isScenarioGenerated: true`
- [ ] Existing non-scenario overrides for unrelated categories are preserved
- [ ] `appliedAt` timestamp is stored on the scenario
- [ ] Applied badge shows on the scenario list card

### Month View Indicator
- [ ] Banner shows in month view when a scenario has been applied to that month
- [ ] "View scenario →" navigates to the scenario projection
- [ ] Banner does not show for months not covered by any applied scenario

### Export
- [ ] "Export summary" button copies formatted text to clipboard
- [ ] "Copied!" confirmation appears for 2 seconds
- [ ] Export includes income changes, expense changes, one-offs, and monthly breakdown
- [ ] Comparison export (when in comparison view) includes all selected scenarios
