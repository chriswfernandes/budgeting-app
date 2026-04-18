# PRP-08: UI & Design Polish

## Status: Not started

## Overview

Targeted visual refinements across the entire app with no new features, no layout restructuring, and no external dependencies. All changes are CSS variable updates and inline style edits within existing components. The goal is to move from a functional-but-flat aesthetic to something that feels more polished and considered — better depth, stronger hierarchy, and a more cohesive colour system.

---

## Design direction

The current app is clean and minimal. The changes here preserve that character but add:

- **Depth** — subtle shadows on cards instead of just hairline borders
- **Hierarchy** — stronger visual separation between page sections and between label/value pairs
- **A single accent colour** — interactive blue used consistently for focus, active states, and links
- **Richer semantics** — income/expense colours that read as clearly positive or negative
- **More breathing room** — small spacing increases in key places

---

## Part 1: Design token updates

All changes are to the CSS variable block inside the `S` constant in `BudgetTracker.jsx`.

### Light mode

| Token | Current | Proposed | Reason |
|---|---|---|---|
| `--color-background-tertiary` | `#f4f4f4` | `#F8FAFC` | Slightly cooler page background |
| `--color-background-secondary` | `#f9f9f9` | `#F1F5F9` | More distinct surface hierarchy |
| `--color-background-primary` | `#ffffff` | `#ffffff` | Keep |
| `--color-border-tertiary` | `#eeeeee` | `#E2E8F0` | More visible hairlines |
| `--color-border-secondary` | `#cccccc` | `#CBD5E1` | More visible interactive borders |
| `--color-border-primary` | `#333333` | `#0F172A` | Richer dark |
| `--color-text-primary` | `#111111` | `#0F172A` | Deep slate — warmer than pure black |
| `--color-text-secondary` | `#666666` | `#64748B` | Slate — more sophisticated grey |
| `--color-text-success` | `#2e7d32` | `#16A34A` | Cleaner green |
| `--color-text-danger` | `#d32f2f` | `#DC2626` | Cleaner red |
| `--color-text-info` | `#0288d1` | `#2563EB` | Blue-600 |
| `--color-background-success` | `#e8f5e9` | `#DCFCE7` | Lighter, fresher green bg |
| `--color-background-danger` | `#ffebee` | `#FEE2E2` | Lighter red bg |
| `--color-background-info` | `#e1f5fe` | `#DBEAFE` | Lighter blue bg |

Two new tokens to add:

```css
--color-accent: #2563EB;                /* interactive blue */
--color-accent-subtle: #EFF6FF;         /* very light blue tint for active/hover backgrounds */
--shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
```

### Dark mode

| Token | Current | Proposed |
|---|---|---|
| `--color-background-tertiary` | `#121212` | `#0F172A` |
| `--color-background-primary` | `#1a1a1a` | `#1E293B` |
| `--color-background-secondary` | `#242424` | `#273449` |
| `--color-border-tertiary` | `#2a2a2a` | `#334155` |
| `--color-border-secondary` | `#444444` | `#475569` |
| `--color-text-primary` | `#eeeeee` | `#F1F5F9` |
| `--color-text-secondary` | `#aaaaaa` | `#94A3B8` |
| `--color-text-success` | `#81c784` | `#4ADE80` |
| `--color-text-danger` | `#e57373` | `#F87171` |
| `--color-text-info` | `#64b5f6` | `#60A5FA` |
| `--color-background-success` | `#1b2e1c` | `#14532D` |
| `--color-background-danger` | `#3c1e1e` | `#450A0A` |
| `--color-background-info` | `#1a2e3e` | `#1E3A5F` |

Dark mode additions:

```css
--color-accent: #60A5FA;
--color-accent-subtle: #1E3A5F;
--shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
```

---

## Part 2: Card treatment

Every component that renders a card div (background-primary + border + border-radius) currently has no shadow. Add `var(--shadow-card)` to all card instances.

