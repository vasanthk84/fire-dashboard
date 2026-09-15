import { useMemo, useState } from 'react';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { fmtRupees, fmtL } from '../../utils/formatters';
import { CHARTS } from '../../utils/chartBuilders';
import { ApexChartComponent } from '../../components/ApexChartComponent';
import { MHero, MChipNeutral, MChip, MTile } from '../components/primitives';
import { M_HERO_TINT, M_PF_CASH, M_PF_BONDS, M_PF_WHEEL, M_POS, M_NEG, M_WARN } from '../mobileColors';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(year: number, monthIdx0: number, offset: number) {
  const total = monthIdx0 + offset;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return MONTH_NAMES[m] + ' ' + y;
}

// The four functions below mirror desktop's PFReinvestmentTab.tsx verbatim
// (module-private there, so duplicated here — same reuse pattern as the
// other mobile screens). No changes to the math, only to what's displayed.
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

interface MonthRow {
  m: number;
  label: string;
  total: number;
  reinvestValue: number;
  pfBench: number;
  diff: number;
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
    const cashInterestGross = (corpusCash * (opts.cashRatePct / 100)) / 12;
    const bondInterestGross = (corpusBond * (opts.bondRatePct / 100)) / 12;
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
      total: cashInterest + bondInterest + wheelIncome,
      reinvestValue,
      pfBench,
      diff: reinvestValue - pfBench
    });
  }
  return rows;
}

interface PFScreenProps {
  planner: UseFirePlannerReturn;
  reinvestWheel: boolean;
  onReinvestWheelChange: (next: boolean) => void;
}

// Interest-credit frequency (monthly/quarterly) has no control in the mobile
// spec at all — it keeps desktop's own default (quarterly) rather than
// exposing it.
const CASH_CREDIT_FREQ = 3;

