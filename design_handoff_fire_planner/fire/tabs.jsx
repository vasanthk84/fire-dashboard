/* tabs.jsx — five redesigned panels. Terse copy, pro charts. */
const { useMemo: useMemoT, useState: useStateT } = React;

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => <span key={it.label}><i style={{ background: it.color }}></i>{it.label}</span>)}
    </div>
  );
}
function PanelHead({ icon, title, cap, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div>
        <div className="panel-h"><span className="ic"><Ic name={icon} /></span><span className="panel-t">{title}</span></div>
        {cap && <div className="panel-cap" style={{ marginLeft: 26 }}>{cap}</div>}
      </div>
      {right}
    </div>
  );
}

/* ───────────────────────── Journey ───────────────────────── */
function JourneyPanel({ results, inputs, themeKey }) {
  const { fmtL } = window.FIRE;
  const proj = results.fireProjections;
  return (
    <div className="stack">
      <div className="card card-pad">
        <PanelHead icon="trending" title="Corpus trajectory"
          cap={`Projected net worth · ${inputs.startYear}–${inputs.retirementYear + 8}`} />
        <ApexChart height={300} dep={'j' + themeKey} build={CHARTS.corpus(proj, inputs.retirementYear)} />
      </div>

      <div className="table-card">
        <div className="table-head"><div className="panel-t">Year-by-year path</div>
          <span className="chip">MF · Stocks · US · Bonds · Emergency · EPF</span></div>
        <div className="table-scroll" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table className="grid">
            <thead><tr>
              <th>Year</th><th>MF</th><th>Stocks IN</th><th>US</th><th>Bonds</th>
              <th>EPF</th><th>401k</th><th>Total</th><th>Passive/mo</th><th style={{ textAlign: 'left' }}>Events</th>
            </tr></thead>
            <tbody>
              {proj.filter((p) => p.year <= inputs.retirementYear + 12).map((p) => (
                <tr key={p.year} className={p.year === inputs.retirementYear ? 'mark' : ''}>
                  <td className="k">{p.year}</td>
                  <td>{fmtL(p.mf)}</td><td>{fmtL(p.stocksIndia)}</td><td>{fmtL(p.usStocks)}</td>
                  <td>{fmtL(p.bonds)}</td><td>{fmtL(p.epf)}</td><td>{fmtL(p.us401k)}</td>
                  <td className="k">{fmtL(p.total)}</td><td>{fmtL(p.passiveIncomeMonthly)}</td>
                  <td style={{ textAlign: 'left' }}>
                    <div className="chips">{p.milestones.map((m, i) => <span key={i} className={'chip ' + m.type}>{m.text}</span>)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Risk ───────────────────────── */
function computeEquity(results, inputs) {
  const proj = results.fireProjections.filter((p) => p.year <= inputs.retirementYear + 8);
  const years = proj.map((p) => p.year), drift = [], rebalanced = [], target = [];
  let prevEq = 0, prevFx = 0;
  proj.forEach((p, i) => {
    const post = p.year >= inputs.retirementYear;
    const since = p.year - inputs.retirementYear;
    let tgt = inputs.targetEquityPre;
    if (post && inputs.glideYears > 0) tgt = inputs.targetEquityPre + Math.min(since / inputs.glideYears, 1) * (inputs.targetEquityPost - inputs.targetEquityPre);
    else if (post) tgt = inputs.targetEquityPost;
    target.push(Math.round(tgt));
    const eq = p.mf + p.stocksIndia + p.usStocks, tot = p.total || 1;
    drift.push(Math.round((eq / tot) * 100));
    if (inputs.enableRebalancing) {
      if (i === 0) { prevEq = eq; prevFx = tot - eq; rebalanced.push(drift[0]); }
      else { const ge = prevEq * (1 + inputs.mfRate), gf = prevFx * 1.07, gt = ge + gf, te = gt * (tgt / 100); prevEq = te; prevFx = gt - te; rebalanced.push(Math.round((te / gt) * 100)); }
    }
  });
  return { years, drift, rebalanced, target };
}
function RiskPanel({ results, inputs, onInput, stress, themeKey }) {
  const { fmtL } = window.FIRE;
  const A = window.FIRE.ASSET_SERIES;
  const eq = useMemoT(() => computeEquity(results, inputs), [results, inputs.enableRebalancing, inputs.glideYears, inputs.targetEquityPre, inputs.targetEquityPost]);
  return (
    <div className="stack">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Stress scenarios · corpus at retirement</div>
        <div className="stress-grid">
          {stress.map((s) => (
            <div className={'stress ' + s.tone} key={s.key}>
              <div className="stress-l">{s.label}</div>
              <div className="stress-a">{s.assumption}</div>
              <div className="stress-row"><span>Corpus</span><strong>{fmtL(s.finalWealth)}</strong></div>
              <div className="stress-row"><span>vs base</span><strong className={s.wealthDelta >= 0 ? 'text-pos' : 'text-neg'}>{s.wealthDelta >= 0 ? '+' : ''}{fmtL(s.wealthDelta)}</strong></div>
              <div className="stress-row"><span>Cover</span><strong>{s.coverage != null ? s.coverage.toFixed(0) + '%' : '—'}</strong></div>
              <div className="stress-row"><span>FIRE year</span><strong>{s.fireYear || 'Not reached'}</strong></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <PanelHead icon="layers" title="Net-worth composition" cap="Asset mix over the accumulation path" />
        <ApexChart height={320} dep={'comp' + themeKey} build={CHARTS.composition(results.fireProjections, inputs.retirementYear, A)} />
        <Legend items={A} />
      </div>

      <div className="card card-pad">
        <PanelHead icon="shield" title="Equity allocation & glidepath"
          right={<label className="switch"><input type="checkbox" checked={inputs.enableRebalancing} onChange={(e) => onInput('enableRebalancing', e.target.checked)} /><span className="track"></span>Rebalance</label>} />
        {inputs.enableRebalancing && (
          <div className="grid-3" style={{ marginBottom: 16, maxWidth: 460 }}>
            {[['targetEquityPre', 'Pre-retire %'], ['targetEquityPost', 'Post-retire %'], ['glideYears', 'Glide years']].map(([k, l]) => (
              <div className="in-wrap" key={k}><label>{l}</label>
                <input className="in" type="number" value={inputs[k]} onChange={(e) => onInput(k, Number(e.target.value))} /></div>
            ))}
          </div>
        )}
        <ApexChart height={300} dep={'eq' + themeKey + inputs.enableRebalancing + inputs.targetEquityPre + inputs.targetEquityPost + inputs.glideYears} build={CHARTS.equity(eq)} />
      </div>
    </div>
  );
}

/* ───────────────────────── Expenses ───────────────────────── */
function ExpensesPanel({ expenses, oneTime, showOneTime, applyTax, onExpense, onOneTime, onToggleOneTime, onToggleTax, results, inputs, sampleTaxYear, themeKey }) {
  const { fmtL, fmtINR, EXPENSE_META, ONETIME_META } = window.FIRE;
  const total = EXPENSE_META.reduce((s, e) => s + (expenses[e.key] || 0), 0);
  const hasExp = total > 0;
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card card-pad">
        <PanelHead icon="wallet" title="Monthly expenses" cap="Drives FIRE target & coverage" />
        {EXPENSE_META.map((e) => (
          <div className="exp-row" key={e.key}>
            <label><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: e.color, marginRight: 8, verticalAlign: 'middle' }}></i>{e.label}</label>
            <input className="in num" type="number" value={expenses[e.key]} onChange={(ev) => onExpense(e.key, ev.target.value)} />
          </div>
        ))}
        <div className="exp-total"><span>Total / month</span><b>{fmtINR(total)}</b></div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="switch"><input type="checkbox" checked={applyTax} onChange={(e) => onToggleTax(e.target.checked)} /><span className="track"></span>Apply 12.5% tax drag</label>
          <label className="switch"><input type="checkbox" checked={showOneTime} onChange={(e) => onToggleOneTime(e.target.checked)} /><span className="track"></span>Return-to-India setup costs</label>
        </div>

        {showOneTime && (
          <div className="drawer-grid" style={{ marginTop: 14 }}>
            {ONETIME_META.map((o) => (
              <div className="in-wrap" key={o.key}><label>{o.label}</label>
                <input className="in" type="number" value={oneTime[o.key]} onChange={(e) => onOneTime(o.key, e.target.value)} /></div>
            ))}
          </div>
        )}

        {applyTax && sampleTaxYear && (
          <div className="card card-pad" style={{ marginTop: 14, background: 'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Tax at retirement</div>
            <div className="stress-row"><span>Gross passive</span><strong>{fmtL(sampleTaxYear.passiveIncomeGross)}</strong></div>
            <div className="stress-row"><span>Tax (12.5%)</span><strong className="text-neg">−{fmtL(sampleTaxYear.monthlyTax)}</strong></div>
            <div className="stress-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}><span>Net / mo</span><strong className="text-pos">{fmtL(sampleTaxYear.passiveIncomeMonthly)}</strong></div>
          </div>
        )}
      </div>

      <div className="stack">
        <div className="card card-pad">
          <PanelHead icon="pie" title="Spend breakdown" />
          {hasExp ? <ApexChart height={240} dep={'don' + themeKey + total} build={CHARTS.expenseDonut(EXPENSE_META, expenses)} />
            : <div className="empty"><p>Add expenses to see the split</p></div>}
        </div>
        <div className="card card-pad">
          <PanelHead icon="activity" title="Passive income vs expenses" cap="Lakhs per month · post-return" />
          <ApexChart height={280} dep={'ie' + themeKey + applyTax} build={CHARTS.incomeVsExpense(results.fireProjections, inputs.retirementYear, inputs.returnYear, applyTax)} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Withdrawal ───────────────────────── */
function WithdrawalPanel({ results, inputs, rate, onRate, themeKey }) {
  const { fmtL, fmtINR } = window.FIRE;
  const scenario = results.withdrawalScenarios[rate] || [];
  if (!scenario.length) return null;
  const annual = scenario[0].withdrawalMonthly * 12;
  const corpus = results.summary.finalWealth;
  const yrs = inputs.retirementYear - inputs.startYear;
  const principal = (inputs.mfPrincipal || inputs.mfCurrent * 0.7) + inputs.mfSIP * 12 * yrs;
  const gainRatio = Math.max(0, (corpus - principal) / corpus);
  const taxable = annual * gainRatio;
  const netGain = Math.max(0, taxable - 1.25);
  const ltcg = netGain * 0.125;
  const oldTax = annual > 15 ? (annual - 15) * 0.3 + 1.5 + 1.5 * 0.04 : 0;
  const cards = [
    { l: 'Annual withdrawal', v: fmtL(annual), f: `Sell ${rate} of units`, cls: '' },
    { l: 'Taxable component', v: fmtL(taxable), f: `${((1 - gainRatio) * 100).toFixed(0)}% is principal`, cls: '' },
    { l: 'Est. LTCG tax', v: fmtINR((ltcg * 100000) / 12) + '/mo', f: `vs old ${fmtL(oldTax)}`, cls: 'hl' }
  ];
  return (
    <div className="stack">
      <div className="card card-pad">
        <PanelHead icon="cross" title="Withdrawal (SWP)" cap="LTCG-optimised · FY2025 rules"
          right={<select className="in" style={{ width: 170 }} value={rate} onChange={(e) => onRate(e.target.value)}>
            <option value="2%">2% · Conservative</option><option value="3%">3% · Balanced</option><option value="4%">4% · Aggressive</option>
          </select>} />
        <div className="grid-3" style={{ marginTop: 4 }}>
          {cards.map((c) => (
            <div className={'calc ' + c.cls} key={c.l}>
              <div className="calc-l">{c.l}</div>
              <div className="calc-v">{c.v}</div>
              <div className="calc-foot">{c.f}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Corpus sustainability · 25 yrs @ {rate}</div>
          <ApexChart height={240} dep={'dep' + themeKey + rate} build={CHARTS.depletion(scenario, rate)} />
        </div>
      </div>

      <div className="table-card">
        <div className="table-head"><div className="panel-t">Projected post-tax income</div></div>
        <div className="table-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="grid">
            <thead><tr><th>Year</th><th>Corpus</th><th>Withdrawal</th><th>Est. tax</th><th>Net / mo</th></tr></thead>
            <tbody>
              {scenario.map((r) => {
                const gs = Math.max(0, (r.corpusStart - principal) / r.corpusStart);
                const aw = r.withdrawalMonthly * 12;
                const tax = Math.max(0, aw * gs - 1.25) * 0.125;
                return (<tr key={r.year}>
                  <td className="k">{r.year}</td><td>{fmtL(r.corpusStart)}</td><td>{fmtL(aw)}</td>
                  <td className="text-neg">−{fmtL(tax)}</td>
                  <td className="text-pos">{fmtINR(((aw - tax) / 12) * 100000)}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Snapshots ───────────────────────── */
function SnapshotsPanel({ snapshots, selected, onToggle, currentWealth, fireNumber, progress, themeKey }) {
  const { fmtL } = window.FIRE;
  const sel = selected.map((id) => snapshots.find((s) => s.modelId === id)).filter(Boolean)
    .sort((a, b) => new Date(a.snapshotDate) - new Date(b.snapshotDate));
  return (
    <div className="stack">
      <div className="grid-3">
        {[['Total wealth', fmtL(currentWealth), 'wallet'], ['FIRE target', fireNumber > 0 ? fmtL(fireNumber) : '—', 'target'], ['Progress', progress.toFixed(0) + '%', 'spark']].map(([l, v, ic]) => (
          <div className="calc" key={l}><div className="calc-l"><Ic name={ic} size={14} />{l}</div><div className="calc-v">{v}</div></div>
        ))}
      </div>

      <div className="card card-pad">
        <PanelHead icon="archive" title={`Saved snapshots (${snapshots.length})`} cap="Select two or more to compare"
          right={<div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm"><Ic name="play" size={14} />Save</button>
            <button className="btn btn-sm"><Ic name="download" size={14} />Export</button>
          </div>} />
        <div className="snap-list">
          {snapshots.slice().reverse().map((s, i, arr) => {
            const prev = arr[i + 1];
            const chg = prev ? ((s.results.currentWealth - prev.results.currentWealth) / prev.results.currentWealth) * 100 : 0;
            const on = selected.includes(s.modelId);
            return (
              <div key={s.modelId} className={'snap-item' + (on ? ' sel' : '')} onClick={() => onToggle(s.modelId)}>
                <div>
                  <div className="snap-label">{on && <Ic name="check" size={15} />}{s.label}{s.notes && <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>· {s.notes}</span>}</div>
                  <div className="snap-meta">
                    <span className="num">{fmtL(s.results.currentWealth)}</span>
                    {prev && <span className={chg >= 0 ? 'delta-up' : 'delta-dn'}>{chg >= 0 ? '↑' : '↓'} {Math.abs(chg).toFixed(1)}%</span>}
                  </div>
                </div>
                <div className="num" style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(s.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
              </div>
            );
          })}
        </div>
      </div>

      {sel.length >= 2 && (
        <div className="card card-pad">
          <PanelHead icon="bars" title="Wealth progression" cap="Selected snapshots vs FIRE target" />
          <ApexChart height={280} dep={'prog' + themeKey + selected.join()} build={CHARTS.progression(sel)} />
          <div className="grid-3" style={{ marginTop: 16 }}>
            {sel.map((s, i) => {
              const prev = sel[i - 1];
              const d = prev ? s.results.currentWealth - prev.results.currentWealth : 0;
              const dp = prev ? (d / prev.results.currentWealth) * 100 : 0;
              return (
                <div className="card card-pad" key={s.modelId} style={{ background: 'var(--surface-2)' }}>
                  <div className="eyebrow">{s.label}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px' }}>{fmtL(s.results.currentWealth)}</div>
                  {prev && <div className={dp >= 0 ? 'delta-up' : 'delta-dn'} style={{ fontSize: 12 }}>{dp >= 0 ? '↑' : '↓'} {fmtL(Math.abs(d))} ({Math.abs(dp).toFixed(1)}%)</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { JourneyPanel, RiskPanel, ExpensesPanel, WithdrawalPanel, SnapshotsPanel });
