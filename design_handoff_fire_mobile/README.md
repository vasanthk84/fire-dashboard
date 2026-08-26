# Handoff: FIRE Planner — Mobile App (Journey · Expenses · 401k · PF Reinvest · Assumptions)

## Overview
A ground-up **mobile app redesign** of the FIRE dashboard (`vasanthk84/fire-dashboard`, React + TS + Vite). One phone-width shell (402×874 reference, iPhone-class) with:

- a **persistent header**: brand block, theme cycler and Snapshots button on the **far right**, plus a three-cell KPI strip (Wealth / Target / Progress);
- a **5-item bottom tab bar**: **Journey · Expenses · 401k · PF · Assumptions**;
- **Risk** and **Withdrawal** are **nested inside Journey** as a 3-way segmented control (`Trajectory | Risk | Withdrawal`) — they are not top-level tabs;
- **Snapshots** is a **bottom sheet** opened from the header (not a tab);
- **Dark / Light / Paper** themes cycled by the header theme button. Dark is the default and the design's canonical look.

Implement this **exactly as specified — no visual deviation.** Every value below is final.

## About the Design Files
`FIRE Mobile.dc.html` is a **design reference authored in HTML** (a streaming component format used by the design tool — `support.js` is its runtime, `ios-frame.jsx` is presentation-only device chrome). It is **not production code to copy**. Recreate it in the existing target codebase: **React + TypeScript**, reusing the repo's real state hooks (`useFirePlanner`, `useSnapshots`, `useSensitivitySummary`), its `api/calculate.js` engine, `formatters.ts`, `chartBuilders.ts` + **ApexCharts**, and **lucide-react** icons. The device bezel and the hand-built inline SVG charts in the prototype are scaffolding: the bezel must NOT be built, and the SVG charts document only *chart type, series, colors and markers* — render them with ApexCharts.

## Fidelity
**High-fidelity (hifi).** Colors, type, spacing, radii, copy and interactions are final and listed here. Recreate pixel-for-pixel. The only structural liberties: chart rendering library (use ApexCharts) and icons (use lucide-react equivalents of the primitive glyphs described below).

---

## Design Tokens

### Typography
- **Sans:** `'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif` (weights 400/500/600/650/700/800)
- **Mono — every number:** `'JetBrains Mono', ui-monospace, monospace`, `font-variant-numeric: tabular-nums`
- Body: `-webkit-font-smoothing: antialiased`

Exact scale used:
| Role | Spec |
|---|---|
| Hero metric | 34px / 700 / mono / `letter-spacing:-.03em` / `line-height:1` |
| Screen H1 | 19px / 700 / `-.02em` |
| Sheet title | 15px / 700 / `-.01em` |
| Card title | 13px / 700 |
| Tile value (secondary) | 18–22px / 700 / mono / `-.02em` |
| Row value | 12–14px / 700 / mono |
| KPI value (header strip) | 14px / 700 / mono / `-.02em` |
| Body label | 12.5px / 650 |
| Caption | 10.5–11px / 500, color `--tx3` |
| Eyebrow | 10px / 700 / uppercase / `letter-spacing:.14em` / `--tx3` |
| KPI/tile eyebrow | 9.5–10px / 600 / uppercase / `.08–.1em` / `--tx3` |
| Chip | 10.5px / 600 / mono (or 650 sans for word chips) |
| Milestone chip | 9.5px / 650 |
| Bottom-nav label | 9.5px / 650 |
| Axis label | 10px / 500 / mono |

### Radii
Hero cards **18px** · standard cards **16px** · nested tiles/rows **12px** · small controls **9–11px** · sheet **22px 22px 0 0** · pills/tracks **999px** · logo **8px**.

### Spacing
Screen scroll padding `16px 14px 108px`. Header `52px 16px 12px` (52px clears the status bar / notch). Card padding `16px` (hero `18px`, compact tiles `14px`, list rows `11px 16px`). Vertical gap between cards **12px**; grid gaps **8px** (2-col tiles) / **10px** (2-col cards). Bottom nav `8px 4px 26px` (26px = home-indicator safe area).

