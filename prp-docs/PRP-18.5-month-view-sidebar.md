# PRP-18.5: Month View in Sidebar

## Status: Done

## Dependencies

- PRP-18 complete (sidebar + header layout)

---

## Problem Summary

The month carousel in the top header took up vertical space and was a separate interaction model from the sidebar navigation. Moving month selection into the sidebar unifies all navigation in one place.

---

## Solution

- Remove the month carousel row from the top header (header simplifies to a single 48px bar: year selector + Import CSV).
- Add a "Month View" item to the sidebar that expands in-place to reveal all 12 months for the current year.
- Clicking "Month View" toggles the expanded list. Clicking a month navigates to MonthView for that month.
- The section auto-expands (and stays expanded) whenever MonthView is active.
- Navigating to any other sidebar item collapses the month list.

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | Remove carousel row from header; add `monthNavExpanded` state; add expandable month list to sidebar; replace `.month-carousel-side` CSS with `.sidebar-month-item` |

---

## Acceptance Criteria

- [ ] Header is a single row (year selector left, Import CSV right)
- [ ] Sidebar has "Month View" item with `›`/`▾` chevron indicating collapsed/expanded state
- [ ] Clicking "Month View" toggles the 12-month list in place
- [ ] Clicking a month navigates to MonthView; that month is highlighted in the list
- [ ] Month list auto-expands when navigating to MonthView via OverviewView or ForecastView
- [ ] Clicking Budget/Overview/Forecast/Scenarios/Rules/Categories collapses the month list
- [ ] No console errors
