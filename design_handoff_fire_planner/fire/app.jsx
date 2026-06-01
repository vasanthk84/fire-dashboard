/* app.jsx — FIRE Planner shell. Two layout directions, theme/hue tweaks. */
const { useState, useMemo, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "console",
  "theme": "dark",
  "hue": "green"
}/*EDITMODE-END*/;

function sum(o) { return Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0); }

/* ----- shared bits ----- */
function StatTiles({ currentWealth, finalWealth, fireNumber, progress, yearsToFI, inputs, onMult, retYear }) {
  const { fmtL } = window.FIRE;
  return (
    <div className="stat-grid">
      <div className="stat">
        <div className="stat-top"><Ic name="wallet" />Current wealth</div>
        <div className="stat-val num">{fmtL(currentWealth)}</div>
        <div className="stat-foot">Liquid + retirement accounts</div>
      </div>
      <div className="stat">
        <div className="stat-top"><Ic name="rocket" />At retirement</div>
        <div className="stat-val num">{fmtL(finalWealth)}</div>
        <div className="stat-foot">Projected corpus · {retYear}</div>
      </div>
      <div className="stat">
        <div className="stat-top"><Ic name="target" />FIRE target
          <span className="stepper" style={{ marginLeft: 'auto' }}>
            <input className="in num" style={{ width: 56, padding: '4px 6px' }} type="number" min="20" max="40" step="0.5" value={inputs.fireMultiplier} onChange={(e) => onMult(Number(e.target.value) || 25)} />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>×</span>
          </span>
        </div>
        <div className="stat-val num">{fireNumber > 0 ? fmtL(fireNumber) : '—'}</div>
        {fireNumber > 0 ? <><div className="bar"><i style={{ width: progress + '%' }}></i></div><div className="stat-foot">{progress.toFixed(0)}% complete · {(100 / inputs.fireMultiplier).toFixed(1)}% SWR</div></> : <div className="stat-foot">Add expenses to compute</div>}
      </div>
      <div className="stat">
        <div className="stat-top"><Ic name="clock" />Years to FIRE</div>
        <div className="stat-val num">{yearsToFI != null && fireNumber > 0 ? yearsToFI + 'y' : '—'}</div>
        <div className="stat-foot">{yearsToFI != null && fireNumber > 0 ? 'Target ' + (inputs.startYear + yearsToFI) : 'Set expenses first'}</div>
      </div>
    </div>
  );
}

function InputField({ f, inputs, onInput }) {
  const raw = inputs[f.key];
  const val = f.pct ? Math.round(raw * 1000) / 10 : raw;
  const set = (v) => onInput(f.key, f.pct ? (Number(v) || 0) / 100 : (Number(v) || 0));
  if (f.type === 'year') return (
    <div className="in-wrap"><label>{f.label}</label>
      <input className="in" type="number" step="1" value={raw} onChange={(e) => onInput(f.key, Number(e.target.value))} /></div>
  );
  return (
    <div className="in-wrap"><label>{f.label}</label>
      <input className={'in' + (f.accent ? ' accent' : '')} type="number" step={f.step} value={val} onChange={(e) => set(e.target.value)} /></div>
  );
}

function InputDeck({ inputs, onInput }) {
  return (
    <div className="deck">
      {window.FIRE.INPUT_GROUPS.map((g) => (
        <div className="deck-card" key={g.title}>
          <h4>{g.title}</h4>
          <div className="fields">{g.fields.map((f) => <InputField key={f.key} f={f} inputs={inputs} onInput={onInput} />)}</div>
        </div>
      ))}
    </div>
  );
}

