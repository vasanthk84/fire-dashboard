# Handoff: FIRE Planner — Responsive Mobile + Desktop UI

## Overview
This package covers a **fully responsive UI** for the FIRE (Financial Independence, Retire Early) planning dashboard — the same product as the `vasanthk84/fire-dashboard` repo (branch `ImprovedUI`). The existing app is desktop-first: below 920px its sidebar simply disappears with no replacement navigation. The goal of this design is to deliver **one UI that works at both mobile (~390px phone) and desktop (responsive web) widths**, sharing a single design system, sample data model, and set of screens.

The dashboard has six screens: **Journey, Risk, Expenses, Withdrawal, Snapshots, and Assumptions (setup)**, plus a persistent **overview stats deck** shown above every analysis screen. All are themeable across **Dark / Light / Paper** with four accent hues (**Green / Blue / Indigo / Cyan**).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. They are authored in a lightweight streaming component format (`.dc.html`), which is a design-tool artifact, not a target runtime.

Your task is to **recreate these designs in the target codebase's existing environment**. The source product is **React + TypeScript + Vite** (see `vasanthk84/fire-dashboard`), so the natural target is React/TSX with the repo's existing `styles.css` design-system conventions. If you are starting fresh with no environment, React + TypeScript is the recommended framework. Reuse the repo's real components (`App.tsx`, `StatsDeck.tsx`, the `tabs/*` views, `InputDeck.tsx`) and its `styles.css` tokens — this design's job is to add the **mobile shell and responsive behavior** on top of that system, not to replace it.

The charts in the prototype are hand-built inline SVG (so the mock is self-contained). In production, keep the repo's existing **ApexCharts** integration (`ApexChartComponent.tsx` + `chartBuilders.ts`); the SVG here only documents intended chart *type, series, and colors*.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are specified below with exact values. Recreate pixel-perfectly using the codebase's existing libraries (ApexCharts, lucide-react) and the `styles.css` token system. The one thing to treat as *structural guidance rather than literal* is chart rendering — use ApexCharts, matching the documented series/colors.

---

## Design Tokens

All tokens mirror the repo's `src/styles.css`. Themes are applied by setting CSS custom properties on a root element (repo uses `[data-theme]` / `[data-hue]` attribute selectors on `<html>`; the prototype sets the same variables inline — either approach is fine).

### Typography
- **Sans (UI):** `'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif`
- **Mono (all numbers/data):** `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` with `font-variant-numeric: tabular-nums; letter-spacing: -.01em`
- Weights used: 400, 500, 550, 600, 650, 700, 750, 800
- Body: `-webkit-font-smoothing: antialiased; font-feature-settings: "cv11", "ss01"`

Type scale (px) seen across screens:
- Page/screen H1: 19 / 700 / -.02em
- Card/panel title: 14.5 / 700 / -.01em
- Stat value: 26–27 / 700 / -.02em (mono)
- Calc/withdrawal value: 23–24 / 700 (mono)
- KPI value: 16 / 700 (mono)
- Body label: 12.5–13.5 / 550–600
- Small caption / foot: 11–12 / 500–550, color `--text-3`
- Eyebrow: 10.5 / 700 / uppercase / letter-spacing .14em / `--text-3`
- Table header: 10–10.5 / 700 / uppercase / letter-spacing .03em / `--text-3`
- Table cell: 12.5 (mono)
- Chip: 10–10.5 / 650
- Nav item (desktop): 13.5 / 600
- Bottom-nav label (mobile): 9.5 / 600

### Radii
`--r-sm: 8px` · `--r-md: 11px` · `--r-lg: 15px`. Logo 8–9px. Pills/toggles 999px. Phone bezel 52px (outer) / 40px (screen). Browser window 14px.

### Semantic colors (theme-independent)
- `--pos` (gains): `#1faa6b`
- `--neg` (losses): `#e0556b`
- `--warn`: `#d98a23`

### Accent hues (`--accent` / `--accent-ink`)
| Hue | --accent | --accent-ink |
|---|---|---|
| green (default) | `#15a05f` | `#0c7a47` |
| blue | `#2f6df0` | `#2257d0` |
| indigo | `#5a52e0` | `#463fc2` |
| cyan | `#0fa3bf` | `#0a82a0` |

Derived (used inline via `color-mix`):
- `--accent-soft` = `color-mix(in srgb, var(--accent) 14%, transparent)`
- `--accent-line` = `color-mix(in srgb, var(--accent) 30%, transparent)`

