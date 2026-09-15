import { useState } from 'react';
import type { CalculationResults, Inputs } from '../../types';
import type { useSensitivitySummary } from '../../hooks/useSensitivitySummary';
import { MSegmented } from '../components/primitives';
import { TrajectoryView } from './journey/TrajectoryView';
import { RiskView } from './journey/RiskView';
import { WithdrawalView } from './journey/WithdrawalView';
import type { JourneySub } from '../MobileApp';

interface JourneyScreenProps {
  results: CalculationResults;
  inputs: Inputs;
  fireNumberLakhs: number;
  progressToFire: number;
  sensitivity: ReturnType<typeof useSensitivitySummary>;
  themeKey: string;
}

const SUB_LABEL: Record<JourneySub, string> = {
  path: '2026–2044',
  risk: 'stress & drift',
  withdrawal: 'drawdown plan'
};

const SUB_OPTIONS: Array<{ value: JourneySub; label: string }> = [
  { value: 'path', label: 'Trajectory' },
  { value: 'risk', label: 'Risk' },
  { value: 'withdrawal', label: 'Withdrawal' }
];

export function JourneyScreen({ results, inputs, fireNumberLakhs, progressToFire, sensitivity, themeKey }: JourneyScreenProps) {
  const [sub, setSub] = useState<JourneySub>('path');

  const subLabel = sub === 'path' ? `${inputs.startYear}–${inputs.withdraw401kYear}` : SUB_LABEL[sub];

  return (
    <div className="m-screen">
      <div className="m-screen-head">
        <h1 className="m-h1">Journey</h1>
        <div className="m-caption m-screen-sub">{subLabel}</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <MSegmented options={SUB_OPTIONS} value={sub} onChange={setSub} />
      </div>

      {sub === 'path' && (
        <TrajectoryView results={results} inputs={inputs} fireNumberLakhs={fireNumberLakhs} progressPct={progressToFire} themeKey={themeKey} />
      )}
      {sub === 'risk' && (
        <RiskView results={results} inputs={inputs} scenarios={sensitivity.scenarios} isLoading={sensitivity.isLoading} />
      )}
      {sub === 'withdrawal' && <WithdrawalView results={results} inputs={inputs} themeKey={themeKey} />}
    </div>
  );
}
