# Categories Tab UI Specification

This document describes the modern, intuitive UI structure and interactive elements of the "Categories" management tab to facilitate AI-assisted UI generation.

## 🏗️ Layout Structure
The Categories tab follows a two-column layout designed to manage complex hierarchies without losing context.

### 1. Header Section
- **Title:** "Categories" (26px, Semi-bold).
- **Description:** "Manage your budget categories, hierarchy, and monthly targets." (14px, Secondary color).

### 2. Left Column: Sticky Category Form Sidebar (280px fixed width)
- **Behavior:** `position: sticky` so the creation form remains visible while scrolling down a long list of categories.
- **Section Label:** Small uppercase text "CREATE CATEGORY".
- **Form Fields:**
  - **Name Input:** Standard text field for the category label.
  - **Monthly Target Input:** Number field for the default budget goal.
  - **Color Picker:** A two-part input: Native color swatch button alongside a hex code text input.
  - **Parent Category Select:** A dropdown to establish hierarchy. Includes "None (Top-level)" and all existing parent categories.
  - **Income Toggle:** A slider switch labeled "This is an Income category" (Visible only for top-level categories).
- **Actions:** "Add Category" (Primary).

### 3. Right Column: Collapsible Hierarchical List
A single card container managing the visual nested tree of categories.
- **Header Toolbar:** Contains a search input to filter categories by name, and an "Expand All / Collapse All" toggle button.
- **Parent Row:** 
  - **Collapse/Expand Chevron:** An interactive arrow icon (▶ / ▼) to hide or show child categories, saving vertical space.
  - 12px colored dot indicator.
  - Category label (Semi-bold, 14px).
  - Target Badge: "Target: $X/mo" in small secondary text.
  - Action Buttons (Visible on hover): "Edit" and "Delete".
- **Child Row (Nested):**
  - Indented 40px from the left under an expanded parent.
  - Slightly smaller 8px colored dot.
  - Sub-category label (13px).
  - Background color is slightly darker/different (#F9F9F9) to distinguish from parents.
  - Action buttons (Edit/Delete) use a smaller font size.
- **Inline Edit State:**
  - Clicking "Edit" on any row (parent or child) transforms the row into an inline form (Name, Target, Color), allowing modifications without losing scroll position or context.

---

## 🕹️ Interactive Behaviors
- **Sticky Form:** Keeps the creation tools accessible at all times.
- **Collapsible Parents:** Clicking the chevron hides/shows children, making long lists manageable.
- **Inline Editing:** Prevents jarring jumps back to the top of the page when editing a category near the bottom.
- **Hierarchy Awareness:** Deleting a parent category triggers a confirmation warning that its children will also be affected (or become uncategorized).
- **Inheritance:** The UI automatically hides the "Income" toggle for child categories because they inherit that status from their parents.
