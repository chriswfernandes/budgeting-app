# PRP-05: Cash Flow & Calendar Engine

## 1. Objective
Introduce a scheduling and forecasting engine that allows users to map expected income and expenses to specific dates. This will enable daily cash-flow projections, helping users anticipate low-balance days and visualize their financial timeline across both global (yearly) and granular (monthly) views.

## 2. Functional Requirements

### 2.1 The Scheduling Engine
Update the local storage architecture to support a new entity: `budget-schedules`. 
* **Data Structure:** A schedule object should include `{ id, type (income/expense), amount, description, category, frequency, startDate, customRule }`.
* **Supported Frequencies:**
    * **One-time:** Hits on a specific `YYYY-MM-DD`.
    * **Bi-weekly (Interval):** Every 14 days from a `startDate`.
        * *Test Case:* Salary ($X) every 14 days starting Jan 9th.
        * *Test Case:* Mortgage ($Y) every 14 days starting Jan 2nd.
    * **Monthly (Nth Weekday):** e.g., "Second Thursday of the month."
        * *Test Case:* Partner's Salary ($Z) starting Jan 15th, repeating every 2nd Thursday.
    * **Monthly (Specific Date):** e.g., "The 1st of every month."

### 2.2 Global "Budget" View: Schedule Management
* **New Navigation Tab:** Add a "Schedules" or "Timeline" tab next to *Category Budgets* and *Income Sources* in the 2026 Budget view.
* **Creation Form:** A UI to create the repeating rules defined in 2.1.
* **Global Ledger:** A master list of all active schedules, showing their next projected occurrence and allowing standard CRUD operations (Edit/Delete/Pause).

### 2.3 Monthly View: Calendar & Cash Flow
* **New Navigation Tab:** Inside a specific month (e.g., January), add a "Calendar" or "Cash Flow" toggle alongside the standard transaction list.
* **Dynamic Projection:** The view must calculate and render the events for that specific month by running the global `budget-schedules` through a date-math helper function.
* **Running Balance (Optional but Recommended):** To make the calendar useful, users should be able to input a "Starting Balance" for the month (or carry it over from the previous month) so the calendar can display the projected running balance on any given day.
* **Instance Overrides:** Users must be able to click a specific generated event on the monthly calendar and edit it *just for that occurrence* (e.g., shifting a Friday payday to Thursday because of a bank holiday) without breaking the global rule.

## 3. UI/UX Specifications

* **Design Language:** Maintain the existing aesthetic (0.5px borders, `var(--color-border-tertiary)`, rounded pills, and monochromatic text hierarchy).
* **Monthly Calendar Layout:** * Instead of a traditional 7x4 square calendar grid (which can get cluttered on smaller screens), implement a **Chronological Timeline View**.
    * Group events by Date (e.g., "Friday, Jan 9"). 
    * Show income in green (`var(--color-text-success)`) and expenses in red/default text.
* **Schedule Builder Form:**
    * Use native HTML `<select>` dropdowns for frequency selection to keep dependencies light.
    * Conditional rendering: If "Bi-weekly" is selected, show a date picker for "Starting on". If "Monthly (Weekday)" is selected, show dropdowns for "1st/2nd/3rd/4th/Last" and "Monday-Sunday".

## 4. Technical Implementation Steps

1.  **Date-Math Utilities:** Create a standalone utility file (e.g., `scheduleUtils.js`) with functions to calculate occurrences. *Do not clutter the main React component with complex leap-year or interval logic.* 2.  **State Management:** Add `schedules` to the top-level `App` state, fetched alongside `budget-years` and `budget-rules`.
3.  **UI - Global Setup:** Build the `SchedulesView` component for the main Budget page.
4.  **UI - Monthly Timeline:** Build the `MonthCalendarView` component that consumes the utility function to project the month's layout.
5.  **Storage Integration:** Ensure `window.storage` saves the `budget-schedules` array and updates instantly upon modification.