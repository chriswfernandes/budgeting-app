# PRP-22: Overview Redesign

## Status: Done

## Dependencies

- PRP-21 (design system + shell)
- Recharts installed (`npm install recharts`)

---

## Problem Summary

The Overview is the emotional anchor of the app but currently looks like a data grid. KPI numbers are small, the bar chart is tiny (100px tall) and custom SVG, and month cards show numbers without visual context. This PRP transforms it into a rich dashboard with prominent hero numbers, a full-width chart, and sparklines.

---

## Solution

### 1. Install Recharts

```bash
npm install recharts
```

Add to `package.json` dependencies. Used across PRPs 22–26.

### 2. Hero KPI Row (3 cards)

Replace the current 3-card row with larger, richer KPI cards:

- **Number size**: `text-[40px]` semibold, tabular-nums
- **Sparkline**: inside each card — a tiny `<LineChart>` (Recharts) showing the last 6 months of that metric. Width: ~80px, height: 36px. No axes, no tooltip, just the line. Emerald for income/net, red for expenses.
- **Delta label**: below the number — "vs last month: +12%" in `text-xs text-muted`. Computed from `monthData`.
- Cards use the new `.card` shadow style (no border)

### 3. Monthly Performance Chart (full-width)

Replace the custom SVG bar chart with a Recharts `<BarChart>`:

- Height: 220px
- Stacked bars: income (emerald, `--color-success`) and expenses (red, `--color-danger`)
- X-axis: month abbreviations (Jan–Dec)
- No Y-axis — just a soft grid (`strokeDasharray="3 3"`, `stroke="var(--color-border-subtle)"`)
- Hover tooltip: month name, income, expenses, net
- Current month bar has a subtle emerald outline/highlight

### 4. Month Card Grid (4 columns)

Refresh the existing month cards:

- Net savings in `text-[28px]` semibold (was smaller)
- Mini horizontal bar inside the card: expenses as % of income (emerald fill, danger if over)
- Over-budget badge: small red pill "3 over" if applicable
- Current month: emerald left-border accent (`border-l-2 border-accent`)
- Shadow on hover (`.card` hover state)

---

## Files Changed

| File | Change |
|---|---|
| `src/OverviewView.jsx` | Full redesign — hero KPIs with sparklines, Recharts bar chart, month card refresh |
| `package.json` | Add `recharts` dependency |

---

## Data Available (from props)

- `yearSummary`: `{ totalIncome, totalExpenses, net }`
- `monthData`: array of 12 months with `{ month, totalIncome, expenses, net }`
- `categories`, `budgetEntries`, `monthOverrides`: for over-budget calculation

---

## Verification

1. `npm run build` — zero errors
2. Chart renders all 12 months with correct income/expense stacking
3. Sparklines show last 6 months of data (or fewer if data is sparse)
4. Delta labels show correct month-over-month comparison
5. Month cards navigate to MonthView on click
6. Dark mode: chart colors, card surfaces, and text all correct
