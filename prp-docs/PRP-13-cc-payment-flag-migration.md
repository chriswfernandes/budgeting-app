# PRP-13: Fix CC Payment Flag Migration & Re-apply Rules Scope

## Status: Done

## Dependencies

- PRP-11 complete (CC Payment category and `isCCPaymentCat` utility exist)
- PRP-12 complete (Re-apply rules button exists)

---

## Problem Summary

Three independent bugs prevent the CC Payment feature from working correctly for users who had data stored before PRP-11 was implemented:

1. **Stored categories are missing `isCCPayment: true`** — the flag never makes it to the live `categories` state, so `isCCPaymentCatLocal` always returns `false`, and CC Payment transactions are counted in expense totals.
2. **Re-apply rules only iterates the current year** — `txns` state is replaced (not merged) when the year changes, so transactions from other years are invisible and never reclassified.
3. **CategoriesView uses `window.confirm` and allows deleting system categories** — violates the no-modal rule and could permanently break the CC Payment feature by deleting or corrupting the category.

---

## Bug 1 — `isCCPayment: true` flag missing from stored categories

### Where

`BudgetTracker.jsx` startup `useEffect`, line 232:

```js
const sc = await store.get('budget-categories') || INITIAL_CATEGORIES;
```

`INITIAL_CATEGORIES` contains:

```js
{ id: 'cc-payment', label: 'CC Payment', color: '#5F7A9E', isCCPayment: true }
```

### What goes wrong

`store.get('budget-categories')` returns an array saved to localStorage **before PRP-11 added the `isCCPayment` flag**. The `cc-payment` entry in storage looks like:

```js
{ id: 'cc-payment', label: 'CC Payment', color: '#5F7A9E' }
// isCCPayment is absent — was never saved
```

Because stored categories are not null, the `|| INITIAL_CATEGORIES` fallback never fires. The live `categories` state contains the unflagged version. `isCCPaymentCat` checks `cat?.isCCPayment` — this returns `undefined`, which is falsy.

**Consequence:** Every filter that calls `isCCPaymentCatLocal` (in `monthData`, `buildForecast`, `projectScenario`, `MonthView`) silently passes, and CC Payment transactions are included in expense and income totals — exactly as if PRP-11 were never implemented.

### Fix — startup migration

After loading stored categories, patch any known system category flags that may be absent. This is the same pattern as the existing `migrateStorage()` call.

In the startup `useEffect` (after line 232), add:

```js
const sc = await store.get('budget-categories') || INITIAL_CATEGORIES;

// Ensure system flags are present on categories that may have been saved before those flags existed
const SYSTEM_FLAGS = { 'cc-payment': { isCCPayment: true } };
const scPatched = sc.map(c => {
  const flags = SYSTEM_FLAGS[c.id];
  if (!flags) return c;
  const needsPatch = Object.entries(flags).some(([k, v]) => c[k] !== v);
  if (!needsPatch) return c;
  return { ...c, ...flags };
});
const categoriesChanged = scPatched.some((c, i) => c !== sc[i]);
if (categoriesChanged) await store.set('budget-categories', scPatched);
```

Then use `scPatched` instead of `sc` when calling `setCategories`:

```js
setCategories(scPatched);
```

**Behaviour after fix:**

| Scenario | Before | After |
|---|---|---|
| Fresh install (no stored categories) | INITIAL_CATEGORIES used ✓ | INITIAL_CATEGORIES used ✓ |
| Stored categories from before PRP-11 | `isCCPayment` absent → totals wrong ✗ | Flag patched on load → totals correct ✓ |
| Stored categories from after PRP-11 | Flag present → no change needed | No-op patch (same objects returned) ✓ |

---

## Bug 2 — Re-apply rules only processes the current year

### Where

`BudgetTracker.jsx`, `reapplyRules()`, line 342–362:

```js
const reapplyRules = async () => {
  ...
  for (const [key, list] of Object.entries(txns)) { // ← only current year
    ...
  }
  setTxns(updatedTxns);
  return count;
};
```

### What goes wrong

`txns` state is populated by the year-scoped `useEffect` (line 271). When the user is viewing 2026, `txns` contains only 2026 data. Transactions from September–December 2025 are not in `txns` and are never visited by `reapplyRules`.

For a user who imported Sep–Dec 2025 data, all those months contain unclassified CC Payment transactions. Re-apply returns 0 for those months because they are invisible.

### Fix — iterate all years from storage

Replace the `for (const [key, list] of Object.entries(txns))` loop with a loop over all known years:

