# Homepage UI Specification (Overview View)

This document describes the current UI structure, components, and design system of the Budget App's homepage to facilitate AI-assisted UI generation.

## 🎨 Design System (The "Vibe")
The app uses a clean, minimalist "Notion-like" aesthetic with high-contrast typography and subtle borders.

- **Color Palette (Light/Dark Mode Support):**
  - **Backgrounds:** Primary (#FFF/ #1A1A1A), Secondary (#F9F9F9/ #242424), Tertiary (#F4F4F4/ #121212).
  - **Borders:** Subtle 0.5px hair-lines (#EEEEEE/ #2A2A2A).
  - **Typography:** Primary (#111/ #EEE), Secondary (#666/ #AAA).
  - **Semantic:** Success (#2E7D32), Danger (#D32F2F), Info (#0288D1).
- **Typography:**
  - **Sans:** System stack (-apple-system, Segoe UI, sans-serif).
  - **Mono:** "SF Mono" or "Roboto Mono" for financial figures.
- **Spacing:** Based on a 4px/8px grid. Cards have `border-radius: 12px`.

---

## 🏗️ Layout Structure

### 1. Global Navigation Bar (Sticky Top)
- **Left Section:**
  - Branding: "Budget" (Semi-bold, 15px).
  - Navigation Tabs: Inline buttons (Overview, Month, Rules, Categories). Active tab has a subtle background and border.
- **Right Section:**
  - Year Switcher: Segmented buttons for available years.
  - Action Buttons: 
    - "+ Year" (Dashed border).
    - "Import CSV" (Primary action): A dropdown containing "Checking Account" and "Credit Card" options.

### 2. Page Header
- Large Title: Current Year (e.g., "2026") in 26px bold.
- Subtitle: "Annual financial summary" in 14px secondary text.

### 3. KPI Cards (3-Column Grid)
Three cards displaying high-level totals for the selected year:
- **Total Income:** Green text, prefixed with "+".
- **Total Expenses:** Red text, prefixed with "-".
- **Net Savings:** Green or Red based on value, prefixed with "+" or "-".
- **Internal Card Layout:** Small uppercase label at top, large mono-spaced amount at bottom.

### 4. Annual Performance Chart (Full-width Card)
- **Header:** Uppercase "MONTHLY" label.
- **Visualization:** A dual-bar chart showing vertical bars for every month.
  - Green bars for Income.
  - Red bars for Expenses.
  - Hovering shows specific month totals.
  - Current month name is highlighted in bold.
- **Legend:** Minimal dots with labels ("Income", "Expenses") at the bottom.

### 5. Monthly Detail Grid (4-Column Grid)
A responsive grid of "Month Cards" representing January through December.
- **Card States:** 
  - **Empty:** "No data" italicized text.
  - **Populated:** Displays up/down arrow icons with totals and a large Net value.
- **Card Elements:**
  - Month Name (e.g., "January").
  - "Current" badge for the actual calendar month.
  - Status Dot: Color-coded (Green/Red) based on the month's net balance.
  - Summary Lines: 
    - "↑ $Total Income"
    - "↓ $Total Expenses"
  - Large Net Amount: Mono-spaced, color-coded by performance.
  - Transaction Count: Small secondary text (e.g., "24 txns").

---

## 🕹️ Interactive Behaviors
- **Hover States:** Cards have a subtle border-color change on hover. Rows highlight with a secondary background.
- **Click Actions:** Clicking any Month Card navigates to the detailed `MonthView`.
- **Responsive:** The grid adjusts columns based on viewport width (defaults to 4 columns).
