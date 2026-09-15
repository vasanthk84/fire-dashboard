import { useMemo } from 'react';
import type { CalculationResults, Inputs } from '../../../types';
import type { SensitivityScenario } from '../../../hooks/useSensitivitySummary';
import { fmtL } from '../../../utils/formatters';
import { M_ASSET_401K, M_ASSET_INDIA } from '../../mobileColors';

interface RiskViewProps {
  results: CalculationResults;
  inputs: Inputs;
  scenarios: SensitivityScenario[];
  isLoading: boolean;
}

// Kept as a hybrid: all 4 of the app's existing stress scenarios (not just the
// 3 the mobile mock showed), restyled to the mobile card spec. "Market shock"
// is relabeled "Market crash" to match the handoff's copy; the underlying
// calculation is unchanged from the existing desktop Risk tab.
const SCENARIO_META: Record<string, { label: string; borderColor: string }> = {
  expenses: { label: 'Market crash', borderColor: 'var(--neg)' },
  returns: { label: 'Low returns', borderColor: 'var(--warn)' },
  inflation: { label: 'High inflation', borderColor: 'var(--warn)' },
  fx: { label: 'Rupee strengthens', borderColor: 'var(--warn)' }
};
const SCENARIO_ORDER = ['expenses', 'returns', 'inflation', 'fx'];

function normaliseAllocation(cashPct: number, bondPct: number) {
  let cashFrac = Math.max(0, Math.min(100, cashPct)) / 100;
  let bondFrac = Math.max(0, Math.min(100, bondPct)) / 100;
  if (cashFrac + bondFrac > 1) {
    const scale = 1 / (cashFrac + bondFrac);
    cashFrac *= scale;
    bondFrac *= scale;
  }
  return { cashFrac, bondFrac };
}

export function RiskView({ results, inputs, scenarios, isLoading }: RiskViewProps) {
  const { fireProjections } = results;
  const { startYear, retirementYear, withdraw401kYear } = inputs;

  const ordered = SCENARIO_ORDER.map((key) => scenarios.find((s) => s.key === key)).filter(Boolean) as SensitivityScenario[];

  const driftYears = useMemo(() => {
    const span = withdraw401kYear - startYear;
    return Array.from({ length: 7 }, (_, i) => Math.round(startYear + (i * span) / 6));
  }, [startYear, withdraw401kYear]);

  const bufferInfo = useMemo(() => {
    const row = fireProjections.find((p) => p.year === retirementYear);
    if (!row || !row.calculatedMonthlyExpense) return null;
    const { cashFrac, bondFrac } = normaliseAllocation(inputs.pfCashAllocPct, inputs.pfBondAllocPct);
    const bufferLakhs = row.epf * (cashFrac + bondFrac);
    const years = bufferLakhs / (row.calculatedMonthlyExpense * 12);
    return years;
  }, [fireProjections, retirementYear, inputs.pfCashAllocPct, inputs.pfBondAllocPct]);

  const bufferColor = bufferInfo === null ? 'var(--text-3)' : bufferInfo >= 3 ? 'var(--pos)' : bufferInfo >= 1.5 ? 'var(--warn)' : 'var(--neg)';
  const bufferPct = bufferInfo === null ? 0 : Math.min(100, (bufferInfo / 5) * 100);

  return (
    <>
      <div className="m-eyebrow" style={{ marginBottom: 8 }}>Stress scenarios · corpus at retirement</div>

      {isLoading && ordered.length === 0 && <div className="m-card"><div className="m-loading">Computing stress scenarios…</div></div>}
      {!isLoading && ordered.length === 0 && (
        <div className="m-card"><div className="m-loading">Set your monthly expenses (Expenses tab) to see stress scenarios.</div></div>
      )}

      <div className="m-stack">
        {ordered.map((s) => {
          const meta = SCENARIO_META[s.key];
          return (
            <div key={s.key} className="m-card" style={{ borderLeft: '3px solid ' + meta.borderColor }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <div className="m-card-title">{meta.label}</div>
                  <div className="m-caption" style={{ marginTop: 2 }}>{s.assumption}</div>
                </div>
                <div className="m-row-value" style={{ fontSize: 15 }}>{fmtL(s.finalWealth)}</div>
              </div>
              <div className="m-grid-2" style={{ marginTop: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="m-tile">
                  <div className="m-tile-top">vs base</div>
                  <div className="m-row-value" style={{ marginTop: 3, color: s.wealthDelta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {s.wealthDelta >= 0 ? '+' : ''}{fmtL(s.wealthDelta)}
                  </div>
                </div>
                <div className="m-tile">
                  <div className="m-tile-top">Cover</div>
                  <div className="m-row-value" style={{ marginTop: 3 }}>{s.coverage !== null ? s.coverage.toFixed(0) + '%' : '—'}</div>
                </div>
                <div className="m-tile">
                  <div className="m-tile-top">FIRE year</div>
                  <div className="m-row-value" style={{ marginTop: 3 }}>{s.fireYear ?? 'Not reached'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="m-card">
        <div className="m-card-title">Composition drift</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
          {driftYears.map((year) => {
            const row = fireProjections.find((p) => p.year === year) ?? fireProjections[fireProjections.length - 1];
            const sum = row.us401k + row.epf;
            const usPct = sum > 0 ? (row.us401k / sum) * 100 : 0;
            const indiaPct = sum > 0 ? 100 - usPct : 100;
            return (
              <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', height: 88, borderRadius: 6, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column-reverse', overflow: 'hidden' }}>
                  <div style={{ height: indiaPct + '%', background: M_ASSET_INDIA }} />
                  <div style={{ height: usPct + '%', background: M_ASSET_401K }} />
                </div>
                <span className="m-axis-label">{year}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="m-card">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div className="m-card-title">Sequence-risk buffer</div>
            <div className="m-caption" style={{ marginTop: 2 }}>Years of spend held in cash + bonds at retirement</div>
          </div>
          <div className="m-tile-value" style={{ fontSize: 20 }}>{bufferInfo === null ? '—' : bufferInfo.toFixed(1) + 'y'}</div>
        </div>
        <div className="m-progress-track" style={{ marginTop: 10 }}>
          <div className="m-progress-fill" style={{ width: bufferPct + '%', background: bufferColor }} />
        </div>
        <div className="m-caption" style={{ marginTop: 8 }}>Driven by the PF Reinvest cash / bond split.</div>
      </div>
    </>
  );
}
