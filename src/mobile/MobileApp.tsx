import { useState } from 'react';
import type { UseFirePlannerReturn } from '../hooks/useFirePlanner';
import type { useSensitivitySummary } from '../hooks/useSensitivitySummary';
import { useSnapshots } from '../hooks/useSnapshots';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
import { SnapshotSheet } from './components/SnapshotSheet';
import { JourneyScreen } from './screens/JourneyScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { K401Screen } from './screens/K401Screen';
import { PFScreen } from './screens/PFScreen';
import { AssumptionsScreen } from './screens/AssumptionsScreen';
import './mobile.css';

export type MobileTab = 'journey' | 'expenses' | 'k401' | 'pf' | 'setup';
export type JourneySub = 'path' | 'risk' | 'withdrawal';

interface MobileAppProps {
  planner: UseFirePlannerReturn;
  snapshotsApi: ReturnType<typeof useSnapshots>;
  sensitivity: ReturnType<typeof useSensitivitySummary>;
  theme: 'dark' | 'light' | 'paper';
  onCycleTheme: () => void;
  themeKey: string;
}

export function MobileApp({ planner, snapshotsApi, sensitivity, theme, onCycleTheme, themeKey }: MobileAppProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('journey');
  const [snapOpen, setSnapOpen] = useState(false);
  // Mirrors PFReinvestmentTab's local `reinvestWheel` toggle (desktop keeps it
  // component-local, default off). Mobile surfaces the same toggle from the
  // Expenses screen per the handoff, and the PF Reinvest screen (Milestone 2
  // continuation) will read this same lifted value so the two screens agree.
  const [reinvestWheel, setReinvestWheel] = useState(false);

  const { currentWealthLakhs, fireNumberLakhs, progressToFire, results } = planner;
  const { snapshots, selectedSnapshots, toggleSnapshotSelection, saveSnapshot, exportSnapshots } = snapshotsApi;

  return (
    <div className="mobile-shell">
      <MobileHeader
        theme={theme}
        onCycleTheme={onCycleTheme}
        snapshotCount={snapshots.length}
        onOpenSnapshots={() => setSnapOpen(true)}
        wealthLakhs={currentWealthLakhs}
        targetLakhs={fireNumberLakhs}
        progressPct={progressToFire}
      />

      {activeTab === 'journey' &&
        (results ? (
          <JourneyScreen
            results={results}
            inputs={planner.inputs}
            fireNumberLakhs={fireNumberLakhs}
            progressToFire={progressToFire}
            sensitivity={sensitivity}
            themeKey={themeKey}
          />
        ) : (
          <div className="m-screen">
            <div className="m-screen-head"><h1 className="m-h1">Journey</h1></div>
            <div className="m-card"><div className="m-loading">Calculating your plan…</div></div>
          </div>
        ))}

      {activeTab === 'expenses' && (
        <ExpensesScreen planner={planner} reinvestWheel={reinvestWheel} onReinvestWheelChange={setReinvestWheel} />
      )}

      {activeTab === 'k401' &&
        (results ? (
          <K401Screen planner={planner} results={results} />
        ) : (
          <div className="m-screen">
            <div className="m-screen-head"><h1 className="m-h1">401k Projector</h1></div>
            <div className="m-card"><div className="m-loading">Calculating your plan…</div></div>
          </div>
        ))}

      {activeTab === 'pf' && (
        <PFScreen planner={planner} reinvestWheel={reinvestWheel} onReinvestWheelChange={setReinvestWheel} />
      )}

      {activeTab === 'setup' && <AssumptionsScreen planner={planner} />}

      <BottomNav active={activeTab} onChange={setActiveTab} />

      <SnapshotSheet
        open={snapOpen}
        onClose={() => setSnapOpen(false)}
        snapshots={snapshots}
        selectedSnapshots={selectedSnapshots}
        toggleSnapshotSelection={toggleSnapshotSelection}
        saveSnapshot={saveSnapshot}
        exportSnapshots={exportSnapshots}
        fireNumberLakhs={fireNumberLakhs}
        themeKey={themeKey}
      />
    </div>
  );
}
