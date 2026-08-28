import { useMemo, useState } from 'react';
import type { CalculationResults, Inputs } from '../../../types';
import { fmtL, fmtRupees } from '../../../utils/formatters';
import { ApexChartComponent } from '../../../components/ApexChartComponent';
import { CHARTS } from '../../../utils/chartBuilders';
import { buildTaxChecklist } from '../../../utils/taxModel';
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

  // Same per-bucket tax model as the desktop Withdrawal tab, read straight off
  // the backend result (EPF/PPF free, equity LTCG above the Rs 1.25L
  // exemption, debt-taxed buckets at your slab rate) instead of re-derived
  // client-side — avoids double-taxing when "Apply tax" is also on.
  const corpus = results.summary.finalWealth;
  const first = scenario.length ? scenario[0] : null;
  const annual = first ? first.grossWithdrawalMonthly * 12 : 0;
  const tax = first ? first.taxMonthly * 12 : 0;
  const equityTax = first ? first.equityTaxMonthly * 12 : 0;
  const netMonthly = first ? first.withdrawalMonthly * 100000 : 0;
  const effectiveTaxPct = annual > 0 ? (tax / annual) * 100 : 0;
  const checklist = useMemo(() => buildTaxChecklist(results, inputs, rate), [results, inputs, rate]);

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
          <div className="m-tile-top">Est. tax (all buckets)</div>
          <div className="m-tile-value" style={{ marginTop: 4, color: 'var(--neg)' }}>{fmtL(tax)}</div>
          <div className="m-tile-foot">{effectiveTaxPct.toFixed(1)}% effective rate</div>
        </div>
        <div className="m-card">
          <div className="m-tile-top">Of which equity LTCG</div>
          <div className="m-tile-value" style={{ marginTop: 4, color: 'var(--neg)' }}>{fmtL(equityTax)}</div>
          <div className="m-tile-foot">12.5% above ₹1.25L/yr</div>
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
          const rowTax = r.depleted ? 0 : r.taxMonthly * 12;
          return (
            <div key={r.year} className="m-list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="m-row-value" style={{ color: 'var(--text-2)', minWidth: 34 }}>{r.year}</span>
              <span className="m-caption">{r.depleted ? '—' : fmtL(r.corpusStart)}</span>
              <span className="m-caption" style={{ color: 'var(--neg)' }}>{r.depleted ? '—' : `−${fmtL(rowTax)}`}</span>
              <span className="m-row-value" style={{ marginLeft: 'auto', color: 'var(--pos)' }}>
                {r.depleted ? 'Depleted' : fmtRupees(r.withdrawalMonthly * 100000) + '/mo'}
              </span>
            </div>
          );
        })}
      </div>

      {checklist.length > 0 && (
        <div className="m-card">
          <div className="m-card-title">Legal ways to reduce SWP tax</div>
          <div className="m-caption" style={{ marginTop: 4, marginBottom: 10 }}>
            With your numbers at {rate} SWR · general guidance, not personalized tax advice
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {checklist.map((item) => (
              <div key={item.title} style={{ borderLeft: '3px solid var(--m-accent)', paddingLeft: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{item.title}</div>
                <div className="m-caption" style={{ lineHeight: 1.45 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