function ChromeControls({ t, setTweak }) {
  const hues = [['green', '#15a05f'], ['blue', '#2f6df0'], ['indigo', '#5a52e0'], ['cyan', '#0fa3bf']];
  const themes = [['dark', 'moon'], ['light', 'sun'], ['paper', 'page']];
  return (
    <div className="chrome">
      <div className="seg sm">
        {['console', 'report'].map((l) => (
          <button key={l} className={t.layout === l ? 'active' : ''} onClick={() => setTweak('layout', l)}>
            {l === 'console' ? 'Console' : 'Report'}</button>
        ))}
      </div>
      <span className="chrome-sep"></span>
      <div className="seg sm icn">
        {themes.map(([l, ic]) => (
          <button key={l} title={l[0].toUpperCase() + l.slice(1) + ' theme'} className={t.theme === l ? 'active' : ''} onClick={() => setTweak('theme', l)}>
            <Ic name={ic} size={14} /></button>
        ))}
      </div>
      <div className="huedots">
        {hues.map(([h, c]) => (
          <button key={h} title={h} aria-label={h} className={'huedot' + (t.hue === h ? ' on' : '')} style={{ '--c': c }} onClick={() => setTweak('hue', h)}></button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [inputs, setInputs] = useState(window.FIRE.SEED_INPUTS);
  const [expenses, setExpenses] = useState(window.FIRE.SEED_EXPENSES);
  const [oneTime, setOneTime] = useState(window.FIRE.SEED_ONETIME);
  const [showOneTime, setShowOneTime] = useState(false);
  const [tab, setTab] = useState('journey');
  const [rate, setRate] = useState('4%');
  const [drawer, setDrawer] = useState(false);
  const [snapshots] = useState(window.FIRE.SEED_SNAPSHOTS);
  const [selected, setSelected] = useState(['s2', 's4']);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-hue', t.hue);
  }, [t.theme, t.hue]);

  const monthlyExp = useMemo(() => sum(expenses), [expenses]);
  const oneTimeTotal = useMemo(() => (showOneTime ? sum(oneTime) : 0), [oneTime, showOneTime]);
  const taxDrag = inputs.applyTax ? 0.125 : 0;

  const payload = useMemo(() => Object.assign({}, inputs, { monthlyExpenses: monthlyExp, oneTimeExpenseTotal: oneTimeTotal }), [inputs, monthlyExp, oneTimeTotal]);
  const results = useMemo(() => window.calculateFirePlan(payload), [payload]);

  const fireNumber = useMemo(() => monthlyExp === 0 ? 0 : (monthlyExp * 12 * inputs.fireMultiplier) / (1 - taxDrag) / 100000, [monthlyExp, inputs.fireMultiplier, taxDrag]);
  const currentWealth = results.summary.startWealth;
  const progress = fireNumber > 0 ? Math.min((currentWealth / fireNumber) * 100, 100) : 0;
  const yearsToFI = useMemo(() => {
    if (fireNumber <= 0) return null;
    const i = results.fireProjections.findIndex((p) => p.total >= fireNumber);
    return i < 0 ? null : i;
  }, [fireNumber, results]);
  const sampleTaxYear = results.fireProjections.find((p) => p.year === inputs.retirementYear);
  const stress = useMemo(() => window.runStressScenarios(payload, results, fireNumber), [payload, results, fireNumber]);

  const retProj = results.fireProjections.find((p) => p.year === inputs.retirementYear);
  const coverage = retProj && retProj.calculatedMonthlyExpense ? (retProj.passiveIncomeMonthly / retProj.calculatedMonthlyExpense) * 100 : null;
  const readiness = monthlyExp === 0 ? { tone: 'warn', text: 'Add expenses to assess readiness' }
    : coverage != null && coverage >= 100 ? { tone: 'ok', text: `Funded · ${coverage.toFixed(0)}% expense cover` }
    : yearsToFI != null && inputs.startYear + yearsToFI <= inputs.retirementYear ? { tone: 'ok', text: `On track · FIRE by ${inputs.startYear + yearsToFI}` }
    : { tone: 'bad', text: 'Gap under current assumptions' };

  const themeKey = t.theme + t.hue;

  const onInput = (k, v) => setInputs((p) => Object.assign({}, p, { [k]: v }));
  const onExpense = (k, v) => setExpenses((p) => Object.assign({}, p, { [k]: Number(v) || 0 }));
  const onOneTime = (k, v) => setOneTime((p) => Object.assign({}, p, { [k]: Number(v) || 0 }));
  const toggleSnap = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const TABS = window.FIRE.TABS;
  const tabIcons = { journey: 'map', risk: 'shield', expenses: 'wallet', withdrawal: 'cross', snapshots: 'archive' };

  function ActivePanel() {
    if (tab === 'journey') return <JourneyPanel results={results} inputs={inputs} themeKey={themeKey} />;
    if (tab === 'risk') return <RiskPanel results={results} inputs={inputs} onInput={onInput} stress={stress} themeKey={themeKey} />;
    if (tab === 'expenses') return <ExpensesPanel expenses={expenses} oneTime={oneTime} showOneTime={showOneTime} applyTax={inputs.applyTax}
      onExpense={onExpense} onOneTime={onOneTime} onToggleOneTime={setShowOneTime} onToggleTax={(v) => onInput('applyTax', v)}
      results={results} inputs={inputs} sampleTaxYear={sampleTaxYear} themeKey={themeKey} />;
    if (tab === 'withdrawal') return <WithdrawalPanel results={results} inputs={inputs} rate={rate} onRate={setRate} themeKey={themeKey} />;
    return <SnapshotsPanel snapshots={snapshots} selected={selected} onToggle={toggleSnap} currentWealth={currentWealth} fireNumber={fireNumber} progress={progress} themeKey={themeKey} />;
  }

  const kpis = (
    <div className="head-kpis">
      <div className="kpi-mini"><span>Wealth</span><strong className="num">{window.FIRE.fmtL(currentWealth)}</strong></div>
      <div className="kpi-mini"><span>Target</span><strong className="num">{fireNumber > 0 ? window.FIRE.fmtL(fireNumber) : '—'}</strong></div>
      <div className="kpi-mini"><span>Progress</span><strong className="num">{progress.toFixed(0)}%</strong></div>
    </div>
  );

  const overview = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className={'tag ' + readiness.tone}><Ic name={readiness.tone === 'ok' ? 'shieldcheck' : 'alert'} size={14} />{readiness.text}</span>
      </div>
      <StatTiles currentWealth={currentWealth} finalWealth={results.summary.finalWealth} fireNumber={fireNumber}
        progress={progress} yearsToFI={yearsToFI} inputs={inputs} onMult={(v) => onInput('fireMultiplier', v)} retYear={inputs.retirementYear} />
    </>
  );

  const tweaks = (
    <TweaksPanel>
      <TweakSection label="Direction" />
      <TweakRadio label="Layout" value={t.layout} options={['console', 'report']} onChange={(v) => setTweak('layout', v)} />
      <TweakSection label="Theme" />
      <TweakRadio label="Surface" value={t.theme} options={['dark', 'light', 'paper']} onChange={(v) => setTweak('theme', v)} />
      <TweakColor label="Accent" value={accentHex(t.hue)}
        options={['#15a05f', '#2f6df0', '#5a52e0', '#0fa3bf']}
        onChange={(v) => setTweak('hue', hexToHue(v))} />
    </TweaksPanel>
  );

  /* ---------- Console layout ---------- */
  if (t.layout === 'console') {
    return (
      <div className="shell">
        <aside className="rail">
          <div className="rail-brand"><div className="logo">F</div>
            <div><div className="brand-name">FIRE Planner</div><div className="brand-sub">Pro</div></div></div>
          <nav className="rail-nav">
            <div className="nav-sec">Analysis</div>
            {TABS.map((x) => (
              <button key={x.key} className={'nav-item' + (tab === x.key ? ' active' : '')} onClick={() => setTab(x.key)}>
                <Ic name={tabIcons[x.key]} />{x.label}</button>
            ))}
          </nav>
          <div className="rail-foot">
            <button className="btn" style={{ width: '100%' }} onClick={() => setDrawer(true)}><Ic name="sliders" size={15} />Assumptions</button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}><Ic name="download" size={15} />Export plan</button>
          </div>
        </aside>

        <main className="console-main">
          <header className="head">
            <div><h1>{TABS.find((x) => x.key === tab).label}</h1><div className="sub">FIRE projection · {inputs.startYear}</div></div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
              <ChromeControls t={t} setTweak={setTweak} />
              {kpis}
            </div>
          </header>
          <div className="content stack">
            {overview}
            <div className="section-gap"><ActivePanel /></div>
          </div>
        </main>

        <div className={'drawer-scrim' + (drawer ? ' open' : '')} onClick={() => setDrawer(false)}></div>
        <aside className={'drawer' + (drawer ? ' open' : '')}>
          <div className="drawer-h"><div className="panel-t">Assumptions</div>
            <button className="btn btn-ghost" onClick={() => setDrawer(false)}><Ic name="x" size={16} /></button></div>
          <div className="drawer-body">
            {window.FIRE.INPUT_GROUPS.map((g) => (
              <div className="drawer-grp" key={g.title}><h4>{g.title}</h4>
                <div className="drawer-grid">{g.fields.map((f) => <InputField key={f.key} f={f} inputs={inputs} onInput={onInput} />)}</div></div>
            ))}
          </div>
        </aside>
        {tweaks}
      </div>
    );
  }

  /* ---------- Report layout ---------- */
  return (
    <div className="shell report">
      <main className="report-main">
        <div className="topbar">
          <div className="rail-brand" style={{ padding: 0 }}><div className="logo">F</div>
            <div><div className="brand-name">FIRE Planner</div></div></div>
          {kpis}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <ChromeControls t={t} setTweak={setTweak} />
            <button className="btn btn-sm"><Ic name="download" size={14} />Export</button>
          </div>
        </div>
        <div className="content stack">
          <InputDeck inputs={inputs} onInput={onInput} />
          {overview}
          <div className="section-gap">
            <div className="tabbar">
              {TABS.map((x) => <button key={x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>{x.label}</button>)}
            </div>
            <ActivePanel />
          </div>
        </div>
      </main>
      {tweaks}
    </div>
  );
}

function accentHex(hue) { return { green: '#15a05f', blue: '#2f6df0', indigo: '#5a52e0', cyan: '#0fa3bf' }[hue] || '#15a05f'; }
function hexToHue(hex) { return { '#15a05f': 'green', '#2f6df0': 'blue', '#5a52e0': 'indigo', '#0fa3bf': 'cyan' }[hex.toLowerCase()] || 'green'; }

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
