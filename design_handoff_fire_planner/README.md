# Handoff: FIRE Planner — Pro Redesign

## Overview
FIRE Planner is a Financial-Independence / Retire-Early modelling dashboard for an India + US-return scenario (assets in ₹ Lakhs/Crores, EPF, US 401k, LTCG-aware withdrawals). It takes a user's assets, monthly flows, growth assumptions and expenses, projects net worth year-by-year to 2055, and surfaces a FIRE target, readiness, stress scenarios, a withdrawal (SWP) plan, and snapshot comparisons.

This package documents a **pro-level visual redesign** of an existing React/Vite app. The math is unchanged; only presentation, information hierarchy, copy and charts were reworked.

## About the Design Files
The files in this bundle (`FIRE Planner.html` + `fire/*`) are **design references built in HTML/React-via-Babel** — a working prototype showing the intended look, layout, charts and behavior. They are **not** production code to paste in.

The task is to **recreate this design inside the target codebase** (the existing `vasanthk84/fire-dashboard` React + TypeScript + Vite app), reusing its established structure (`src/components`, `src/hooks`, `src/types.ts`, the `api/calculate.js` engine) and its real charting lib (ApexCharts is already a dependency). Where this prototype reimplements logic client-side, prefer the app's existing engine/hooks — the prototype's `fire/engine.js` is a faithful 1:1 port of `api/calculate.js` and exists only so the static prototype can run offline.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, chart styling and copy are all decided. Recreate pixel-faithfully using the app's existing libraries (React, ApexCharts) and the design tokens below. Replace the prototype's inline-SVG `Ic` icon set with the app's existing `lucide-react`.

---

## Theme System (IMPORTANT — new in this redesign)
The redesign is driven by two HTML attributes on `<html>`:

- `data-theme` → `dark` | `light` | `paper` (surface family)
- `data-hue`   → `green` | `blue` | `indigo` | `cyan` (single accent)

All colors are CSS custom properties that cascade from these two attributes (see `fire/styles.css`, top block). To implement in the real app: set these attributes on the root element from app state / a theme context, and keep every color reference as a `var(--token)` — never hardcode. Charts read the same vars at render via `getComputedStyle` and must re-render on theme/hue change (the prototype rebuilds each chart when a `dep` key containing `theme+hue` changes).

### Accent hues (the `--accent` value per `data-hue`)
| Hue | `--accent` | `--accent-ink` (text-on-light) |
|-----|-----------|-------------------------------|
| green  | `#15a05f` | `#0c7a47` |
| blue   | `#2f6df0` | `#2257d0` |
| indigo | `#5a52e0` | `#463fc2` |
| cyan   | `#0fa3bf` | `#0a82a0` |

Derived: `--accent-soft = color-mix(in srgb, var(--accent) 14%, transparent)`, `--accent-line = color-mix(... 30% ...)`.

### Surface themes (tokens per `data-theme`)
| Token | dark | light | paper |
|-------|------|-------|-------|
| `--bg` | `#0a0d12` | `#eef1f6` | `#ece5d6` |
| `--surface` | `#11161e` | `#ffffff` | `#faf6ec` |
| `--surface-2` | `#161c26` | `#f6f8fb` | `#f3ecdd` |
| `--surface-3` | `#1d2533` | `#eef2f7` | `#eae0cd` |
| `--border` | `rgba(255,255,255,.075)` | `#e4e9f0` | `#ddd2bd` |
| `--border-strong` | `rgba(255,255,255,.14)` | `#d2d9e4` | `#cbbd9f` |
| `--text` | `#e8edf4` | `#101826` | `#2a2417` |
| `--text-2` (muted) | `#98a4b6` | `#586273` | `#6d6450` |
| `--text-3` (faint) | `#647084` | `#8a94a4` | `#9c9079` |
| `--grid` (chart) | `rgba(255,255,255,.06)` | `rgba(16,24,38,.07)` | `rgba(42,36,23,.08)` |
| `--shadow` | `none` | `0 1px 2px rgba(16,24,38,.05), 0 8px 24px -12px rgba(16,24,38,.12)` | warm equiv. |

Status colors (theme-independent): `--pos #1faa6b` (gains), `--neg #e0556b` (losses), `--warn #d98a23`.

---

## Layout — two directions
The redesign ships **two interchangeable app shells**, selectable at runtime (prototype: `layout` tweak = `console` | `report`). Both render the same content components; only the chrome differs. Pick one as default (recommend **console**) and optionally expose the other as a preference.

