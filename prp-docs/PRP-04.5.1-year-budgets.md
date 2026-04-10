# PRP-04.5.1: Year-Specific Budgets & Global Rules

## Status: Complete

## Overview
Migrate `budget-global` from a single shared object to a year-specific storage model, allowing different monthly targets for different years (e.g., 2025 vs 2026).

## 1. Storage Schema Changes
*   **Key Change**: `budget-global` → `budget-global-{year}`.
*   **Migration**: On application load, if a year-specific budget doesn't exist, the app attempts to copy data from the legacy `budget-global` key to ensure no data loss for the current year.

## 2. Implementation Details
*   **BudgetTracker.jsx**:
    *   `useEffect` updated to reload `globalBudgets` whenever the `year` state changes.
    *   `saveGlobalBudgets` updated to target the year-specific key.
*   **BudgetView.jsx**:
    *   Added `year` prop to display "Budgeting for [Year]" in the header, clarifying which year's limits are being modified.

## Acceptance Criteria
- [x] Changing the year tab switches the category limits shown in the Budget tab.
- [x] Saving a limit in 2026 does not affect the limit for 2025.
- [x] Rules remain global and apply across all years.