### Themes (`[data-theme]`)
**Dark** (default)
```
--bg:#0a0d12; --surface:#11161e; --surface-2:#161c26; --surface-3:#1d2533;
--border:rgba(255,255,255,.075); --border-strong:rgba(255,255,255,.14);
--text:#e8edf4; --text-2:#98a4b6; --text-3:#647084;
--grid:rgba(255,255,255,.06); --on-accent:#fff; --shadow:none; color-scheme:dark;
```
**Light**
```
--bg:#eef1f6; --surface:#ffffff; --surface-2:#f6f8fb; --surface-3:#eef2f7;
--border:#e4e9f0; --border-strong:#d2d9e4;
--text:#101826; --text-2:#586273; --text-3:#8a94a4;
--grid:rgba(16,24,38,.07); --on-accent:#fff;
--shadow:0 1px 2px rgba(16,24,38,.05), 0 8px 24px -12px rgba(16,24,38,.12); color-scheme:light;
```
**Paper**
```
--bg:#ece5d6; --surface:#faf6ec; --surface-2:#f3ecdd; --surface-3:#eae0cd;
--border:#ddd2bd; --border-strong:#cbbd9f;
--text:#2a2417; --text-2:#6d6450; --text-3:#9c9079;
--grid:rgba(42,36,23,.08); --on-accent:#fbf7ee;
--shadow:0 1px 2px rgba(60,48,20,.05), 0 10px 26px -14px rgba(60,48,20,.18); color-scheme:light;
```
> Dark-theme special case: active nav item text uses `color-mix(in srgb, var(--accent) 78%, white)` for legibility.

### Fixed chart series palettes (independent of theme/hue)
- **Asset composition & journey table:** MF `#4f9dff` · Stocks IN `#22c55e` · US Stocks `#a78bfa` · Bonds `#f59e0b` · EPF `#14b8a6` · 401k `#f472b6`
- **Expense donut/breakdown:** Rent `#4f9dff` · Groceries `#22c55e` · Utilities `#f59e0b` · Transport `#a78bfa` · Health `#ef4444` · Entertainment `#14b8a6` · Misc `#94a3b8`
- **Passive vs expense bars:** passive = `var(--accent)`, expense = `var(--neg)`

### Number formatting (from repo `formatters.ts`)
- `fmtL(valueInLakhs)` → `≥100` renders `₹{(v/100).toFixed(2)}Cr`, else `₹{v.toFixed(1)}L`
- `fmtRupees(v)` → `₹{Math.round(v).toLocaleString('en-IN')}`

---

## Responsive Behavior (the core of this handoff)

The layout has **two shells** selected by viewport width. The prototype uses an explicit `variant` (`mobile` | `desktop`); in production drive it with a CSS breakpoint. Repo breakpoints: `max-width:1180px` (deck→3col, stats→2col) and `max-width:920px` (rail hidden). **Treat 920px as the mobile/desktop switch.**

| Aspect | Desktop (≥920px) | Mobile (<920px) |
|---|---|---|
| Navigation | Left **sidebar rail**, fixed `232px`, sticky full-height | **Bottom tab bar**, fixed, 5 icon+label items |
| Header | Top strip: screen title + subtitle, right-aligned layout segmented control + KPI trio | Compact bar: logo, screen title+subtitle, theme icon-button + assumptions (sliders) icon-button |
| Assumptions access | Sidebar footer "Assumptions" button (opens setup) | Sliders icon in header (opens setup) |
| Content padding | `22px 28px 40px` | `14px 14px 16px` |
| Stat tiles | 4 across | 2 across (flex-wrap, `min-width:150px`) |
| Stress / withdrawal / expense cards | 2–3 across | stack to 1 (flex-wrap, `min-width` ~230–300px) |
| Tables | full width | horizontal scroll (`overflow-x:auto`), first column sticky |

**Implementation trick that makes both shells share content:** the shell is a flex container whose direction flips (`row` desktop → `column` mobile). The `<main>` region and all screen content are authored **once**; only the chrome differs (sidebar vs bottom-nav, and the two header variants). All content cards use `flex-wrap: wrap` with `flex: 1 1 <min>px; min-width:<min>px`, so they naturally reflow from multi-column (desktop) to single-column (mobile) with **no duplicated markup**. Reproduce this: one screen component, responsive-by-flex-wrap, with breakpoint-swapped nav chrome.

