# PRP-03: Month View — Budget Progress & Warnings

## Status: Implement after PRP-02

## Overview
Wire the global budgets and month overrides into visible progress indicators throughout the app. The category sidebar in the month view gains budget progress bars. The overview month grid gains status indicators. A forecast warning appears when spending pace suggests an overage by month end.

---

## Prerequisites
- PRP-01: `resolveMonthBudget`, `getBudgetStatus` in place
- PRP-02: `globalBudgets`, `monthOverrides` flowing into `MonthView` and `monthData`

---

## 1. Category Sidebar — Budget Progress Bars

### Current behaviour
Each category row in the `MonthView` left sidebar shows:
- Colour dot + category label
- Spend amount (right-aligned)
- A thin fill bar showing spend as % of total expenses

### New behaviour
When a budget limit exists for the category (resolved via `resolveMonthBudget`), the bar changes meaning: it now represents **spend as % of budget limit**, not % of total expenses. When no budget is set, behaviour is unchanged.

Add below each category label row:

```
Food & Dining                        $620 / $800
████████████████░░░░░  77%
```

The bar fill colour changes based on `getBudgetStatus`:
- `'under'` (< 80%): use the category's existing colour
- `'warning'` (80–99%): amber — `#EF9F27`
- `'over'` (≥ 100%): red — `#E24B4A`. Bar overflows visually (cap bar at 100% width, but the text label shows the real over-budget amount)
- `'none'` (no budget): original behaviour (% of total expenses, category colour)

When status is `'over'`, the spend amount text also turns red:
```
Food & Dining                    $920 / $800  ← red text
████████████████████  +$120 over
```

Show the over-budget delta amount below the bar when over.

When status is `'warning'`, show a small amber dot next to the category label instead of the colour dot.

### Implementation

In the `MonthView` component, the category sidebar map currently looks like:
```js
Object.entries(catTotals).sort(([,a],[,b])=>b-a).map(([id, total]) => { ... })
```

Add inside each row:
```js
const limit  = resolveMonthBudget(globalBudgets, monthOverrides, id);
const status = getBudgetStatus(total, limit);
const barPct = limit ? Math.min((total / limit) * 100, 100) : (data.expenses > 0 ? (total / data.expenses) * 100 : 0);
const barColor = status === 'over' ? '#E24B4A' : status === 'warning' ? '#EF9F27' : c.color;
```

Replace the existing simple bar `<div>` with:
```jsx
<div>
  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
      <span style={{
        width:8, height:8, borderRadius:'50%',
        background: status === 'warning' ? '#EF9F27' : c.color,
        display:'inline-block', flexShrink:0
      }} />
      {c.label}
    </div>
    <span style={{
      fontSize:12,
      fontFamily:'var(--font-mono)',
      color: status === 'over' ? 'var(--color-text-danger)' : 'var(--color-text-secondary)'
    }}>
      {fmt(total)}{limit ? ` / ${fmt(limit)}` : ''}
    </span>
  </div>
  <div style={{ height:2, background:'var(--color-border-tertiary)', borderRadius:1 }}>
    <div style={{ height:'100%', width:`${barPct}%`, background:barColor, borderRadius:1,
      transition:'width 0.3s ease' }} />
  </div>
  {status === 'over' && (
    <p style={{ fontSize:11, color:'var(--color-text-danger)', marginTop:3 }}>
      +{fmt(total - limit)} over budget
    </p>
  )}
</div>
```

---

## 2. Month KPI Tiles — Over-Budget Summary

Add a fourth KPI tile to the three-tile row in `MonthView` when any category is over budget:

```
┌──────────┬──────────┬──────────┬──────────────────┐
│ Income   │ Expenses │ Net      │ Over budget       │
│ $14,700  │ -$9,400  │ +$5,300  │ 2 categories      │
└──────────┴──────────┴──────────┴──────────────────┘
```

The fourth tile only renders when `overBudgetCategories.length > 0`. Its background uses `var(--color-background-danger)`.

Calculate `overBudgetCategories` in the `MonthView` render:
```js
const overBudgetCategories = CATEGORIES
  .filter(c => {
    const spent = catTotals[c.id] || 0;
    const limit = resolveMonthBudget(globalBudgets, monthOverrides, c.id);
    return getBudgetStatus(spent, limit) === 'over';
  });
```

Tile content:
```jsx
{overBudgetCategories.length > 0 && (
  <div style={{ background:'var(--color-background-danger)', border:'0.5px solid var(--color-border-danger)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}>
    <p style={{ fontSize:11, color:'var(--color-text-danger)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Over budget</p>
    <p style={{ fontSize:26, fontWeight:500, color:'var(--color-text-danger)' }}>
      {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category' : 'categories'}
    </p>
    <p style={{ fontSize:12, color:'var(--color-text-danger)', marginTop:4 }}>
      {overBudgetCategories.map(c => c.label).join(', ')}
    </p>
  </div>
)}
```

When over-budget tile is present, change the grid from `repeat(3, 1fr)` to `repeat(4, 1fr)`.

---

## 3. Spend Forecast Warning

