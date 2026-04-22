# PRP-27: Settings Shell + Utility Views Polish

## Status: Done

## Dependencies

- PRP-21 (design system + shell — settings shell structure defined there)

---

## Problem Summary

Rules, Categories, and Classify are utility/configuration views that don't need a dramatic redesign, but they should feel cohesive with the new design system. The settings shell navigation (from PRP-21) puts them in their own context. This PRP polishes the views that live there.

---

## Solution

### 1. Settings Shell (BudgetTracker.jsx — minor addition to PRP-21)

If not fully implemented in PRP-21, ensure:
- Settings gear (⚙) in top bar sets `view === 'settings'` and defaults to `settingsTab === 'rules'`
- Top bar tints to `--color-raised` background in settings mode
- Center tabs: Rules · Categories · Classify
- `← Back` on left returns to previous main view

### 2. ClassifyView — Progress Bar Refresh

- Progress bar: full-width emerald fill (`bg-accent`) on `bg-raised` track, `h-1.5` rounded
- Progress text: "12 of 50 classified" in `text-sm text-muted`
- Transaction card: larger amount display (`text-[32px]`) in the card center
- Category pill grid: pills slightly larger, selected pill uses emerald fill + white text (was muted highlight)
- "Done" button: emerald primary button

### 3. RulesView — Visual Polish

- Rule rows: category color dot more prominent (`w-3 h-3`)
- Active/inactive toggle: emerald when active (replaces `--color-text`)
- CC payment tip banner: inherits new `bg-info-bg` + `text-info` from token update

### 4. CategoriesView — Visual Polish

- Category tree rows: slightly more breathing room (`py-3`)
- Add category form: card shadow styling
- Color picker: small round swatch preview next to the hex input

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | Settings shell completion (if not done in PRP-21) |
| `src/ClassifyView.jsx` | Progress bar, transaction card, category pill selection style |
| `src/RulesView.jsx` | Toggle accent color, row visual polish |
| `src/CategoriesView.jsx` | Row spacing, color picker swatch preview |

---

## Verification

1. `npm run build` — zero errors
2. Settings gear navigates to Rules view; tabs switch between Rules/Categories/Classify
3. Back button returns to previous main view
4. Classify progress bar fills correctly
5. Category pill selection shows emerald fill on selected item
6. All create/edit/delete flows in each utility view still work
7. Dark mode: all utility view elements correct
