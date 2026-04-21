# PRP-20: Sidebar Tab Order

## Status: Done

## Dependencies

- PRP-18 (sidebar nav exists)

---

## Problem Summary

The sidebar tab order was Budget → Overview → Forecast → Scenarios. Overview is the natural landing view and should be first; Forecast logically follows Overview; Budget is a configuration tab and should come after.

---

## Solution

Reorder the three main nav buttons in `BudgetTracker.jsx`:

**Before:** Budget → Overview → Forecast → Scenarios  
**After:** Overview → Forecast → Budget → Scenarios

---

## Files Changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | Reorder sidebar nav buttons (3 lines swapped) |
