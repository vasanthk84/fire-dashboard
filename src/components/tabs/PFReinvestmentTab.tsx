import { useMemo, useState } from 'react';
import type { CalculationResults, Inputs } from '../../types';
import { fmtRupees, fmtL } from '../../utils/formatters';
import { NumberInput } from '../NumberInput';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface PFReinvestmentTabProps {
  results: CalculationResults;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
  themeKey: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(year: number, monthIdx0: number, offset: number) {
  const total = monthIdx0 + offset;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return MONTH_NAMES[m] + ' ' + y;
}

function projectEpfForward(startBalance: number, basicPay: number, epfRate: number, vpfRate: number, months: number) {
  if (months <= 0) return startBalance;
  let balance = startBalance;
  let yearlyInterest = 0;
  const totalMonthly = basicPay * (0.12 + vpfRate) + basicPay * 0.12;
  for (let m = 1; m <= months; m++) {
    balance += totalMonthly;
    yearlyInterest += balance * (epfRate / 12);
  }
  return balance + yearlyInterest;
}

// Superannuation keeps earning employer contributions + interest right up to
// the withdrawal date — mirrors api/calculate.js's projectSimpleForward.
function projectSimpleForward(startBalance: number, monthlyContribution: number, annualRatePct: number, months: number) {
  if (months <= 0) return startBalance;
  let balance = startBalance;
  let yearlyInterest = 0;
  for (let m = 1; m <= months; m++) {
    balance += monthlyContribution;
    yearlyInterest += balance * (annualRatePct / 100 / 12);
  }
  return balance + yearlyInterest;
}

interface MonthRow {
  m: number;
  label: string;
  cashInterest: number;
  bondInterest: number;
  wheelIncome: number;
  total: number;
  reinvestValue: number;
  pfBench: number;
  diff: number;
}

// Cash + bond allocations clamp to 100% between them; whatever's left goes to
// wheeling — mirrors the same normalisation used in api/calculate.js.
function normaliseAllocation(cashPct: number, bondPct: number) {
  let cashFrac = Math.max(0, Math.min(100, cashPct)) / 100;
  let bondFrac = Math.max(0, Math.min(100, bondPct)) / 100;
  if (cashFrac + bondFrac > 1) {
    const scale = 1 / (cashFrac + bondFrac);
    cashFrac *= scale;
    bondFrac *= scale;
  }
  const wheelFrac = 1 - cashFrac - bondFrac;
  return { cashFrac, bondFrac, wheelFrac };
}

function projectReinvestment(opts: {
  totalCorpus: number;
  cashAllocPct: number;
  cashRatePct: number;
  bondAllocPct: number;
  bondRatePct: number;
  wheelYieldPctMonthly: number;
  taxPct: number;
  pfRateToBeat: number;
  months: number;
  reinvestWheel: boolean;
  cashCreditFreq: number;
  startYear: number;
  startMonthIdx0: number;
}): MonthRow[] {
  const { cashFrac, bondFrac, wheelFrac } = normaliseAllocation(opts.cashAllocPct, opts.bondAllocPct);
  let corpusCash = opts.totalCorpus * cashFrac;
  let corpusBond = opts.totalCorpus * bondFrac;
  let corpusWheel = opts.totalCorpus * wheelFrac;
  let pfBench = opts.totalCorpus;
  let pendingCashInterest = 0;
  const rows: MonthRow[] = [];

  for (let m = 1; m <= opts.months; m++) {
    const cashInterestGross = corpusCash * (opts.cashRatePct / 100) / 12;
    const bondInterestGross = corpusBond * (opts.bondRatePct / 100) / 12;
    const wheelIncomeGross = corpusWheel * (opts.wheelYieldPctMonthly / 100);
    const cashInterest = cashInterestGross * (1 - opts.taxPct / 100);
    const bondInterest = bondInterestGross * (1 - opts.taxPct / 100);
    const wheelIncome = wheelIncomeGross * (1 - opts.taxPct / 100);

    corpusBond += bondInterestGross;

    if (opts.reinvestWheel) {
      corpusWheel += wheelIncomeGross;
    } else {
      corpusCash += wheelIncomeGross;
    }

    pendingCashInterest += cashInterestGross;
    if (m % opts.cashCreditFreq === 0) {
      corpusCash += pendingCashInterest;
      pendingCashInterest = 0;
    }

    pfBench *= 1 + opts.pfRateToBeat / 12;

    const reinvestValue = corpusCash + corpusBond + corpusWheel + pendingCashInterest;
    rows.push({
      m,
      label: monthLabel(opts.startYear, opts.startMonthIdx0, m),
      cashInterest,
      bondInterest,
      wheelIncome,
      total: cashInterest + bondInterest + wheelIncome,
      reinvestValue,
      pfBench,
      diff: reinvestValue - pfBench
    });
  }
  return rows;
}

const COMMUTATION_OPTIONS: Array<{ label: string; value: number; note: string }> = [
  { label: '1/3 lump sum', value: 1 / 3, note: 'Commute 1/3, annuitise the rest' },
  { label: '1/2 lump sum', value: 0.5, note: 'Commute 1/2, annuitise the rest' },
  { label: 'Full annuity', value: 0, note: 'No lump sum — annuitise 100%' }
];

export function PFReinvestmentTab({ inputs, onInput, themeKey }: PFReinvestmentTabProps) {
  const [horizonMonths, setHorizonMonths] = useState(36);
  const [reinvestWheel, setReinvestWheel] = useState(false);
  const [cashCreditFreq, setCashCreditFreq] = useState(3);

  const now = new Date();
  const monthsToWithdrawal = (inputs.pfWithdrawalYear * 12 + (inputs.pfWithdrawalMonth - 1)) - (now.getFullYear() * 12 + now.getMonth());

  const pfBalanceAtWithdrawal = useMemo(
    () => projectEpfForward(inputs.epfCurrent * 100000, inputs.basicPay, inputs.epfRate, inputs.vpfRate, Math.max(0, monthsToWithdrawal)),
    [inputs.epfCurrent, inputs.basicPay, inputs.epfRate, inputs.vpfRate, monthsToWithdrawal]
  );

  const superannuationAtWithdrawal = useMemo(
    () => projectSimpleForward(inputs.superannuationBalance, inputs.superMonthlyContribution, inputs.superInterestRatePct, Math.max(0, monthsToWithdrawal)),
    [inputs.superannuationBalance, inputs.superMonthlyContribution, inputs.superInterestRatePct, monthsToWithdrawal]
  );
  const superLumpINR = superannuationAtWithdrawal * inputs.superCommutationPct;
  const superAnnuityCorpusINR = superannuationAtWithdrawal * (1 - inputs.superCommutationPct);
  const annuityMonthlyIncome = (superAnnuityCorpusINR * inputs.annuityRatePct) / 12;
  const totalReinvestCorpus = pfBalanceAtWithdrawal + inputs.gratuityAmount + superLumpINR;

  const rows = useMemo(
    () =>
      projectReinvestment({
        totalCorpus: totalReinvestCorpus,
        cashAllocPct: inputs.pfCashAllocPct,
        cashRatePct: inputs.pfCashRatePct,
        bondAllocPct: inputs.pfBondAllocPct,
        bondRatePct: inputs.pfBondRatePct,
        wheelYieldPctMonthly: inputs.pfWheelYieldPctMonthly,
        taxPct: inputs.pfReinvestTaxPct,
        pfRateToBeat: inputs.epfRate,
        months: horizonMonths,
        reinvestWheel,
        cashCreditFreq,
        startYear: inputs.pfWithdrawalYear,
        startMonthIdx0: inputs.pfWithdrawalMonth - 1
      }),
    [
      totalReinvestCorpus,
      inputs.pfCashAllocPct,
      inputs.pfCashRatePct,
      inputs.pfBondAllocPct,
      inputs.pfBondRatePct,
      inputs.pfWheelYieldPctMonthly,
      inputs.pfReinvestTaxPct,
      inputs.epfRate,
      horizonMonths,
      reinvestWheel,
      cashCreditFreq,
      inputs.pfWithdrawalYear,
      inputs.pfWithdrawalMonth
    ]
  );

  const last = rows[rows.length - 1];
  const first = rows[0];
  const beating = last ? last.diff >= 0 : true;
  const withdrawalDateLabel = monthLabel(inputs.pfWithdrawalYear, inputs.pfWithdrawalMonth - 1, 0);
  const { cashFrac, bondFrac, wheelFrac } = normaliseAllocation(inputs.pfCashAllocPct, inputs.pfBondAllocPct);
  const cashAmt = totalReinvestCorpus * cashFrac;
  const bondAmt = totalReinvestCorpus * bondFrac;
  const wheelAmt = totalReinvestCorpus * wheelFrac;

  const stats = [
    { l: 'PF balance at withdrawal', v: fmtRupees(pfBalanceAtWithdrawal), f: withdrawalDateLabel },
    { l: 'Gratuity', v: fmtRupees(inputs.gratuityAmount), f: 'Paid at separation' },
    {
      l: 'Superannuation lump sum',
      v: fmtRupees(superLumpINR),
      f: superLumpINR > 0 ? 'Tax-free commutation' : 'Fully annuitised'
    },
    {
      l: 'Annuity income',
      v: fmtRupees(annuityMonthlyIncome) + '/mo',
      f: superAnnuityCorpusINR > 0 ? `On ${fmtRupees(superAnnuityCorpusINR)} corpus` : 'No annuity — full lump sum'
    }
  ];

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">PF Closure &amp; Reinvestment</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          Set the date TCS actually closes your PF, and everything below — the reinvestment
          corpus, the chart, and your main FIRE plan's EPF line and passive income — recalculates from that date.
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 4 }}>
          <div className="in-wrap" style={{ minWidth: 140 }}>
            <label>PF withdrawal date</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select
                className="in"
                style={{ flex: '0 0 72px', padding: '6px 4px', fontSize: '12px' }}
                value={inputs.pfWithdrawalMonth}
                onChange={(e) => onInput('pfWithdrawalMonth', Number(e.target.value))}
              >
                {MONTH_NAMES.map((mn, i) => (
                  <option key={mn} value={i + 1}>{mn}</option>
                ))}
              </select>
              <NumberInput className="in" step={1} value={inputs.pfWithdrawalYear} onCommit={(n) => onInput('pfWithdrawalYear', n)} />
            </div>
          </div>
          <span className="tag warn">
            Best-guess date — TCS has indicated closure within ~6–12 months of Aug 2026
          </span>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.l}>
            <div className="stat-top">{s.l}</div>
            <div className="stat-val">{s.v}</div>
            <div className="stat-foot">{s.f}</div>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Gratuity, superannuation &amp; commutation</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          TCS policy: on separation, commute 1/3 or 1/2 of the superannuation corpus tax-free and
          buy an annuity with the rest — or annuitise the entire corpus.
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="in-wrap">
            <label>Gratuity (₹)</label>
            <NumberInput className="in" step={1000} value={inputs.gratuityAmount} onCommit={(n) => onInput('gratuityAmount', n)} />
          </div>
          <div className="in-wrap">
            <label>Superannuation balance (₹, latest statement)</label>
            <NumberInput className="in" step={1000} value={inputs.superannuationBalance} onCommit={(n) => onInput('superannuationBalance', n)} />
          </div>
          <div className="in-wrap">
            <label>Annuity payout rate %/yr</label>
            <NumberInput
              className="in"
              step={0.1}
              value={Math.round(inputs.annuityRatePct * 1000) / 10}
              onCommit={(n) => onInput('annuityRatePct', n / 100)}
            />
          </div>
          <div className="in-wrap">
            <label>Super monthly contribution (₹)</label>
            <NumberInput className="in" step={100} value={inputs.superMonthlyContribution} onCommit={(n) => onInput('superMonthlyContribution', n)} />
          </div>
          <div className="in-wrap">
            <label>Super interest rate %/yr</label>
            <NumberInput
              className="in"
              step={0.1}
              value={inputs.superInterestRatePct}
              onCommit={(n) => onInput('superInterestRatePct', n)}
            />
          </div>
          <div className="stat" style={{ padding: '10px 14px' }}>
            <div className="stat-top">Superannuation at withdrawal</div>
            <div className="stat-val" style={{ fontSize: 18 }}>{fmtRupees(superannuationAtWithdrawal)}</div>
            <div className="stat-foot">Grown from latest statement to {withdrawalDateLabel}</div>
          </div>
        </div>
        <div className="in-wrap" style={{ marginBottom: 4 }}>
          <label>Commutation option</label>
        </div>
        <div className="seg" style={{ width: 'fit-content' }}>
          {COMMUTATION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className={Math.abs(inputs.superCommutationPct - opt.value) < 0.001 ? 'active' : ''}
              onClick={() => onInput('superCommutationPct', opt.value)}
              title={opt.note}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Reinvestment allocation</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 6 }}>
          Total corpus to reinvest: <strong>{fmtRupees(totalReinvestCorpus)}</strong>
        </div>
        <div className="split-bar-wrap" style={{ height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 10, background: 'var(--surface-2)' }}>
          <div style={{ width: (cashFrac * 100) + '%', background: '#5b9cff' }} />
          <div style={{ width: (bondFrac * 100) + '%', background: '#2dd4a7' }} />
          <div style={{ width: (wheelFrac * 100) + '%', background: '#ffb84d' }} />
        </div>
        <div className="legend" style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-2)' }}>
          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#5b9cff', marginRight: 6 }} />Cash {(cashFrac * 100).toFixed(0)}% · {fmtRupees(cashAmt)}</span>
          {' '}<span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#2dd4a7', marginRight: 6 }} />Bonds {(bondFrac * 100).toFixed(0)}% · {fmtRupees(bondAmt)}</span>
          {' '}<span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#ffb84d', marginRight: 6 }} />Wheeling {(wheelFrac * 100).toFixed(0)}% · {fmtRupees(wheelAmt)}</span>
        </div>

        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="in-wrap">
            <label>Cash % — {inputs.pfCashAllocPct.toFixed(0)}%</label>
            <input type="range" min={0} max={100} step={1} value={inputs.pfCashAllocPct} onChange={(e) => onInput('pfCashAllocPct', Number(e.target.value))} />
          </div>
          <div className="in-wrap">
            <label>Bonds % — {inputs.pfBondAllocPct.toFixed(0)}%</label>
            <input type="range" min={0} max={100} step={1} value={inputs.pfBondAllocPct} onChange={(e) => onInput('pfBondAllocPct', Number(e.target.value))} />
          </div>
          <div className="in-wrap">
            <label>Wheeling % (remainder)</label>
            <div className="stat" style={{ padding: '6px 10px' }}>
              <div className="stat-val" style={{ fontSize: 15 }}>{(wheelFrac * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="in-wrap">
            <label>Cash interest %/yr (Equitas)</label>
            <NumberInput className="in" step={0.1} value={inputs.pfCashRatePct} onCommit={(n) => onInput('pfCashRatePct', n)} />
          </div>
          <div className="in-wrap">
            <label>Bond/debt fund yield %/yr</label>
            <NumberInput className="in" step={0.1} value={inputs.pfBondRatePct} onCommit={(n) => onInput('pfBondRatePct', n)} />
          </div>
          <div className="in-wrap">
            <label>Wheeling yield %/mo</label>
            <NumberInput className="in" step={0.05} value={inputs.pfWheelYieldPctMonthly} onCommit={(n) => onInput('pfWheelYieldPctMonthly', n)} />
          </div>
          <div className="in-wrap">
            <label>Tax on reinvestment income %</label>
            <NumberInput className="in" step={1} value={inputs.pfReinvestTaxPct} onCommit={(n) => onInput('pfReinvestTaxPct', n)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 16, alignItems: 'center' }}>
          <label className="switch">
            <input type="checkbox" checked={reinvestWheel} onChange={(e) => setReinvestWheel(e.target.checked)} />
            <span className="track"></span>
            Compound wheeling premiums (vs sweep to cash)
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Interest credit</span>
            <div className="seg sm">
              <button className={cashCreditFreq === 1 ? 'active' : ''} onClick={() => setCashCreditFreq(1)}>Monthly</button>
              <button className={cashCreditFreq === 3 ? 'active' : ''} onClick={() => setCashCreditFreq(3)}>Quarterly</button>
            </div>
          </div>

          <div className="in-wrap" style={{ minWidth: 160 }}>
            <label>Chart horizon — {horizonMonths} months</label>
            <input type="range" min={6} max={60} step={1} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {last && (
        <div className={'banner warn'} style={beating ? { borderColor: 'var(--pos)', background: 'color-mix(in srgb, var(--pos) 10%, transparent)', color: 'var(--pos)' } : undefined}>
          {beating
            ? `Beating the PF benchmark by ${fmtRupees(Math.abs(last.diff))} by ${last.label}, at current assumptions.`
            : `Falling short of the PF benchmark by ${fmtRupees(Math.abs(last.diff))} by ${last.label}, at current assumptions.`}
        </div>
      )}

      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <span className="panel-t" style={{ fontSize: 13 }}>Reinvestment vs staying in PF</span>
          <span className="panel-cap" style={{ marginLeft: 0 }}>
            Benchmark @ EPF rate ({(inputs.epfRate * 100).toFixed(2)}%) · This month's income {fmtRupees(first?.total ?? 0)} · Blended yield{' '}
            {totalReinvestCorpus > 0 ? (((first?.total ?? 0) * 12) / totalReinvestCorpus * 100).toFixed(2) : '0.00'}%
          </span>
        </div>
        {rows.length > 0 && (
          <ApexChartComponent
            height={140}
            dep={'pfr' + themeKey + horizonMonths + reinvestWheel + cashCreditFreq + inputs.pfCashAllocPct + inputs.pfBondAllocPct + inputs.pfWithdrawalYear + inputs.pfWithdrawalMonth}
            build={CHARTS.pfReinvest(
              rows.map((r) => r.label),
              rows.map((r) => Math.round(r.reinvestValue)),
              rows.map((r) => Math.round(r.pfBench))
            )}
          />
        )}
      </div>

      <div className="table-card">
        <div className="table-head">
          <div className="panel-t">Month-by-month breakdown</div>
        </div>
        <div className="table-scroll" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Month</th>
                <th>Cash interest</th>
                <th>Bond interest</th>
                <th>Wheeling income</th>
                <th>Total income</th>
                <th>Reinvest. value</th>
                <th>PF benchmark</th>
                <th>Ahead / behind</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.m}>
                  <td className="k">{r.label}</td>
                  <td>{fmtRupees(r.cashInterest)}</td>
                  <td>{fmtRupees(r.bondInterest)}</td>
                  <td>{fmtRupees(r.wheelIncome)}</td>
                  <td>{fmtRupees(r.total)}</td>
                  <td>{fmtRupees(r.reinvestValue)}</td>
                  <td>{fmtRupees(r.pfBench)}</td>
                  <td className={r.diff >= 0 ? 'text-pos' : 'text-neg'}>{r.diff >= 0 ? '+' : ''}{fmtRupees(r.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
