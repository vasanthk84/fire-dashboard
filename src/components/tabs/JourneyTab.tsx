import { useState } from 'react';
import type { FireProjection } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface JourneyTabProps {
  projections: FireProjection[];
  retirementYear: number;
  startYear: number;
  withdraw401kYear: number;
  themeKey: string;
}

export function JourneyTab({ projections, retirementYear, startYear, withdraw401kYear, themeKey }: JourneyTabProps) {
  const [chartOpen, setChartOpen] = useState(false);
  const [showAssets, setShowAssets] = useState(false);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip" title="Values shown are start-of-year balances (before that year's growth is applied)">
              Start-of-year balances · highlights = retirement
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowAssets((v) => !v)}
            >
              {showAssets ? '▲ Hide asset breakdown' : '▼ Show asset breakdown'}
            </button>
          </div>
        </div>
        <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Year</th>
                {showAssets && (
                  <>
                    <th>MF</th>
                    <th>Stocks IN</th>
                    <th>US</th>
                    <th>Bonds</th>
                    <th>Options</th>
                    <th>EPF</th>
                    <th>PPF</th>
                    <th>FD</th>
                    <th>NPS</th>
                    <th title="Locked until your 401k withdrawal year — not counted in Total until then">401k (locked)</th>
                  </>
                )}
                <th>Total</th>
                <th title="Passive (4% rule estimate) + Options premium income, combined">Income/mo</th>
                <th>Expense/mo</th>
                <th title="Income/mo as a % of Expense/mo — 100%+ means fully funded">Coverage</th>
                <th style={{ textAlign: 'left' }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {projections
                .filter((p) => p.year <= retirementYear + 12)
                .map((p) => {
                  const combinedIncome = p.passiveIncomeMonthly + p.optionsIncomeMonthly;
                  const coverage = p.calculatedMonthlyExpense
                    ? (combinedIncome / p.calculatedMonthlyExpense) * 100
                    : null;
                  return (
                    <tr key={p.year} className={p.year === retirementYear ? 'mark' : ''}>
                      <td className="k">{p.year}</td>
                      {showAssets && (
                        <>
                          <td>{fmtL(p.mf)}</td>
                          <td>{fmtL(p.stocksIndia)}</td>
                          <td>{fmtL(p.usStocks)}</td>
                          <td>{fmtL(p.bonds)}</td>
                          <td>{fmtL(p.optionsPortfolio)}</td>
                          <td>{fmtL(p.epf)}</td>
                          <td>{fmtL(p.ppf)}</td>
                          <td>{fmtL(p.fd)}</td>
                          <td>{fmtL(p.nps)}</td>
                          <td
                            style={p.year < withdraw401kYear ? { color: 'var(--text-3)', fontStyle: 'italic' } : undefined}
                            title={p.year < withdraw401kYear ? 'Locked · not yet counted in Total' : 'Injected into MF this year'}
                          >
                            {fmtL(p.us401k)}
                          </td>
                        </>
                      )}
                      <td className="k">{fmtL(p.total)}</td>
                      <td
                        className="text-pos"
                        title={`Passive ${fmtL(p.passiveIncomeMonthly)} + Options ${fmtRupees(p.optionsIncomeMonthly * 100000)}`}
                      >
                        {fmtL(combinedIncome)}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        {p.calculatedMonthlyExpense
                          ? fmtRupees(p.calculatedMonthlyExpense * 100000)
                          : '—'}
                      </td>
                      <td className={coverage !== null ? (coverage >= 100 ? 'text-pos' : 'text-neg') : ''}>
                        {coverage !== null ? `${coverage.toFixed(0)}%` : '—'}
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
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
