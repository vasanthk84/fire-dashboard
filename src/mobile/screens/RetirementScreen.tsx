import { useState } from 'react';
import type { CalculationResults } from '../../types';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { MSegmented } from '../components/primitives';
import { K401Screen } from './K401Screen';
import { PFScreen } from './PFScreen';

type RetirementSub = '401k' | 'pf';

interface RetirementScreenProps {
  planner: UseFirePlannerReturn;
  results: CalculationResults | null;
  reinvestWheel: boolean;
  onReinvestWheelChange: (next: boolean) => void;
}

// Combines the two former standalone nav slots (401k, PF) into one, per the
// mobile nav consolidation — both sub-screens keep their own m-screen-head
// h1 ("401k Projector" / "PF Reinvest") rather than suppressing it via a new
// prop; stacking this segmented switcher above that unchanged header reads
// fine and avoids touching either screen's internals.
export function RetirementScreen({ planner, results, reinvestWheel, onReinvestWheelChange }: RetirementScreenProps) {
  const [sub, setSub] = useState<RetirementSub>('401k');

  if (!results) {
    return (
      <div className="m-screen">
        <div className="m-screen-head"><h1 className="m-h1">Retirement</h1></div>
        <div className="m-card"><div className="m-loading">Calculating your plan…</div></div>
      </div>
    );
  }

  // K401Screen/PFScreen each render their own full `m-screen` (with its own
  // top/bottom padding) — nesting this switcher inside a second `m-screen`
  // would double that padding, so it renders as a bare padded strip above
  // the sub-screen instead of wrapping it.
  return (
    <>
      <div style={{ padding: '16px 14px 0' }}>
        <h1 className="m-h1">Retirement</h1>
        <div style={{ marginTop: 12 }}>
          <MSegmented
            options={[
              { value: '401k', label: '401k' },
              { value: 'pf', label: 'PF' }
            ]}
            value={sub}
            onChange={setSub}
          />
        </div>
      </div>

      {sub === '401k' ? (
        <K401Screen planner={planner} results={results} />
      ) : (
        <PFScreen planner={planner} reinvestWheel={reinvestWheel} onReinvestWheelChange={onReinvestWheelChange} />
      )}
    </>
  );
}
