import { Fragment, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  PlusCircle,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  Upload,
  X
} from 'lucide-react';
import type { MFCategory, MFPlan, MFTxnType } from '../../types';
import { useMutualFunds } from '../../hooks/useMutualFunds';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';
import { NumberInput } from '../NumberInput';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MF_CATEGORIES, MF_CATEGORY_LABEL, MF_TXN_TYPE_LABEL } from '../../utils/mfCategories';
import { projectScenarios, yearlyPoints } from '../../utils/mfProjections';

interface MutualFundsTabProps {
  /** Inputs.mfCurrent / Inputs.mfPrincipal, ₹L, as currently synced into the main FIRE plan. */
  mfCurrentSynced: number;
  mfPrincipalSynced: number;
  onSyncToPlan: (currentLakhs: number, principalLakhs: number) => void;
  themeKey: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return (rate * 100).toFixed(1) + '%';
}

function tierMeta(tier: 1 | 2 | 3 | null): { label: string; cls: string } {
  if (tier === 1) return { label: 'Accumulate', cls: 'ok' };
  if (tier === 2) return { label: 'Maintain', cls: 'warn' };
  if (tier === 3) return { label: 'Reduce', cls: 'bad' };
  return { label: 'Pending', cls: '' };
}

const TXN_TYPES: MFTxnType[] = ['purchase', 'redemption', 'switchIn', 'switchOut'];
const COL_COUNT = 9;