### Theme variables
Set as CSS custom properties on the app root; **semantic and chart colors never change with theme.**

| var | dark (default) | light | paper |
|---|---|---|---|
| `--bg` | `#0a0d12` | `#eef1f6` | `#ece5d6` |
| `--sf` (surface) | `#11161e` | `#ffffff` | `#faf6ec` |
| `--sf2` | `#161c26` | `#f6f8fb` | `#f3ecdd` |
| `--sf3` (track) | `#1d2533` | `#eef2f7` | `#eae0cd` |
| `--bd` | `rgba(255,255,255,.075)` | `#e4e9f0` | `#ddd2bd` |
| `--bds` | `rgba(255,255,255,.14)` | `#d2d9e4` | `#cbbd9f` |
| `--tx` | `#e8edf4` | `#101826` | `#2a2417` |
| `--tx2` | `#98a4b6` | `#586273` | `#6d6450` |
| `--tx3` | `#647084` | `#8a94a4` | `#9c9079` |
| `--gd` (chart grid) | `rgba(255,255,255,.06)` | `rgba(16,24,38,.07)` | `rgba(42,36,23,.08)` |
| `--hd` (header bg) | `linear-gradient(#11161e,#0d1219)` | `linear-gradient(#ffffff,#f6f8fb)` | `linear-gradient(#faf6ec,#f3ecdd)` |
| `--nav` (tab bar bg) | `rgba(13,18,25,.96)` | `rgba(255,255,255,.96)` | `rgba(250,246,236,.96)` |
| `--tile` (on-hero tile) | `rgba(10,13,18,.55)` | `rgba(255,255,255,.72)` | `rgba(255,255,255,.6)` |

### Fixed colors
- Accent **`#15a05f`**; accent text on tinted fills **`#4fd493`**; accent tint `rgba(21,160,95,.16)`; accent hairline `rgba(21,160,95,.28–.32)`.
- `--pos` **`#1faa6b`** · `--neg` **`#e0556b`** · `--warn` **`#d98a23`**.
- PF buckets: cash **`#5b9cff`** · bonds **`#2dd4a7`** · wheeling **`#ffb84d`**.
- Asset split: US 401k **`#f472b6`** · India retirals **`#14b8a6`**.
- 401k contribution rates: 5% **`#4f9dff`** · 7% **`#2dd4a7`** · 8% **`#ffb84d`** · 10% **`#a78bfa`**.
- Funds: VITAX `#4f9dff` · JLGMX `#2dd4a7` · FXAIX `#ffb84d`.
- Expenses: Rent `#4f9dff` · Groceries `#22c55e` · Utilities `#f59e0b` · Transport `#a78bfa` · Health `#ef4444` · Entertainment `#14b8a6` · Misc `#94a3b8`.
- PF hero gradient uses blue `rgba(47,109,240,.16)`; Expenses hero uses `rgba(224,85,107,.14)`; Journey/401k/Withdrawal heroes use accent `rgba(21,160,95,.16)`.

**Hero card recipe (all screens):** `border-radius:18px; padding:18px; background:linear-gradient(160deg,<tint .14–.16>,<tint .03> 55%,var(--sf)); border:1px solid <hairline>`.
**Standard card:** `background:var(--sf); border:1px solid var(--bd); border-radius:16px; padding:16px`.

### Number formatting (repo `formatters.ts`)
`fmtL(lakhs)` → `≥100` → `₹{(v/100).toFixed(2)}Cr` else `₹{v.toFixed(1)}L` · `fmtRupees(v)` → `₹{v.toLocaleString('en-IN')}` · USD → `$` + `toLocaleString('en-US')`, no decimals.

---

## Chrome

