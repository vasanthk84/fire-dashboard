import { useMemo } from 'react';
import type { CalculationResults, Inputs, Milestone } from '../../../types';
import { fmtL } from '../../../utils/formatters';
import { ApexChartComponent } from '../../../components/ApexChartComponent';
import { CHARTS } from '../../../utils/chartBuilders';
import { MHero, MChip, MChipNeutral, MShareBar } from '../../components/primitives';
import { M_ASSET_401K, M_ASSET_INDIA, M_MILESTONE_COLORS, M_POS, M_WARN } from '../../mobileColors';

interface TrajectoryViewProps {
  results: CalculationResults;
  inputs: Inputs;
  fireNumberLakhs: number;
  progressPct: number;
  themeKey: string;
}

function milestoneColor(m: Milestone): string {
  if (m.text === 'PF Withdrawn & Reinvested') return M_MILESTONE_COLORS.pfClosure;
  if (m.text === 'Return India') return M_MILESTONE_COLORS.returnToIndia;
  if (m.text === 'Retirement') return M_MILESTONE_COLORS.retire;
  if (m.text === '401k Injected') return M_MILESTONE_COLORS.draw401k;
  if (m.type === 'expense') return 'var(--neg)';
  if (m.type === 'wealth') return M_MILESTONE_COLORS.draw401k;
  return 'var(--text-3)';
}

function shareSplit(us401k: number, epf: number): { usPct: number; indiaPct: number } {
  const sum = us401k + epf;
  if (sum <= 0) return { usPct: 0, indiaPct: 100 };
  return { usPct: (us401k / sum) * 100, indiaPct: (epf / sum) * 100 };
}

export function TrajectoryView({ results, inputs, fireNumberLakhs, progressPct, themeKey }: TrajectoryViewProps) {
  const { fireProjections } = results;
  const { startYear, retirementYear, withdraw401kYear } = inputs;

  const spanRows = useMemo(
    () => fireProjections.filter((p) => p.year >= startYear && p.year <= withdraw401kYear),
    [fireProjections, startYear, withdraw401kYear]
  );

  const corpusAtRetirement = spanRows.find((p) => p.year === retirementYear)?.total ?? 0;
  const passiveAtRetirement = spanRows.find((p) => p.year === retirementYear)?.passiveIncomeMonthly ?? 0;
  const fireYear = spanRows.find((p) => p.total >= fireNumberLakhs)?.year ?? null;

  const labels = spanRows.map((p) => String(p.year));
  const values = spanRows.map((p) => Number(p.total.toFixed(1)));
  const retirementIndex = spanRows.findIndex((p) => p.year === retirementYear);

  const listRows = useMemo(
    () => spanRows.filter((p) => (p.year - startYear) % 2 === 0 || p.milestones.length > 0),
    [spanRows, startYear]
  );

  return (
    <>
      <MHero tint1="rgba(21,160,95,.16)">
        <div className="m-eyebrow">Corpus at retirement · {retirementYear}</div>
        <div className="m-hero-metric" style={{ marginTop: 6 }}>{fmtL(corpusAtRetirement)}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <MChipNeutral label={`FIRE target ${fmtL(fireNumberLakhs)}`} />
          {fireYear !== null ? (
            <MChip label={`FIRE by ${fireYear}`} color={M_POS} />
          ) : (
            <MChip label="Target not reached" color={M_WARN} />
          )}
        </div>
        <div className="m-progress-track" style={{ marginTop: 12 }}>
          <div className="m-progress-fill" style={{ width: Math.min(100, Math.max(0, progressPct)) + '%' }} />
        </div>
        <div className="m-caption" style={{ marginTop: 8 }}>
          {progressPct.toFixed(0)}% of target funded today · passive {fmtL(passiveAtRetirement)}/mo at retirement
        </div>
      </MHero>

      <div className="m-card">
        <div className="m-card-title">Corpus trajectory</div>
        <div style={{ marginTop: 10 }}>
          <ApexChartComponent
            height={220}
            dep={'mtraj' + themeKey + startYear + withdraw401kYear + retirementYear + fireNumberLakhs}
            build={CHARTS.mobileTrajectory(labels, values, retirementIndex, fireNumberLakhs)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="m-axis-label">{startYear}</span>
          <span className="m-axis-label" style={{ color: 'var(--warn)' }}>retire {retirementYear}</span>
          <span className="m-axis-label">{withdraw401kYear}</span>
        </div>
      </div>

      <div className="m-card">
        <div className="m-card-title">Year by year</div>
        <div style={{ marginTop: 8 }}>
          {listRows.map((p) => {
            const isRetirement = p.year === retirementYear;
            const { usPct, indiaPct } = shareSplit(p.us401k, p.epf);
            return (
              <div
                key={p.year}
                style={{
                  padding: '9px 0',
                  borderTop: '1px solid var(--border)',
                  background: isRetirement ? 'rgba(21,160,95,.09)' : undefined
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="m-row-value" style={{ color: 'var(--text-2)', fontSize: 11.5, minWidth: 34 }}>{p.year}</span>
                  <span className="m-row-value" style={{ fontSize: 12.5 }}>{fmtL(p.total)}</span>
                  <span className="m-row-value" style={{ marginLeft: 'auto', color: 'var(--pos)' }}>{fmtL(p.passiveIncomeMonthly)}/mo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <div style={{ flex: 1 }}>
                    <MShareBar height={5} segments={[{ pct: usPct, color: M_ASSET_401K }, { pct: indiaPct, color: M_ASSET_INDIA }]} />
                  </div>
                  {p.milestones.map((m, i) => (
                    <span
                      key={i}
                      className="m-milestone-chip"
                      style={{
                        borderRadius: 999,
                        padding: '3px 8px',
                        background: milestoneColor(m) + '33',
                        border: '1px solid ' + milestoneColor(m) + '88',
                        color: milestoneColor(m),
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {m.text}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <span className="m-caption" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: M_ASSET_401K, display: 'inline-block' }} />
            US 401k
          </span>
          <span className="m-caption" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: M_ASSET_INDIA, display: 'inline-block' }} />
            India retirals
          </span>
        </div>
      </div>
    </>
  );
}
