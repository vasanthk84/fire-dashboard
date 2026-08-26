import { useMemo, useState } from 'react';
import type { CalculationResults, Inputs } from '../../../types';
import { fmtL, fmtRupees } from '../../../utils/formatters';
import { ApexChartComponent } from '../../../components/ApexChartComponent';
import { CHARTS } from '../../../utils/chartBuilders';
import { MHero } from '../../components/primitives';

interface WithdrawalViewProps {
  results: CalculationResults;
  inputs: Inputs;
  themeKey: string;
}

const RATES = ['2%', '3%', '4%'];
const DEPLETION_HORIZON_YEARS = 25;

export function WithdrawalView({ results, inputs, themeKey }: WithdrawalViewProps) {
  const [rate, setRate] = useState('4%');
  const scenario = results.withdrawalScenarios[rate] ?? [];
  const sustainability = results.withdrawalSustainability?.[rate];

  // Same LTCG model as the desktop Withdrawal tab — reused verbatim, just
  // re-skinned to the mobile card layout.
  const corpus = results.summary.finalWealth;
  const yrs = inputs.retirementYear - inputs.startYear;
  const principal = (inputs.mfPrincipal || inputs.mfCurrent * 0.7) + inputs.mfSIP * 12 * yrs;
  const gainRatio = corpus > 0 ? Math.max(0, (corpus - principal) / corpus) : 0;

  const annual = scenario.length ? scenario[0].withdrawalMonthly * 12 : 0;
  const taxable = annual * gainRatio;
  const netGain = Math.max(0, taxable - 1.25);
  const ltcg = netGain * 0.125;
  const netMonthly = ((annual - ltcg) / 12) * 100000;

  const depletionRows = useMemo(() => scenario.slice(0, DEPLETION_HORIZON_YEARS + 1), [scenario]);
  const depletionLabels = depletionRows.map((r) => String(r.year));
  const depletionValues = depletionRows.map((r) => Number(r.corpusEnd.toFixed(1)));
  const depletesWithinHorizon = !!(sustainability?.depletionYear && depletionRows.some((r) => r.year === sustainability.depletionYear));

  const endYear = inputs.retirementYear + DEPLETION_HORIZON_YEARS;
  const endLabel = depletesWithinHorizon
    ? `depleted before ${endYear}`
    : `${endYear} · ${fmtL(depletionRows[depletionRows.length - 1]?.corpusEnd ?? 0)}`;

  const listRows = scenario.slice(0, 6);

  if (scenario.length === 0) {
    return <div className="m-card"><div className="m-loading">Run the calculation to see withdrawal projections.</div></div>;
  }

  return (
    <>
      <MHero tint1="rgba(21,160,95,.16)">
        <div className="m-eyebrow">Net income · {rate} SWR</div>
        <div className="m-hero-metric" style={{ marginTop: 6 }}>{fmtRupees(netMonthly)}</div>
        <div className="m-caption" style={{ marginTop: 4 }}>per month, after LTCG · from {inputs.retirementYear}</div>
        <div className="m-rate-row" style={{ marginTop: 12 }}>
          {RATES.map((r) => (
            <button key={r} className={'m-rate-btn' + (rate === r ? ' active' : '')} onClick={() => setRate(r)}>{r}</button>
          ))}
        </div>
      </MHero>

      <div className="m-grid-2-card">
        <div className="m-card">
          <div className="m-tile-top">Annual withdrawal</div>
          <div className="m-tile-value" style={{ marginTop: 4 }}>{fmtL(annual)}</div>
          <div className="m-tile-foot">Sell {rate} of units</div>
        </div>
        <div className="m-card">
          <div className="m-tile-top">Taxable component</div>
          <div className="m-tile-value" style={{ marginTop: 4 }}>{fmtL(taxable)}</div>
          <div className="m-tile-foot">{((1 - gainRatio) * 100).toFixed(0)}% is principal</div>
        </div>
        <div className="m-card">
          <div className="m-tile-top">Est. LTCG tax</div>
          <div className="m-tile-value" style={{ marginTop: 4, color: 'var(--neg)' }}>{fmtL(ltcg)}</div>
          <div className="m-tile-foot">12.5% on gains</div>
        </div>
        <div className="m-card">
          <div className="m-tile-top">Corpus at {inputs.retirementYear}</div>
          <div className="m-tile-value" style={{ marginTop: 4 }}>{fmtL(corpus)}</div>
          <div className="m-tile-foot">From the trajectory</div>
        </div>
      </div>

      <div className="m-card">
        <div className="m-card-title">Corpus sustainability</div>
        <div style={{ marginTop: 10 }}>
          <ApexChartComponent
            height={200}
            dep={'msustain' + themeKey + rate}
            build={CHARTS.mobileSustainability(depletionLabels, depletionValues, depletesWithinHorizon)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="m-axis-label">{inputs.retirementYear}</span>
          <span className="m-axis-label" style={depletesWithinHorizon ? { color: 'var(--neg)' } : undefined}>{endLabel}</span>
        </div>
      </div>

      <div className="m-card" style={{ padding: '6px 16px 10px' }}>
        <div className="m-card-title" style={{ padding: '10px 0' }}>Post-tax income</div>
        {listRows.map((r) => {
          const gs = r.corpusStart > 0 ? Math.max(0, (r.corpusStart - principal) / r.corpusStart) : 0;
          const aw = r.withdrawalMonthly * 12;
          const tax = r.depleted ? 0 : Math.max(0, aw * gs - 1.25) * 0.125;
          return (
            <div key={r.year} className="m-list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="m-row-value" style={{ color: 'var(--text-2)', minWidth: 34 }}>{r.year}</span>
              <span className="m-caption">{r.depleted ? '—' : fmtL(r.corpusStart)}</span>
              <span className="m-caption" style={{ color: 'var(--neg)' }}>{r.depleted ? '—' : `−${fmtL(tax)}`}</span>
              <span className="m-row-value" style={{ marginLeft: 'auto', color: 'var(--pos)' }}>
                {r.depleted ? 'Depleted' : fmtRupees(((aw - tax) / 12) * 100000) + '/mo'}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
