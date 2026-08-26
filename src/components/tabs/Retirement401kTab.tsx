import { useMemo, useState } from 'react';
import type { CalculationResults, Inputs } from '../../types';
import { NumberInput } from '../NumberInput';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface Retirement401kTabProps {
  results: CalculationResults;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
  themeKey: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// Per-fund performance as of 07/31/2026 (fund company fact sheets) — 1/3/5/10-yr
// average annual returns plus since-inception, factored into the blended scenarios below.
const FUNDS = [
  { name: 'Vanguard IT Index Admiral', ticker: 'VITAX', alloc: 25, r1: 31.73, r3: 26.52, r5: 17.83, r10: 23.99, rInception: 15.28, color: '#378ADD' },
  { name: 'JPMorgan Large Cap Growth R6', ticker: 'JLGMX', alloc: 45, r1: 3.44, r3: 17.04, r5: 10.11, r10: 18.68, rInception: 16.22, color: '#1D9E75' },
  { name: 'Fidelity 500 Index Fund', ticker: 'FXAIX', alloc: 30, r1: 19.55, r3: 19.31, r5: 12.84, r10: 15.07, rInception: 13.98, color: '#D85A30' }
];
const blend = (key: 'r1' | 'r3' | 'r5' | 'r10' | 'rInception') => FUNDS.reduce((s, f) => s + (f.alloc / 100) * f[key], 0) / 100;
const BLEND_1YR = blend('r1');
const BLEND_3YR = blend('r3');
const BLEND_5YR = blend('r5');
const BLEND_10YR = blend('r10');
const BLEND_INCEPTION = blend('rInception');

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

interface ProjRow {
  year: number;
  month: number;
  age: number;
  balance: number;
  phase: 'active' | 'coast' | 'withdraw';
}

function project(
  employeeRate: number,
  employerRate: number,
  annualReturn: number,
  stopYear: number,
  startBal: number,
  startYear: number,
  startMonth: number,
  endYear: number,
  currentAge: number,
  salary: number
): ProjRow[] {
  const mr = annualReturn / 12;
  const mc = (salary * (employeeRate + employerRate)) / 12;
  let bal = startBal;
  const results: ProjRow[] = [];
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
      const age = currentAge + (calYear - startYear);
      const phase: ProjRow['phase'] = calYear < stopYear ? 'active' : calYear === stopYear ? 'active' : calYear === endYear ? 'withdraw' : 'coast';
      results.push({ year: calYear, month: calMonth, age, balance: bal, phase });
    }
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calYear > endYear) break;
  }
  return results;
}

const CONTRIB_OPTIONS = [0.05, 0.07, 0.08, 0.10];
const CONTRIB_COLORS: Record<number, string> = { 0.05: '#378ADD', 0.07: '#1D9E75', 0.08: '#D85A30', 0.10: '#7F77DD' };
const CONTRIB_LABELS: Record<number, string> = { 0.05: '5%', 0.07: '7%', 0.08: '8%', 0.10: '10%' };

