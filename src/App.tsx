import { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Download,
  Map,
  PlusCircle,
  Shield,
  SlidersHorizontal,
  Wallet,
  X,
  BookOpen,
  Sun,
  Moon,
  ShieldCheck,
  DownloadCloud,
  PiggyBank,
  Landmark,
  RotateCcw,
  LineChart,
  Palette
} from 'lucide-react';
import { InputDeck, INPUT_GROUPS, InputField } from './components/InputDeck';
import { OptionsYieldHint } from './components/OptionsYieldHint';
import { SaveSnapshotModal } from './components/SaveSnapshotModal';
import { StatsDeck } from './components/StatsDeck';
import { CloudSyncChip } from './components/CloudSyncChip';
import { useFirePlanner } from './hooks/useFirePlanner';
import { useSensitivitySummary } from './hooks/useSensitivitySummary';
import { useSnapshots } from './hooks/useSnapshots';
import { useIsMobile } from './mobile/hooks/useIsMobile';
import { MobileApp } from './mobile/MobileApp';
import { downloadPlanExcel } from './services/api';
import type { TabKey } from './types';
import { fmtL } from './utils/formatters';

const JourneyTab = lazy(() => import('./components/tabs/JourneyTab').then((module) => ({ default: module.JourneyTab })));
const RiskTab = lazy(() => import('./components/tabs/RiskTab').then((module) => ({ default: module.RiskTab })));
const ExpensesTab = lazy(() => import('./components/tabs/ExpensesTab').then((module) => ({ default: module.ExpensesTab })));
const WithdrawalTab = lazy(() => import('./components/tabs/WithdrawalTab').then((module) => ({ default: module.WithdrawalTab })));
const MutualFundsTab = lazy(() => import('./components/tabs/MutualFundsTab').then((module) => ({ default: module.MutualFundsTab })));
const SnapshotsTab = lazy(() => import('./components/tabs/SnapshotsTab').then((module) => ({ default: module.SnapshotsTab })));
const Retirement401kTab = lazy(() => import('./components/tabs/Retirement401kTab').then((module) => ({ default: module.Retirement401kTab })));
const PFReinvestmentTab = lazy(() => import('./components/tabs/PFReinvestmentTab').then((module) => ({ default: module.PFReinvestmentTab })));

function TabFallback() {
  return <div className="tab-panel-loading">Loading panel...</div>;
}

const tabIcons = {
  journey: Map,
  risk: Shield,
  expenses: Wallet,
  withdrawal: PlusCircle,
  mutualFunds: LineChart,
  retirement401k: PiggyBank,
  pfReinvest: Landmark,
  snapshots: Archive
};

const tabsMeta = [
  { key: 'journey' as TabKey, label: 'Journey' },
  { key: 'risk' as TabKey, label: 'Risk' },
  { key: 'expenses' as TabKey, label: 'Expenses' },
  { key: 'withdrawal' as TabKey, label: 'Withdrawal' },
  { key: 'mutualFunds' as TabKey, label: 'Mutual Funds' },
  { key: 'retirement401k' as TabKey, label: '401k Projector' },
  { key: 'pfReinvest' as TabKey, label: 'PF Reinvest' },
  { key: 'snapshots' as TabKey, label: 'Snapshots' }
];

