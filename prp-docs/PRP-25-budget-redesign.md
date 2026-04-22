# PRP-25: Budget View Redesign

## Status: Done

## Dependencies

- PRP-21 (design system + shell)
- PRP-22 (Recharts installed)

---

## Problem Summary

The Budget view's two-column layout is logical but the right panel (category detail) feels sparse — just a table of date ranges with no visual sense of how the budget fits into the whole picture. Adding a donut chart showing budget allocation makes the planning process more visual and meaningful.

---

## Solution

### 1. Left Panel — Category List Refresh

- Category rows: add an emerald amount badge (small pill, right-aligned) showing the active monthly amount
- "No limit" categories: muted dash instead of blank
- Active category: emerald left-border accent (`border-l-2 border-accent`)
- Panel header: "Total budgeted: $X,XXX/mo" summary line at the bottom, emerald text

### 2. Right Panel — Donut Chart + Entry List

**New: Donut chart** at the top of the right panel (when a category is selected):
- Recharts `<PieChart>` with `innerRadius`/`outerRadius` (donut shape)
- Shows the selected category's budget as a slice of the total budget
- Two slices: this category (category's own color) vs everything else (muted gray)
- Center label: category amount + "/ mo"
- Height: 160px, centered
- Only shown when a category with at least one active entry is selected

**Entry list**: unchanged structure, refined styling (inherits design system)

### 3. Sources Tab

- Same layout, visual polish only
- Toggle switch uses emerald accent when active (currently uses `--color-text`)

### 4. Income Tab

- Same as Outgoing but donut shows income category as share of total income budget

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetView.jsx` | Left panel amount badges, right panel donut chart, Sources toggle accent color |

---

## Verification

1. `npm run build` — zero errors
2. Donut chart renders correctly for selected category
3. Donut hidden when no active entry exists for selected category
4. Total budgeted summary line at bottom of left panel is correct
5. All existing entry add/edit/delete functionality unchanged
6. Dark mode: donut slices, badges, and cards correct