```css
/* Add to every card-like element */
box-shadow: var(--shadow-card);
```

For clickable cards (month cards in OverviewView, scenario cards), upgrade to:

```css
.month-card {
  box-shadow: var(--shadow-card);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.month-card:hover {
  border-color: var(--color-border-secondary);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}
```

The easiest approach is to add `--shadow-card` to the shared `cardStyle` object used in MonthView and ForecastView, and update the `.month-card` class in `S`.

---

## Part 3: Navigation bar

### Height and logo area

Increase nav height from `52px` to `58px`. Increase the "Budget" wordmark from `15px` to `16px`, `fontWeight: 600`.

### Tab active state

Replace the current active tab style (grey filled background) with an underline accent:

```css
/* Current */
.nav-tab.active {
  background: var(--color-background-secondary);
  border-color: var(--color-border-secondary);
  color: var(--color-text-primary);
}

/* Proposed */
.nav-tab.active {
  background: transparent;
  border-color: transparent;
  color: var(--color-text-primary);
  font-weight: 500;
  box-shadow: inset 0 -2px 0 var(--color-accent);
}
```

This replaces the filled box look with a clean underline that references the accent colour — standard in modern tabbed interfaces.

### Tab hover

```css
.nav-tab:hover {
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
}
```

---

## Part 4: KPI tiles

The current tiles are plain white boxes with a label and a number. Add a 3px coloured top border to convey semantics at a glance.

Tiles with semantic meaning get a matching top border:

| Tile | Top border colour |
|---|---|
| Income / Total income | `var(--color-text-success)` |
| Expenses / Total expenses | `var(--color-text-danger)` |
| Net (positive) | `var(--color-text-success)` |
| Net (negative) | `var(--color-text-danger)` |
| Over-budget count | `var(--color-text-danger)` |
| Account balance | `var(--color-accent)` |
| Forecast: Planned net | `var(--color-text-secondary)` |
| Forecast: Actual net | `var(--color-text-success)` (or danger) |
| Forecast: Year-end estimate | `var(--color-accent)` |

Implementation — add to each tile div:

```jsx
style={{
  borderTop: `3px solid ${semanticColour}`,
  borderRadius: 'var(--border-radius-lg)',
  // top border overrides the corner radius on the top edge:
  borderTopLeftRadius: 'var(--border-radius-lg)',
  borderTopRightRadius: 'var(--border-radius-lg)',
}}
```

---

## Part 5: Progress bars (MonthView)

The category budget progress bars are currently 2px tall — barely visible. Increase to 5px and round the track.

```jsx
/* Track */
<div style={{ height: 5, background: 'var(--color-border-tertiary)', borderRadius: 3, marginBottom: 6 }}>
  {/* Fill */}
  <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: 3 }} />
</div>
```

---

## Part 6: Overview bar chart

The current monthly performance chart uses the background success/danger colours at 0.8 opacity. Update to use the text-level colours at lower opacity for more visual impact:

```jsx
/* Income bar */
<div style={{ background: 'var(--color-text-success)', opacity: 0.25, borderRadius: '3px 3px 0 0' }} />

/* Expense bar */
<div style={{ background: 'var(--color-text-danger)', opacity: 0.25, borderRadius: '3px 3px 0 0' }} />
```

Also increase the chart container height from `100px` to `120px` (bars from `78px` to `96px`).

Add a subtle baseline rule at the bottom of the chart area:

```jsx
<div style={{ height: 1, background: 'var(--color-border-tertiary)', marginTop: 2 }} />
```

---

## Part 7: Month cards (OverviewView)

The current month cards show name, +income, -expenses, net, and a status dot. Improve the internal hierarchy:

- Month name: keep `14px fontWeight: 500`
- Income/expense lines: use semantic colour instead of `--color-text-secondary`
  - Income: `var(--color-text-success)` at `opacity: 0.8`
  - Expenses: `var(--color-text-danger)` at `opacity: 0.8`