### Header (fixed, non-scrolling)
`padding:52px 16px 12px; background:var(--hd); border-bottom:1px solid var(--bd)`.
Row 1 (`flex; gap:10px; align-items:center`):
1. Logo: 26×26, radius 8, `#15a05f`, white `F` 13/800.
2. Title block: **"FIRE Planner"** 13.5/700 `-.01em`; sub **"Plan 2026 · returning-NRI"** 10.5/500 `--tx3`.
3. `margin-left:auto` action pair, `gap:7px` — each button 32×32, radius 10, `background:var(--sf2)`, `border:1px solid var(--bd)`, glyph 16px stroked `var(--tx2)` at 1.6:
   - **Theme cycler** — sun/moon glyph (lucide `Moon` in dark, `Sun` in light, `BookOpen` in paper). Cycles `dark → light → paper`. `title` = "Dark theme" etc.
   - **Snapshots** — lucide `Archive`. Carries a badge: top `-3px`, right `-3px`, min-width 15, height 15, radius 999, `#15a05f`, white 9/700 mono, showing the saved-snapshot count (3).

Row 2 — KPI strip, `margin-top:14px`, `background:var(--bg)`, `border:1px solid var(--bd)`, radius 12, three equal cells split by `1px solid var(--bd)`, each `padding:9px 10px`: eyebrow (Wealth / Target / Progress) + mono value 14/700. Progress value is `--pos`.

### Bottom tab bar (fixed)
`padding:8px 4px 26px; background:var(--nav); border-top:1px solid var(--bd); backdrop-filter:blur(12px)`. Five equal buttons, each column `gap:5px`, 20×20 icon above 9.5/650 label. Active = `#15a05f` (icon stroke + label); inactive = `--tx3`. Icons (lucide in production): Journey `TrendingUp`, Expenses `Wallet`, 401k `PiggyBank`, PF `Landmark`, Assumptions `SlidersHorizontal`.
Labels exactly: `Journey`, `Expenses`, `401k`, `PF`, `Assumptions`.

### Snapshots sheet (from header)
Full-bleed scrim `rgba(2,6,12,.5)`; tapping the area above the sheet closes it. Sheet: `background:var(--sf)`, radius `22px 22px 0 0`, `padding:16px 16px 34px`, `max-height:76%`, scrollable, entry animation `sheetUp .2s ease` (`translateY(14px)` + `opacity 0` → `0/1`).
- Header row: "Snapshots" 15/700 + sub "Compare saved versions of the plan" 10.5/500 `--tx3`; right 30×30 close button (radius 9, `var(--sf2)`, border `var(--bd)`).
- Actions `margin-top:14px`, `gap:8px`: primary **"＋ Save current"** (flex:1, `padding:11px 0`, radius 11, `#15a05f` fill, white 12.5/700) + **"Export"** (`padding:11px 16px`, `var(--sf2)`, border `var(--bds)`).
- List (gap 8): rows `padding:13px 15px`, radius 12. Unselected `var(--sf2)` + `var(--bd)`; **selected** `rgba(21,160,95,.1)` + `#15a05f`. Row line 1: label 12.5/650 + muted note (`· initial plan`) + right mono wealth 13/700. Line 2: delta (`baseline` in `--tx3`, else `↑ N.N%` in `--pos`) + right date mono 10.5/500 `--tx3`. Tap toggles selection.
- Sample rows: **Baseline** `· initial plan` (Jan 2026, baseline), **Post PF plan** `· reinvest split set` (Apr 2026, ↑4.3%), **Current** `· Aug review` (Aug 2026, ↑3.1%) — last two selected by default.
- Progression chart card: `var(--sf2)`, radius 14, dashed `--neg` target line at top labelled `— target ₹X.XXCr`, accent 2px line through the snapshot points with 3.2r accent dots.

---

## Screens

### 1. Journey (default tab)
H1 **"Journey"** + sub (`2026–2044` on Trajectory, `stress & drift` on Risk, `drawdown plan` on Withdrawal).
**Segmented control** below the title: container `padding:3px`, radius 12, `var(--sf2)`, border `var(--bd)`; three flex buttons `padding:9px 0`, radius 9; active = `rgba(21,160,95,.16)` bg + `#15a05f` border + `#4fd493` text; inactive transparent with `--tx2` text. Labels **Trajectory / Risk / Withdrawal**.