export function Retirement401kTab({ results, inputs, onInput, themeKey }: Retirement401kTabProps) {
  const [fundBal, setFundBal] = useState(52226);
  const [loanBal, setLoanBal] = useState(9228);
  // 18-year holding period (withdrawing 2044) — default to the 10-yr blend rather
  // than a shorter, noisier window like the 1-yr snapshot.
  const [currentReturn, setCurrentReturn] = useState(BLEND_10YR);
  const [compareAll, setCompareAll] = useState(false);

  const totalBal = fundBal + loanBal;

  const commitBalance = (nextFund: number, nextLoan: number) => {
    setFundBal(nextFund);
    setLoanBal(nextLoan);
    onInput('us401k', nextFund + nextLoan);
  };

  const contribs = compareAll ? CONTRIB_OPTIONS : [inputs.us401kContribPct];

  const datasets = useMemo(
    () =>
      contribs.map((c) => {
        const rows = project(
          c,
          inputs.us401kEmployerMatchPct,
          currentReturn,
          inputs.returnYear,
          totalBal,
          inputs.startYear,
          inputs.startMonth,
          inputs.withdraw401kYear,
          inputs.currentAge,
          inputs.annualSalary
        );
        return { c, rows };
      }),
    [contribs.join(','), inputs.us401kEmployerMatchPct, currentReturn, inputs.returnYear, totalBal, inputs.startYear, inputs.startMonth, inputs.withdraw401kYear, inputs.currentAge, inputs.annualSalary]
  );

  const labels = datasets[0]?.rows.map((r) => MONTH_NAMES[r.month - 1] + ' ' + r.year) ?? [];
  const stopIdx = datasets[0]?.rows.findIndex((r) => r.year === inputs.returnYear && r.month === 12) ?? -1;
  const withdrawIdx = datasets[0]?.rows.findIndex((r) => r.year === inputs.withdraw401kYear && r.month === 12) ?? -1;

  const chartDatasets = datasets.map(({ c, rows }) => ({
    name: CONTRIB_LABELS[c] ?? (c * 100).toFixed(1) + '%',
    color: CONTRIB_COLORS[c] ?? 'var(--accent)',
    activeData: rows.map((r, i) => (stopIdx < 0 || i <= stopIdx ? Math.round(r.balance) : null)),
    coastData: rows.map((r, i) => (stopIdx < 0 || i >= stopIdx ? Math.round(r.balance) : null))
  }));

  const xMarkers = [
    ...(stopIdx >= 0 ? [{ index: stopIdx, label: 'Return to India ' + inputs.returnYear }] : []),
    ...(withdrawIdx >= 0 ? [{ index: withdrawIdx, label: 'Withdraw ' + inputs.withdraw401kYear, color: 'var(--neg)' }] : [])
  ];

  const withdrawAge = inputs.currentAge + (inputs.withdraw401kYear - inputs.startYear);

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">401k Projector</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          Fund-level balance &amp; blended return feed straight into your main FIRE plan — this tab and the
          Assumptions drawer's 401k / US Salary fields stay in sync.
        </div>

        <div className="grid-3">
          <div className="in-wrap">
            <label>Fund balance ($)</label>
            <NumberInput className="in" step={100} value={fundBal} onCommit={(n) => commitBalance(n, loanBal)} />
          </div>
          <div className="in-wrap">
            <label>Loan balance ($)</label>
            <NumberInput className="in" step={100} value={loanBal} onCommit={(n) => commitBalance(fundBal, n)} />
          </div>
          <div className="stat" style={{ padding: '10px 14px' }}>
            <div className="stat-top">Total (synced to plan)</div>
            <div className="stat-val" style={{ fontSize: 20 }}>{fmtUSD(totalBal)}</div>
            <div className="stat-foot">As of {MONTH_NAMES[inputs.startMonth - 1]} {inputs.startYear}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Fund allocation &amp; historic returns</span>
        </div>
        <div className="table-scroll" style={{ marginBottom: 12 }}>
          <table className="grid" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Fund</th>
                <th>Allocation</th>
                <th>1-yr</th>
                <th>3-yr</th>
                <th>5-yr</th>
                <th>10-yr</th>
                <th>Since inception</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {FUNDS.map((f) => (
                <tr key={f.ticker}>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ color: 'var(--text)' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{f.ticker}</div>
                  </td>
                  <td>{f.alloc}%</td>
                  <td className={f.r1 >= 0 ? 'text-pos' : 'text-neg'}>{f.r1}%</td>
                  <td className={f.r3 >= 0 ? 'text-pos' : 'text-neg'}>{f.r3}%</td>
                  <td className="text-pos">{f.r5}%</td>
                  <td className="text-pos">{f.r10}%</td>
                  <td className="text-pos">{f.rInception}%</td>
                  <td>{fmtUSD(totalBal * (f.alloc / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0 }}>
          Blended: 1-yr <strong style={{ color: 'var(--text)' }}>{(BLEND_1YR * 100).toFixed(1)}%</strong> · 3-yr{' '}
          <strong style={{ color: 'var(--text)' }}>{(BLEND_3YR * 100).toFixed(1)}%</strong> · 5-yr{' '}
          <strong style={{ color: 'var(--text)' }}>{(BLEND_5YR * 100).toFixed(1)}%</strong> · 10-yr{' '}
          <strong style={{ color: 'var(--text)' }}>{(BLEND_10YR * 100).toFixed(1)}%</strong> · since inception{' '}
          <strong style={{ color: 'var(--text)' }}>{(BLEND_INCEPTION * 100).toFixed(1)}%</strong>. Past returns
          don't guarantee future performance — for an 18-year hold, the 1-yr/3-yr figures are noisy snapshots;
          the 10-yr or since-inception blend below is the more defensible planning assumption.
        </div>
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Plan assumptions</span>
        </div>
        {inputs.annualSalary <= 0 && (
          <div className="banner warn" style={{ marginBottom: 16 }}>
            Set your US salary below — it's currently $0, so employee/employer contributions compute to $0/month
            regardless of contribution %. That's why every rate in "Compare all 4" (and the single-rate view) shows
            identical projections: only your existing fund balance is compounding, nothing is being added to it.
          </div>
        )}
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="in-wrap">
            <label>US salary ($/yr)</label>
            <NumberInput className="in" step={1000} value={inputs.annualSalary} onCommit={(n) => onInput('annualSalary', n)} />
          </div>
          <div className="in-wrap">
            <label>Employer match %</label>
            <NumberInput
              className="in"
              step={0.5}
              value={Math.round(inputs.us401kEmployerMatchPct * 1000) / 10}
              onCommit={(n) => onInput('us401kEmployerMatchPct', n / 100)}
            />
          </div>
          <div className="in-wrap">
            <label>Return to India year</label>
            <NumberInput className="in" step={1} value={inputs.returnYear} onCommit={(n) => onInput('returnYear', n)} />
          </div>
        </div>

        <div className="in-wrap" style={{ marginBottom: 4 }}><label>Annual return scenario</label></div>
        <div className="seg" style={{ width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
          <button className={Math.abs(currentReturn - 0.06) < 0.0001 ? 'active' : ''} onClick={() => setCurrentReturn(0.06)}>6% conservative</button>
          <button className={Math.abs(currentReturn - 0.10) < 0.0001 ? 'active' : ''} onClick={() => setCurrentReturn(0.10)}>10% moderate</button>
          <button className={Math.abs(currentReturn - BLEND_5YR) < 0.0001 ? 'active' : ''} onClick={() => setCurrentReturn(BLEND_5YR)}>{(BLEND_5YR * 100).toFixed(1)}% (5-yr blend)</button>
          <button className={Math.abs(currentReturn - BLEND_10YR) < 0.0001 ? 'active' : ''} onClick={() => setCurrentReturn(BLEND_10YR)}>{(BLEND_10YR * 100).toFixed(1)}% (10-yr blend)</button>
          <button className={Math.abs(currentReturn - BLEND_INCEPTION) < 0.0001 ? 'active' : ''} onClick={() => setCurrentReturn(BLEND_INCEPTION)}>{(BLEND_INCEPTION * 100).toFixed(1)}% (since inception)</button>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 16 }}>
          Applied as your plan's <strong style={{ color: 'var(--text)' }}>US 401k</strong> growth rate (synced automatically).
        </div>

        <div className="in-wrap" style={{ marginBottom: 4 }}><label>Employee contribution</label></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div className="seg" style={{ width: 'fit-content' }}>
            {CONTRIB_OPTIONS.map((c) => (
              <button
                key={c}
                className={!compareAll && Math.abs(inputs.us401kContribPct - c) < 0.0001 ? 'active' : ''}
                onClick={() => { setCompareAll(false); onInput('us401kContribPct', c); }}
              >
                {CONTRIB_LABELS[c]}
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={compareAll} onChange={(e) => setCompareAll(e.target.checked)} />
            <span className="track"></span>
            Compare all 4
          </label>
        </div>
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Projection · {inputs.startYear}–{inputs.withdraw401kYear}</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 10 }}>
          {inputs.withdraw401kYear - inputs.startYear}-year horizon to withdrawal (age {withdrawAge}).
        </div>
        {labels.length > 0 && (
          <ApexChartComponent
            height={340}
            dep={'k401' + themeKey + compareAll + currentReturn + inputs.us401kContribPct + inputs.returnYear + inputs.withdraw401kYear + totalBal + inputs.annualSalary}
            build={CHARTS.retirement401k(labels, chartDatasets, xMarkers)}
          />
        )}
      </div>

      <div className="stat-grid">
        {datasets.map(({ c, rows }) => {
          const atIndia = rows.find((r) => r.year === inputs.returnYear && r.month === 12) ?? rows[rows.length - 1];
          const atEnd = rows[rows.length - 1];
          return (
            <div className="stat" key={c}>
              <div className="stat-top">
                <span style={{ width: 9, height: 9, borderRadius: 2, background: CONTRIB_COLORS[c], display: 'inline-block' }} />
                {CONTRIB_LABELS[c]} · end of {inputs.returnYear}
              </div>
              <div className="stat-val" style={{ fontSize: 18 }}>{fmtUSD(atIndia.balance)}</div>
              <div className="stat-foot">
                {inputs.withdraw401kYear} (age {withdrawAge}): <strong className="text-neg">{fmtUSD(atEnd.balance)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Withdrawal estimate · {inputs.withdraw401kYear} (age {withdrawAge})</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          {results.summary.isEarlyWithdrawal401k
            ? `Before 59½ — IRS applies ordinary income tax plus a 10% early withdrawal penalty (${(results.summary.taxRate401k * 100).toFixed(0)}% total).`
            : `At/after 59½ — no early withdrawal penalty, ordinary income tax only (${(results.summary.taxRate401k * 100).toFixed(0)}%).`}
        </div>
        <div className="grid-3">
          {datasets.map(({ c, rows }) => {
            const gross = rows[rows.length - 1].balance;
            const net = gross * (1 - results.summary.taxRate401k);
            return (
              <div className="calc" key={c}>
                <div className="calc-l">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CONTRIB_COLORS[c], display: 'inline-block' }} />
                  {CONTRIB_LABELS[c]} contribution
                </div>
                <div className="calc-v">{fmtUSD(net)}</div>
                <div className="calc-foot">Gross {fmtUSD(gross)} · net after tax</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
