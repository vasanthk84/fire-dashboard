import { useMemo } from 'react';
import type { CalculationResults, Inputs } from '../../types';
import { fmtL } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS, ASSET_SERIES } from '../../utils/chartBuilders';
import { NumberInput } from '../NumberInput';

interface RiskTabProps {
  results: CalculationResults;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
  stress: any[];
  themeKey: string;
}

function computeEquity(results: CalculationResults, inputs: Inputs) {
  const proj = results.fireProjections.filter((p) => p.year <= inputs.retirementYear + 8);
  const years = proj.map((p) => p.year);
  const drift: number[] = [];
  const rebalanced: number[] = [];
  const target: number[] = [];
  
  let prevEq = 0;
  let prevFx = 0;

  proj.forEach((p, i) => {
    const post = p.year >= inputs.retirementYear;
    const since = p.year - inputs.retirementYear;
    let tgt = inputs.targetEquityPre;
    
    if (post && inputs.glideYears > 0) {
      tgt = inputs.targetEquityPre + Math.min(since / inputs.glideYears, 1) * (inputs.targetEquityPost - inputs.targetEquityPre);
    } else if (post) {
      tgt = inputs.targetEquityPost;
    }
    target.push(Math.round(tgt));
    
    const eq = p.mf + p.stocksIndia + p.usStocks;
    const tot = p.total || 1;
    drift.push(Math.round((eq / tot) * 100));
    
    if (inputs.enableRebalancing) {
      if (i === 0) {
        prevEq = eq;
        prevFx = tot - eq;
        rebalanced.push(drift[0]);
      } else {
        const ge = prevEq * (1 + inputs.mfRate);
        const gf = prevFx * 1.07; // Assumed fixed income return rate (7%)
        const gt = ge + gf;
        const te = gt * (tgt / 100);
        prevEq = te;
        prevFx = gt - te;
        rebalanced.push(Math.round((te / gt) * 100));
      }
    }
  });

  return { years, drift, rebalanced, target };
}

export function RiskTab({ results, inputs, onInput, stress, themeKey }: RiskTabProps) {
  const eq = useMemo(() => computeEquity(results, inputs), [
    results,
    inputs.enableRebalancing,
    inputs.glideYears,
    inputs.targetEquityPre,
    inputs.targetEquityPost,
    inputs.mfRate
  ]);

  return (
    <div className="stack">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Stress scenarios · corpus at retirement</div>
        <div className="stress-grid">
          {stress.map((s) => (
            <div className={'stress ' + (s.tone === 'success' ? 'neutral' : s.tone === 'warning' ? 'warning' : 'danger')} key={s.key}>
              <div className="stress-l">{s.label}</div>
              <div className="stress-a">{s.assumption}</div>
              <div className="stress-row">
                <span>Corpus</span>
                <strong>{fmtL(s.finalWealth)}</strong>
              </div>
              <div className="stress-row">
                <span>vs base</span>
                <strong className={s.wealthDelta >= 0 ? 'text-pos' : 'text-neg'}>
                  {s.wealthDelta >= 0 ? '+' : ''}{fmtL(s.wealthDelta)}
                </strong>
              </div>
              <div className="stress-row">
                <span>Cover</span>
                <strong>{s.coverage != null ? s.coverage.toFixed(0) + '%' : '—'}</strong>
              </div>
              <div className="stress-row">
                <span>FIRE year</span>
                <strong>{s.fireYear || 'Not reached'}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Net-worth composition</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>Asset mix over the accumulation path</div>
          </div>
        </div>
        <ApexChartComponent
          height={320}
          dep={'comp' + themeKey}
          build={CHARTS.composition(results.fireProjections, inputs.retirementYear)}
        />
        <div className="legend" style={{ marginTop: 12 }}>
          {ASSET_SERIES.map((it) => (
            <span key={it.label}>
              <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: it.color, marginRight: 6 }}></i>
              {it.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Equity allocation & glidepath</span>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={inputs.enableRebalancing}
              onChange={(e) => onInput('enableRebalancing', e.target.checked)}
            />
            <span className="track"></span>Rebalance
          </label>
        </div>

        {inputs.enableRebalancing && (
          <div className="grid-3" style={{ marginBottom: 16, maxWidth: 460 }}>
            <div className="in-wrap">
              <label>Pre-retire %</label>
              <NumberInput
                className="in"
                value={inputs.targetEquityPre}
                onCommit={(n) => onInput('targetEquityPre', n)}
              />
            </div>
            <div className="in-wrap">
              <label>Post-retire %</label>
              <NumberInput
                className="in"
                value={inputs.targetEquityPost}
                onCommit={(n) => onInput('targetEquityPost', n)}
              />
            </div>
            <div className="in-wrap">
              <label>Glide years</label>
              <NumberInput
                className="in"
                value={inputs.glideYears}
                onCommit={(n) => onInput('glideYears', n)}
              />
            </div>
          </div>
        )}

        <ApexChartComponent
          height={300}
          dep={'eq' + themeKey + inputs.enableRebalancing + inputs.targetEquityPre + inputs.targetEquityPost + inputs.glideYears}
          build={CHARTS.equity(eq)}
        />
      </div>
    </div>
  );
}