**1a. Trajectory**
- Hero: eyebrow "CORPUS AT RETIREMENT · 2036", hero metric (`fmtL`), chips `FIRE target ₹X` (neutral) + `FIRE by YYYY` / `Target not reached` (accent), 6px progress track (`--sf3`) with accent fill = % of target funded today, foot `"NN% of target funded today · passive ₹X/mo at retirement"`.
- **Corpus trajectory** card: area+line (accent 2px line, accent gradient .32→0 fill), 3 grid lines `--gd`, dashed `--warn` vertical at the retirement year with a 3.4r warn dot, dashed `--neg` horizontal at the FIRE target. Axis row: `2026` · `retire 2036` (warn) · `2044`.
- **Year by year** list card: one row per alternate year plus every milestone year. Row line 1: year (mono 11.5/700 `--tx2`, min-width 34) · total (`fmtL`, mono 12.5/700) · right passive `₹X/mo` in `--pos`. Line 2: 5px stacked share bar (US 401k `#f472b6` / India `#14b8a6`) + optional milestone chip. Retirement row background `rgba(21,160,95,.09)`.
- Milestone chips (radius 999, 9.5/650, bg = colour @ `20` alpha, border = colour @ `55`): **PF closure** `#4f9dff` (2027) · **Return to India** `#15a05f` (2031) · **Retire** `#d98a23` (2036) · **401k draw** `#f472b6` (2044).
- Legend footer: swatch + `US 401k`, `India retirals`.

**1b. Risk**
- Eyebrow "STRESS SCENARIOS · CORPUS AT RETIREMENT".
- Three scenario cards: standard card with `border-left:3px solid <tone>` — **Market crash** `--neg` (`−30% on US equity from 2030`), **Low returns** `--warn` (`CAGR 2pp below plan`), **High inflation** `--warn` (`Spend inflates 8% not 6%`). Header row: label 12.5/700 + corpus mono 15/700. Three mini tiles (`var(--sf2)`, radius 10, `padding:8px 10px`): **vs base** (signed `fmtL`, pos/neg colour), **Cover** (`passive ÷ inflated monthly spend`, %), **FIRE year** (or `Not reached`).
- **Composition drift** card: 7 columns, each an 88px stacked bar (`--sf3` track, US `#f472b6` over India `#14b8a6`) with the year label below in 9/500 mono.
- **Sequence-risk buffer** card: label + sub "Years of spend held in cash + bonds at retirement", right value 20/700 mono; 6px track with fill; colour `--pos` ≥3y, `--warn` ≥1.5y, else `--neg`; scale maxes at 5y. Foot explains it is driven by the PF Reinvest cash/bond split.

**1c. Withdrawal**
- Hero: eyebrow "NET INCOME · N% SWR", hero metric = net monthly rupees, sub "per month, after LTCG · from 2036", then a 3-way rate control (`2% / 3% / 4%`, default **4%**) — buttons `padding:10px 0`, radius 11, active accent tint/border/`#4fd493`.
- 2×2 tiles: **Annual withdrawal** (`sell N% of units`), **Taxable component** (`40% is principal`), **Est. LTCG tax** (value in `--neg`, `12.5% on gains`), **Corpus at 2036** (`from the trajectory`).
- **Corpus sustainability** card: 25-year depletion area (accent, or `--neg` line when it depletes), 2 grid lines; axis `2036` … `2061 · ₹X` or `depleted before 2061`.
- **Post-tax income** list: 6 rows — year · corpus · tax (`−₹X`, `--neg`) · right net/mo (`--pos`).

