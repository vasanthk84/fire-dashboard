import { useMemo, useState } from 'react';
import type { CalculationResults } from '../../types';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { CHARTS } from '../../utils/chartBuilders';
import { ApexChartComponent } from '../../components/ApexChartComponent';
import { MHero, MChipNeutral, MChip, MTile } from '../components/primitives';
import { M_CONTRIB_COLORS, M_FUND_COLORS, M_HERO_TINT, M_POS } from '../mobileColors';

function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// Per-fund 5/10-yr & since-inception returns — mirrors desktop's
// Retirement401kTab.tsx FUNDS table verbatim (module-private there, so
// duplicated here; same reuse pattern as RiskView/WithdrawalView). Colors
// come from mobileColors.ts's M_FUND_COLORS, not desktop's own hexes.
const FUNDS = [
  { name: 'Vanguard IT Index Admiral', ticker: 'VITAX', alloc: 25, r5: 17.83, r10: 23.99, rInception: 15.28 },
  { name: 'JPMorgan Large Cap Growth R6', ticker: 'JLGMX', alloc: 45, r5: 10.11, r10: 18.68, rInception: 16.22 },
  { name: 'Fidelity 500 Index Fund', ticker: 'FXAIX', alloc: 30, r5: 12.84, r10: 15.07, rInception: 13.98 }
];
const blend = (key: 'r5' | 'r10' | 'rInception') => FUNDS.reduce((s, f) => s + (f.alloc / 100) * f[key], 0) / 100;
const BLEND_5YR = blend('r5');
const BLEND_10YR = blend('r10');
const BLEND_INCEPTION = blend('rInception');

// Two small personal-loan repayments that add to the monthly 401k contribution
// stream until mid-2027 — mirrors desktop's project()/loanActive() verbatim,
// including these, so mobile's balance path matches desktop's exactly.
const LOAN3_MONTHLY = 204.22 * 2;
const LOAN4_MONTHLY = 147.35 * 2;
const LOAN3_END = { year: 2027, month: 8 };
const LOAN4_END = { year: 2027, month: 7 };
function loanActive(calYear: number, calMonth: number) {
  const cur = calYear * 12 + calMonth;
  let b = 0;
  if (cur <= LOAN3_END.year * 12 + LOAN3_END.month) b += LOAN3_MONTHLY;
  if (cur <= LOAN4_END.year * 12 + LOAN4_END.month) b += LOAN4_MONTHLY;
  return b;
}

interface ProjRow { year: number; month: number; balance: number }

function project(
  employeeRate: number,
  employerRate: number,
  annualReturn: number,
  stopYear: number,
  startBal: number,
  startYear: number,
  startMonth: number,
  endYear: number,
  salary: number
): ProjRow[] {
  const mr = annualReturn / 12;
  const mc = (salary * (employeeRate + employerRate)) / 12;
  let bal = startBal;
  const rows: ProjRow[] = [];
  let calYear = startYear;
  let calMonth = startMonth;
  const totalSteps = (endYear - startYear) * 12 + (12 - startMonth + 1);

  for (let step = 0; step <= totalSteps; step++) {
    if (step > 0) {
      const isActive = calYear < stopYear || (calYear === stopYear && calMonth <= 12);
      const contrib = isActive ? mc + loanActive(calYear, calMonth) : 0;
      bal = bal * (1 + mr) + contrib;
    }
    if (calMonth === 12 || step === 0) {
      rows.push({ year: calYear, month: calMonth, balance: bal });
    }
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calYear > endYear) break;
  }
  return rows;
}

const CONTRIB_OPTIONS = [0.05, 0.07, 0.08, 0.1];
const CONTRIB_LABELS: Record<number, string> = { 0.05: '5%', 0.07: '7%', 0.08: '8%', 0.1: '10%' };

const RETURN_OPTIONS = [
  { v: 0.06, label: '6% conservative' },
  { v: 0.1, label: '10% moderate' },
  { v: BLEND_5YR, label: `${(BLEND_5YR * 100).toFixed(1)}% · 5-yr` },
  { v: BLEND_10YR, label: `${(BLEND_10YR * 100).toFixed(1)}% · 10-yr` },
  { v: BLEND_INCEPTION, label: `${(BLEND_INCEPTION * 100).toFixed(1)}% · inception` }
];

interface K401ScreenProps {
  planner: UseFirePlannerReturn;
  results: CalculationResults;
}