Mobile safe-area note: the mobile header uses `padding: 30px 16px 14px` — the extra top padding clears the device notch/status bar. Preserve top safe-area inset in production (`env(safe-area-inset-top)`).

---

## Screens / Views

Every screen renders, top to bottom inside the scroll area: **(1)** a readiness tag, **(2)** the overview **stats deck**, then **(3)** the screen-specific content.

### Shared: Readiness tag
Pill, `4px 10px`, radius 999px, `font 11/650`, inline-flex gap 5px. Tone `ok`: color `--pos`, bg `color-mix(in srgb, var(--pos) 13%, transparent)`, shield-check icon (14px). Sample copy: **"On track · FIRE by 2035"**. (Other tones: `warn` → `--warn`, `bad` → `--neg`, alert-triangle icon.)

### Shared: Stats deck (overview)
Row of 4 tiles, `flex-wrap`, each `flex:1 1 150px; min-width:150px`. Tile: `background var(--surface); border 1px var(--border); radius 15px; padding 16px 18px; box-shadow var(--shadow)`.
- Top row: 7×7px `--accent` square + label (`12/600 var(--text-2)`). (Repo uses lucide icons: Wallet, Rocket, Target, Clock3 — restore those.)
- Value: `26–27/700` mono, margin-top 11px.
- Optional progress bar (FIRE target tile): 5px track `var(--surface-3)` radius 3px, fill `var(--accent)`.
- Foot: `11.5/500 var(--text-3)`.

Sample data:
| Tile | Value | Foot |
|---|---|---|
| Current wealth | ₹1.85Cr | Liquid + retirement accounts |
| At retirement | ₹6.40Cr | Projected corpus · 2036 |
| FIRE target | ₹6.00Cr | 31% complete · 4.0% SWR (bar at 31%) |
| Years to FIRE | 9y | Target 2035 |

Desktop header KPI trio (mono, 16/700): Wealth **₹1.85Cr**, Target **₹6.00Cr**, Progress **31%**.

### 1. Journey
- **Corpus trajectory card** — area+line chart, years 2026–2044, start-of-year ₹L. Accent line (2px) over an accent→transparent vertical gradient fill (0.28→0). Three horizontal grid lines `var(--grid)`. Dashed vertical marker (`var(--warn)`, dash 1.4) at retirement (2036). X-axis labels: `2026 · retire 2036 · 2044` (mono 10.5, warn on middle).
- **Year-by-year table** — header chip "highlight = retirement". Columns: Year, MF, Stocks, US, EPF, Total, Passive/mo, Events. Retirement row highlighted `color-mix(in srgb, var(--accent) 14%, transparent)`. First column sticky. Values mono; Total bold. Events cell shows milestone chips.
- **Milestone chip types** (radius 999px, `10/650`, 1px border): `life` (accent), `wealth` (pos), `expense` (neg), `milestone` (warn) — each with `color-mix` 13–14% bg and 30–38% border in its color.

### 2. Risk
- **Eyebrow** "Stress scenarios · corpus at retirement".
- **Stress cards** (flex-wrap, `min-width:230px`): left border 3px colored by tone (`danger`→`--neg`, `warning`→`--warn`, neutral→`--text-3`). Rows: Corpus, vs base (delta in `--neg`), Cover, FIRE year. Sample: *Market crash* (−30% equity → ₹4.68Cr, −₹1.72Cr, 78%, 2039); *High inflation* (8% vs 6% → ₹6.40Cr, −₹0.0L, 71%, 2038); *Low returns* (CAGR −2% → ₹5.45Cr, −₹0.95Cr, 86%, 2038).
- **Net-worth composition** — stacked area of the 6 assets over the accumulation path, using the fixed asset palette at opacity 0.9. Legend row below (9×9 swatches). In production use ApexCharts stacked area; `ASSET_SERIES` already exists in repo.
- **Equity allocation & glidepath** — line chart: actual equity % (2px accent) vs target glidepath (1.4px `--text-3`, dashed 2 2). Right-aligned "Rebalance" toggle (shown ON). Legend: "Actual equity %" / "Target glidepath". When rebalance is on, repo shows 3 inputs (Pre-retire %, Post-retire %, Glide years).