export function PFScreen({ planner, reinvestWheel }: PFScreenProps) {
  const { inputs, handleInput, runCalculation } = planner;
  const [horizonMonths, setHorizonMonths] = useState(36);

  const now = new Date();
  const monthsToWithdrawal = inputs.pfWithdrawalYear * 12 + (inputs.pfWithdrawalMonth - 1) - (now.getFullYear() * 12 + now.getMonth());

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
        cashCreditFreq: CASH_CREDIT_FREQ,
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
      inputs.pfWithdrawalYear,
      inputs.pfWithdrawalMonth
    ]
  );

  const { cashFrac, bondFrac, wheelFrac } = normaliseAllocation(inputs.pfCashAllocPct, inputs.pfBondAllocPct);
  const cashAmt = totalReinvestCorpus * cashFrac;
  const bondAmt = totalReinvestCorpus * bondFrac;
  const wheelAmt = totalReinvestCorpus * wheelFrac;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const beating = last ? last.diff >= 0 : true;
  const withdrawalDateLabel = monthLabel(inputs.pfWithdrawalYear, inputs.pfWithdrawalMonth - 1, 0);
  const blendedYieldPct = totalReinvestCorpus > 0 ? (((first?.total ?? 0) * 12) / totalReinvestCorpus) * 100 : 0;

  const verdictColor = beating ? M_POS : M_NEG;
  const verdictBg = beating ? 'rgba(31,170,107,.09)' : 'rgba(224,85,107,.09)';
  const verdictBd = beating ? 'rgba(31,170,107,.28)' : 'rgba(224,85,107,.28)';

  const onSlider = (key: 'pfCashAllocPct' | 'pfBondAllocPct', v: number) => {
    handleInput(key, v);
    void runCalculation({ [key]: v });
  };

  const shownRows = rows.slice(0, 6);

  return (
    <div className="m-screen">
      <div className="m-screen-head" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 className="m-h1">PF Reinvest</h1>
        <span className="m-caption" style={{ fontSize: 11 }}>closure {withdrawalDateLabel}</span>
      </div>

      <div className="m-stack">
        <MHero tint1={M_HERO_TINT.pf} tint2="rgba(47,109,240,.03)" lineColor="rgba(47,109,240,.26)">
          <div className="m-eyebrow">Corpus to reinvest</div>
          <div className="m-hero-metric" style={{ marginTop: 8 }}>{fmtL(totalReinvestCorpus / 100000)}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MChipNeutral label={`${Math.max(0, monthsToWithdrawal)} months out`} />
            <MChip label="Date not confirmed" color={M_WARN} mono={false} />
          </div>
          <div className="m-grid-2" style={{ marginTop: 14 }}>
            <MTile top="EPF + VPF" value={fmtL(pfBalanceAtWithdrawal / 100000)} foot="grown to closure" onHero />
            <MTile top="Gratuity" value={fmtL(inputs.gratuityAmount / 100000)} foot="at separation" onHero />
            <MTile top="Super lump" value={fmtL(superLumpINR / 100000)} foot={`${(inputs.superCommutationPct * 100).toFixed(0)}% commuted`} onHero />
            <MTile top="Annuitised" value={fmtL(superAnnuityCorpusINR / 100000)} foot={`${(inputs.annuityRatePct * 100).toFixed(0)}% payout`} onHero />
          </div>
        </MHero>

        <div className="m-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="m-card-title">Allocation</span>
            <span className="m-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>blended {blendedYieldPct.toFixed(2)}%/yr</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
              <div style={{ width: cashFrac * 100 + '%', background: M_PF_CASH }} />
              <div style={{ width: bondFrac * 100 + '%', background: M_PF_BONDS }} />
              <div style={{ width: wheelFrac * 100 + '%', background: M_PF_WHEEL }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: M_PF_CASH, flexShrink: 0 }} />
                <span style={{ font: '650 12.5px var(--font-sans)' }}>Cash / FD</span>
                <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--text-3)' }}>{inputs.pfCashRatePct.toFixed(1)}% p.a.</span>
                <span style={{ marginLeft: 'auto', font: '700 12.5px var(--font-mono)' }}>{fmtRupees(cashAmt)}</span>
                <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-2)', minWidth: 34, textAlign: 'right' }}>{(cashFrac * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={inputs.pfCashAllocPct} onChange={(e) => onSlider('pfCashAllocPct', Number(e.target.value))} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: M_PF_BONDS, flexShrink: 0 }} />
                <span style={{ font: '650 12.5px var(--font-sans)' }}>Bonds / debt</span>
                <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--text-3)' }}>{inputs.pfBondRatePct.toFixed(1)}% p.a.</span>
                <span style={{ marginLeft: 'auto', font: '700 12.5px var(--font-mono)' }}>{fmtRupees(bondAmt)}</span>
                <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-2)', minWidth: 34, textAlign: 'right' }}>{(bondFrac * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={inputs.pfBondAllocPct} onChange={(e) => onSlider('pfBondAllocPct', Number(e.target.value))} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: M_PF_WHEEL, flexShrink: 0 }} />
                <span style={{ font: '650 12.5px var(--font-sans)' }}>Wheeling</span>
                <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--text-3)' }}>{inputs.pfWheelYieldPctMonthly.toFixed(2)}% p.m.</span>
                <span style={{ marginLeft: 'auto', font: '700 12.5px var(--font-mono)' }}>{fmtRupees(wheelAmt)}</span>
                <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-2)', minWidth: 34, textAlign: 'right' }}>{(wheelFrac * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={Math.round(wheelFrac * 100)} disabled style={{ opacity: 0.45 }} onChange={() => {}} />
            </div>
          </div>
        </div>

        <div className="m-grid-2-card">
          <div className="m-card" style={{ padding: 14 }}>
            <div style={{ font: '600 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Income / month</div>
            <div style={{ marginTop: 7, font: '700 20px var(--font-mono)', letterSpacing: '-0.02em' }}>{fmtRupees(first?.total ?? 0)}</div>
            <div style={{ marginTop: 3, font: '500 10.5px var(--font-sans)', color: 'var(--text-3)' }}>post-tax, month one</div>
          </div>
          <div className="m-card" style={{ padding: 14 }}>
            <div style={{ font: '600 10px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Annuity / month</div>
            <div style={{ marginTop: 7, font: '700 20px var(--font-mono)', letterSpacing: '-0.02em' }}>{fmtRupees(annuityMonthlyIncome)}</div>
            <div style={{ marginTop: 3, font: '500 10.5px var(--font-sans)', color: 'var(--text-3)' }}>on annuitised super</div>
          </div>
        </div>

        <div style={{ borderRadius: 16, padding: 16, background: verdictBg, border: '1px solid ' + verdictBd }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ font: '700 12.5px var(--font-sans)', color: verdictColor }}>{beating ? 'Ahead of PF' : 'Behind PF'}</span>
            <span style={{ font: '700 15px var(--font-mono)', color: verdictColor }}>
              {last ? (beating ? '+' : '−') + fmtL(Math.abs(last.diff) / 100000) : fmtL(0)}
            </span>
          </div>
          <div style={{ marginTop: 4, font: '500 11px var(--font-sans)', color: 'var(--text-2)' }}>
            vs staying in PF @ {(inputs.epfRate * 100).toFixed(2)}% by {last?.label ?? withdrawalDateLabel}
          </div>
          {rows.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <ApexChartComponent
                height={96}
                dep={'pfv' + horizonMonths + reinvestWheel + inputs.pfCashAllocPct + inputs.pfBondAllocPct + beating}
                build={CHARTS.mobilePfVerdict(
                  rows.map((r) => r.label),
                  rows.map((r) => Math.round(r.reinvestValue)),
                  rows.map((r) => Math.round(r.pfBench)),
                  verdictColor
                )}
              />
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '500 10.5px var(--font-sans)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Horizon {horizonMonths} mo</span>
            <input type="range" min={6} max={60} step={1} value={horizonMonths} onChange={(e) => setHorizonMonths(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
        </div>

        <div className="m-card" style={{ padding: 0 }}>
          <div className="m-list-row" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <span className="m-card-title">Month by month</span>
            <span className="m-caption" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>income · ahead</span>
          </div>
          {shownRows.map((r) => (
            <div key={r.m} className="m-list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: '600 11.5px var(--font-mono)', color: 'var(--text-2)', minWidth: 64 }}>{r.label}</span>
              <span style={{ font: '600 12px var(--font-mono)' }}>{fmtRupees(r.total)}</span>
              <span style={{ marginLeft: 'auto', font: '700 12px var(--font-mono)', color: r.diff >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {r.diff >= 0 ? '+' : '−'}{fmtRupees(Math.abs(r.diff))}
              </span>
            </div>
          ))}
          <div className="m-list-row">
            <span className="m-caption" style={{ fontSize: 10.5 }}>First {shownRows.length} months of {horizonMonths} mo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
