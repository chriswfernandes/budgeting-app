# PRP: Phase 3 - UI/UX Modernization Roadmap

This document outlines the step-by-step implementation plan to transform the Budget App's user experience based on the new UI specifications.

## 🏁 Phase 3.1: The Sticky Architecture
*Objective: Keep context visible at all times.*

1.  **Sidebar Pinning:** Update the CSS for the left-hand forms in `RulesView`, `CategoriesView`, and `MonthView`.
    - Apply `position: sticky; top: 24px;` to the sidebar containers.
    - Ensure parent containers have adequate height to allow sticky behavior.
2.  **Header Pinning:** Apply `sticky` positioning to the "Action Bars" (Search/Add buttons) at the top of the Rules, Categories, and Transaction lists.

## 🏁 Phase 3.2: Real-time Data Discovery
*Objective: Instant access to any transaction or rule.*

1.  **State Integration:** Add a `searchQuery` state variable to the `App` component (or individual view components).
2.  **Filter Logic:** Implement `.filter()` logic in the render functions for the three major lists:
    - **Rules:** Filter by trigger keyword or category.
    - **Categories:** Filter by name.
    - **Transactions:** Filter by description or amount.
3.  **UI Component:** Add a standardized `<input className="input-f">` search bar at the top of each list.

## 🏁 Phase 3.3: Inline "In-Situ" Editing
*Objective: Eliminate the "Scroll-to-Sidebar" loop.*

1.  **Per-View State:** Add `editingId` states to the list views.
2.  **Conditional Rendering:** 
    - If `item.id === editingId`, render the "Form Row" (inline inputs and Save/Cancel buttons).
    - Else, render the "Display Row" (standard metadata and Edit button).
3.  **Refactor Handlers:** Redirect the existing "Edit" button clicks to set the local `editingId` instead of populating the global sidebar form.

## 🏁 Phase 3.4: Vertical Density Management
*Objective: Clean up long category trees.*

1.  **Expansion State:** Add a `collapsedIds` state (Set) to track which parent categories are hidden.
2.  **Toggle Logic:** Add an interactive chevron (▶ / ▼) next to parent categories.
    - Clicking the chevron adds/removes the ID from `collapsedIds`.
3.  **Hierarchical Roll-up:** Ensure that collapsed parents still show the "Roll-up" total of their children so users don't lose the high-level budget status.

---

## 📅 Suggested Implementation Order
1.  **Sticky Architecture** (Highest Impact / Lowest Effort)
2.  **Search & Filtering** (High Utility)
3.  **Collapsible Hierarchies** (Important for power users)
4.  **Inline List Editing** (Most complex, best UX payoff)
