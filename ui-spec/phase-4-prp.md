# PRP: Phase 4 - Advanced Budgeting & Savings Goals

This document outlines the implementation plan for the advanced budgeting features, including rollover logic, templates, forecasting, and savings goals.

## 🏁 Phase 4.1: The Envelope & Rollover Engine
*Objective: Implement core envelope-style budgeting with monthly persistence.*

1.  **Rollover State:** Add a `rollover` toggle to the `Category` schema.
2.  **Calculation Logic:**
    - Update `monthData` to calculate the "Available" budget.
    - `Available = (Current Target) + (Previous Month's Unspent if Rollover is ON)`.
3.  **Envelope Cap:** Add a "Total Budget Cap" field to the Month View. Flag if the sum of category targets exceeds this cap or the expected monthly income.

## 🏁 Phase 4.2: Budget Templates & Profiles
*Objective: Quick-apply budget configurations.*

1.  **Template Storage:** Create a new storage key `budget-templates`.
2.  **Management UI:** A modal or section in the Categories tab to "Save Current Targets as Template".
3.  **Application UI:** A "Apply Template" dropdown in the `MonthView` to instantly populate all overrides for that month.

## 🏁 Phase 4.3: Proactive Forecasting & Alerts
*Objective: Predictive warnings before overspending happens.*

1.  **Velocity Calculation:**
    - Calculate `Days Elapsed / Days in Month`.
    - Compare `Spent / Target`.
    - If `Spent Ratio > Time Ratio`, show a "⚠️ Projected to overspend" indicator.
2.  **Overview Integration:** Add a small red/yellow warning dot to the Month Cards in the `OverviewView` if a month is over (or projected to be over) budget.

## 🏁 Phase 4.4: Savings Goals & Dedicated Tracking
*Objective: Purpose-driven saving.*

1.  **Goal Schema:** Create `budget-savings-goals`. Fields: `name`, `targetAmount`, `deadline`, `currentSaved`.
2.  **Automatic Calculation:** Calculate `(Target - Current) / Months Remaining` to show the required monthly contribution.
3.  **Savings View:** A new sub-section in the Budgeting tab to track these goals with dedicated progress bars.

---

## 📅 Implementation Order
1.  **Rollover & Envelope Logic** (Foundational)
2.  **Forecasting Indicators** (High utility, low effort)
3.  **Savings Goals** (New feature set)
4.  **Budget Templates** (Convenience feature)
