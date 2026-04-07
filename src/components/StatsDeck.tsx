import { Clock3, Crosshair, Rocket, TrendingUp } from 'lucide-react';
import { fmtL } from '../utils/formatters';

interface StatsDeckProps {
  currentWealthLakhs: number;
  finalWealth: number;
  fireNumberLakhs: number;
  progressToFire: number;
  yearsToFI: number | null;
  startYear: number;
}

export function StatsDeck({ currentWealthLakhs, finalWealth, fireNumberLakhs, progressToFire, yearsToFI, startYear }: StatsDeckProps) {
  return (
    <div className="stats-deck">
      <div className="stat-card">
        <div className="stat-title"><TrendingUp size={14} /> Current Wealth</div>
        <div className="stat-num" style={{ color: 'var(--primary)' }}>{fmtL(currentWealthLakhs)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-title"><Rocket size={14} /> At Retirement</div>
        <div className="stat-num" style={{ color: 'var(--accent-green)' }}>{fmtL(finalWealth)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-title"><Crosshair size={14} /> FIRE Target</div>
        <div className="stat-num" style={{ color: 'var(--accent-orange)' }}>
          {fireNumberLakhs > 0 ? fmtL(fireNumberLakhs) : '₹0.0L'}
        </div>
        {fireNumberLakhs > 0 ? (
          <>
            <div className="progress-wrapper">
              <div className="progress-bar" style={{ width: `${progressToFire}%` }} />
            </div>
            <div className="stat-subtitle">{progressToFire.toFixed(1)}% Complete</div>
          </>
        ) : (
          <div className="stat-subtitle stat-muted">Add expenses to calculate</div>
        )}
      </div>

      <div className="stat-card">
        <div className="stat-title"><Clock3 size={14} /> Years to FIRE</div>
        <div className="stat-num" style={{ color: 'var(--accent-purple)' }}>
          {yearsToFI !== null && fireNumberLakhs > 0 ? `${yearsToFI}y` : 'N/A'}
        </div>
        {yearsToFI !== null && fireNumberLakhs > 0 ? (
          <div className="stat-subtitle">Target: {startYear + yearsToFI}</div>
        ) : (
          <div className="stat-subtitle stat-muted">{fireNumberLakhs === 0 ? 'Add expenses first' : 'Already at FIRE!'}</div>
        )}
      </div>
    </div>
  );
}