export function MutualFundsTab({ mfCurrentSynced, mfPrincipalSynced, onSyncToPlan, themeKey }: MutualFundsTabProps) {
  const mf = useMutualFunds();
  const { funds, metrics, totals, benchmarks, tierThresholdPct } = mf;

  const [showAddFund, setShowAddFund] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---------- Add fund form ----------
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MFCategory>('flexiCap');
  const [newPlan, setNewPlan] = useState<MFPlan>('direct');
  const [newValue, setNewValue] = useState(0);

  const resetAddForm = () => {
    setNewName('');
    setNewCategory('flexiCap');
    setNewPlan('direct');
    setNewValue(0);
  };

  const handleAddFund = () => {
    if (!newName.trim()) {
      window.alert('Enter a fund name');
      return;
    }
    const id = mf.addFund({
      name: newName.trim(),
      category: newCategory,
      plan: newPlan,
      currentValue: newValue,
      asOfDate: today()
    });
    setShowAddFund(false);
    resetAddForm();
    setExpandedId(id);
  };

  // ---------- Transaction entry (one shared draft row, applies to whichever fund is expanded) ----------
  const [txnDate, setTxnDate] = useState(today());
  const [txnType, setTxnType] = useState<MFTxnType>('purchase');
  const [txnAmount, setTxnAmount] = useState(0);

  const handleAddTxn = (fundId: string) => {
    if (txnAmount <= 0) {
      window.alert('Enter a transaction amount greater than 0');
      return;
    }
    mf.addTransaction(fundId, { date: txnDate, type: txnType, amount: txnAmount });
    setTxnAmount(0);
  };

  // ---------- Projection engine ----------
  const [projStartOverride, setProjStartOverride] = useState<number | null>(null);
  const [projMonthly, setProjMonthly] = useState(10000);
  const [projReturnOverride, setProjReturnOverride] = useState<number | null>(null);
  const [projYears, setProjYears] = useState(15);

  const defaultStartLakhs = Number((totals.currentValue / 100000).toFixed(2));
  const defaultReturnPct = totals.blendedXirr !== null ? Number((totals.blendedXirr * 100).toFixed(1)) : 12;
  const effectiveStartLakhs = projStartOverride ?? defaultStartLakhs;
  const effectiveReturnPct = (projReturnOverride ?? defaultReturnPct) / 100;

  const scenarios = useMemo(
    () => projectScenarios(effectiveStartLakhs, projMonthly / 100000, effectiveReturnPct, projYears),
    [effectiveStartLakhs, projMonthly, effectiveReturnPct, projYears]
  );

  const yearlyFlat = useMemo(() => yearlyPoints(scenarios.flat), [scenarios]);
  const yearlyStep10 = useMemo(() => yearlyPoints(scenarios.step10), [scenarios]);
  const yearlyStep20 = useMemo(() => yearlyPoints(scenarios.step20), [scenarios]);

  const projLabels = useMemo(() => {
    const startYr = new Date().getFullYear();
    return yearlyFlat.map((p) => String(startYr + p.month / 12));
  }, [yearlyFlat]);

  const finalFlat = yearlyFlat[yearlyFlat.length - 1]?.balance ?? effectiveStartLakhs;
  const finalStep10 = yearlyStep10[yearlyStep10.length - 1]?.balance ?? effectiveStartLakhs;
  const finalStep20 = yearlyStep20[yearlyStep20.length - 1]?.balance ?? effectiveStartLakhs;

  // ---------- Fund vs benchmark comparison chart data ----------
  const comparable = metrics.filter((m) => m.xirr !== null && !m.usesAbsoluteReturn);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => mf.importPortfolio(event);

  const investedLakhs = Number((totals.invested / 100000).toFixed(2));
  const currentValueLakhs = Number((totals.currentValue / 100000).toFixed(2));
  const inSync = Math.abs(mfCurrentSynced - currentValueLakhs) < 0.01 && Math.abs(mfPrincipalSynced - investedLakhs) < 0.01;

  return (
    <div className="stack">
      {/* ---------- Summary ---------- */}
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-top">
            <TrendingUp size={15} /> Invested
          </div>
          <div className="stat-val num">{fmtL(investedLakhs)}</div>
          <div className="stat-foot">Net cost basis across {funds.length} fund{funds.length === 1 ? '' : 's'}</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <TrendingUp size={15} /> Current value
          </div>
          <div className="stat-val num">{fmtL(currentValueLakhs)}</div>
          <div className="stat-foot">As you last updated each fund</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <TrendingUp size={15} /> Overall gain
          </div>
          <div className={'stat-val num' + (totals.gain >= 0 ? ' text-pos' : ' text-neg')}>
            {fmtL(Number((totals.gain / 100000).toFixed(2)))}
          </div>
          <div className="stat-foot">{totals.gainPct !== null ? fmtPct(totals.gainPct) + ' absolute' : 'Add funds to compute'}</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <TrendingUp size={15} /> Blended XIRR
          </div>
          <div className={'stat-val num' + (totals.blendedXirr !== null && totals.blendedXirr >= 0 ? ' text-pos' : totals.blendedXirr !== null ? ' text-neg' : '')}>
            {fmtPct(totals.blendedXirr)}
          </div>
          <div className="stat-foot">Pooled cash flows, portfolio-wide</div>
        </div>
      </div>

      {/* ---------- Sync with FIRE plan ---------- */}
      <div className="current-model-card">
        <div>
          <div className="eyebrow">FIRE plan sync</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
            Plan currently uses <strong style={{ color: 'var(--text)' }}>{fmtL(mfCurrentSynced)}</strong> current /{' '}
            <strong style={{ color: 'var(--text)' }}>{fmtL(mfPrincipalSynced)}</strong> principal for Mutual Funds. Tracked here:{' '}
            <strong style={{ color: 'var(--text)' }}>{fmtL(currentValueLakhs)}</strong> / {fmtL(investedLakhs)}.
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={inSync || funds.length === 0}
          onClick={() => onSyncToPlan(currentValueLakhs, investedLakhs)}
        >
          <RefreshCw size={13} /> {inSync ? 'In sync' : 'Sync to plan'}
        </button>
      </div>

      {/* ---------- Fund table ---------- */}
      <div className="table-card">
        <div className="table-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Funds ({funds.length})</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>Per-fund XIRR, category benchmark &amp; tier</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddFund(true)}>
              <PlusCircle size={13} /> Add fund
            </button>
            <button className="btn btn-sm" onClick={mf.exportPortfolio} disabled={funds.length === 0}>
              <Download size={12} /> Export
            </button>
            <label className="btn btn-sm" style={{ margin: 0 }}>
              <Upload size={12} /> Import
              <input type="file" accept=".json" onChange={handleImport} hidden />
            </label>
          </div>
        </div>

        {funds.length === 0 ? (
          <div className="empty-state" style={{ border: 'none', borderRadius: 0 }}>
            <div className="empty-state-icon">📊</div>
            <h3>No funds yet</h3>
            <p>Add your mutual funds and log purchases/redemptions to compute real XIRR.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="grid" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Fund</th>
                  <th>Plan</th>
                  <th>Invested</th>
                  <th>Current</th>
                  <th>Gain</th>
                  <th>XIRR</th>
                  <th>Benchmark</th>
                  <th>Tier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const f = m.fund;
                  const expanded = expandedId === f.id;
                  const tm = tierMeta(m.tier);
                  return (
                    <Fragment key={f.id}>
                      <tr className={expanded ? 'mark' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : f.id)}>
                        <td style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {f.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 19 }}>{MF_CATEGORY_LABEL[f.category]}</div>
                        </td>
                        <td>
                          {f.plan === 'regular' ? (
                            <span className="tag warn" title="Regular plans usually carry a higher expense ratio than the same scheme's Direct plan">Regular</span>
                          ) : (
                            'Direct'
                          )}
                        </td>
                        <td>{fmtRupees(m.invested)}</td>
                        <td className="k">{fmtRupees(f.currentValue)}</td>
                        <td className={m.gain >= 0 ? 'text-pos' : 'text-neg'}>
                          {fmtRupees(m.gain)} {m.gainPct !== null && <span style={{ opacity: 0.75 }}>({fmtPct(m.gainPct)})</span>}
                        </td>
                        <td className={m.xirr !== null && m.xirr >= 0 ? 'text-pos' : m.xirr !== null ? 'text-neg' : undefined}>
                          {fmtPct(m.xirr)}
                          {m.usesAbsoluteReturn && <span style={{ opacity: 0.6 }}> *</span>}
                        </td>
                        <td>{(m.benchmark * 100).toFixed(1)}%</td>
                        <td>
                          <span className={'tag ' + tm.cls} title={m.tierReason}>{tm.label}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-ghost text-neg"
                            style={{ padding: 4 }}
                            title="Delete fund"
                            onClick={() => {
                              if (window.confirm(`Delete "${f.name}" and all its transactions?`)) {
                                mf.deleteFund(f.id);
                                if (expandedId === f.id) setExpandedId(null);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={COL_COUNT} style={{ background: 'var(--surface-2)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                              <div style={{ flex: '1 1 280px', minWidth: 260 }}>
                                <div className="eyebrow" style={{ marginBottom: 8 }}>Update current value</div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <NumberInput
                                    className="in"
                                    style={{ width: 140 }}
                                    step={100}
                                    value={f.currentValue}
                                    onCommit={(n) => mf.updateFund(f.id, { currentValue: n, asOfDate: today() })}
                                  />
                                  <select
                                    className="in"
                                    style={{ width: 130 }}
                                    value={f.plan}
                                    onChange={(e) => mf.updateFund(f.id, { plan: e.target.value as MFPlan })}
                                  >
                                    <option value="direct">Direct</option>
                                    <option value="regular">Regular</option>
                                  </select>
                                  <select
                                    className="in"
                                    style={{ width: 150 }}
                                    value={f.category}
                                    onChange={(e) => mf.updateFund(f.id, { category: e.target.value as MFCategory })}
                                  >
                                    {MF_CATEGORIES.map((c) => (
                                      <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>As of {f.asOfDate}</div>
                              </div>

                              <div style={{ flex: '1 1 320px', minWidth: 300 }}>
                                <div className="eyebrow" style={{ marginBottom: 8 }}>Log a transaction</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <input
                                    type="date"
                                    className="in"
                                    style={{ width: 140 }}
                                    value={txnDate}
                                    onChange={(e) => setTxnDate(e.target.value)}
                                  />
                                  <select className="in" style={{ width: 120 }} value={txnType} onChange={(e) => setTxnType(e.target.value as MFTxnType)}>
                                    {TXN_TYPES.map((t) => (
                                      <option key={t} value={t}>{MF_TXN_TYPE_LABEL[t]}</option>
                                    ))}
                                  </select>
                                  <NumberInput
                                    className="in"
                                    style={{ width: 120 }}
                                    step={500}
                                    value={txnAmount}
                                    onCommit={setTxnAmount}
                                  />
                                  <button className="btn btn-sm btn-primary" onClick={() => handleAddTxn(f.id)}>
                                    <PlusCircle size={12} /> Add
                                  </button>
                                </div>
                              </div>
                            </div>

                            {f.transactions.length > 0 && (
                              <div className="table-scroll" style={{ marginTop: 14 }}>
                                <table className="grid" style={{ width: '100%' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left' }}>Date</th>
                                      <th style={{ textAlign: 'left' }}>Type</th>
                                      <th>Amount</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {f.transactions.map((t) => (
                                      <tr key={t.id}>
                                        <td style={{ textAlign: 'left' }}>{t.date}</td>
                                        <td style={{ textAlign: 'left' }}>{MF_TXN_TYPE_LABEL[t.type]}</td>
                                        <td>{fmtRupees(t.amount)}</td>
                                        <td>
                                          <button
                                            className="btn btn-sm btn-ghost text-neg"
                                            style={{ padding: 3 }}
                                            onClick={() => mf.deleteTransaction(f.id, t.id)}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="panel-cap" style={{ marginLeft: 0, marginTop: 10 }}>{m.tierReason}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {metrics.some((m) => m.usesAbsoluteReturn) && (
          <div style={{ padding: '0 20px 16px', fontSize: 11.5, color: 'var(--text-3)' }}>* Absolute return, not annualized XIRR — see the fund's row for why.</div>
        )}
      </div>

      {/* ---------- Fund vs benchmark chart ---------- */}
      {comparable.length > 0 && (
        <div className="card card-pad">
          <div className="panel-h">
            <span className="panel-t">XIRR vs category benchmark</span>
          </div>
          <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 12 }}>Funds without a settled XIRR (too new, or still absolute-return) are excluded.</div>
          <ApexChartComponent
            height={300}
            dep={'mfcmp' + themeKey + comparable.map((m) => m.fund.id + m.xirr).join()}
            build={CHARTS.mfFundComparison(
              comparable.map((m) => m.fund.name),
              comparable.map((m) => (m.xirr ?? 0) * 100),
              comparable.map((m) => m.benchmark * 100)
            )}
          />
        </div>
      )}

      {/* ---------- Category benchmarks & tier threshold ---------- */}
      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Category benchmarks &amp; tiering</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          Each fund's XIRR is ranked against its own category benchmark, not against other funds — normalizes for how long a fund has been compounding.
        </div>
        <div className="deck">
          {MF_CATEGORIES.map((c) => (
            <div className="deck-card" key={c.key}>
              <h4>{c.label}</h4>
              <div className="fields">
                <div className="in-wrap">
                  <label>Benchmark %/yr</label>
                  <NumberInput className="in" step={0.5} value={benchmarks[c.key]} onCommit={(n) => mf.updateBenchmark(c.key, n)} />
                </div>
              </div>
            </div>
          ))}
          <div className="deck-card">
            <h4>Tier threshold</h4>
            <div className="fields">
              <div className="in-wrap">
                <label>± percentage points</label>
                <NumberInput className="in" step={0.5} min={0.5} value={tierThresholdPct} onCommit={mf.setTierThresholdPct} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)' }}>
          <span className="tag ok">Accumulate</span> ahead of benchmark by ≥{tierThresholdPct}pp
          <span className="tag warn">Maintain</span> within ±{tierThresholdPct}pp
          <span className="tag bad">Reduce</span> behind by ≥{tierThresholdPct}pp
        </div>
      </div>

      {/* ---------- Projection engine ---------- */}
      <div className="card card-pad">
        <div className="panel-h">
          <span className="panel-t">Projection · flat vs step-up SIP</span>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
          Three scenarios from today's tracked corpus: same monthly SIP throughout, +10%/yr step-up, +20%/yr step-up.
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="in-wrap">
            <label>Starting corpus · ₹L</label>
            <NumberInput className="in" step={1} value={effectiveStartLakhs} onCommit={setProjStartOverride} />
          </div>
          <div className="in-wrap">
            <label>Monthly SIP · ₹</label>
            <NumberInput className="in" step={500} value={projMonthly} onCommit={setProjMonthly} />
          </div>
          <div className="in-wrap">
            <label>Assumed return %/yr</label>
            <NumberInput className="in" step={0.5} value={Math.round(effectiveReturnPct * 1000) / 10} onCommit={(n) => setProjReturnOverride(n)} />
          </div>
        </div>
        <div className="in-wrap" style={{ maxWidth: 220, marginBottom: 16 }}>
          <label>Horizon · years</label>
          <NumberInput className="in" step={1} min={1} max={40} value={projYears} onCommit={setProjYears} />
        </div>

        {projLabels.length > 1 && (
          <ApexChartComponent
            height={320}
            dep={'mfproj' + themeKey + effectiveStartLakhs + projMonthly + effectiveReturnPct + projYears}
            build={CHARTS.mfProjection(
              projLabels,
              yearlyFlat.map((p) => p.balance),
              yearlyStep10.map((p) => p.balance),
              yearlyStep20.map((p) => p.balance)
            )}
          />
        )}

        <div className="grid-3" style={{ marginTop: 16 }}>
          <div className="calc">
            <div className="calc-l">Flat SIP · {projYears}y</div>
            <div className="calc-v">{fmtL(finalFlat)}</div>
          </div>
          <div className="calc hl">
            <div className="calc-l">+10%/yr step-up</div>
            <div className="calc-v">{fmtL(finalStep10)}</div>
          </div>
          <div className="calc">
            <div className="calc-l">+20%/yr step-up</div>
            <div className="calc-v">{fmtL(finalStep20)}</div>
          </div>
        </div>
        <div className="panel-cap" style={{ marginLeft: 0, marginTop: 12 }}>
          Return assumption defaults to your blended XIRR ({fmtPct(totals.blendedXirr)}) once you've logged transactions — edit it above to stress-test a different rate.
        </div>
      </div>

      {/* ---------- Add fund modal ---------- */}
      {showAddFund && (
        <div className="modal-overlay" onClick={() => setShowAddFund(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><Save size={18} /> Add fund</div>
              <button className="modal-close" onClick={() => setShowAddFund(false)}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Fund name</label>
              <input className="form-input" type="text" placeholder="e.g., Parag Parikh Flexi Cap" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value as MFCategory)}>
                {MF_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Plan</label>
              <select className="form-input" value={newPlan} onChange={(e) => setNewPlan(e.target.value as MFPlan)}>
                <option value="direct">Direct</option>
                <option value="regular">Regular</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Current value (₹)</label>
              <input
                className="form-input"
                type="number"
                step={100}
                value={newValue || ''}
                onChange={(e) => setNewValue(Number(e.target.value) || 0)}
              />
            </div>

            <div className="banner warn" style={{ fontSize: 12 }}>
              <AlertTriangle size={14} /> Add purchase/redemption transactions next so XIRR has real cash flows to work from.
            </div>

            <div className="modal-actions">
              <button className="btn-snapshot secondary" onClick={() => setShowAddFund(false)}>Cancel</button>
              <button className="btn-snapshot" onClick={handleAddFund}><Save size={16} /> Add fund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
