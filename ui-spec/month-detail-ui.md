# Month Detail View UI Specification

This document describes the intuitive, action-oriented UI structure of the monthly transaction and budget tracking view.

## 🏗️ Layout Structure
The Month view is composed of a header, three KPI cards, and a two-column main content area optimized for rapid data entry and review.

### 1. Header
- Large Title: Month and Year (e.g., "April 2026") in 26px semi-bold.

### 2. KPI Summary Cards (3-Column Grid)
- **Income Card:** Displays total income. Includes an "Edit" button to manually adjust monthly income overrides inline.
- **Expenses Card:** Displays total monthly expenses in Red text.
- **Net Card:** Displays the bottom-line balance (Green for positive, Red for negative).

### 3. Left Column: Sticky Budget Sidebar (280px fixed width)
Manages the "Budget Targets" for the month.
- **Behavior:** `position: sticky` so budget progress remains visible while scrolling through long transaction lists.
- **Search/Filter Box:** A quick input to filter categories by name.
- **Category Progress Row (Collapsible if parent):**
  - Header: Category name and total amount spent (Roll-up logic included).
  - **Progress Bar:** A horizontal bar showing the ratio of Spending vs. Target.
    - **Green/Neutral:** Spending is within the target.
    - **Red:** Spending has exceeded the target.
  - **Budget Info (Bottom Row):**
    - **Left side:** "Target: $X" text. Clicking this opens an inline input field to override the target for this month only.
    - **Right side:** Dynamic status text like "$120 left" (Green) or "$45 over" (Red).

### 4. Right Column: Transaction List (Flexible width)
- **Action Bar (Sticky Header):**
  - Transaction count or active filter label.
  - **Search Input:** Instantly filter transactions by description or amount.
  - **"+ Add" Button:** Toggles an inline "Manual Transaction" form at the top of the list.
  - **"Import CSV" Dropdown:** Opens the account-selection import menu.
- **Transaction Row:**
  - Colored category dot.
  - **Description:** Large primary text.
  - **Metadata Row:** Small secondary text showing the Date, Category Label (clickable to change), and Account Tag (e.g., "CHECKING").
  - **Amount:** Mono-spaced text (+ for income, - for expenses).
  - **Action Menu (Hover):**
    - "Edit" (Transforms the row into an inline form for Date, Description, Amount, Category).
    - "✕" (Delete).

---

## 🕹️ Interactive Behaviors
- **Sticky Elements:** The Budget Sidebar and Transaction Action Bar stay pinned during scrolling.
- **Inline Editing (Categories):** Clicking a transaction's category label immediately transforms it into a searchable dropdown selector.
- **Inline Editing (Full Row):** Clicking "Edit" allows changing the transaction amount or description without leaving the list context.
- **Target Overrides:** Clicking "Target: $X" in the sidebar creates a monthly budget override that does not affect the global category settings.
- **Filtering:** Clicking a category in the sidebar filters the transaction list. Clicking again clears the filter. Parent categories automatically show child category transactions.
- **Manual Entry:** The "+ Add" form allows quick data entry with auto-focus on the date field, designed for keyboard-friendly input.
