import type { CalculationResults, Inputs } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';
import { buildTaxChecklist } from '../../utils/taxModel';

interface WithdrawalTabProps {
  results: CalculationResults;
  inputs: Inputs;
  selectedWithdrawalRate: string;
  onSelectedRateChange: (value: string) => void;
  themeKey: string;
}

export function WithdrawalTab({ results, inputs, selectedWithdrawalRate, onSelectedRateChange, themeKey }: WithdrawalTabProps) {
  const scenario = results.withdrawalScenarios[selectedWithdrawalRate] ?? [];
  if (scenario.length === 0) return null;

  const sustainability = results.withdrawalSustainability?.[selectedWithdrawalRate];
  const postFireRatePct = ((inputs.postFireRate ?? 0.065) * 100).toFixed(1);
  const taxModel = results.summary.taxModel;

  // Backend now computes the actual per-bucket tax (equity LTCG above the
  // Rs 1.25L exemption + slab-rate tax on debt-taxed buckets, EPF/PPF free) —
  // these numbers are read directly rather than re-derived here, avoiding the
  // double-taxation that used to happen when "Apply tax" was also on.
  const first = scenario[0];
  const annualGross = first.grossWithdrawalMonthly * 12;
  const annualTax = first.taxMonthly * 12;
  const annualEquityTax = first.equityTaxMonthly * 12;
  const annualSlabTax = first.slabTaxMonthly * 12;
  const effectiveTaxPct = annualGross > 0 ? (annualTax / annualGross) * 100 : 0;

  const cards = [
    { l: 'Annual withdrawal', v: fmtL(annualGross), f: `Sell ${selectedWithdrawalRate} of corpus`, cls: '' },
    { l: 'Est. tax', v: fmtL(annualTax), f: `Equity ${fmtL(annualEquityTax)} · Debt/US ${fmtL(annualSlabTax)}`, cls: '' },
    { l: 'Net / mo', v: fmtRupees(((annualGross - annualTax) / 12) * 100000), f: `${effectiveTaxPct.toFixed(1)}% effective rate`, cls: 'hl' }
  ];

  const checklist = buildTaxChecklist(results, inputs, selectedWithdrawalRate);

  return (
    <div className="stack">
      <div className="card card-pad">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Withdrawal (SWP)</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>LTCG-optimised · FY2025 rules</div>
          </div>
          <select
            className="in"
            style={{ width: 170, maxWidth: '100%' }}
            value={selectedWithdrawalRate}
            onChange={(e) => onSelectedRateChange(e.target.value)}
          >
            <option value="2%">2% · Conservative</option>
            <option value="3%">3% · Balanced</option>
            <option value="4%">4% · Aggressive</option>
          </select>
        </div>

        <div className="grid-3" style={{ marginTop: 4 }}>
          {cards.map((c) => (
            <div className={'calc ' + c.cls} key={c.l}>
              <div className="calc-l">{c.l}</div>
              <div className="calc-v">{c.v}</div>
              <div className="calc-foot">{c.f}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div className="eyebrow">
              Corpus sustainability · {sustainability?.horizonYears ?? 30}-yr horizon @ {selectedWithdrawalRate}
            </div>
            {sustainability?.depletionYear ? (
              <span className="tag bad">
                Depletes {sustainability.depletionYear} · lasts {sustainability.sustainableYears}y
              </span>
            ) : (
              <span className="tag ok">
                Sustains full {sustainability?.horizonYears ?? 30}y horizon
              </span>
            )}
          </div>
          <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 12 }}>
            Fixed real withdrawal, inflation-adjusted yearly · post-FI return assumed {postFireRatePct}%
          </div>
          <ApexChartComponent
            height={240}
            dep={'dep' + themeKey + selectedWithdrawalRate}
            build={CHARTS.depletion(scenario, selectedWithdrawalRate)}
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-head">
          <div className="panel-t">Projected post-tax income</div>
        </div>
        <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Year</th>
                <th>Corpus</th>
                <th>Withdrawal</th>
                <th>Est. tax</th>
                <th>Net / mo</th>
              </tr>
            </thead>
            <tbody>
              {scenario.map((r) => {
                const aw = r.grossWithdrawalMonthly * 12;
                const tax = r.depleted ? 0 : r.taxMonthly * 12;
                return (
                  <tr key={r.year} className={r.depleted ? 'text-neg' : ''}>
                    <td className="k">{r.year}</td>
                    <td>{r.depleted ? '—' : fmtL(r.corpusStart)}</td>
                    <td>{r.depleted ? '—' : fmtL(aw)}</td>
                    <td className="text-neg">{r.depleted ? '—' : `−${fmtL(tax)}`}</td>
                    <td className={r.depleted ? '' : 'text-pos'}>
                      {r.depleted ? 'Depleted' : fmtRupees(r.withdrawalMonthly * 100000)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {checklist.length > 0 && (
        <div className="card card-pad">
          <div className="panel-h">
            <span className="panel-t">Legal ways to reduce SWP tax</span>
          </div>
          <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
            Plugged in with your numbers at {selectedWithdrawalRate} SWR · general guidance, not personalized tax advice
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {checklist.map((item) => (
              <div key={item.title} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
                <div className="panel-cap" style={{ marginLeft: 0, lineHeight: 1.5 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
