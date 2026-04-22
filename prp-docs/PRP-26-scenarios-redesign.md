# PRP-26: Scenarios Redesign

## Status: Done

## Dependencies

- PRP-21 (design system + shell)
- PRP-22 (Recharts installed)

---

## Problem Summary

Scenario cards are plain text lists with no visual personality. The projection view shows one scenario at a time with a bare SVG line chart — you can't compare scenarios side-by-side. This PRP makes scenarios visually compelling and adds multi-scenario comparison.

---

## Solution

### 1. Scenario Cards (ScenariosView.jsx)

Refresh each scenario card:

- **Colored left border**: `border-l-4` using `scenario.color` (was just a dot)
- **Name**: `text-[18px]` semibold
- **Duration**: muted, below name
- **Modification pills**: small colored pills for income changes / budget adjustments / one-off costs (was plain text badges)
- **Action row**: "View Projection" as primary button (emerald), "Edit" as ghost button
- Cards use the new `.card` shadow style

### 2. Multi-Scenario Comparison Chart (ScenariosView.jsx)

New section at the top of the scenarios list — a comparison chart showing all non-archived scenarios overlaid:

- Recharts `<LineChart>` with one `<Line>` per scenario
- Each line uses `scenario.color`
- X-axis: months (derived from the union of all scenario date ranges)
- Y-axis: cumulative net
- Legend: scenario names with their color dots
- Only shown when 2+ scenarios exist
- Height: 200px

This requires calling `projectScenario()` for each scenario and passing the results into the chart. The existing `projectScenario()` utility in `utils.js` is pure and can be called for all scenarios in the render.

### 3. Projection View (ScenarioProjectionView.jsx)

- Replace the existing SVG `<path>` chart with a Recharts `<AreaChart>`
- Same data, richer visual: filled area using `scenario.color` at 40% opacity, solid stroke
- Floor and savings target reference lines (`<ReferenceLine>`) replacing the raw SVG lines
- KPI cards: apply hero card style (`text-[36px]`, shadow)
- Table: visual polish only (inherits design system)

---

## Files Changed

| File | Change |
|---|---|
| `src/ScenariosView.jsx` | Card refresh, multi-scenario comparison chart |
| `src/ScenarioProjectionView.jsx` | Recharts AreaChart replacing SVG, hero KPI cards |

---

## Note on Complexity

The multi-scenario comparison chart requires projecting all scenarios during render. Since `projectScenario()` is a pure function, this is safe to do inline — no new state or storage changes needed. However, it adds computation proportional to scenario count. For typical usage (2–5 scenarios) this is negligible.

---

## Verification

1. `npm run build` — zero errors
2. Comparison chart renders when 2+ scenarios exist; hidden with 0 or 1
3. Each scenario line uses the correct `scenario.color`
4. Projection view area chart fills correctly, reference lines appear at correct values
5. "Below floor" row indicator still works in the table
6. Dark mode: all chart elements correct
