import type { CalculationResults, Inputs } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

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

  const annual = scenario[0].withdrawalMonthly * 12;
  const corpus = results.summary.finalWealth;
  const yrs = inputs.retirementYear - inputs.startYear;
  const principal = (inputs.mfPrincipal || inputs.mfCurrent * 0.7) + inputs.mfSIP * 12 * yrs;
  const gainRatio = Math.max(0, (corpus - principal) / corpus);
  const taxable = annual * gainRatio;
  const netGain = Math.max(0, taxable - 1.25);
  const ltcg = netGain * 0.125;
  const oldTax = annual > 15 ? (annual - 15) * 0.3 + 1.5 + 1.5 * 0.04 : 0;

  const cards = [
    { l: 'Annual withdrawal', v: fmtL(annual), f: `Sell ${selectedWithdrawalRate} of units`, cls: '' },
    { l: 'Taxable component', v: fmtL(taxable), f: `${((1 - gainRatio) * 100).toFixed(0)}% is principal`, cls: '' },
    { l: 'Est. LTCG tax', v: fmtRupees((ltcg * 100000) / 12) + '/mo', f: `vs old ${fmtL(oldTax)}/yr`, cls: 'hl' }
  ];

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
          <div className="eyebrow" style={{ marginBottom: 8 }}>Corpus sustainability · 25 yrs @ {selectedWithdrawalRate}</div>
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
                const gs = Math.max(0, (r.corpusStart - principal) / r.corpusStart);
                const aw = r.withdrawalMonthly * 12;
                const tax = Math.max(0, aw * gs - 1.25) * 0.125;
                return (
                  <tr key={r.year}>
                    <td className="k">{r.year}</td>
                    <td>{fmtL(r.corpusStart)}</td>
                    <td>{fmtL(aw)}</td>
                    <td className="text-neg">−{fmtL(tax)}</td>
                    <td className="text-pos">{fmtRupees(((aw - tax) / 12) * 100000)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
