# PRP-24: Forecast Redesign

## Status: Done

## Dependencies

- PRP-21 (design system + shell)
- PRP-22 (Recharts installed)

---

## Problem Summary

The Forecast view's custom SVG line chart is functional but visually flat — a thin line on a white card. It doesn't communicate the weight of the data (your future financial position). Replacing it with a filled area chart adds visual richness and makes the distinction between actual and projected months much clearer.

---

## Solution

### 1. Replace SVG Chart with Recharts AreaChart

Remove the custom SVG polyline implementation. Replace with a Recharts `<ComposedChart>` (or `<AreaChart>`):

**Actual months** (past):
- Filled `<Area>` — emerald, 80% opacity fill, solid stroke

**Projected months** (future):
- Filled `<Area>` — emerald, 25% opacity fill, dashed stroke (`strokeDasharray="6 4"`)

**Reference lines**:
- Zero line: red dashed `<ReferenceLine y={0}>` (shown only if balance goes negative)
- Starting balance: muted dashed `<ReferenceLine y={startingBalance}>`

**Chart config**:
- Height: 240px, full width
- X-axis: month abbreviations
- Y-axis: compact formatted values (`$12K`, `$1.2K`)
- Grid: soft `strokeDasharray="3 3"`, `stroke="var(--color-border-subtle)"`
- Tooltip: month, balance, net for that month
- Dot on each month point (filled for actual, hollow for projected)

### 2. KPI Summary Row

Keep the 3 summary tiles (Planned Net · Actual Net · Year-End Estimate) but apply the hero card style from PRP-21 (shadow, no border, `text-[36px]`).

### 3. Starting Balance Editor

Refined inline edit UI — same logic, improved styling:
- Edit trigger: pencil icon button instead of plain "Edit" text
- Input appears inline with a smooth transition

### 4. Forecast Table

- Same columns, refined styling (inherits from design system)
- Actual rows: white background; projected rows: `--color-raised` background (subtle distinction)

---

## Files Changed

| File | Change |
|---|---|
| `src/ForecastView.jsx` | Replace SVG chart with Recharts AreaChart; refresh KPI cards and table styling |

---

## Verification

1. `npm run build` — zero errors
2. Area chart renders all 12 months, solid/dashed split at correct actual/projected boundary
3. Zero line appears when balance dips negative
4. Tooltip shows correct data on hover
5. Starting balance edit still works and recalculates chart
6. Clicking a table row still navigates to MonthView
7. Dark mode: filled areas, reference lines, and tooltips all correct
