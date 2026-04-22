# PRP-21: Design System + Shell

## Status: Not started

## Dependencies

- PRP-19 (Tailwind CSS v4 migration complete)
- PRP-20 (sidebar tab order)

---

## Problem Summary

The app uses a left sidebar for all navigation and a system-font stack with a neutral warm-gray palette. This PRP establishes the new visual foundation — emerald accent color system, Inter typography, card shadows — and restructures navigation into a top bar with a separate settings shell.

---

## Solution

### 1. Typography — Inter

Add Inter via Google Fonts `@import` in `index.css`. Update `--font-sans` in `@theme`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

@theme {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

### 2. Design Token Replacement

Replace the current color tokens in `index.css` `@theme` and dark-mode override block:

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#f8faf9` | `#0f1a16` |
| `--color-surface` | `#ffffff` | `#1a2d24` |
| `--color-raised` | `#f0f7f4` | `#22352b` |
| `--color-accent` | `#059669` | `#34d399` |
| `--color-accent-bg` | `#d1fae5` | `#064e3b` |
| `--color-success` | `#059669` | `#34d399` |
| `--color-success-bg` | `#d1fae5` | `#064e3b` |
| `--color-danger` | `#dc2626` | `#f87171` |
| `--color-danger-bg` | `#fee2e2` | `#450a0a` |
| `--color-warning` | `#d97706` | `#fbbf24` |
| `--color-info` | `#2563eb` | `#60a5fa` |
| `--color-info-bg` | `#dbeafe` | `#1e3a8a` |
| `--color-text` | `#111827` | `#f0fdf4` |
| `--color-muted` | `#6b7280` | `#9ca3af` |
| `--color-border-subtle` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` |
| `--color-border` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.15)` |
| `--color-border-strong` | `rgba(0,0,0,0.80)` | `rgba(255,255,255,0.80)` |

Add `--color-accent` utility to `@layer utilities` and update `.card` shadow in `@layer components`:

```css
.card {
  @apply bg-surface rounded-xl;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  border: none; /* shadow replaces border */
}
```

### 3. Navigation Restructure (BudgetTracker.jsx)

**Remove**: the entire 200px left sidebar (`<nav>` element)

**Add**: Top bar (56px height):

```
[● Budget]  [‹ 2024 ›]    Overview · Forecast · Budget · Scenarios · {Month}    [Import CSV]  [⚙]
```

- Logo: "Budget" semibold with emerald dot (`●`) prefix
- Year pill: `‹ 2024 ›` compact, next to logo
- Center tabs: `overview | forecast | budget | scenarios | month` — when `view === 'month'` the tab label shows the current month name (e.g. "April")
- Import CSV: ghost button, right side
- Settings gear (⚙): sets `view === 'settings'`

**Month sub-nav strip** (36px, shown only when `view === 'month'`):
- 12 month pills below the top bar: J F M A M J J A S O N D
- Selected month: emerald filled pill
- Months with transaction data: small emerald dot beneath label
- Clicking navigates to that month

**Settings shell** (shown when `view === 'settings'`):
- Top bar background shifts to `--color-raised` tint
- Center nav replaced with: Rules · Categories · Classify
- `← Back` link on left replaces logo

### 4. Layout

- Remove sidebar flex layout, switch to full-width single column
- Main content: `max-width: 1100px`, `margin: 0 auto`, `padding: 40px 24px`
- Top bar: `position: sticky; top: 0; z-index: 50`

---

## Files Changed

| File | Change |
|---|---|
| `src/index.css` | Replace color tokens, add Inter, update `.card` shadow, add `--color-accent` |
| `src/BudgetTracker.jsx` | Remove sidebar, add top bar + month sub-nav + settings shell |

---

## Verification

1. `npm run build` — zero errors
2. All existing views still render (no regressions)
3. Month sub-nav navigates correctly
4. Settings gear shows Rules/Categories/Classify; Back returns to main
5. Dark mode: all new token colors invert correctly
6. Year selector still works
