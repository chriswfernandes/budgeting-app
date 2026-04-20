# PRP-14: Budget Tab Filtering & Categories Target Removal

## Status: Done

## Dependencies

- PRP-13 complete (`isIncomeCat`, `isCCPaymentCat` utilities and system-category guard exist)

---

## Problem Summary

Two independent issues cause confusion and potential data desync:

1. **Budget "Outgoing" tab filtering bug** — the category list in the Outgoing tab shows income-flagged categories (and subcategories of income categories) alongside expense categories. Users can accidentally set spending targets against income categories. The filter uses `!c.isIncome` (a direct flag check) instead of `isIncomeCat(categories, c.id)`, so any child category whose *parent* is income — but which has no `isIncome: true` flag of its own — slips through.

2. **Duplicate target-setting surface in CategoriesView** — the Categories tab contains a "Target ($)" input in both the Create Category form and the inline edit form. The Budget tab (`BudgetView`) is the authoritative place to set spending targets (it supports time-bounded periods, overrides, and history). The CategoriesView target field predates this architecture, writes to a `target` property on the category object, and is no longer read by anything meaningful. Its presence confuses users and creates a second code path that quietly diverges from Budget tab entries.

---

## Fix 1 — Outgoing tab: use `isIncomeCat` for filtering

### Where

`BudgetView.jsx`, outgoing tab — three places that filter the category list:

1. `activeMonthTotal` computation (~line 15 of the component):
```js
const activeMonthTotal = categories
  .filter(c => !c.isIncome)
  .reduce(...)
```

2. Outgoing sidebar category list (~sidebar render):
```jsx
{categories.filter(c => !c.isIncome).map(c => {
```

3. `getCatDisplayValue` uses `getCatEntries` which doesn't filter, but the sidebar list above drives what is selectable — fixing the sidebar filter is sufficient.

### What goes wrong

`isIncomeCat(categories, c.id)` checks both the direct flag *and* the parent chain:

```js
export function isIncomeCat(categories, catId) {
  const cat = categories.find(c => c.id === catId);
  if (cat?.isIncome) return true;
  if (cat?.parentId) {
    const parent = categories.find(p => p.id === cat.parentId);
    return parent?.isIncome || false;
  }
  return false;
}
```

The current filter `!c.isIncome` only checks the direct flag. A subcategory of `income` (e.g. a child with `parentId: 'income'`) has no direct `isIncome: true` flag, so it passes the filter and appears in Outgoing.

CC Payment categories (`isCCPayment: true`) should also be excluded from Outgoing — they are neutral bookkeeping entries, not spending targets.

### Fix

In `BudgetView.jsx`, import `isIncomeCat` and `isCCPaymentCat` from `utils` (they are already available in the app), then replace the two filter calls:

**Before:**
```js
categories.filter(c => !c.isIncome)
```

**After:**
```js
categories.filter(c => !isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id))
```

Apply this change to:
- `activeMonthTotal` reducer
- Outgoing sidebar `.map()` call

No changes needed in the Income tab — the Income tab already shows named income *sources* (the `incomeSources` array), not categories, so it is unaffected by this fix.

---

## Fix 2 — CategoriesView: remove Target field

### Where

`CategoriesView.jsx` — four locations:

| Location | Code |
|---|---|
| State initialisation | `useState({ label: '', color: '#888888', parentId: '', isIncome: false, target: '' })` |
| `saveCategory()` | `target: parseFloat(form.target) \|\| 0` written to category object |
| `saveInlineEdit()` | `target: parseFloat(editForm.target) \|\| 0` written to category object |
| `startInlineEdit()` | `target: cat.target?.toString() \|\| ''` read back into form |
| Create form JSX | `<input ... placeholder="500" />` target field |
| Parent inline-edit JSX | `<input ... placeholder="Target" />` target field |
| Child inline-edit JSX | `<input ... placeholder="Target" />` target field |
| Parent display JSX | `{p.target > 0 && <div>Target: {fmt(p.target)}</div>}` |
| Child display JSX | `{c.target > 0 && <div>Target: {fmt(c.target)}</div>}` |

### What goes wrong

- Users who set a "Target" in CategoriesView see a different (and stale) value from what Budget tab shows, because the Budget tab reads from `budgetEntries[catId]` (time-bounded periods in localStorage under `budget-entries`), not from `category.target`.
- The `target` property on the category object is not used by `resolveMonthBudget`, `getBudgetStatus`, MonthView, OverviewView, or any chart/summary. It is effectively a dead field.
- The field will confuse new users into thinking they have set a budget when they haven't.

### Fix

**State:** Remove `target` from both `form` and `editForm` initial values.

```js
// Before
const [form, setForm] = useState({ label: '', color: '#888888', parentId: '', isIncome: false, target: '' });
const [editForm, setEditForm] = useState({ label: '', color: '', parentId: '', isIncome: false, target: '' });

// After
const [form, setForm] = useState({ label: '', color: '#888888', parentId: '', isIncome: false });
const [editForm, setEditForm] = useState({ label: '', color: '', parentId: '', isIncome: false });
```

**`saveCategory()`:** Remove the `target` line. Do not write it to the category object.

```js
// Before
const catData = { label: form.label, color: form.color, ..., target: parseFloat(form.target) || 0 };

// After
const catData = { label: form.label, color: form.color, parentId: form.parentId || undefined, isIncome: form.parentId ? false : form.isIncome };
```

**`saveInlineEdit()`:** Same removal — do not write `target`.

**`startInlineEdit()`:** Remove the `target` read from `cat.target`.

**Create form JSX:** Delete the "Target ($)" label + input block entirely.

**Parent and child edit-mode JSX:** Delete the target `<input>` from the inline edit row for both parent and child rows.

**Parent and child display JSX:** Delete the `{p.target > 0 && ...}` and `{c.target > 0 && ...}` display lines.

### Data compatibility note

Existing category objects in storage that already have a `target` property are harmless — no code reads them after this PRP. There is no need to migrate or strip the property from storage. It will simply be ignored.

---

## Files changed

| File | Change |
|---|---|
| `src/BudgetView.jsx` | Import `isIncomeCat`, `isCCPaymentCat` from utils; update two `.filter()` calls in the Outgoing tab |
| `src/CategoriesView.jsx` | Remove `target` from all form state, `saveCategory`, `saveInlineEdit`, `startInlineEdit`, Create form JSX, and both parent/child edit + display row JSX |

---

## Acceptance Criteria

- [ ] A category with `isIncome: true` (e.g. the built-in "Income" category) does **not** appear in the Budget → Outgoing tab category list
- [ ] A child category whose parent has `isIncome: true` does **not** appear in the Budget → Outgoing tab category list
- [ ] The CC Payment category does **not** appear in the Budget → Outgoing tab category list
- [ ] All non-income, non-CC-payment categories continue to appear in the Outgoing tab
- [ ] The Budget → Income tab is unchanged (still shows named income sources)
- [ ] The "Target ($)" input is absent from the Create Category form in CategoriesView
- [ ] The "Target" input is absent from the inline edit row for both parent and child categories in CategoriesView
- [ ] Editing a category name and colour still works correctly (Save persists the change)
- [ ] Editing a child category's parent still works correctly
- [ ] The "Target: $X" display line is absent from all category rows in CategoriesView
- [ ] No regression: existing categories load, display, and can be created/edited/deleted as before
- [ ] No console errors on load
