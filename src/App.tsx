import { Suspense, lazy, useState } from 'react';
import {
  AlertCircle,
  Download,
  Flag,
  Play,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  Zap
} from 'lucide-react';
import { InputDeck } from './components/InputDeck';
import { SaveSnapshotModal } from './components/SaveSnapshotModal';
import { StatsDeck } from './components/StatsDeck';
import { TabNavigation } from './components/TabNavigation';
import { useChartData } from './hooks/useChartData';
import { useFirePlanner } from './hooks/useFirePlanner';
import { useSnapshots } from './hooks/useSnapshots';
import { downloadPlanExcel } from './services/api';
import type { TabKey } from './types';
import { fmtL } from './utils/formatters';

const JourneyTab = lazy(() => import('./components/tabs/JourneyTab').then((module) => ({ default: module.JourneyTab })));
const RiskTab = lazy(() => import('./components/tabs/RiskTab').then((module) => ({ default: module.RiskTab })));
const ExpensesTab = lazy(() => import('./components/tabs/ExpensesTab').then((module) => ({ default: module.ExpensesTab })));
const WithdrawalTab = lazy(() => import('./components/tabs/WithdrawalTab').then((module) => ({ default: module.WithdrawalTab })));
const SnapshotsTab = lazy(() => import('./components/tabs/SnapshotsTab').then((module) => ({ default: module.SnapshotsTab })));