export function K401Screen({ planner, results }: K401ScreenProps) {
  const { inputs, handleInput, runCalculation } = planner;
  const [currentReturn, setCurrentReturn] = useState(BLEND_10YR);
  const [compareAll, setCompareAll] = useState(false);

  // Today's combined 401k balance is the same live `us401k` value the actual
  // FIRE plan uses (desktop's tab instead keeps a separate hardcoded local
  // fund/loan split that resets on remount — mobile has no editable
  // breakdown UI here, so it reads the real synced figure instead).
  const totalBal = inputs.us401k;

  const contribs = compareAll ? CONTRIB_OPTIONS : [inputs.us401kContribPct];
  const datasets = useMemo(
    () =>
      contribs.map((c) => ({
        c,
        rows: project(
          c,
          inputs.us401kEmployerMatchPct,
          currentReturn,
          inputs.returnYear,
          totalBal,
          inputs.startYear,
          inputs.startMonth,
          inputs.withdraw401kYear,
          inputs.annualSalary
        )
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contribs.join(','), inputs.us401kEmployerMatchPct, currentReturn, inputs.returnYear, totalBal, inputs.startYear, inputs.startMonth, inputs.withdraw401kYear, inputs.annualSalary]
  );

  const primary = datasets.find((d) => Math.abs(d.c - inputs.us401kContribPct) < 1e-6) ?? datasets[0];
  const labels = primary.rows.map((r) => String(r.year));
  const stopIndex = primary.rows.findIndex((r) => r.year === inputs.returnYear);
  const values = primary.rows.map((r) => Math.round(r.balance));
  const gross = values[values.length - 1] ?? 0;
  const net = gross * (1 - results.summary.taxRate401k);
  const atStop = stopIndex >= 0 ? values[stopIndex] : values[0] ?? 0;
  const multiple = totalBal > 0 ? gross / totalBal : 0;
  const monthlyIn = (inputs.annualSalary * (inputs.us401kContribPct + inputs.us401kEmployerMatchPct)) / 12;
  const withdrawAge = inputs.currentAge + (inputs.withdraw401kYear - inputs.startYear);

  const compareLines = compareAll
    ? CONTRIB_OPTIONS.map((c) => {
        const d = datasets.find((x) => x.c === c)!;
        return { color: M_CONTRIB_COLORS[c], data: d.rows.map((r) => Math.round(r.balance)) };
      })
    : [];

  const withdrawRows = (compareAll ? CONTRIB_OPTIONS : [inputs.us401kContribPct]).map((c) => {
    const d = datasets.find((x) => x.c === c)!;
    const g = d.rows[d.rows.length - 1]?.balance ?? 0;
    const isActive = Math.abs(c - inputs.us401kContribPct) < 1e-6;
    return { c, netUsd: g * (1 - results.summary.taxRate401k), isActive };
  });

  const onPickContrib = (c: number) => {
    setCompareAll(false);
    handleInput('us401kContribPct', c);
    void runCalculation({ us401kContribPct: c });
  };

  return (
    <div className="m-screen">
      <div className="m-screen-head" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 className="m-h1">401k Projector</h1>
        <span className="m-caption" style={{ fontSize: 11 }}>{inputs.withdraw401kYear - inputs.startYear}y to draw</span>
      </div>

      <div className="m-stack">
        <MHero tint1={M_HERO_TINT.k401} lineColor="rgba(21,160,95,.28)">
          <div className="m-eyebrow">Net after tax · {inputs.withdraw401kYear}</div>
          <div className="m-hero-metric" style={{ marginTop: 8 }}>{fmtUSD(net)}</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <MChipNeutral label={`Gross ${fmtUSD(gross)}`} />
            <MChipNeutral label={`Tax ${(results.summary.taxRate401k * 100).toFixed(0)}%`} />
            <MChip label={`${multiple.toFixed(1)}× of today`} color={M_POS} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <MTile top="Today" value={fmtUSD(totalBal)} onHero />
            </div>
            <div style={{ flex: 1 }}>
              <MTile top={`Leave US ${inputs.returnYear}`} value={fmtUSD(atStop)} onHero />
            </div>
          </div>
        </MHero>

        <div className="m-card" style={{ paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span className="m-card-title" style={{ letterSpacing: '-0.01em' }}>Balance path</span>
            <span className="m-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
              {(currentReturn * 100).toFixed(1)}% return · {(inputs.us401kContribPct * 100).toFixed(0)}% + {(inputs.us401kEmployerMatchPct * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <ApexChartComponent
              height={200}
              dep={'k401bal' + labels.length + values.join(',') + compareAll + currentReturn}
              build={CHARTS.mobile401kBalance(labels, values, stopIndex, compareLines)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingBottom: 6 }}>
            <span className="m-axis-label">{inputs.startYear}</span>
            <span className="m-axis-label" style={{ color: 'var(--warn)' }}>India {inputs.returnYear}</span>
            <span className="m-axis-label">{inputs.withdraw401kYear}</span>
          </div>
        </div>

        <div className="m-card">
          <div className="m-eyebrow">Employee contribution</div>
          <div className="m-rate-row" style={{ marginTop: 10 }}>
            {CONTRIB_OPTIONS.map((c) => (
              <button
                key={c}
                className={'m-rate-btn' + (!compareAll && Math.abs(inputs.us401kContribPct - c) < 1e-6 ? ' active' : '')}
                onClick={() => onPickContrib(c)}
              >
                {CONTRIB_LABELS[c]}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ font: '600 12px var(--font-sans)', color: 'var(--text-2)' }}>
              Monthly in (you + {(inputs.us401kEmployerMatchPct * 100).toFixed(0)}% match)
            </span>
            <span style={{ font: '700 14px var(--font-mono)' }}>{fmtUSD(monthlyIn)}</span>
          </div>

          <div className="m-eyebrow" style={{ marginTop: 14 }}>Return scenario</div>
          <div className="m-pill-row" style={{ marginTop: 10 }}>
            {RETURN_OPTIONS.map((o) => (
              <button
                key={o.label}
                className={'m-pill' + (Math.abs(currentReturn - o.v) < 1e-6 ? ' active' : '')}
                onClick={() => setCurrentReturn(o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="m-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="m-card-title">Funds</span>
            <span className="m-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>10-yr avg</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {FUNDS.map((f) => (
              <div key={f.ticker} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: M_FUND_COLORS[f.ticker], flexShrink: 0 }} />
                  <span style={{ font: '600 12.5px var(--font-sans)' }}>{f.ticker}</span>
                  <span style={{ font: '500 11px var(--font-sans)', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ marginLeft: 'auto', font: '700 12.5px var(--font-mono)', color: 'var(--pos)', flexShrink: 0 }}>{f.r10.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: f.alloc + '%', background: M_FUND_COLORS[f.ticker], borderRadius: 999 }} />
                  </div>
                  <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-2)', minWidth: 34, textAlign: 'right' }}>{f.alloc}%</span>
                  <span style={{ font: '600 11px var(--font-mono)', minWidth: 62, textAlign: 'right' }}>{fmtUSD(totalBal * (f.alloc / 100))}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', font: '500 11px/1.5 var(--font-sans)', color: 'var(--text-3)' }}>
            Blended 10-yr {(BLEND_10YR * 100).toFixed(1)}% · since inception {(BLEND_INCEPTION * 100).toFixed(1)}%. For an {inputs.withdraw401kYear - inputs.startYear}-year hold the long windows are the defensible assumption.
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-title">Withdrawal at age {withdrawAge}</div>
          <div className="m-caption" style={{ marginTop: 6, lineHeight: 1.5, fontSize: 11.5 }}>
            {results.summary.isEarlyWithdrawal401k
              ? `Before 59½ — income tax plus a 10% early-withdrawal penalty (${(results.summary.taxRate401k * 100).toFixed(0)}% total).`
              : `At ${withdrawAge} you are past 59½ — ordinary income tax only, no 10% early-withdrawal penalty (${(results.summary.taxRate401k * 100).toFixed(0)}%).`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {withdrawRows.map((w) => (
              <div
                key={w.c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 12,
                  background: w.isActive ? 'rgba(21,160,95,.1)' : 'var(--surface-2)',
                  border: '1px solid ' + (w.isActive ? 'rgba(21,160,95,.32)' : 'var(--border)')
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 2, background: M_CONTRIB_COLORS[w.c], flexShrink: 0 }} />
                <span style={{ font: '650 12px var(--font-mono)', color: 'var(--text-2)' }}>{CONTRIB_LABELS[w.c]} contribution</span>
                <span style={{ marginLeft: 'auto', font: '700 14px var(--font-mono)' }}>{fmtUSD(w.netUsd)}</span>
                <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--text-3)' }}>net</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="m-btn-secondary"
              style={{ padding: '9px 13px', font: '650 11.5px var(--font-sans)' }}
              onClick={() => setCompareAll((v) => !v)}
            >
              {compareAll ? 'Hide rate overlay' : 'Compare all rates'}
            </button>
            <span className="m-caption">Overlay 5 / 7 / 8 / 10% on the chart</span>
          </div>
        </div>
      </div>
    </div>
  );
}