### Direction A — "Console" (default, recommended)
- **Left nav rail**, fixed `232px`, `--surface` bg, `1px --border` right edge. Brand block at top (32px rounded accent logo "F" + "FIRE Planner / Pro"), a "Analysis" section label, then the 5 tabs as vertical `.nav-item` buttons (17px icon + label). Active item: `--accent-soft` bg, `--accent-line` border, accent text.
- Rail footer (pinned bottom, `margin-top:auto`): **Assumptions** button (opens the inputs drawer) + **Export plan** ghost button.
- **Main column**: sticky `.head` (60–80px) with the active tab title + `--text-3` subline on the left, and 3 mini-KPIs (Wealth / Target / Progress) on the right.
- Inputs live in a **right slide-in drawer** (`420px`, `transform: translateX(100%)` → `0`, `.24s cubic-bezier(.4,0,.2,1)`, scrim `rgba(2,6,12,.42)`), opened by the Assumptions button. 6 grouped sections, 2-col grid of fields.

### Direction B — "Report"
- **Full-width sticky topbar** (`60px`, blurred translucent `--surface`): brand left, mini-KPIs, Export right.
- Inputs shown inline as a **6-card horizontal deck** (`grid-template-columns: repeat(6,1fr)`, collapses to 3 then 2 cols) at the top of the content.
- Tabs as an **underline tab bar** (`.tabbar`, 2px accent underline on active) above the active panel.

Shared, above the active panel in both: a readiness **status chip**, then the 4 **stat tiles**.

---

## Screens / Views

### Persistent overview (above every tab)
- **Readiness chip** — single pill, `.tag.ok|warn|bad`. Copy is terse: `Funded · 194% cover` / `On track · FIRE by 2028` / `Gap under current assumptions` / `Add expenses to assess readiness`. Icon: shield-check (ok) or alert.
- **Stat tiles** — `grid` of 4, `repeat(4,1fr)`, gap 14px, collapse to 2 cols < 1180px. Each `.stat`: `--surface`, `1px --border`, radius 15px, `--shadow`, padding `16px 18px`.
  1. **Current wealth** — `fmtL(currentWealth)`, foot "Liquid + retirement accounts".
  2. **At retirement** — `fmtL(finalWealth)`, foot "Projected corpus · {retYear}".
  3. **FIRE target** — value + an inline **multiplier stepper** (number input 20–40 step 0.5, "×"), a 5px progress `.bar` (accent fill at `progress%`), foot "{progress}% complete · {SWR}% SWR".
  4. **Years to FIRE** — `{n}y`, foot "Target {startYear+n}".
  - Tile value type: 27px / 700 / `-.02em`, mono tabular.

### Tab 1 — Journey
- **Corpus trajectory** card: area chart, total net worth from `startYear` to `retirementYear+8`, accent stroke 2.5px smooth, gradient fill `0.32→0.02`, dashed retirement marker annotation. Height ~300.
- **Year-by-year path** table card: sticky header + sticky first column, max-height 520 scroll. Columns: Year, MF, Stocks IN, US, Bonds, EPF, 401k, **Total** (bold), Passive/mo, Events. Numbers mono/tabular, right-aligned; first col left. Retirement-year row highlighted `--accent-soft`. Events render as `.chip` pills (`.life` accent, `.wealth` green, `.expense` red, `.milestone` amber).

### Tab 2 — Risk
- **Stress scenarios** — eyebrow + 3 `.stress` cards (left-accent-bar: neutral / `--warn` / `--neg`). Each: label, terse assumption (`Equity CAGR −2%`, `Inflation +2%`, `Equity −30% today`), then rows Corpus / vs base (green/red delta) / Cover / FIRE year.
- **Net-worth composition** — **stacked area** chart (the "right graph" for asset-mix-over-time), 6 series with fixed categorical colors (see Assets), smooth, gradient `0.7→0.45`. Custom legend row below.
- **Equity allocation & glidepath** — line chart: Equity % (accent) vs Target (faint, dashed), optional Rebalanced series. A `--neg` dashed "High risk" annotation at y=80. A **Rebalance** toggle (`.switch`) in the header reveals 3 inputs (pre-/post-retire %, glide years).

### Tab 3 — Expenses (2-col grid)
- **Left — Monthly expenses** card: 7 `.exp-row` rows (color dot + label + right-aligned mono input), `.exp-total` footer with `fmtINR`. Two `.switch` toggles: "Apply 12.5% tax drag" and "Return-to-India setup costs" (reveals a 2-col one-time-expense grid). When tax on, a "Tax at retirement" sub-card (gross / −tax / net).
- **Right** — **Spend breakdown** donut (70% inner, center total label) + **Passive income vs expenses** chart (area income accent + line expense `--warn`, Return/Retire x-annotations).

### Tab 4 — Withdrawal
- **Withdrawal (SWP)** card: rate `<select>` (2% Conservative / 3% Balanced / 4% Aggressive) in header. 3 `.calc` cards (Annual withdrawal, Taxable component, **Est. LTCG tax** highlighted `.hl` accent-soft). Then a **corpus sustainability** depletion area chart (25 yrs at selected rate).
- **Projected post-tax income** table: Year, Corpus, Withdrawal, Est. tax (red), Net/mo (green). Changing the rate recomputes all rows.

