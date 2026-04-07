import { Suspense, lazy, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Download,
  Flag,
  Info,
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
import { useSensitivitySummary } from './hooks/useSensitivitySummary';
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
    validation,
    handleInput,
    handleExpense,
    handleOneTime,
    runCalculation,
    setExpenses,
    setOneTimeExpenses,
    sumExpenses,
    initialOneTimeExpenses
  } = planner;

  const oneTimeExpenseTotal = showOneTime ? sumExpenses(oneTimeExpenses) : 0;

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
  const sensitivity = useSensitivitySummary({
    inputs,
    results,
    currentMonthlyExp,
    oneTimeExpenseTotal,
    enabled: Boolean(results) && !validation.hasBlocking && currentMonthlyExp > 0
  });

  const retirementProjection = results?.fireProjections.find((projection) => projection.year === inputs.retirementYear);
  const retirementCoverage = retirementProjection && retirementProjection.calculatedMonthlyExpense
    ? (retirementProjection.passiveIncomeMonthly / retirementProjection.calculatedMonthlyExpense) * 100
    : null;

  const readiness = !results
    ? null
    : currentMonthlyExp === 0
      ? {
          tone: 'warning',
          title: 'Incomplete planning input',
          detail: 'The portfolio projection is available, but your expense base is still zero so the retirement target is not decision-ready.'
        }
      : retirementCoverage !== null && retirementCoverage >= 100
        ? {
            tone: 'success',
            title: 'Plan is funded at retirement',
            detail: `Projected passive income covers ${retirementCoverage.toFixed(0)}% of inflation-adjusted retirement expenses in ${inputs.retirementYear}.`
          }
        : yearsToFI !== null && inputs.startYear + yearsToFI <= inputs.retirementYear
          ? {
              tone: 'success',
              title: 'Plan reaches FIRE before retirement',
              detail: `The current assumptions reach the target around ${inputs.startYear + yearsToFI}, ahead of the planned retirement year.`
            }
          : {
              tone: 'warning',
              title: 'Gap remains under the current assumptions',
              detail: 'The model still needs either higher savings, lower retirement expenses, or a later retirement year.'
            };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="brand-block">
          <div className="hero-kicker">Financial Independence Planner</div>
          <div className="brand">
            <h1><TrendingUp size={22} /> FIRE Architect Pro</h1>
          </div>
          <p className="hero-subtitle">
            Model wealth accumulation, return-to-India costs, withdrawal strategy, and snapshot comparisons in one dark-mode workspace.
          </p>
          <div className="hero-badges">
            <span className="hero-badge">TSX Modular UI</span>
            <span className="hero-badge">Vercel Ready</span>
            <span className="hero-badge">Scenario Planning</span>
          </div>
        </div>
        <div className="hero-sidecard">
          <div className="hero-card-label">Plan Snapshot</div>
          <div className="hero-metric-grid">
            <div className="hero-metric">
              <span>Current Wealth</span>
              <strong>{fmtL(currentWealthLakhs)}</strong>
            </div>
            <div className="hero-metric">
              <span>FIRE Target</span>
              <strong>{fireNumberLakhs > 0 ? fmtL(fireNumberLakhs) : 'Pending'}</strong>
            </div>
            <div className="hero-metric">
              <span>Status</span>
              <strong>{results ? `${progressToFire.toFixed(0)}% funded` : 'Ready to model'}</strong>
            </div>
          </div>
          {results && (
            <div className="hero-actions">
              <button className="btn-dl" onClick={() => downloadPlanExcel(results, expenses, oneTimeExpenses, inputs)}>
                <Download size={16} /> Export Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="section-heading">
        <div>
          <div className="section-eyebrow">Inputs</div>
          <h2 className="section-title">Plan your accumulation model</h2>
        </div>
        <p className="section-note">
          Update assumptions across assets, contributions, and growth rates before running the projection engine.
        </p>
      </div>

      <InputDeck inputs={inputs} onInput={handleInput} />

      {validation.hasBlocking && (
        <div className="status-banner warning-banner">
          <AlertTriangle size={16} /> {validation.blocking[0]}
        </div>
      )}

      {!validation.hasBlocking && validation.hasAdvisory && (
        <div className="advisory-panel">
          <div className="advisory-header"><Info size={16} /> Model guardrails</div>
          <ul className="advisory-list">
            {validation.advisory.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

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

      {!results && !calculationError && (
        <div className="empty-dashboard">
          <div className="empty-dashboard-copy">
            <div className="section-eyebrow">Workflow</div>
            <h2 className="section-title">Run your first projection</h2>
            <p className="empty-copy">
              The dashboard will unlock risk, expense, withdrawal, and snapshot views once you calculate a baseline plan.
            </p>
          </div>
          <div className="empty-points">
            <div className="empty-point">
              <strong>1</strong>
              <span>Set retirement year, assets, and monthly flows.</span>
            </div>
            <div className="empty-point">
              <strong>2</strong>
              <span>Add lifestyle expenses to calculate a credible FIRE target.</span>
            </div>
            <div className="empty-point">
              <strong>3</strong>
              <span>Run the plan, then review risk, withdrawals, and snapshots.</span>
            </div>
          </div>
        </div>
      )}

      {results && (
        <>
          {readiness && (
            <div className={`readiness-card readiness-card-${readiness.tone}`}>
              <div className="readiness-title">{readiness.title}</div>
              <p className="readiness-copy">{readiness.detail}</p>
              <div className="method-note">
                Deterministic model with fixed growth, FX, and simplified tax assumptions. Treat it as a planning baseline, not tax or investment advice.
              </div>
            </div>
          )}

          <div className="sensitivity-panel">
            <div className="sensitivity-header">
              <div>
                <div className="section-eyebrow">Sensitivity</div>
                <h3 className="section-title">How fragile is the current plan?</h3>
              </div>
              <p className="section-note">
                Quick stress checks against the same model using slightly worse inflation, return, and expense assumptions.
              </p>
            </div>

            {sensitivity.isLoading && <div className="tab-panel-loading">Calculating sensitivity summary...</div>}
            {sensitivity.error && !sensitivity.isLoading && <div className="status-banner warning-banner"><AlertTriangle size={16} /> {sensitivity.error}</div>}

            {!sensitivity.isLoading && !sensitivity.error && sensitivity.scenarios.length > 0 && (
              <div className="sensitivity-grid">
                {sensitivity.scenarios.map((scenario) => (
                  <div key={scenario.key} className={`sensitivity-card sensitivity-card-${scenario.tone}`}>
                    <div className="sensitivity-label">{scenario.label}</div>
                    <div className="sensitivity-assumption">{scenario.assumption}</div>
                    <div className="sensitivity-metric-row">
                      <span>Retirement corpus</span>
                      <strong>{fmtL(scenario.finalWealth)}</strong>
                    </div>
                    <div className="sensitivity-metric-row">
                      <span>Base-case delta</span>
                      <strong>{scenario.wealthDelta >= 0 ? '+' : ''}{fmtL(scenario.wealthDelta)}</strong>
                    </div>
                    <div className="sensitivity-metric-row">
                      <span>Expense cover</span>
                      <strong>{scenario.coverage !== null ? `${scenario.coverage.toFixed(0)}%` : 'N/A'}</strong>
                    </div>
                    <div className="sensitivity-metric-row">
                      <span>FIRE year</span>
                      <strong>{scenario.fireYear ?? 'Not reached'}</strong>
                    </div>
                    <p className="sensitivity-summary">{scenario.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-heading section-heading-compact">
            <div>
              <div className="section-eyebrow">Results</div>
              <h2 className="section-title">Portfolio outlook and retirement readiness</h2>
            </div>
            <p className="section-note">
              Use the tabs below to inspect journey milestones, asset mix, expense runway, and post-retirement withdrawals.
            </p>
          </div>

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