// Guardrail banners and the readiness/StatsDeck overview are about the core
// FIRE plan's assumptions (expenses, contributions, tax, withdrawal safety) —
// meaningful on the tabs that actually drive those calculations. They read as
// noise on tabs that are their own self-contained tools (Mutual Funds' own
// summary stats, 401k/PF Reinvest's own projections, Snapshots' own history).
const PLAN_OVERVIEW_TABS = new Set<TabKey>(['journey', 'risk', 'expenses', 'withdrawal']);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('journey');
  const [selectedWithdrawalRate, setSelectedWithdrawalRate] = useState('4%');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showPlanOverview = PLAN_OVERVIEW_TABS.has(activeTab);

  // Theme states
  const [theme, setTheme] = useState<'dark' | 'light' | 'paper'>(() => {
    return (localStorage.getItem('fire-planner-theme') as 'dark' | 'light' | 'paper') || 'dark';
  });
  const [hue, setHue] = useState<'green' | 'blue' | 'indigo' | 'cyan'>(() => {
    return (localStorage.getItem('fire-planner-hue') as 'green' | 'blue' | 'indigo' | 'cyan') || 'green';
  });
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appearanceOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target as Node)) setAppearanceOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [appearanceOpen]);

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
    compareApartmentScenarios,
    resetToDefaults,
    setExpenses,
    setOneTimeExpenses,
    sumExpenses,
    initialOneTimeExpenses
  } = planner;

  // Run calculation on mount
  useEffect(() => {
    void runCalculation();
  }, []);

  // Update HTML attributes for CSS cascade
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fire-planner-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-hue', hue);
    localStorage.setItem('fire-planner-hue', hue);
  }, [hue]);

  const oneTimeExpenseTotal = showOneTime ? sumExpenses(oneTimeExpenses) : 0;

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

  // Target multiplier stepper callback
  const handleMultiplierChange = (val: number) => {
    handleInput('fireMultiplier', val);
    void runCalculation({ fireMultiplier: val });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all inputs and expenses back to the app defaults? Your saved Snapshots are not affected.')) {
      void resetToDefaults();
    }
  };

  // Theme Key used to rebuild charts
  const themeKey = theme + '-' + hue;
  const isMobile = useIsMobile(920);
  const cycleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'paper' : 'dark'));
  };

  // Readiness Calculation
  const retirementProjection = results?.fireProjections.find((p) => p.year === inputs.retirementYear);
  const retirementCoverage = retirementProjection && retirementProjection.calculatedMonthlyExpense
    ? (retirementProjection.passiveIncomeMonthly / retirementProjection.calculatedMonthlyExpense) * 100
    : null;

  const readiness = useMemo(() => {
    if (currentMonthlyExp === 0) {
      return { tone: 'warn', text: 'Add expenses to assess readiness' };
    }
    if (retirementCoverage !== null && retirementCoverage >= 100) {
      return { tone: 'ok', text: `Funded · ${retirementCoverage.toFixed(0)}% expense cover` };
    }
    if (yearsToFI !== null && inputs.startYear + yearsToFI <= inputs.retirementYear) {
      return { tone: 'ok', text: `On track · FIRE by ${inputs.startYear + yearsToFI}` };
    }
    return { tone: 'bad', text: 'Gap under current assumptions' };
  }, [currentMonthlyExp, retirementCoverage, yearsToFI, inputs.startYear, inputs.retirementYear]);

  const hues: Array<['green' | 'blue' | 'indigo' | 'cyan', string]> = [
    ['green', '#15a05f'],
    ['blue', '#2f6df0'],
    ['indigo', '#5a52e0'],
    ['cyan', '#0fa3bf']
  ];
  const themes: Array<['dark' | 'light' | 'paper', typeof Sun]> = [
    ['dark', Moon],
    ['light', Sun],
    ['paper', BookOpen]
  ];

  // Chrome selection controls
  const chromeControls = (
    <div className="chrome">
      <div className="appearance-picker" ref={appearanceRef} style={{ position: 'relative' }}>
        <button
          className="btn btn-ghost btn-icon"
          title="Appearance"
          onClick={() => setAppearanceOpen((v) => !v)}
        >
          <Palette size={16} />
        </button>
        {appearanceOpen && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              padding: 14,
              zIndex: 20,
              width: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div>
              <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 6 }}>Theme</div>
              <div className="seg sm icn" style={{ width: '100%' }}>
                {themes.map(([l, Icon]) => (
                  <button
                    key={l}
                    title={l[0].toUpperCase() + l.slice(1) + ' theme'}
                    className={theme === l ? 'active' : ''}
                    onClick={() => setTheme(l)}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 6 }}>Hue</div>
              <div className="huedots">
                {hues.map(([h, c]) => (
                  <button
                    key={h}
                    title={h}
                    aria-label={h}
                    className={'huedot' + (hue === h ? ' on' : '')}
                    style={{ '--c': c } as any}
                    onClick={() => setHue(h)}
                  ></button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <span className="chrome-sep"></span>
      <CloudSyncChip onOpenSnapshots={() => setActiveTab('snapshots')} />
    </div>
  );

  const banners = (
    <>
      {validation.hasBlocking && (
        <div className="banner warn">
          <AlertCircle size={16} /> {validation.blocking[0]}
        </div>
      )}

      {!validation.hasBlocking && validation.hasAdvisory && (
        <div className="banner warn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <AlertTriangle size={16} /> Model Guardrails
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '12px', color: 'var(--text-2)' }}>
            {validation.advisory.map((item) => (
              <li key={item} style={{ marginTop: 4 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {calculationError && (
        <div className="banner warn text-neg" style={{ borderColor: 'var(--neg)', background: 'color-mix(in srgb, var(--neg) 10%, transparent)' }}>
          <AlertCircle size={16} /> {calculationError}
        </div>
      )}

      {results?.summary.isEarlyWithdrawal401k && (
        <div className="banner warn" style={{ borderColor: 'var(--neg)', background: 'color-mix(in srgb, var(--neg) 10%, transparent)', color: 'var(--neg)' }}>
          <AlertCircle size={16} />
          401k Draw year has you withdrawing at age {results.summary.ageAtWithdrawal401k} — before 59½, the IRS adds a 10% early withdrawal penalty on top of income tax ({(results.summary.taxRate401k * 100).toFixed(0)}% total applied).
        </div>
      )}
    </>
  );

  const overview = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className={'tag ' + readiness.tone}>
          {readiness.tone === 'ok' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
          {readiness.text}
        </span>
      </div>
      <StatsDeck
        currentWealthLakhs={currentWealthLakhs}
        finalWealth={results ? results.summary.finalWealth : 0}
        fireNumberLakhs={fireNumberLakhs}
        progressToFire={progressToFire}
        yearsToFI={yearsToFI}
        inputs={inputs}
        onMultiplierChange={handleMultiplierChange}
        retirementYear={inputs.retirementYear}
      />
    </>
  );

  function ActivePanel() {
    if (!results) {
      return <div className="tab-panel-loading">Calculating initial plan...</div>;
    }

    switch (activeTab) {
      case 'journey':
        return (
          <JourneyTab
            projections={results.fireProjections}
            retirementYear={inputs.retirementYear}
            startYear={inputs.startYear}
            withdraw401kYear={inputs.withdraw401kYear}
            themeKey={themeKey}
          />
        );
      case 'risk':
        return (
          <RiskTab
            results={results}
            inputs={inputs}
            onInput={(k, v) => {
              handleInput(k, v);
              void runCalculation({ [k]: v });
            }}
            stress={sensitivity.scenarios}
            themeKey={themeKey}
          />
        );
      case 'expenses':
        return (
          <ExpensesTab
            expenses={expenses}
            oneTimeExpenses={oneTimeExpenses}
            showOneTime={showOneTime}
            currentMonthlyExp={currentMonthlyExp}
            applyTax={inputs.applyTax}
            sampleTaxYear={sampleTaxYear}
            onExpenseChange={(key, value) => void handleExpense(key, value)}
            onOneTimeChange={(key, value) => void handleOneTime(key, value)}
            onShowOneTimeChange={(checked) => {
              setShowOneTime(checked);
              void runCalculation({ oneTimeExpenseTotal: checked ? sumExpenses(oneTimeExpenses) : 0 });
            }}
            onApplyTaxChange={(checked) => {
              handleInput('applyTax', checked);
              void runCalculation({ applyTax: checked });
            }}
            results={results}
            inputs={inputs}
            onInput={(k, v) => {
              handleInput(k, v);
              void runCalculation({ [k]: v });
            }}
            compareApartmentScenarios={compareApartmentScenarios}
            themeKey={themeKey}
          />
        );
      case 'withdrawal':
        return (
          <WithdrawalTab
            results={results}
            inputs={inputs}
            selectedWithdrawalRate={selectedWithdrawalRate}
            onSelectedRateChange={setSelectedWithdrawalRate}
            themeKey={themeKey}
          />
        );
      case 'mutualFunds':
        return (
          <MutualFundsTab
            mfCurrentSynced={inputs.mfCurrent}
            mfPrincipalSynced={inputs.mfPrincipal}
            onSyncToPlan={(currentLakhs, principalLakhs) => {
              handleInput('mfCurrent', currentLakhs);
              handleInput('mfPrincipal', principalLakhs);
              void runCalculation({ mfCurrent: currentLakhs, mfPrincipal: principalLakhs });
            }}
            themeKey={themeKey}
          />
        );
      case 'retirement401k':
        return (
          <Retirement401kTab
            results={results}
            inputs={inputs}
            onInput={(k, v) => {
              handleInput(k, v);
              void runCalculation({ [k]: v });
            }}
            themeKey={themeKey}
          />
        );
      case 'pfReinvest':
        return (
          <PFReinvestmentTab
            results={results}
            inputs={inputs}
            onInput={(k, v) => {
              handleInput(k, v);
              void runCalculation({ [k]: v });
            }}
            themeKey={themeKey}
          />
        );
      case 'snapshots':
        return (
          <SnapshotsTab
            snapshots={snapshots.snapshots}
            selectedSnapshots={snapshots.selectedSnapshots}
            currentWealthLakhs={currentWealthLakhs}
            fireNumberLakhs={fireNumberLakhs}
            progressToFire={progressToFire}
            onSaveOpen={() => (results ? snapshots.setShowSaveModal(true) : window.alert('Run calculation first'))}
            onExport={snapshots.exportSnapshots}
            onImport={snapshots.importSnapshots}
            onClearAll={snapshots.clearAllSnapshots}
            onToggleSelection={snapshots.toggleSnapshotSelection}
            onLoad={(id) => void snapshots.loadSnapshot(id)}
            onDelete={snapshots.deleteSnapshot}
            themeKey={themeKey}
          />
        );
      default:
        return null;
    }
  }

  if (isMobile) {
    return (
      <MobileApp
        planner={planner}
        snapshotsApi={snapshots}
        sensitivity={sensitivity}
        theme={theme}
        onCycleTheme={cycleTheme}
        themeKey={themeKey}
      />
    );
  }

  /* ---------- Console layout shell ---------- */
  return (
      <div className="shell">
        <aside className="rail">
          <div className="rail-brand">
            <div className="logo">F</div>
            <div>
              <div className="brand-name">FIRE Planner</div>
              <div className="brand-sub">Pro</div>
            </div>
          </div>
          <nav className="rail-nav">
            <div className="nav-sec">Analysis</div>
            {tabsMeta.map((x) => {
              const Icon = tabIcons[x.key];
              return (
                <button
                  key={x.key}
                  className={'nav-item' + (activeTab === x.key ? ' active' : '')}
                  onClick={() => setActiveTab(x.key)}
                >
                  <Icon size={17} />
                  {x.label}
                </button>
              );
            })}
          </nav>
          <div className="rail-foot">
            <button className="btn" style={{ width: '100%' }} onClick={() => setDrawerOpen(true)}>
              <SlidersHorizontal size={15} />
              Assumptions
            </button>
            {results && (
              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => downloadPlanExcel(results, expenses, oneTimeExpenses, inputs)}
              >
                <Download size={15} />
                Export plan
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              title="Clears your saved plan and restores the app defaults"
              onClick={handleResetToDefaults}
            >
              <RotateCcw size={15} />
              Reset to defaults
            </button>
          </div>
        </aside>

        <main className="console-main">
          <header className="head head-desktop">
            <div>
              <h1>{tabsMeta.find((x) => x.key === activeTab)?.label}</h1>
              <div className="sub">FIRE projection · {inputs.startYear}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
              {chromeControls}
            </div>
          </header>

          <header className="head head-mobile">
            <div className="logo">F</div>
            <div className="head-mobile-title">
              <h1>{tabsMeta.find((x) => x.key === activeTab)?.label}</h1>
              <div className="sub">FIRE projection · {inputs.startYear}</div>
            </div>
            <div className="head-mobile-actions">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                title={theme[0].toUpperCase() + theme.slice(1) + ' theme'}
                onClick={() => {
                  const order: Array<'dark' | 'light' | 'paper'> = ['dark', 'light', 'paper'];
                  setTheme(order[(order.indexOf(theme) + 1) % order.length]);
                }}
              >
                {theme === 'dark' ? <Moon size={17} /> : theme === 'light' ? <Sun size={17} /> : <BookOpen size={17} />}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                title="Assumptions"
                onClick={() => setDrawerOpen(true)}
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
          </header>

          <div className="content stack">
            {showPlanOverview && banners}

            {showPlanOverview && overview}
            <div className="section-gap">
              <Suspense fallback={<TabFallback />}>
                {ActivePanel()}
              </Suspense>
            </div>
          </div>
        </main>

        <nav className="bottom-nav">
          {tabsMeta.map((x) => {
            const Icon = tabIcons[x.key];
            return (
              <button
                key={x.key}
                className={'bottom-nav-item' + (activeTab === x.key ? ' active' : '')}
                onClick={() => setActiveTab(x.key)}
              >
                <Icon size={19} />
                <span>{x.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={'drawer-scrim' + (drawerOpen ? ' open' : '')} onClick={() => setDrawerOpen(false)}></div>
        <aside className={'drawer' + (drawerOpen ? ' open' : '')}>
          <div className="drawer-h">
            <div className="panel-t">Assumptions</div>
            <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="drawer-body">
            {INPUT_GROUPS.map((g: any) => (
              <div className="drawer-grp" key={g.title}>
                <h4>{g.title}</h4>
                {g.title === 'Options income' && (
                  <OptionsYieldHint
                    portfolioValueLakhs={inputs.optionsPortfolioValue}
                    assumedYieldPct={inputs.optionsYieldPct}
                    onApplyActual={(pct) => {
                      handleInput('optionsYieldPct', pct);
                      void runCalculation({ optionsYieldPct: pct });
                    }}
                  />
                )}
                <div className="drawer-grid">
                  {g.fields.map((f: any) => (
                    <InputField
                      key={f.key}
                      f={f}
                      inputs={inputs}
                      onInput={(k, v) => {
                        handleInput(k, v);
                        void runCalculation({ [k]: v });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <SaveSnapshotModal
          open={snapshots.showSaveModal}
          snapshotLabel={snapshots.snapshotLabel}
          snapshotNotes={snapshots.snapshotNotes}
          snapshotTags={snapshots.snapshotTags}
          currentWealth={fmtL(currentWealthLakhs)}
          progressToFire={progressToFire}
          yearsToFI={yearsToFI}
          onClose={snapshots.closeSaveModal}
          onSave={snapshots.saveSnapshot}
          onLabelChange={snapshots.setSnapshotLabel}
          onNotesChange={snapshots.setSnapshotNotes}
          onAddTag={snapshots.addTag}
          onRemoveTag={snapshots.removeTag}
        />
      </div>
  );
}

