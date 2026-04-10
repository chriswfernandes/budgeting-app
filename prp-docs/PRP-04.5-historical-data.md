# PRP-04.5: Historical Data — Supporting Previous Years

## Overview
Enable users to add data for previous years (e.g., 2025) and ensure the import engine correctly routes transactions to the appropriate year, even if that year hasn't been explicitly "added" yet.

---

## 1. Nav Bar: Flexible "Add Year"

### Current behaviour
The "Add Year" input placeholder suggests `new Date().getFullYear() + 1`.

### New behaviour
Allow users to enter any 4-digit year. If the year is older than the current minimum year, it should still be added to the `years` array and sorted correctly.

In `BudgetTracker.jsx`:
- Ensure `doAddYear` sorts the `updatedYears` array (already doing this).
- Update the placeholder to be more generic or just current year.

---

## 2. Import Engine: Auto-Year Discovery

### Current behaviour
The `handleFile` function in `BudgetTracker.jsx` identifies the year from the CSV date column. If a transaction belongs to a year not currently in the `years` list, it may not be correctly saved or the UI might not reflect it until a refresh.

### New behaviour
When importing a CSV:
1. Parse transactions and determine their years.
2. If any transactions belong to a year not in the `years` state:
   - Add those years to the `years` list automatically.
   - Save the updated `years` list to storage.
3. Ensure the `txns` state is updated for the *current* active year if any transactions were added to it, and that other years' data is saved to storage.

Update `handleFile` in `BudgetTracker.jsx`:
```js
const newYearsSet = new Set(years);
// ... during loop
if (txn.date) { 
  const d = new Date(txn.date); 
  if (!isNaN(d)) { 
    const y = d.getFullYear(); 
    newYearsSet.add(y); // Auto-discover year
  } 
}
// ... after loop
if (newYearsSet.size > years.length) {
  const updatedYears = Array.from(newYearsSet).sort((a, b) => a - b);
  setYears(updatedYears);
  await store.set('budget-years', updatedYears);
}
```

---

## 3. Storage Compatibility

Ensure `store.get('budget-years')` fallback handles cases where no years are set (default to current year).

---

## Acceptance Criteria
- [ ] User can manually add "2025" via the "+ Year" button.
- [ ] Importing a CSV containing 2025 transactions automatically adds "2025" to the year tabs.
- [ ] Year tabs are always sorted numerically (e.g., 2025, 2026, 2027).
- [ ] No data loss when adding a previous year.
