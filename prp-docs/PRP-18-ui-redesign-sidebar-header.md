# PRP-18: UI Redesign — Left Sidebar + Top Header with Year/Month Carousel

## Status: Done

## Dependencies

- All prior PRPs complete (no new data model changes)

---

## Problem Summary

The top nav bar was a single horizontal strip that grew crowded as features were added. Year selector, nav tabs, and Import CSV all competed for space. There was no persistent spatial context for which view you were on.

---

## Solution

Replace the top nav bar with a two-part layout:
1. **Top header** (two rows): year `‹ › +` on top-left, Import CSV on top-right; month carousel centered below.
2. **Left sidebar** (200px): vertical nav — Budget, Overview, Forecast, Scenarios, Rules, Categories (Classify when active).

Month carousel always shows `[prev dimmed] | [CURRENT MONTH bold] | [next dimmed]`. Clicking prev/next always navigates to MonthView for that month (year wraps at boundaries).

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | New two-row header, left sidebar, flex layout; CSS classes `.hdr-yr-btn`, `.month-carousel-side`, `.sidebar-tab` added to `S` template literal |

---

## Acceptance Criteria

- [ ] Sidebar visible on all views with correct active highlight
- [ ] Year `‹ ›` arrows cycle through available years; disabled at limits
- [ ] `+` button opens inline year-add input; Enter or "Add" creates year
- [ ] Month carousel: current month bold/centered, prev/next dimmed
- [ ] Clicking carousel month navigates to MonthView; year wraps Jan↔Dec
- [ ] Import CSV in top-right of header; file picker opens; classify flow unbroken
- [ ] All existing views render without regressions
- [ ] No console errors; dark mode correct
