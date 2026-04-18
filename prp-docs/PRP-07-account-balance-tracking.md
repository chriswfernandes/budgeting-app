# PRP-07: Account Balance Tracking

## Status: Not started

## Overview

When a user imports a **checking account** CSV, the rightmost column contains the running account balance. Parse and store this balance so the app can display "your account balance as of [date]" and use it as the starting point for the annual forecast (PRP-06).

---

## Prerequisites

- PRP-01: CSV import pipeline, `store` helper
- PRP-06: `forecast-start-{year}` key (this PRP feeds data into it)

---

## Part 1: Balance Column Detection in CSV Import

### How it works today

The CSV parser in `BudgetTracker.jsx` looks for `date`, `description`, and `withdrawal`/`deposit`/`amount` columns. It ignores any remaining columns.

### Change

After the existing column detection, add a step to detect a **balance column**:

```js
// After finding date/description/amount columns:
const balanceIdx = headers.findIndex(h =>
  /balance|running.?bal|closing.?bal/i.test(h)
);
```

If `balanceIdx !== -1`, for each parsed row, read `row[balanceIdx]` and convert to a number (strip `$`, commas, handle negative parentheses `(1,234.56)` → `-1234.56`).

### What to extract

For each imported CSV row that has a valid balance:
- Record the `date` and `balance` value.

After parsing all rows, take the **most recent date's balance** as the authoritative closing balance for the import.

This gives us: `{ date: 'YYYY-MM-DD', balance: number }` — the latest account balance found in the file.

---

## Part 2: Balance Storage

### Data model

```js
// Stored per account-month
// Key: balance-{year}-{month}
// Value: { balance: number, date: string, source: 'csv' }
```

When a CSV import completes and a balance was detected:

1. Determine which year and month the closing balance date falls in.
2. Store `{ balance, date, source: 'csv' }` at `balance-{year}-{month}`.
3. If a record already exists for that month, only overwrite if the new date is **later** than the stored date (newer data wins).

### Why per-month and not per-account

The app does not currently have named accounts — CSVs are tagged as `'checking'` or `'credit'`. Account balance tracking only applies to checking accounts (credit card balances are liabilities, not cash). Per-month storage is simple and sufficient.

---

## Part 3: UI — Displaying the Balance

### Overview View

In the `OverviewView` component, if any `balance-{year}-{month}` records exist for the current year, show a compact balance banner below the KPI tiles:

```
┌──────────────────────────────────────────────────────┐
│  Account balance   $12,618   as of Mar 14, 2026       │
└──────────────────────────────────────────────────────┘
```

The date shown is the most recent balance date across all months of the current year.

### Month View

In `MonthView`, if a `balance-{year}-{month}` record exists for the month being viewed, show it in the income row area:

```
Account balance at end of month:  $12,618  (from CSV, Mar 14)
```

If no balance is recorded for that month but one exists for a prior month in the same year, show:

```
Last recorded balance:  $11,200  (Jan 31)
```

Use muted text colour for the "last recorded" variant to signal it's not the current month.

---

## Part 4: Integration with Forecast (PRP-06)

In `ForecastView`, below the starting balance input, show:

```
Starting balance  [$12,400.00]  [Edit]

Last recorded balance: $12,618 (from Mar 14 statement)  [Use this →]
```

Clicking "Use this →" sets the starting balance input to the most recent recorded balance and saves it to `forecast-start-{year}`.

The helper text only appears if a `balance-{year}-{month}` record exists for any month in the selected year.

---

## App State Changes

Add to root state:
```js
const [accountBalances, setAccountBalances] = useState({});

// On startup, load all balance records:
// Iterate over known years and months, collect any balance-{y}-{m} keys
// that exist. Store as { 'balance-2026-2': { balance, date, source }, ... }

const saveAccountBalance = async (year, month, record) => {
  const key = `balance-${year}-${month}`;
  const existing = accountBalances[key];
  if (existing && existing.date >= record.date) return; // don't overwrite newer data
  const updated = { ...accountBalances, [key]: record };
  setAccountBalances(updated);
  await store.set(key, record);
};
```

Pass `accountBalances` and `saveAccountBalance` as props to components that need them.

---

## Edge Cases

- **Credit card CSVs**: Some credit card files have a balance column too, but it represents a liability (money owed), not cash. Do not store these. Detect account type from the import flow's existing `account` field — only store if `account === 'checking'`.
- **Negative balances**: Valid — store as-is.
- **Multiple imports for the same month**: Always keep the record with the later date.
- **Balance column not found**: Silent — the import completes normally with no balance recorded. No warning needed.

---

## Acceptance Criteria

- [ ] CSV import detects a `balance`/`running balance`/`closing balance` column by header name
- [ ] Only stores balance for `checking` account imports, not credit card
- [ ] Stores the closing balance (latest-date row) from each import at `balance-{year}-{month}`
- [ ] Does not overwrite an existing record with an older date
- [ ] `OverviewView` shows most recent account balance when records exist for the current year
- [ ] `MonthView` shows the month's closing balance if available, or last known balance if not
- [ ] `ForecastView` shows a "Use this →" helper when a recorded balance exists for the year
- [ ] Clicking "Use this →" populates and saves the starting balance
- [ ] No regression to the CSV import classify flow
- [ ] Importing a CSV with no balance column completes silently without error
