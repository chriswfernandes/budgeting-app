# PRP-05: Month View UX — Categories Above the Fold & Plan vs Actual

## Status: Not started

## Overview

Reorganise `MonthView` so the category budget summary is the first thing a user sees, with plan vs. actual columns showing how each category is tracking. The transaction list moves below this section. This makes the month view useful as a budget-tracking tool, not just a transaction log.

---

## Prerequisites

- PRP-02: `globalBudgets`, `monthOverrides`, category budget resolution in place
- PRP-03: `getBudgetStatus`, `resolveMonthBudget`, spend helpers in place

---

## Part 1: Category Summary Panel (above the fold)

### Layout

Replace the current top section of `MonthView` with a category summary table. The income row and transaction import controls move below the category table.

```
┌──────────────────────────────────────────────────────────────────┐
│  January 2026                                                     │
│                                                                   │
│  BUDGET SUMMARY                                                   │
│  ─────────────────────────────────────────────────────────────   │
│  Category          Budget      Actual      Remaining   Status    │
│  ─────────────────────────────────────────────────────────────   │
│  Food              $800        $620        $180 left   ●         │
│  Transport         $300        $340        $40 over    ●         │
│  Housing           $2,100      $2,100      $0          ●         │
│  Subscriptions     $120        $95         $25 left    ●         │
│  Entertainment     $200        —           $200 left   ○         │
│  (Uncategorised)   —           $45         —           —         │
│  ─────────────────────────────────────────────────────────────   │
│  Total             $3,520      $3,200      $320 left             │
└──────────────────────────────────────────────────────────────────┘
```

### Column definitions

| Column | Logic |
|---|---|
| **Budget** | `resolveMonthBudget(categoryId, year, month)` — month override → global → `—` if unset |
| **Actual** | Sum of all expense transactions for this category in this month (`getCategorySpend`) |
| **Remaining** | `budget - actual`. Show "X left" if positive, "X over" if negative. Show `—` if no budget set |
| **Status** | Colour dot from `getBudgetStatus`: green (under), amber (warning, >80%), red (over). Grey circle if no budget |

### Uncategorised row

Always show a final row for transactions with `category === null`. No Budget column. Actual = sum of uncategorised transactions. Remaining = `—`. A link: "Classify →" that switches view to `'classify'`.

### Total row

Sum the Budget column (only rows with a budget set) and the Actual column (all rows). Remaining = total budget − total actual.

### Income summary

Above the category table, keep a compact income row:

```
Income   Planned: $8,500   Actual: $8,500   ✓
```

- **Planned**: `resolveMonthIncome(year, month, incomeSources, incomeAdjusts)`
- **Actual**: Sum of all transactions where `type === 'income'` or `isIncomeCat(category)`
- Show ✓ (green) if actual ≥ planned, ✗ (red) if not

---

## Part 2: Transactions Below the Fold

Move the full transaction list (with search, filter, and CSV import) into a collapsible section below the category summary.

### Default state

The section is **collapsed** by default if the month has ≥ 1 categorised transaction. It is open by default if the month has uncategorised transactions (to prompt the user to classify them).

```
▼  Transactions (42)                [Import CSV]  [+ Add]
```

Clicking the header toggles open/closed. The arrow rotates. The count shows total transactions in the month.

### Import CSV and Add transaction controls

Move these buttons into the transactions section header row (right-aligned). They are always visible even when the section is collapsed.

### Transaction list

No change to the transaction list itself — same search, filter, inline edit, and delete as today.

---

## Part 3: Month Override Panel

The existing "Override budget for this month" panel (from PRP-02) moves below the Transactions section. It is collapsed by default and labelled:

```
▶  Budget overrides for this month
```

---

## Storage

No new storage keys. This PRP is a pure UI reorganisation using existing data.

---

## Acceptance Criteria

- [ ] Category summary table is the first content visible in MonthView, above transactions
- [ ] Budget column uses `resolveMonthBudget` (respects month overrides)
- [ ] Actual column uses `getCategorySpend` for each category
- [ ] Remaining column shows "X left" or "X over" correctly; `—` when no budget is set
- [ ] Status dot colours match `getBudgetStatus` output
- [ ] Uncategorised row appears when uncategorised transactions exist, with "Classify →" link
- [ ] Total row sums correctly
- [ ] Income row shows planned vs actual
- [ ] Transactions section is collapsible; collapsed by default when all transactions are categorised
- [ ] CSV import and Add transaction buttons are accessible without expanding the section
- [ ] No regression: transaction list, search, filter, inline edit still work
- [ ] No regression: CSV import flow still works