### 2. Expenses
H1 "Expenses" + sub "India lifestyle · from 2031".
- Hero (`--neg` tint): "TOTAL PER MONTH" + `fmtRupees` hero metric; chips `₹X.XCr/yr`, `FIRE target ₹X`; 10px stacked category bar in the expense palette.
- **Category list** card (`padding:6px 16px 10px`): 7 rows `padding:12px 0` separated by `1px solid var(--bd)`. Left: 8×8 colour square, label 12.5/650, sub `NN% of spend` mono 10.5. Right: stepper — 30×30 `−` button, value mono 13/700 (min-width 64, right-aligned), 30×30 `+` button (radius 9, `var(--sf2)`, border `var(--bds)`, `--tx2` glyph). Step **±₹1,000**, floor 0. Footer row: "Total / month" 12/700 `--tx2` + total mono 17/700.
- Defaults: Rent 45,000 · Groceries 22,000 · Utilities 8,000 · Transport 12,000 · Health 9,000 · Entertainment 10,000 · Misc 8,000 (**total ₹1,14,000**).
- **Toggles** card (gap 14): "Apply 12.5% tax drag" (`Taxes passive income in retirement`, OFF), "Return-to-India setup costs" (`One-time relocation spend`, **ON**), "Compound wheeling premiums" (`Otherwise swept to cash`, OFF). Switch: 44×26, radius 999; OFF `var(--sf3)` bg + `var(--bds)` border + `--tx2` knob at `left:2px`; ON `#15a05f` bg+border + white knob at `left:20px`; knob 18×18, `transition:left .16s ease`.
- **Return-to-India setup** card (only when that toggle is ON): 2-col tile grid — Home setup ₹8L, Car ₹12L, Renovation ₹4L, Family event ₹3L, Misc ₹2L; footer "One-time total" + total in `--neg`.
- **Villa purchase** card: title + sub "Optional goal — down payment hits the corpus, EMI draws only post-retirement" + switch (OFF by default). When ON: 2×2 tiles — Down payment ₹150.0L (`inflated to 2031`), Monthly EMI (`45L @ 8.5%`), Loan paid off 2045 (`15y tenure`), Cash needed ₹195.0L (`down + principal`). EMI = standard amortisation formula.

### 3. 401k Projector
H1 "401k Projector" + sub "18y to draw".
- Hero: "NET AFTER TAX · 2044" + net USD hero metric; chips `Gross $X`, `Tax 22%`, accent `N.N× of today`; two tiles **Today** ($61,454) and **Leave US 2031**.
- **Balance path** card: header right meta `18.9% return · 5% + 4%`; accent area+line, 3 grid lines, dashed `--warn` marker at the India-return year (warn dot) and accent end dot; axis `2026 · India 2031 · 2044`. When the rate overlay is on, four dashed 1.3px lines in the contribution colours, `stroke-dasharray:4 3`, `opacity:.85`. **All lines — primary and overlays — must share one min/max domain** so they are comparable.
- **Employee contribution**: 4 equal buttons `5% / 7% / 8% / 10%` (`padding:11px 0`, radius 11, mono 13/700), active = accent tint/border/`#4fd493`. Below a divider: "Monthly in (you + 4% match)" + mono value.
- **Return scenario**: horizontally scrollable pills (radius 999, `padding:9px 12px`, 11.5/650) — `6% conservative`, `10% moderate`, `12.9% · 5-yr`, `18.9% · 10-yr`, `15.6% · inception`. Default **10-yr blend**.
- **Funds** card: per fund a two-line block — colour square + ticker 12.5/600 + truncated name + right 10-yr return in `--pos`; then a 6px allocation bar (`--sf3` track), allocation % and USD value (mono 11/600, right-aligned, min-widths 34/62). Funds: VITAX 25% 23.99%, JLGMX 45% 18.68%, FXAIX 30% 15.07%. Footer note with blended 10-yr / inception figures.
- **Withdrawal at age 60** card: penalty note (past 59½ → income tax only), then one row per shown rate (`padding:11px 12px`, radius 12; active row `rgba(21,160,95,.1)` + `rgba(21,160,95,.32)`, others `var(--sf2)`/`var(--bd)`): colour square, `N% contribution`, right net USD 14/700 + "net" caption. Button **"Compare all rates" / "Hide rate overlay"** (radius 10, `var(--sf2)`, border `var(--bds)`) + caption "Overlay 5 / 7 / 8 / 10% on the chart".