- Net: keep large mono number
- Add a thin left border to the card in the net colour (green/red) when the month has data:

```jsx
<div className="month-card" style={{
  borderLeft: hasData ? `3px solid ${d.net >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)'}` : undefined,
  paddingLeft: hasData ? 13 : 16, // compensate for extra border width
}}>
```

The current-month highlight should use `var(--color-accent)` for the border instead of `--color-border-info`:

```jsx
borderLeft: isCur ? `3px solid var(--color-accent)` : (hasData ? ... : undefined)
```

---

## Part 8: Buttons

### Primary button (`btn-p`)

Add `letter-spacing: 0.01em` and swap the background to `--color-accent` so the primary action colour is consistent with the rest of the accent system rather than pure black:

```css
.btn-p {
  background: var(--color-accent);
  color: #ffffff;
  letter-spacing: 0.01em;
}
.btn-p:hover { opacity: 0.88; }
```

This is the biggest departure from the current design. If the user prefers to keep the black primary button, skip this change. The rest of Part 8 is independent.

### Ghost button (`btn-g`)

Add a subtle hover background:

```css
.btn-g:hover {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

---

## Part 9: Typography refinements

Small targeted changes only — no font import needed.

| Element | Current | Proposed |
|---|---|---|
| Section label (UPPERCASE 11px) | `letterSpacing: 0.06em` | `letterSpacing: 0.08em`, `fontWeight: 500` |
| Page `h1` | `fontSize: 26, fontWeight: 500` | `fontSize: 28, fontWeight: 600` |
| KPI large number | `fontSize: 26, fontWeight: 500` | `fontSize: 28, fontWeight: 600` |
| Table header | `fontSize: 11` | `fontSize: 11, fontWeight: 600` |

---

## Part 10: Forecast SVG chart — area fill

The current balance chart is a single line. Add a subtle filled area beneath the actual-months segment to emphasise confirmed vs projected.

Below the solid `<polyline>`, add a `<path>` that traces the line, drops to the baseline, and closes:

```jsx
{/* Filled area under actual months */}
{lastActualIdx >= 0 && (
  <path
    d={`M ${toX(0)} ${toY(balances[0])} ${
      Array.from({ length: lastActualIdx + 1 }, (_, i) =>
        `L ${toX(i)} ${toY(balances[i])}`
      ).join(' ')
    } L ${toX(lastActualIdx)} ${SVG_H - PB} L ${toX(0)} ${SVG_H - PB} Z`}
    fill="var(--color-text-success)"
    opacity="0.06"
  />
)}
```

---

## Implementation order

Changes are independent and can be applied in any order. Suggested sequence for ease of review:

1. Part 1 (tokens) — everything else depends on this
2. Part 2 (card shadows)
3. Part 3 (nav)
4. Part 4 (KPI tiles)
5. Part 5 (progress bars)
6. Parts 6–10 in any order

---

## What this PRP does NOT change

- Layout structure of any view
- Component boundaries or file splits
- Any feature behaviour
- Font family (system font stays)
- Border radius variables (12px/8px stay)
- Any storage keys or data model

---

## Acceptance Criteria

- [ ] All CSS tokens updated per Part 1 tables (light + dark)
- [ ] Cards throughout the app have `--shadow-card`; clickable cards animate on hover
- [ ] Nav tabs use accent underline for active state; hover uses accent-subtle background
- [ ] Every KPI tile has a 3px semantic top border
- [ ] Budget progress bars are 5px tall
- [ ] Overview chart uses updated bar colours and has a baseline rule
- [ ] Month cards in Overview show left accent border in net colour
- [ ] Primary button uses accent colour (or kept black — decision to be made before implementation)
- [ ] Ghost button hover uses accent colours
- [ ] Section labels are `fontWeight: 500, letterSpacing: 0.08em`
- [ ] Forecast chart has filled area under actual-months segment
- [ ] Dark mode renders correctly for all changes
- [ ] No regressions in layout or functionality