### 3. Expenses
Two columns (flex-wrap, `min-width` 280–300px → stack on mobile).
- **Left — Monthly expenses editor:** caption "India lifestyle · active from 2031 · drives FIRE target". Seven rows (colored 8×8 swatch + label, right-aligned mono value field `width:116px`): Rent ₹45,000 · Groceries ₹22,000 · Utilities ₹8,000 · Transport ₹12,000 · Health ₹9,000 · Entertainment ₹10,000 · Misc ₹8,000. **Total / month ₹1,14,000** (17px mono, top border `--border-strong`). Two toggles below: "Apply 12.5% tax drag" (OFF), "Return-to-India setup costs" (ON). Toggle spec in Interactions.
- **Right — Spend breakdown donut:** SVG donut (`r=15.915`, circumference-100 trick, `stroke-width:4`, track `--surface-3`, rotate −90°), segments in expense palette, with legend "Label · NN%". Below it **Passive income vs expenses** grouped bar chart (₹L/mo, 2031–2040), passive=`--accent`, expense=`--neg`, 2px-radius bar tops, year labels (mono 9) under bars.

### 4. Withdrawal
- **Withdrawal (SWP) card:** title + caption "LTCG-optimised · FY2025 rules"; right segmented rate control `2% / 3% / 4%` (4% active). Three calc cards (flex-wrap, `min-width:170px`): *Annual withdrawal* ₹25.6L ("Sell 4% of units"); *Taxable component* ₹15.4L ("40% is principal"); *Est. LTCG tax* **₹14,700/mo** ("vs old ₹1.8L/yr") — this one highlighted (`bg`/`border` = accent 14%/30% `color-mix`). Below: eyebrow "Corpus sustainability · 25 yrs @ 4%" + depletion area chart (accent line + gradient fill).
- **Projected post-tax income table:** Year, Corpus, Withdrawal, Est. tax (neg, prefixed −), Net/mo (pos). 12 rows from 2036. Net/mo in `fmtRupees`.

### 5. Snapshots
- **Three stat tiles:** Total wealth ₹1.85Cr · FIRE target ₹6.00Cr · Progress 31%.
- **Saved snapshots (3):** header actions "＋ Save" (accent-filled) + "Export" (surface-2 outlined). List items: `13px 15px`, radius 11px; selected items get `border:var(--accent)` + accent-14% bg. Each: label + muted note, wealth (mono), delta (↑/↓ colored pos/neg), date (mono, right). Sample: *Baseline* (·initial plan, ₹1.72Cr, Jan 2026, no delta, unselected); *Post bonus* (·added ₹9L MF, ₹1.81Cr, ↑5.2%, Apr 2026, selected); *Current* (·July review, ₹1.85Cr, ↑2.2%, Jul 2026, selected).
- **Wealth progression** chart: accent line through the selected snapshot points (dots), with a dashed `--warn` reference line at top labeled "— — FIRE target ₹6.00Cr".

### 6. Assumptions (Setup)
Read-in input deck: six group cards (flex-wrap, `min-width:210px`, radius 11px). Each has an uppercase group heading (`11/700/.04em var(--text-3)`) and stacked fields (label `11/600 var(--text-2)` + mono value box `background var(--surface-2); border 1px var(--border); radius 8px; padding 8px 10px`). The **MF Principal** field is "accent"-styled: border `color-mix(in srgb, var(--pos) 55%, var(--border))`, text `--pos`.
Groups & sample values:
- **Timeline:** Start Date `Jan 2026`, Retire `2036`, Return IN `2031`, 401k Draw `2034`
- **Assets · ₹L:** Mutual Funds `62.0`, MF Principal `44.0` (accent), Stocks IN `28.0`, US Stocks `34.0`, Emergency `12.0`
- **Retirement:** 401k · $ `46,000`, ₹/$ `86`, US Salary · $ `120,000`, EPF · ₹L `15.0`
- **Flows · ₹L/mo:** MF SIP `0.6`, Step-up % `10`, Options `0.3`
- **Bonds:** Initial · ₹L `8.0`, Add % `1.0`, Rate % `7.0`
- **Rates · %:** MF CAGR `12.0`, Stocks `15.0`, US 401k `12.0`, Inflation `6.0`

---

## Chrome & Frames (prototype-only)
The showcase wraps the app in a **phone bezel** (414×840, radius 52px, 13px padding, dark `#05070a`, notch pill 120×30 radius `0 0 18px 18px`) and a **browser window** (radius 14, traffic-light dots `#ff5f57/#febc2e/#28c840`, centered address bar `fire-planner.app/{tab}`). These frames are **presentation scaffolding only** — do not build them into the real app. The **control bar** (tab pills + Dark/Light/Paper segmented control + 4 hue dots) is likewise a demo affordance; in production, theme/hue live in the app's own header chrome (see repo `App.tsx` `chromeControls`).