### 4. PF Reinvest
H1 "PF Reinvest" + sub "closure May 2027".
- Hero (blue tint): "CORPUS TO REINVEST" + `fmtL` hero metric; chips `9 months out` and warn `Date not confirmed`; 2×2 source tiles — **EPF + VPF** (`grown to closure`), **Gratuity** (`at separation`), **Super lump** (`50% commuted`), **Annuitised** (`6% payout`).
- **Allocation** card: header right `blended N.NN%/yr`; 12px stacked bar (cash/bond/wheel colours over `--sf3`); then three bucket blocks — row (colour square, label 12.5/650, rate caption, right amount 12.5/700, % 11/600 min-width 34) above a full-width `<input type="range">` (`accent-color:#15a05f`, height 22). Cash and Bonds are live 0–100 sliders (defaults **68** / **0**); **Wheeling is the remainder** — disabled slider at `opacity:.45`. Cash+bonds >100 normalises proportionally.
- Two tiles: **Income / month** (`post-tax, month one`) and **Annuity / month** (`on annuitised super`).
- **Verdict** card: tinted `--pos`/`--neg` at 9% with a 28% border; title `Ahead of PF` / `Behind PF` + signed delta 15/700; sub `vs staying in PF @ 8.25% by <month>`; dual line chart — benchmark 1.4px dashed `--tx3`, reinvestment 2px in the verdict colour, **shared scale**; footer `Horizon NN mo` + 6–60 range slider (default **36**).
- **Month by month** list: header `income · ahead`; 6 rows — month label (mono 11.5/600, min-width 64) · income · right signed delta in pos/neg; footer "First 6 months of NN mo".

### 5. Assumptions
H1 "Assumptions" + sub "drives every projection".
- **US salary** card: eyebrow, 34×34 `−` / centred mono 22/700 value / 34×34 `+` (step **$5,000**, floor 0), note "Contributions are a share of this — at $0 every rate projects the same."
- Four read-only groups, each a card with an eyebrow title and a 2-col tile grid (`var(--sf2)`, radius 12, `padding:10px 12px`; label 10/600 `--tx3` + mono 13.5/700 value):
  - **Timeline** — Start `Aug 2026`, Return to India `2031`, Retire `2036`, 401k draw `2044`
  - **US 401k** — Fund balance `$52,226`, Loan balance `$9,228`, Employer match `4%`, ₹/$ `86`
  - **PF & retirals** — EPF today `₹68.9L`, Basic pay `₹36,700`, EPF rate `8.25%`, VPF rate `88%`, Gratuity `₹5.7L`, Superannuation `₹6.0L`
  - **Rates** — Cash `7.0%`, Bonds `7.5%`, Wheeling `1.25%/mo`, Inflation `6%`, Post-FIRE `6.5%`, Tax on income `0%`

---

## Interactions & Behavior
- **Tab switch**: sets `activeTab`; scroll position resets per screen; icon+label recolour to accent instantly (no transition needed beyond `.12s` colour if the repo already uses it).
- **Journey sub-tab**: sets `journeySub`; content swaps in place, header title sub-label updates.
- **Theme button**: cycles `dark → light → paper`, writes `document.documentElement[data-theme]`, persists to `localStorage['fire-planner-theme']`. Accent hue stays green (`--accent`/`--accent-ink` unchanged).
- **Snapshots button**: opens the sheet (`sheetUp .2s ease`); scrim tap or ✕ closes; snapshot rows toggle selection; 2+ selected drives the progression chart; Save/Export map to `useSnapshots().saveSnapshot` / `exportSnapshots`.
- **Steppers** (expenses ±1,000, salary ±5,000): clamp at 0; every change re-runs the calculation (debounce as the repo already does) and updates the header KPI strip live.
- **Sliders**: `onChange` (continuous) for allocation and horizon; wheeling is derived, never directly settable.
- **Segmented / pill / rate controls**: single-select, immediate recalculation.
- **Rate overlay button**: toggles four dashed comparison lines and expands the withdrawal rows from 1 to 4.
- **Buttons**: `cursor:pointer`; hover — primary `filter:brightness(1.06)`, secondary → `var(--sf3)`. Touch targets ≥30px (steppers) / ≥34px (salary, nav rows) tall.
- No loading spinners in the mock: while `results` is null, keep the last-known numbers and show the repo's existing `tab-panel-loading` treatment inside the affected card only.

