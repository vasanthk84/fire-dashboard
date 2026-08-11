import { Clock3, Rocket, Target, Wallet } from 'lucide-react';
import { fmtL } from '../utils/formatters';
import { NumberInput } from './NumberInput';

interface StatsDeckProps {
  currentWealthLakhs: number;
  finalWealth: number;
  fireNumberLakhs: number;
  progressToFire: number;
  yearsToFI: number | null;
  inputs: {
    startYear: number;
    fireMultiplier: number;
  };
  onMultiplierChange: (value: number) => void;
  retirementYear: number;
}

export function StatsDeck({
  currentWealthLakhs,
  finalWealth,
  fireNumberLakhs,
  progressToFire,
  yearsToFI,
  inputs,
  onMultiplierChange,
  retirementYear
}: StatsDeckProps) {
  return (
    <div className="stat-grid">
      <div className="stat">
        <div className="stat-top">
          <Wallet size={15} /> Current wealth
        </div>
        <div className="stat-val num">{fmtL(currentWealthLakhs)}</div>
        <div className="stat-foot">Liquid + retirement accounts</div>
      </div>

      <div className="stat">
        <div className="stat-top">
          <Rocket size={15} /> At retirement
        </div>
        <div className="stat-val num">{fmtL(finalWealth)}</div>
        <div className="stat-foot">Projected corpus · {retirementYear}</div>
      </div>

      <div className="stat">
        <div className="stat-top">
          <Target size={15} /> FIRE target
          <span className="stepper" style={{ marginLeft: 'auto' }}>
            <NumberInput
              className="in num"
              style={{ width: 56, padding: '4px 6px' }}
              min={20}
              max={40}
              step={0.5}
              emptyFallback={25}
              value={inputs.fireMultiplier}
              onCommit={onMultiplierChange}
            />
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 2 }}>×</span>
          </span>
        </div>
        <div className="stat-val num">{fireNumberLakhs > 0 ? fmtL(fireNumberLakhs) : '—'}</div>
        {fireNumberLakhs > 0 ? (
          <>
            <div className="bar">
              <i style={{ width: `${progressToFire}%` }}></i>
            </div>
            <div className="stat-foot">
              {progressToFire.toFixed(0)}% complete · {(100 / inputs.fireMultiplier).toFixed(1)}% SWR
            </div>
          </>
        ) : (
          <div className="stat-foot">Add expenses to compute</div>
        )}
      </div>

      <div className="stat">
        <div className="stat-top">
          <Clock3 size={15} /> Years to FIRE
        </div>
        <div className="stat-val num">{yearsToFI !== null && fireNumberLakhs > 0 ? `${yearsToFI}y` : '—'}</div>
        <div className="stat-foot">
          {yearsToFI !== null && fireNumberLakhs > 0
            ? `Target ${inputs.startYear + yearsToFI}`
            : 'Set expenses first'}
        </div>
      </div>
    </div>
  );
}