```js
const reapplyRules = async () => {
  const activeRules = rules.filter(r => r.active);
  if (!activeRules.length) return 0;

  let count = 0;
  const updatedTxnsForCurrentYear = { ...txns };

  for (const y of years) {
    for (let m = 0; m < 12; m++) {
      const storageKey = `t-${y}-${m}`;
      const stateKey = `${y}-${m}`;
      const list = await store.get(storageKey);
      if (!list || list.length === 0) continue;

      const updated = list.map(t => {
        const match = activeRules.find(r => t.description.toLowerCase().includes(r.trigger.toLowerCase()));
        if (!match) return t;
        const newType = isIncomeCatLocal(match.targetCategory) ? 'income' : 'expense';
        if (t.category === match.targetCategory && t.type === newType) return t;
        count++;
        return { ...t, category: match.targetCategory, type: newType };
      });

      const changed = updated.some((t, i) => t !== list[i]);
      if (changed) {
        await store.set(storageKey, updated);
        // Update in-memory state only for the currently loaded year
        if (y === year) {
          updatedTxnsForCurrentYear[stateKey] = updated;
        }
      }
    }
  }

  setTxns(updatedTxnsForCurrentYear);
  return count;
};
```

**Behaviour after fix:**

| Scenario | Before | After |
|---|---|---|
| Re-apply while viewing 2026, 2025 data exists | Only 2026 reclassified ✗ | All years reclassified ✓ |
| No multi-year data | Same as before ✓ | Same as before ✓ |
| Large dataset (many months) | Fast (in-memory only) | Slightly slower (reads storage per month, but skips empty months) |

---

## Bug 3 — CategoriesView allows deleting system categories and uses `window.confirm`

### Where

`CategoriesView.jsx`, `del()`, line 49–51:

```js
const del = (id) => {
  if (window.confirm('Delete category?')) onSaveCategories(categories.filter(c => c.id !== id && c.parentId !== id));
};
```

### What goes wrong

1. **`window.confirm` is a modal** — violates the no-modal design rule documented in `prp-docs/README.md`. The app uses inline confirmation patterns everywhere else.
2. **No guard against system categories** — a user can delete `cc-payment` (or `income`) from the category list. This would cause `isCCPaymentCat` to return false for all transactions and silently re-introduce double-counting. Existing rules targeting `cc-payment` would also become orphaned.

### Fix — inline confirmation + system category protection

Replace `del` with an inline confirmation pattern (matching the "Clear data" and "Re-apply rules" patterns):

```js
const [confirmDeleteId, setConfirmDeleteId] = useState(null);

const SYSTEM_CATEGORY_IDS = ['cc-payment', 'income'];

const del = (id) => {
  if (SYSTEM_CATEGORY_IDS.includes(id)) return; // silently block, button hidden anyway
  onSaveCategories(categories.filter(c => c.id !== id && c.parentId !== id));
  setConfirmDeleteId(null);
};
```

In the category row JSX, replace the delete button with an inline confirm swap:

```jsx
{confirmDeleteId === p.id ? (
  <>
    <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, color:'var(--color-text-danger)' }} onClick={() => del(p.id)}>Confirm</button>
    <button className="btn-g" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => setConfirmDeleteId(null)}>✕</button>
  </>
) : (
  <>
    <button className="btn-g" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => startInlineEdit(p)}>Edit</button>
    {!SYSTEM_CATEGORY_IDS.includes(p.id) && (
      <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, color:'var(--color-text-danger)' }} onClick={() => setConfirmDeleteId(p.id)}>✕</button>
    )}
  </>
)}
```

Apply the same pattern to child category rows (using `confirmDeleteId === c.id`).

---

## Files changed

| File | Change |
|---|---|
| `src/BudgetTracker.jsx` | Add system-flag migration after loading stored categories; fix `reapplyRules` to iterate all years |
| `src/CategoriesView.jsx` | Replace `window.confirm` with inline confirmation; hide delete button for system categories |

---

## Acceptance Criteria

- [ ] After page refresh with pre-PRP-11 stored categories, CC Payment transactions are excluded from January 2026 expense total (should drop by ~$6,580)
- [ ] `isCCPaymentCat(categories, 'cc-payment')` returns `true` immediately after app load
- [ ] Re-apply rules button reclassifies transactions across ALL years, not just the currently viewed year
- [ ] After Re-apply, Sep–Dec 2025 CC Payment transactions are correctly classified
- [ ] Re-apply result count reflects reclassifications across all years
- [ ] Delete button is hidden for `cc-payment` and `income` categories in CategoriesView
- [ ] Attempting to delete other categories shows inline confirmation (no `window.confirm` dialog)
- [ ] Cancelling inline delete confirmation restores the normal row state
- [ ] No regression: existing non-system categories can still be deleted after confirming
