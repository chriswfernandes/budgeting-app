# PRP-23: Month View Redesign

## Status: Done

## Dependencies

- PRP-21 (design system + shell)
- PRP-22 (Recharts installed)

---

## Problem Summary

MonthView is the most-used view but its layout is dense and hard to scan. The category budget table is the right data structure but has no visual weight. There's no quick way to see which categories are biggest or most over-budget at a glance.

---

## Solution

### 1. Hero KPI Row (3 cards)

Same pattern as Overview (PRP-22):
- Income · Expenses · Net — `text-[40px]` semibold, colored
- No sparklines here (single-month view doesn't benefit from trend)
- Over-budget card (4th card, red): shown only if any categories are over, same as today

### 2. Category Spend Chart (full-width, horizontal bars)

New section above the existing category table — a Recharts `<BarChart layout="vertical">`:

- Each category = one horizontal bar
- Bar shows: spent amount (solid fill, using `category.color`) vs budget (ghost/outlined bar behind)
- Sorted by spend descending
- Height: 200px (scales with category count, ~28px per bar)
- Labels: category name on left, spent amount on right
- Only shows categories with spend > 0
- No axes — just bars and labels
- Clicking a bar filters the transaction list (same behaviour as clicking a category row today)

### 3. Category Budget Table

- Keep existing structure and logic
- Visual refresh: larger row height (`py-3.5`), slightly larger font for amounts
- Status dot replaced with a colored left-border on the row (`border-l-2`, red/yellow/green/transparent)
- "No budget" rows: muted opacity rather than plain text

### 4. Transaction Rows

- Category dot slightly larger (`w-2.5 h-2.5`)
- Description text `text-[14px]` (was 13px)
- Date shown in muted gray, not competing with description

---

## Files Changed

| File | Change |
|---|---|
| `src/MonthView.jsx` | Hero KPI refresh, new horizontal bar chart section, table and row visual polish |

---

## Verification

1. `npm run build` — zero errors
2. Horizontal bar chart renders correctly with category colors
3. Clicking a bar filters transactions (same as clicking category row)
4. KPI cards show correct month totals
5. Dark mode: bars, table rows, and cards all correct
