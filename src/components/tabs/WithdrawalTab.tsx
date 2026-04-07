import { PieChart } from 'lucide-react';
import type { CalculationResults, Inputs } from '../../types';
import { fmtL } from '../../utils/formatters';

interface WithdrawalTabProps {
  results: CalculationResults;
  inputs: Inputs;
  selectedWithdrawalRate: string;
  onSelectedRateChange: (value: string) => void;
}

export function WithdrawalTab({ results, inputs, selectedWithdrawalRate, onSelectedRateChange }: WithdrawalTabProps) {
  const scenario = results.withdrawalScenarios[selectedWithdrawalRate] ?? [];

  if (scenario.length === 0) {
    return null;
  }

  const annualWithdrawal = scenario[0].withdrawalMonthly * 12;
  const corpusAtRetirement = results.summary.finalWealth;
  const yearsToRetire = inputs.retirementYear - inputs.startYear;
  const totalSIPAddition = inputs.mfSIP * 12 * yearsToRetire;
  const projectedPrincipal = (inputs.mfPrincipal || inputs.mfCurrent * 0.7) + totalSIPAddition;
  const gainRatio = Math.max(0, (corpusAtRetirement - projectedPrincipal) / corpusAtRetirement);
  const taxableGainComponent = annualWithdrawal * gainRatio;
  const netTaxableGain = Math.max(0, taxableGainComponent - 1.25);
  const ltcgTax = netTaxableGain * 0.125;
  const oldWayTax = annualWithdrawal > 15 ? (annualWithdrawal - 15) * 0.3 + 1.5 + (1.5 * 0.04) : 0;

  return (
    <div>
      <div className="withdrawal-shell">
        <div className="withdrawal-header">
          <div>
            <h3 className="panel-title"><PieChart size={18} /> Smart Withdrawal Strategy (SWP)</h3>
            <p className="panel-subtitle">Optimized for Long Term Capital Gains (LTCG)</p>
          </div>
          <select className="rate-select" value={selectedWithdrawalRate} onChange={(event) => onSelectedRateChange(event.target.value)}>
            <option value="2%">2% (Conservative)</option>
            <option value="3%">3% (Balanced)</option>
            <option value="4%">4% (Aggressive)</option>
          </select>
        </div>

        <div className="withdrawal-grid">
          <div className="info-card info-card-primary">
            <div className="info-label">Annual Withdrawal</div>
            <div className="info-value">{fmtL(annualWithdrawal)}</div>
            <div className="info-note">You sell {selectedWithdrawalRate} of units</div>
          </div>

          <div className="info-card">
            <div className="info-label">Taxable Component</div>
            <div className="info-value info-value-amber">{fmtL(taxableGainComponent)}</div>
            <div className="info-note">{((1 - gainRatio) * 100).toFixed(0)}% is your own principal</div>
          </div>

          <div className="info-card info-card-success">
            <div className="info-label">Estimated Tax (LTCG)</div>
            <div className="info-value info-value-green">₹{((ltcgTax * 100000) / 12).toFixed(0)}<span className="small-unit">/mo</span></div>
            <div className="info-note success-row">
              <span className="strike">Old: {fmtL(oldWayTax)}</span>
              <span>Save {fmtL(Math.max(0, oldWayTax - ltcgTax))}!</span>
            </div>
          </div>

          <div className="logic-panel">
            <h4>Calculation Logic (FY 2025 Rules)</h4>
            <div className="logic-grid">
              <div>
                <div className="info-label">Estimated Principal in {inputs.retirementYear}</div>
                <div className="logic-value">{fmtL(projectedPrincipal)}</div>
              </div>
              <div>
                <div className="info-label">Capital Gains Ratio</div>
                <div className="logic-value">{(gainRatio * 100).toFixed(1)}% of withdrawal</div>
              </div>
              <div>
                <div className="info-label">Tax Calculation</div>
                <div className="logic-mono">({fmtL(taxableGainComponent)} - 1.25L) × 12.5%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-title">Projected Post-Tax Income</div>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Corpus</th>
              <th>Withdrawal</th>
              <th>Est. Tax (LTCG)</th>
              <th>Net Monthly</th>
            </tr>
          </thead>
          <tbody>
            {scenario.map((row) => {
              const corpus = row.corpusStart;
              const gainShare = Math.max(0, (corpus - projectedPrincipal) / corpus);
              const annualW = row.withdrawalMonthly * 12;
              const taxable = Math.max(0, annualW * gainShare - 1.25);
              const tax = taxable * 0.125;

              return (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{fmtL(row.corpusStart)}</td>
                  <td>{fmtL(annualW)}</td>
                  <td className="text-red">-{fmtL(tax)}</td>
                  <td className="text-green">₹{(((annualW - tax) / 12) * 100000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
