# Rules Tab UI Specification

This document describes the modern, intuitive UI structure and interactive elements of the "Rules Engine" tab to facilitate AI-assisted UI generation.

## 🏗️ Layout Structure
The Rules tab uses a two-column layout optimized for long lists.

### 1. Header Section
- **Title:** "Rules Engine" (26px, Semi-bold).
- **Description:** "Automatically categorize transactions during CSV imports." (14px, Secondary color).

### 2. Left Column: Sticky Creation Sidebar (280px fixed width)
A vertical card-style container for adding new rules.
- **Behavior:** `position: sticky` so it remains visible while the user scrolls down a long list of rules on the right.
- **Card Styling:** White background, subtle border, rounded corners (12px).
- **Section Label:** Small uppercase text "CREATE RULE" with letter-spacing.
- **Form Fields:**
  - **Trigger Input:** Label "If description contains:", Placeholder "e.g., Starbucks". Uses standard input styling.
  - **Category Select:** Label "Set category to:", a dropdown populated with all categories.
    - Hierarchical display: Sub-categories are prefixed with "↳ ".
- **Actions:**
  - "Add Rule" (Primary button): Full width.

### 3. Right Column: Searchable Rules List (Flexible width)
A list of all established rules.
- **Header Toolbar:** A sticky search bar (`position: sticky; top: 0; z-index: 10;`) at the top of the list container to quickly filter rules by trigger keyword or category name.
- **Empty State:** A dashed-border card with "No rules set up yet" text centered.
- **List Container:** A single card container with rules separated by horizontal lines.
- **Rule Row Item (Default State):**
  - **Interactive Toggle:** A custom "Switch" component (slider style) on the far left.
  - **Trigger Text:** The keyword/phrase in quotes (e.g., ""Starbucks"") in bold 14px text.
  - **Target Indicator:** Shows a "↳" symbol followed by a colored category dot and the category name.
  - **Action Buttons (Visible on hover):**
    - "Edit" (Ghost button).
    - "✕" (Ghost button with Danger color) for deletion.
- **Rule Row Item (Inline Edit State):**
  - Clicking "Edit" transforms the row into an inline form.
  - The trigger text becomes an input field.
  - The target indicator becomes a category dropdown.
  - Actions change to "Save" (Primary) and "Cancel" (Ghost).
  - This eliminates the need to scroll back up to the sidebar to edit an item at the bottom of the list.
- **Inactive State:** If a rule is toggled off, the entire row has reduced opacity (0.5).

---

## 🕹️ Interactive Behaviors
- **Sticky Positioning:** The sidebar and search bar stay in view during scroll, reducing vertical travel.
- **Inline Editing:** Editing happens directly in the list, preserving context.
- **Instant Search:** Typing in the search bar instantly filters the rules list below.
- **Inline Toggling:** Clicking the slider switch immediately activates/deactivates the rule without opening a modal.
- **Hover Highlighting:** Individual rule rows change background color on hover to indicate they are interactive.
