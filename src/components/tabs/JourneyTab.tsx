import { useState } from 'react';
import type { FireProjection } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface JourneyTabProps {
  projections: FireProjection[];
  retirementYear: number;
  startYear: number;
  themeKey: string;
}

export function JourneyTab({ projections, retirementYear, startYear, themeKey }: JourneyTabProps) {
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <div className="stack">
      {/* Collapsible corpus trajectory */}
      <div className="table-card">
        <button
          type="button"
          onClick={() => setChartOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          <span className="panel-t">Corpus trajectory · {startYear}–{retirementYear + 8}</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', userSelect: 'none' }}>
            {chartOpen ? '▲ hide' : '▼ show'}
          </span>
        </button>
        {chartOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            <ApexChartComponent
              height={200}
              dep={'j' + themeKey}
              build={CHARTS.corpus(projections, retirementYear)}
            />
          </div>
        )}
      </div>

      {/* Year-by-year table */}
      <div className="table-card">
        <div className="table-head">
          <div className="panel-t">Year-by-year path</div>
          <span className="chip" title="Values shown are start-of-year balances (before that year's growth is applied)">
            Start-of-year balances · highlights = retirement
          </span>
        </div>
        <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Year</th>
                <th>MF</th>
                <th>Stocks IN</th>
                <th>US</th>
                <th>Bonds</th>
                <th>EPF</th>
                <th>401k</th>
                <th>Total</th>
                <th>Passive/mo</th>
                <th>Expense/mo</th>
                <th style={{ textAlign: 'left' }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {projections
                .filter((p) => p.year <= retirementYear + 12)
                .map((p) => (
                    <tr key={p.year} className={p.year === retirementYear ? 'mark' : ''}>
                      <td className="k">{p.year}</td>
                      <td>{fmtL(p.mf)}</td>
                      <td>{fmtL(p.stocksIndia)}</td>
                      <td>{fmtL(p.usStocks)}</td>
                      <td>{fmtL(p.bonds)}</td>
                      <td>{fmtL(p.epf)}</td>
                      <td>{fmtL(p.us401k)}</td>
                      <td className="k">{fmtL(p.total)}</td>
                      <td>{fmtL(p.passiveIncomeMonthly)}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        {p.calculatedMonthlyExpense
                          ? fmtRupees(p.calculatedMonthlyExpense * 100000)
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div className="chips">
                          {p.milestones.map((m, i) => (
                            <span key={i} className={'chip ' + m.type}>
                              {m.text}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
