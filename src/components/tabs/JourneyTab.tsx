import type { FireProjection } from '../../types';
import { fmtL } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface JourneyTabProps {
  projections: FireProjection[];
  retirementYear: number;
  startYear: number;
  themeKey: string;
}

export function JourneyTab({ projections, retirementYear, startYear, themeKey }: JourneyTabProps) {
  return (
    <div className="stack">
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Corpus trajectory</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>
              Projected net worth · {startYear}–{retirementYear + 8}
            </div>
          </div>
        </div>
        <ApexChartComponent
          height={300}
          dep={'j' + themeKey}
          build={CHARTS.corpus(projections, retirementYear)}
        />
      </div>

      <div className="table-card">
        <div className="table-head">
          <div className="panel-t">Year-by-year path</div>
          <span className="chip">MF · Stocks · US · Bonds · Emergency · EPF</span>
        </div>
        <div className="table-scroll" style={{ maxHeight: 520, overflowY: 'auto' }}>
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