## State Management
| State | Type | Default |
|---|---|---|
| `activeTab` | `'journey' \| 'expenses' \| 'k401' \| 'pf' \| 'setup'` | `journey` |
| `journeySub` | `'path' \| 'risk' \| 'withdrawal'` | `path` |
| `theme` | `'dark' \| 'light' \| 'paper'` | `dark` (persisted) |
| `snapOpen` | boolean | false |
| `snapSelected` | number[] | `[1,2]` |
| `us401kContribPct` | 0.05 / 0.07 / 0.08 / 0.10 | 0.05 |
| `k401Return` | number | 10-yr blend `0.1892` |
| `compareRates` | boolean | false |
| `pfCashAllocPct` / `pfBondAllocPct` | 0–100 | 68 / 0 |
| `horizonMonths` | 6–60 | 36 |
| `swr` | 2 / 3 / 4 | 4 |
| `annualSalary` | number | 145,000 (repo default is 0 — see note) |
| `applyTax`, `showOneTime`, `compoundWheel`, `villaEnabled` | boolean | false / **true** / false / false |
| `expenses` | 7 keys | 45,000 / 22,000 / 8,000 / 12,000 / 9,000 / 10,000 / 8,000 |

**Model notes (match these formulas):**
- 401k: monthly compounding at `rate/12`; contributions `salary × (employee% + 4%) / 12` while `year ≤ 2031`, then coast to 2044; withdrawal tax 22%, no penalty at 60. Blends: 5-yr `12.9%`, 10-yr `18.9%`, inception `15.6%` (allocation-weighted from the fund table).
- PF: `projectEpfForward` — monthly `basic × (0.12 + VPF) + basic × 0.12`, interest accrued monthly and credited yearly; superannuation via `projectSimpleForward`; corpus = EPF + gratuity + `commutation × super`.
- Reinvestment: allocation normalised (cash+bonds ≤100, wheeling = remainder); cash interest credited **quarterly**; bond interest compounds; wheeling premiums swept to cash unless "compound" is on; benchmark compounds at EPF rate monthly.
- Journey: total corpus = 401k (USD × 86 → lakhs) + India retirals (EPF at 8.25% until closure, then the reinvestment blended yield); passive/mo = `corpus × 6.5% / 12` + annuity income; FIRE target = `monthly spend × 12 × 25`.
- Withdrawal: `draw = corpus × SWR`, corpus grows 6.5%, draw inflates 6%; tax = `draw × 60% × 12.5%`.
- **The prototype's `annualSalary` default of $145,000 is a demo value.** In production keep the repo's real input; just note that at $0 all contribution rates coincide (the existing warning banner still applies).

## Assets
- Fonts: Plus Jakarta Sans + JetBrains Mono (Google Fonts).
- Icons: lucide-react (`TrendingUp`, `Wallet`, `PiggyBank`, `Landmark`, `SlidersHorizontal`, `Archive`, `Sun`, `Moon`, `BookOpen`, `X`, `Plus`, `Download`). The prototype uses primitive SVG shapes as stand-ins — replace with these.
- No raster imagery.

## Files
- `FIRE Mobile.dc.html` — the design (all five screens, both nested Journey views, snapshot sheet, three themes, live model).
- `ios-frame.jsx` — device bezel used for presentation only; **do not implement**.
- `support.js` — design-format runtime; ignore.
- Source product for logic/structure: `src/App.tsx`, `src/constants.ts`, `src/components/tabs/*`, `src/utils/formatters.ts`, `src/utils/chartBuilders.ts`, `api/calculate.js`.
