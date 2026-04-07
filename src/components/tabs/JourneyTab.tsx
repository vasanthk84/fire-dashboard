import type { FireProjection } from '../../types';
import { fmtL, milestoneClass } from '../../utils/formatters';

interface JourneyTabProps {
  projections: FireProjection[];
  retirementYear: number;
}

export function JourneyTab({ projections, retirementYear }: JourneyTabProps) {
  return (
    <div className="table-wrapper">
      <div className="table-title">Yearly corpus path with monthly retirement-income estimate</div>
      <div className="journey-note">
        <span>Total Corpus includes MF, India stocks, US stocks, bonds, emergency fund, and EPF.</span>
        <span>401k Side Pot stays outside total until withdrawal year, then gets injected into MF after tax.</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>SIP</th>
            <th>MF</th>
            <th>India Stocks</th>
            <th>US Stocks</th>
            <th>Bonds</th>
            <th>Emergency</th>
            <th>EPF</th>
            <th>401k Side Pot</th>
            <th>Total Corpus</th>
            <th>Net Worth incl. 401k</th>
            <th>Passive / Mo</th>
            <th>Expense / Mo</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((projection) => {
            const netWorthIncluding401k = projection.total + projection.us401k;

            return (
            <tr key={projection.year} style={{ background: projection.year === retirementYear ? 'rgba(16, 185, 129, 0.05)' : '' }}>
              <td style={{ fontWeight: 700 }}>{projection.year}</td>
              <td>{projection.sipAmount > 0 ? fmtL(projection.sipAmount) : '-'}</td>
              <td>{fmtL(projection.mf)}</td>
              <td>{fmtL(projection.stocksIndia)}</td>
              <td>{fmtL(projection.usStocks)}</td>
              <td>{fmtL(projection.bonds)}</td>
              <td>{fmtL(projection.emergencyFund)}</td>
              <td>{fmtL(projection.epf)}</td>
              <td>{fmtL(projection.us401k)}</td>
              <td style={{ fontWeight: 700 }}>{fmtL(projection.total)}</td>
              <td style={{ fontWeight: 700 }}>{fmtL(netWorthIncluding401k)}</td>
              <td>{fmtL(projection.passiveIncomeMonthly)}</td>
              <td>{projection.calculatedMonthlyExpense ? fmtL(projection.calculatedMonthlyExpense) : '-'}</td>
              <td>
                {projection.milestones.map((milestone, index) => (
                  <span key={`${projection.year}-${index}`} className={milestoneClass(milestone.type)}>
                    {milestone.text}
                  </span>
                ))}
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}