## Interactions & Behavior
- **Navigation:** clicking a sidebar item / bottom-tab / control pill sets the active screen. Active desktop nav item: bg `--accent-soft`, text `--accent(-ink)`, border `--accent-line`. Active bottom-nav item: icon+label colored `--accent`; inactive `--text-3`. Nav transitions `background .12s, color .12s`.
- **Theme switch:** swaps the full CSS-variable set on the root; both frames recolor instantly. Accent hue swaps `--accent`/`--accent-ink` only.
- **Toggle switch:** track 34×19, radius 999px; OFF = `--surface-3` bg, `--border-strong` border, knob 14px `--text-2` at left; ON = `--accent` bg+border, knob `#fff` translated +15px. Transition `.15s`.
- **Segmented control:** `--surface-2` container, 3px padding, radius 10px; active button = `--surface` (dark theme: `--surface-3`) with `--shadow`.
- **Buttons:** primary = `--accent` bg / `--on-accent` text (hover `brightness(1.06)`); secondary = `--surface-2` + `--border-strong` (hover `--surface-3`); ghost = transparent (hover `--surface-2`). Base `9px 15px`, radius 8px, `13/600`.
- **Table rows:** hover → `--surface-2` (incl. sticky first cell).
- **Assumptions drawer (desktop):** repo opens a right-side slide-in drawer (`width:420px`, `translateX(100%)`→`0`, transition `.24s cubic-bezier(.4,0,.2,1)`, scrim `rgba(2,6,12,.42)`). On mobile this becomes the full Setup screen.
- **Charts:** hover tooltips per ApexCharts defaults; rebuild on theme change (repo keys charts by `theme + '-' + hue`).

## State Management
- `activeTab`: `'journey' | 'risk' | 'expenses' | 'withdrawal' | 'snapshots'` (+ setup/assumptions). Repo default `'journey'`.
- `theme`: `'dark' | 'light' | 'paper'` — persisted to `localStorage['fire-planner-theme']`, written to `document.documentElement[data-theme]`.
- `hue`: `'green' | 'blue' | 'indigo' | 'cyan'` — persisted `localStorage['fire-planner-hue']`, `[data-hue]`.
- `layout`: `'console' | 'report'` — persisted `localStorage['fire-planner-layout']` (desktop shells; "console" = sidebar).
- `selectedWithdrawalRate`: `'2%' | '3%' | '4%'`.
- `drawerOpen`: boolean (assumptions drawer).
- Snapshot selection: array of ids (2+ selected → show progression chart).
- **Data:** the numbers here are **illustrative sample data** (a returning-NRI plan). In production the projections come from the repo's calculation engine (`useFirePlanner`, `api/calculate.js`); do not hardcode these values — wire the same inputs/hooks. The sample set is documented so charts/tables can be visually matched during development.

## Responsive behavior summary
See the **Responsive Behavior** table above. Single breakpoint at **920px**: below it, hide the rail and show the bottom tab bar + compact header; collapse all multi-column card grids to one column; enable horizontal table scroll with sticky first column.

## Assets
- **Fonts:** Plus Jakarta Sans + JetBrains Mono (Google Fonts).
- **Icons:** repo uses **lucide-react** (Map, Shield, Wallet, PlusCircle/TrendingDown, Archive, SlidersHorizontal, Sun, Moon, BookOpen, Target, Rocket, Clock3, ShieldCheck, AlertTriangle, Download, Upload, Trash2, Play, X). The prototype inlines equivalent SVG paths as placeholders — **use lucide-react in production**, not the inline SVGs.
- No raster images; all visuals are type, SVG charts, and CSS.

## Files
- `FireDashboard.dc.html` — showcase shell: control bar (tab/theme/hue), phone bezel + browser window, shared state, theme CSS-var application. Demo scaffolding.
- `FireScreen.dc.html` — **the actual app UI**: both shells (sidebar/bottom-nav), all six screens, sample-data model, and the SVG chart builders. This is the primary reference.
- `support.js` — runtime for the `.dc.html` design format (not part of the target app; ignore for implementation).
- Original source product for structure/logic: `vasanthk84/fire-dashboard@ImprovedUI` — `src/App.tsx`, `src/styles.css`, `src/components/StatsDeck.tsx`, `src/components/InputDeck.tsx`, `src/components/tabs/*.tsx`, `src/utils/formatters.ts`, `src/utils/chartBuilders.ts`, `src/hooks/*`.
