# PRP-04.5.2: Advanced Classification & Inline Categories

## Status: Complete

## Overview
Overhaul the `ClassifyView` to provide better transaction context, precision rule building (including amount and type conditions), and the ability to create categories on the fly.

## 1. UX Enhancements
*   **Transaction Header**: Displays Date, Transaction Type (Money In/Out), and Account.
*   **Visual Cues**: Green/Red color coding for income vs expenses in the classification display.

## 2. Advanced Rule Builder
*   **Expansion**: Selecting a category now opens an "Advanced Rule" panel instead of a simple toggle.
*   **Keyword Extraction**: Automatically strips noise (like `***` or long ID numbers) from descriptions to suggest cleaner rule triggers.
*   **Conditional Logic**: 
    *   `Amount > [Value]`: Rules only trigger if the transaction exceeds a specific amount.
    *   `Type`: Rules can be restricted to only "Expense" or only "Income".

## 3. Inline Category Management
*   **Quick Add**: "+ New Category" button added to the classification grid.
*   **Inline Form**: Allows setting Label, Color, Parent, and Income-status without leaving the import flow.

## 4. Technical Changes
*   **Rule Model**: Updated to include `amountThreshold` and `type`.
*   **ClassifyView.jsx**: Complete rewrite to support new stateful flows (Rule Builder vs Category Form).
*   **RulesView.jsx**: Updated to allow viewing and editing of the new conditional fields.

## Acceptance Criteria
- [x] Can create a new category while classifying and immediately use it.
- [x] Rules can be created with specific amount thresholds (e.g., "Only if > $100").
- [x] Transaction date is visible during classification.
- [x] Rules successfully filter by transaction type (Income/Expense).
