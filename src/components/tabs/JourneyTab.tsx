import type { FireProjection } from '../../types';
import { fmtL, milestoneClass } from '../../utils/formatters';

interface JourneyTabProps {
  projections: FireProjection[];
  retirementYear: number;
}

export function JourneyTab({ projections, retirementYear }: JourneyTabProps) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>SIP</th>
            <th>MF</th>
            <th>Stocks</th>
            <th>EPF</th>
            <th>401k</th>
            <th>Total</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((projection) => (
            <tr key={projection.year} style={{ background: projection.year === retirementYear ? 'rgba(16, 185, 129, 0.05)' : '' }}>
              <td style={{ fontWeight: 700 }}>{projection.year}</td>
              <td>{projection.sipAmount > 0 ? fmtL(projection.sipAmount) : '-'}</td>
              <td>{fmtL(projection.mf)}</td>
              <td>{fmtL(projection.stocksIndia)}</td>
              <td>{fmtL(projection.epf)}</td>
              <td>{fmtL(projection.us401k)}</td>
              <td style={{ fontWeight: 700 }}>{fmtL(projection.total)}</td>
              <td>
                {projection.milestones.map((milestone, index) => (
                  <span key={`${projection.year}-${index}`} className={milestoneClass(milestone.type)}>
                    {milestone.text}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