### Logic
A forecast warning appears when: it's the current month (year + month === today's year + month), at least 7 days have elapsed, and at least one category is on pace to exceed its budget by month end.

Calculate pace for each category:
```js
function forecastSpend(spent, dayOfMonth, daysInMonth) {
  if (dayOfMonth === 0) return 0;
  return (spent / dayOfMonth) * daysInMonth;
}
```

Run this for each category in the current month. If `forecastSpend > limit`, flag it.

### UI
Show a warning banner **above** the KPI tiles, only in the current month, only when forecast overages exist:

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚠  At your current pace, you're on track to overspend in:         │
│     Food & Dining (+$180 projected over)  ·  Shopping (+$90)       │
└────────────────────────────────────────────────────────────────────┘
```

Banner styles:
```jsx
<div style={{
  background: 'var(--color-background-warning)',
  border: '0.5px solid var(--color-border-warning)',
  borderRadius: 'var(--border-radius-md)',
  padding: '12px 16px',
  marginBottom: 16,
  fontSize: 13,
  color: 'var(--color-text-warning)'
}}>
```

Implementation in `MonthView`:
```js
const today = new Date();
const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
const dayOfMonth = today.getDate();
const daysInMonth = new Date(year, month + 1, 0).getDate();

const forecastWarnings = isCurrentMonth && dayOfMonth >= 7
  ? CATEGORIES.filter(c => {
      const spent = catTotals[c.id] || 0;
      const limit = resolveMonthBudget(globalBudgets, monthOverrides, c.id);
      if (!limit) return false;
      const projected = forecastSpend(spent, dayOfMonth, daysInMonth);
      return projected > limit;
    }).map(c => {
      const spent = catTotals[c.id] || 0;
      const limit = resolveMonthBudget(globalBudgets, monthOverrides, c.id);
      const projected = forecastSpend(spent, dayOfMonth, daysInMonth);
      return { category: c, overage: projected - limit };
    })
  : [];
```

---

## 4. Overview Grid — Month Card Status Indicators

### Current behaviour
Month cards show a small dot (green/red) if the month has data.

### New behaviour
Month cards with budget data show additional status indicators.

Add below the existing net savings line in each month card, if `list.length > 0` and any category budgets are set:

```jsx
{overCount > 0 && (
  <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-text-danger)', display:'inline-block' }} />
    <span style={{ fontSize:11, color:'var(--color-text-danger)' }}>
      {overCount} over budget
    </span>
  </div>
)}
{overCount === 0 && hasAnyBudget && (
  <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-text-success)', display:'inline-block' }} />
    <span style={{ fontSize:11, color:'var(--color-text-success)' }}>On track</span>
  </div>
)}
```

Calculate `overCount` and `hasAnyBudget` inside the `OverviewView` month grid map:
```js
const overCount = CATEGORIES.filter(c => {
  const spent = getCategorySpend(d.list, c.id);
  const limit = resolveMonthBudget(globalBudgets, monthOverrides[`${year}-${i}`] || {}, c.id);
  return getBudgetStatus(spent, limit) === 'over';
}).length;

const hasAnyBudget = CATEGORIES.some(c =>
  resolveMonthBudget(globalBudgets, monthOverrides[`${year}-${i}`] || {}, c.id) !== null
);
```

Pass `globalBudgets` and `monthOverrides` as props to `OverviewView`.

---

## 5. Legend Update in Month Category Sidebar

Add a small legend below the category list explaining the colour coding:

```jsx
<div style={{ marginTop:16, paddingTop:12, borderTop:'0.5px solid var(--color-border-tertiary)', display:'flex', flexDirection:'column', gap:6 }}>
  {[
    ['var(--color-text-success)', 'On track'],
    ['#EF9F27', 'Near limit (80%+)'],
    ['var(--color-text-danger)', 'Over budget'],
  ].map(([color, label]) => (
    <div key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--color-text-secondary)' }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }} />
      {label}
    </div>
  ))}
</div>
```

Only render this legend if at least one category has a budget set.

---

## Props Changes Summary

### `OverviewView` — new props
```ts
globalBudgets: GlobalBudgets
monthOverrides: { [key: string]: MonthOverrides }
```

### `MonthView` — new props (already added in PRP-02, now consumed here)
```ts
globalBudgets: GlobalBudgets
monthOverrides: MonthOverrides   // for this specific month only
```

---

## Acceptance Criteria

- [ ] Category bars show `spent / limit` when a budget is set; original behaviour when not
- [ ] Bar colour is category colour (under), amber (warning), red (over)
- [ ] Over-budget categories show "+$X over budget" text below bar
- [ ] Fourth KPI tile appears only when ≥ 1 category is over budget
- [ ] Forecast banner appears only in current month, only after day 7, only when applicable
- [ ] Forecast banner lists category names and projected overage amounts
- [ ] Overview month cards show "N over budget" or "On track" when budgets are set
- [ ] Cards with no budgets set show no budget status indicator (unchanged behaviour)
- [ ] Sidebar legend only appears when ≥ 1 budget is configured
- [ ] No crashes when `globalBudgets` is `{}` or `monthOverrides` is `{}`