function TabFallback() {
  return <div className="tab-panel-loading">Loading panel...</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('journey');
  const [selectedWithdrawalRate, setSelectedWithdrawalRate] = useState('4%');
  const planner = useFirePlanner();
  const {
    inputs,
    setInputs,
    results,
    expenses,
    oneTimeExpenses,
    showOneTime,
    setShowOneTime,
    isCalculating,
    calculationError,
    currentMonthlyExp,
    fireNumberLakhs,
    currentWealthLakhs,
    progressToFire,
    yearsToFI,
    sampleTaxYear,
    handleInput,
    handleExpense,
    handleOneTime,
    runCalculation,
    setExpenses,
    setOneTimeExpenses,
    sumExpenses,
    initialOneTimeExpenses
  } = planner;

  const { equityPctSeries, equityPctOptions, netWorthSeries, netWorthOptions, incomeExpenseSeries, incomeExpenseOptions } = useChartData({ inputs, results });
  const snapshots = useSnapshots({
    inputs,
    expenses,
    oneTimeExpenses,
    showOneTime,
    results,
    fireNumberLakhs,
    yearsToFI,
    progressToFire,
    setInputs,
    setExpenses,
    setOneTimeExpenses,
    setShowOneTime,
    initialOneTimeExpenses,
    runCalculation,
    sumExpenses
  });

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="brand">
          <h1><TrendingUp size={22} /> FIRE Architect Pro</h1>
        </div>
        {results && (
          <button className="btn-dl" onClick={() => downloadPlanExcel(results, expenses, oneTimeExpenses, inputs)}>
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      <InputDeck inputs={inputs} onInput={handleInput} />

      <div className="action-bar">
        <button className="btn-run" onClick={() => void runCalculation()} disabled={isCalculating}>
          <Play size={16} /> {isCalculating ? 'Running...' : 'Run Calculation'}
        </button>
      </div>

      {calculationError && (
        <div className="status-banner error-banner">
          <AlertCircle size={16} /> {calculationError}
        </div>
      )}

      {results && (
        <>
          <div className="fire-calculator-panel">
            <div className="fire-calc-card">
              <div className="fire-calc-label"><Wallet size={14} /> Monthly Expenses</div>
              <div className="fire-calc-input-wrapper">
                <input className="fire-calc-input fire-calc-readonly" type="number" value={currentMonthlyExp} readOnly />
              </div>
              <div className="fire-calc-subtitle">₹{(currentMonthlyExp * 12).toLocaleString()}/year</div>
              <div className="fire-calc-badge fire-calc-badge-success">Edit in Expenses tab</div>
            </div>

            <div className="fire-calc-card">
              <div className="fire-calc-label"><Target size={14} /> FIRE Multiplier</div>
              <div className="multiplier-input-group">
                <input className="fire-calc-input" type="number" min={20} max={40} step={0.5} value={inputs.fireMultiplier} onChange={(event) => {
                  handleInput('fireMultiplier', Number(event.target.value) || 25);
                  void runCalculation({ fireMultiplier: Number(event.target.value) || 25 });
                }} />
                <span className="multiplier-symbol">×</span>
              </div>
              <div className="fire-calc-subtitle">{(100 / inputs.fireMultiplier).toFixed(2)}% safe withdrawal rate</div>
              <div className="fire-calc-badge">{inputs.fireMultiplier >= 30 ? 'Conservative' : inputs.fireMultiplier >= 25 ? 'Balanced' : 'Aggressive'}</div>
            </div>

            <div className="fire-calc-card highlight">
              <div className="fire-calc-label"><Flag size={14} /> FIRE Number Required</div>
              <div className="fire-calc-value">{fireNumberLakhs > 0 ? fmtL(fireNumberLakhs) : '₹0.0L'}</div>
              <div className="fire-calc-subtitle">{inputs.applyTax ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{inputs.applyTax ? 'Tax-adjusted (12.5%)' : 'Pre-tax calculation'}</div>
              <div className="fire-calc-badge"><Zap size={14} /> Your Freedom Target</div>
            </div>
          </div>

          <StatsDeck
            currentWealthLakhs={currentWealthLakhs}
            finalWealth={results.summary.finalWealth}
            fireNumberLakhs={fireNumberLakhs}
            progressToFire={progressToFire}
            yearsToFI={yearsToFI}
            startYear={inputs.startYear}
          />

          <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

          <Suspense fallback={<TabFallback />}>
            {activeTab === 'journey' && <JourneyTab projections={results.fireProjections} retirementYear={inputs.retirementYear} />}
            {activeTab === 'risk' && (
              <RiskTab
                enableRebalancing={inputs.enableRebalancing}
                targetEquityPre={inputs.targetEquityPre}
                targetEquityPost={inputs.targetEquityPost}
                glideYears={inputs.glideYears}
                onInput={handleInput}
                equityPctSeries={equityPctSeries}
                equityPctOptions={equityPctOptions}
                netWorthSeries={netWorthSeries}
                netWorthOptions={netWorthOptions}
              />
            )}
            {activeTab === 'expenses' && (
              <ExpensesTab
                expenses={expenses}
                oneTimeExpenses={oneTimeExpenses}
                showOneTime={showOneTime}
                currentMonthlyExp={currentMonthlyExp}
                applyTax={inputs.applyTax}
                sampleTaxYear={sampleTaxYear}
                incomeExpenseSeries={incomeExpenseSeries}
                incomeExpenseOptions={incomeExpenseOptions}
                onExpenseChange={(key, value) => void handleExpense(key, value)}
                onOneTimeChange={(key, value) => void handleOneTime(key, value)}
                onShowOneTimeChange={(checked) => {
                  setShowOneTime(checked);
                  void runCalculation();
                }}
                onApplyTaxChange={(checked) => {
                  setInputs((prev) => ({ ...prev, applyTax: checked }));
                  void runCalculation({ applyTax: checked });
                }}
              />
            )}
            {activeTab === 'withdrawal' && <WithdrawalTab results={results} inputs={inputs} selectedWithdrawalRate={selectedWithdrawalRate} onSelectedRateChange={setSelectedWithdrawalRate} />}
            {activeTab === 'snapshots' && (
              <SnapshotsTab
                snapshots={snapshots.snapshots}
                selectedSnapshots={snapshots.selectedSnapshots}
                currentWealthLakhs={currentWealthLakhs}
                fireNumberLakhs={fireNumberLakhs}
                progressToFire={progressToFire}
                onSaveOpen={() => results ? snapshots.setShowSaveModal(true) : window.alert('Run calculation first')}
                onExport={snapshots.exportSnapshots}
                onImport={snapshots.importSnapshots}
                onClearAll={snapshots.clearAllSnapshots}
                onToggleSelection={snapshots.toggleSnapshotSelection}
                onLoad={(id) => void snapshots.loadSnapshot(id)}
                onDelete={snapshots.deleteSnapshot}
              />
            )}
          </Suspense>
        </>
      )}

      <SaveSnapshotModal
        open={snapshots.showSaveModal}
        snapshotLabel={snapshots.snapshotLabel}
        snapshotNotes={snapshots.snapshotNotes}
        snapshotTags={snapshots.snapshotTags}
        currentWealth={fmtL(currentWealthLakhs)}
        progressToFire={progressToFire}
        yearsToFI={yearsToFI}
        onClose={() => snapshots.setShowSaveModal(false)}
        onSave={snapshots.saveSnapshot}
        onLabelChange={snapshots.setSnapshotLabel}
        onNotesChange={snapshots.setSnapshotNotes}
        onAddTag={snapshots.addTag}
        onRemoveTag={snapshots.removeTag}
      />
    </div>
  );
}