### Tab 5 — Snapshots
- 3 summary `.calc` tiles (Total wealth / FIRE target / Progress).
- **Saved snapshots** list (`.snap-item`, click to select, `.sel` = accent border + soft bg). Each: label + note, mono wealth, ↑/↓ % delta vs previous, date. Save / Export buttons (placeholder).
- When ≥2 selected: **Wealth progression** line chart (wealth accent vs FIRE target `--warn` dashed) + per-snapshot comparison cards with deltas.

---

## Interactions & Behavior
- **Live recompute**: any input/expense/assumption change re-runs the projection synchronously (engine is fast; prototype uses `useMemo` keyed on the payload). No "Run" button needed — the original explicit Run step was removed.
- **Theme/hue/layout**: switch instantly; charts rebuild on theme/hue change so axis/grid/series colors track the new tokens.
- **Drawer** (console): slide-in 240ms, scrim click to close.
- **Multiplier stepper** in the FIRE-target tile updates `fireMultiplier` and re-derives target, progress, years-to-FIRE.
- **Withdrawal rate select** recomputes withdrawal cards + table.
- **Snapshot selection** toggles inclusion in the comparison chart/cards.
- Hover: nav items, table rows, buttons, snapshot items all have subtle `--surface-2/3` hover states.
- **Responsive**: rail + header KPIs hide < 920px; grids collapse (4→2 stats, 6→3→2 input deck, 3→1 stress/calc).

## State Management
Mirror the existing `useFirePlanner` hook. State: `inputs` (full `Inputs` type), `expenses`, `oneTimeExpenses`, `showOneTime`, `applyTax` (inside inputs), `activeTab`, `selectedWithdrawalRate`, `selectedSnapshots`, drawer open, plus **new** theme state: `{ layout, theme, hue }` (persist to localStorage / settings). Derived (memoized): `results` (from engine), `fireNumberLakhs`, `currentWealthLakhs`, `progressToFire`, `yearsToFI`, `sampleTaxYear`, `stressScenarios`, `readiness`, `coverage`.

## Design Tokens
- **Type**: UI/labels = `'Plus Jakarta Sans'` (400–800). All numbers = `'JetBrains Mono'` with `font-variant-numeric: tabular-nums`, letter-spacing `-.01em`. Headings tracking `-.01em` to `-.02em`.
- **Radii**: `--r-sm 8px`, `--r-md 11px`, `--r-lg 15px`; pills 999px.
- **Spacing**: card padding `16–20px`; grid gaps `12–14px`; section gap `18px`.
- **Shadows**: none on dark; soft elevation on light/paper (see table).
- **Colors**: all the `--*` tokens above. Categorical chart palette (asset classes) is theme-stable.

## Assets
- **Icons**: prototype uses a small inline-SVG set (`fire/icons.jsx`, lucide-style). In the app, use the existing **`lucide-react`** dependency. Mapping: Journey→`Map`, Risk→`Shield`, Expenses→`Wallet`, Withdrawal→`PlusCircle`, Snapshots→`Archive`; plus `TrendingUp, Target, Clock3, Rocket, Layers, PieChart, Activity, BarChart2, Download, Upload, SlidersHorizontal, X`.
- **Charts**: ApexCharts (already a dependency). Builders in `fire/charts.jsx` show exact options (stroke widths, gradient stops, formatters, annotations) per chart.
- **Categorical asset palette** (composition / legend): MF `#4f8cff`, Stocks IN `#f5a524`, US Stocks `#9b8cff`, Bonds `#2dd4a7`, Emergency `#64748b`, EPF `#f25f9c`.
- No raster images or external imagery used.

## Files (in this bundle)
- `FIRE Planner.html` — entry; loads fonts, ApexCharts, React/Babel, and the modules below.
- `fire/styles.css` — **the design system**: theme/hue token blocks + every component class. Primary reference for CSS.
- `fire/engine.js` — 1:1 port of `api/calculate.js` (projection, withdrawal scenarios, stress scenarios). Prefer the app's real engine.
- `fire/seed.js` — demo inputs/expenses/snapshots + input-group metadata + asset/expense palettes + `fmtL`/`fmtINR` formatters.
- `fire/charts.jsx` — theme-aware ApexCharts wrapper + all chart option builders.
- `fire/tabs.jsx` — the 5 tab panels (Journey, Risk, Expenses, Withdrawal, Snapshots).
- `fire/app.jsx` — app shell: both layout directions, stat tiles, input deck/drawer, tab routing, theme/hue wiring.
- `fire/icons.jsx` — inline icon set (replace with lucide-react).
- `fire/tweaks-panel.jsx` — prototype-only tweak panel; not for production.

## Copy guidance
Copy was deliberately stripped to labels and short fragments. Keep it terse: section eyebrows, one-line status chips, one-word deltas, unit captions (`₹/mo`, `Lakhs per month`). Avoid full explanatory sentences. The only place plain-English logic is retained is the LTCG note on the Withdrawal tab ("LTCG-optimised · FY2025 rules").
