import { Fragment, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CloudUpload,
  FileUp,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';
import type { CASParseResult, MFCategory, MFFundMetrics, MFPlan, MFTxnType } from '../../types';
import { useMutualFunds } from '../../hooks/useMutualFunds';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';
import { NumberInput } from '../NumberInput';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MF_CATEGORIES, MF_CATEGORY_COLOR, MF_CATEGORY_LABEL, MF_TXN_TYPE_LABEL } from '../../utils/mfCategories';
import { projectScenarios, yearlyPoints } from '../../utils/mfProjections';
import { buildCASReviewRows, cleanFundDisplayName, mergeCasResults, type CASImportSelection, type CASReviewRow, type CASSourceFile } from '../../utils/mfCasImport';
import { groupFundsByScheme, type FundGroup } from '../../utils/mfAnalysis';
import { computeHealthScore } from '../../utils/mfHealthScore';
import { LTCG_EXEMPTION_LAKHS, LTCG_RATE } from '../../utils/taxModel';
import { parseCASStatement } from '../../services/api';
import { pushCloudState } from '../../services/cloudSync';

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

// The Category benchmarks card only shows an editable %/yr input for these —
// the equity buckets the user actively tunes. Other categories (ELSS, Index,
// Hybrid, Debt, International) still exist as real fund categories (CAS
// import can guess any of them from a scheme name) and still use their
// DEFAULT_MF_BENCHMARKS value for tiering — they're just not surfaced here to
// edit.
const BENCHMARK_EDITABLE_CATEGORIES = new Set<MFCategory>(['largeCap', 'flexiCap', 'midCap', 'smallCap']);

type SortColumn = 'name' | 'plan' | 'invested' | 'currentValue' | 'gain' | 'xirr' | 'benchmark' | 'tier';
type SortDirection = 'asc' | 'desc';

const SORT_COLUMNS: Array<{ key: SortColumn; label: string; align?: 'left' }> = [
  { key: 'name', label: 'Fund', align: 'left' },
  { key: 'plan', label: 'Plan' },
  { key: 'invested', label: 'Invested' },
  { key: 'currentValue', label: 'Current' },
  { key: 'gain', label: 'Gain' },
  { key: 'xirr', label: 'XIRR' },
  { key: 'benchmark', label: 'Benchmark' },
  { key: 'tier', label: 'Tier' }
];

function sortValue(m: MFFundMetrics, column: SortColumn): number | string {
  switch (column) {
    case 'name':
      return m.fund.name.toLowerCase();
    case 'plan':
      return m.fund.plan;
    case 'invested':
      return m.invested;
    case 'currentValue':
      return m.fund.currentValue;
    case 'gain':
      return m.gain;
    case 'xirr':
      return m.xirr ?? -Infinity;
    case 'benchmark':
      return m.benchmark;
    case 'tier':
      return m.tier ?? 0;
  }
}

// Per-file progress for a multi-PDF CAS parse — keyed by file name so the UI
// can show each upload's own state instead of one generic spinner. Files are
// sent to the parse endpoint concurrently (see handleCasParse); a failure in
// one file is isolated to its own row and doesn't block the others from
// still being merged/reconciled once everything settles.
interface CasFileStatus {
  state: 'queued' | 'parsing' | 'done' | 'failed';
  error?: string;
}

function groupSortValue(g: FundGroup, column: SortColumn): number | string {
  const first = g.members[0];
  switch (column) {
    case 'name':
      return first.fund.name.toLowerCase();
    case 'plan':
      return first.fund.plan;
    case 'invested':
      return g.invested;
    case 'currentValue':
      return g.currentValue;
    case 'gain':
      return g.gain;
    case 'xirr':
      return g.combined.xirr ?? -Infinity;
    case 'benchmark':
      return g.combined.benchmark;
    case 'tier':
      return g.combined.tier ?? 0;
  }
}

export function MutualFundsTab({ mfCurrentSynced, mfPrincipalSynced, onSyncToPlan, themeKey }: MutualFundsTabProps) {
  const mf = useMutualFunds();
  const { funds, metrics, totals, benchmarks, tierThresholdPct } = mf;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---------- Sortable table ----------
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Redeemed/fully-switched-out holdings are kept for history (their cash
  // flows still feed blended XIRR) but shown separately — mixing them into
  // the active table misrepresents "what you currently hold" (see: a
  // Regular-plan fund fully switched to its Direct twin still showing up as
  // an apparently-live row otherwise).
  const activeMetrics = useMemo(() => metrics.filter((m) => !m.closed), [metrics]);
  const closedMetrics = useMemo(() => metrics.filter((m) => m.closed), [metrics]);

  const groupMetrics = (list: MFFundMetrics[]): FundGroup[] => groupFundsByScheme(list, benchmarks, tierThresholdPct);

  const sortGroups = (groups: FundGroup[]) => {
    if (!sortColumn) return groups;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...groups].sort((a, b) => {
      const va = groupSortValue(a, sortColumn);
      const vb = groupSortValue(b, sortColumn);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  };

  const activeGroups = useMemo(() => groupMetrics(activeMetrics), [activeMetrics]);
  const closedGroups = useMemo(() => groupMetrics(closedMetrics), [closedMetrics]);
  const sortedActiveGroups = useMemo(() => sortGroups(activeGroups), [activeGroups, sortColumn, sortDirection]);
  const sortedClosedGroups = useMemo(() => sortGroups(closedGroups), [closedGroups, sortColumn, sortDirection]);
  const [showRedeemed, setShowRedeemed] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // ---------- Cloud backup status (shown after an import) ----------
  const [backupStatus, setBackupStatus] = useState<'idle' | 'syncing' | 'done' | 'failed'>('idle');

  const backupToCloud = async () => {
    setBackupStatus('syncing');
    try {
      await pushCloudState();
      setBackupStatus('done');
    } catch {
      setBackupStatus('failed');
    }
  };

  // ---------- CAS import ----------
  const [showCasImport, setShowCasImport] = useState(false);
  const [casFiles, setCasFiles] = useState<File[]>([]);
  const [casPassword, setCasPassword] = useState('');
  const [casLoading, setCasLoading] = useState(false);
  const [casError, setCasError] = useState<string | null>(null);
  const [casParsed, setCasParsed] = useState<CASParseResult | null>(null);
  const [casRows, setCasRows] = useState<CASReviewRow[]>([]);
  const [casFileStatus, setCasFileStatus] = useState<Record<string, CasFileStatus>>({});
  const casFileInputRef = useRef<HTMLInputElement>(null);

  const openCasImport = () => {
    setCasFiles([]);
    setCasPassword('');
    setCasError(null);
    setCasParsed(null);
    setCasRows([]);
    setCasFileStatus({});
    setShowCasImport(true);
  };

  const closeCasImport = () => setShowCasImport(false);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  // Keys casFileStatus/casFiles by position so two same-named files (e.g. both
  // called "CAS.pdf" from different folders) never collide on one status row.
  const casFileKey = (file: File, index: number) => `${index}:${file.name}`;

  const handleCasParse = async () => {
    if (casFiles.length === 0) {
      setCasError('Choose at least one CAS statement PDF.');
      return;
    }
    setCasLoading(true);
    setCasError(null);
    setCasFileStatus(Object.fromEntries(casFiles.map((f, i) => [casFileKey(f, i), { state: 'parsing' as const }])));

    // Every file is parsed concurrently rather than one-by-one — with 2-3
    // PDFs (the common case) this turns total wait time from "sum of every
    // file's parse time" into "the slowest single file". allSettled (not
    // Promise.all) means one bad password or corrupt PDF only fails its own
    // row; every other file that parsed fine still gets merged/reconciled.
    const results = await Promise.allSettled(
      casFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        const parsed = await parseCASStatement(base64, casPassword);
        return { parsed, fileName: file.name } satisfies CASSourceFile;
      })
    );

    const sources: CASSourceFile[] = [];
    const statusUpdate: Record<string, CasFileStatus> = {};
    let anySucceeded = false;
    results.forEach((result, i) => {
      const key = casFileKey(casFiles[i], i);
      if (result.status === 'fulfilled') {
        sources.push(result.value);
        statusUpdate[key] = { state: 'done' };
        anySucceeded = true;
      } else {
        statusUpdate[key] = { state: 'failed', error: (result.reason as Error)?.message || 'Failed to parse this file.' };
      }
    });
    setCasFileStatus((prev) => ({ ...prev, ...statusUpdate }));

    if (!anySucceeded) {
      setCasError('None of the selected files could be parsed — see the errors above.');
      setCasLoading(false);
      return;
    }

    try {
      const merged = mergeCasResults(sources);
      const rows = buildCASReviewRows(merged, mf.existingCasKeys);
      setCasParsed(merged);
      setCasRows(rows);
      if (sources.length < casFiles.length) {
        setCasError(`${casFiles.length - sources.length} of ${casFiles.length} file(s) failed to parse — proceeding with the rest. See the errors above.`);
      }
    } catch (error) {
      setCasError((error as Error).message || 'Failed to merge the parsed CAS statement(s).');
    } finally {
      setCasLoading(false);
    }
  };

  const updateCasRow = (key: string, patch: Partial<CASReviewRow>) => {
    setCasRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleCasConfirm = async () => {
    if (!casParsed) return;
    const selections: Record<string, CASImportSelection> = {};
    for (const row of casRows) {
      selections[row.key] = { include: row.include, category: row.category, plan: row.plan };
    }
    const count = mf.importFromCAS(casParsed, selections);
    setShowCasImport(false);
    window.alert(`Imported ${count} fund(s) from CAS.`);
    await backupToCloud();
  };

  const handleResetAndReimport = () => {
    if (funds.length === 0) {
      openCasImport();
      return;
    }
    if (!window.confirm('Reset will delete all tracked funds and transactions (benchmarks and tier settings are kept). Continue?')) {
      return;
    }
    mf.resetPortfolio();
    setExpandedId(null);
    openCasImport();
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

  // ---------- Portfolio report ----------
  const [showReport, setShowReport] = useState(false);
  const health = useMemo(() => computeHealthScore(metrics), [metrics]);

  // Value-weighted category exposure across active holdings only — a
  // redeemed fund holding 0 units isn't part of "how is my money allocated
  // today". Real percentages only; no target/ideal range is shown since the
  // app has no target-allocation input to compare against.
  const allocationByCategory = useMemo(() => {
    const totalActive = activeMetrics.reduce((s, m) => s + m.fund.currentValue, 0);
    if (totalActive <= 0) return [];
    const byCat = new Map<MFCategory, number>();
    for (const m of activeMetrics) {
      byCat.set(m.fund.category, (byCat.get(m.fund.category) ?? 0) + m.fund.currentValue);
    }
    return MF_CATEGORIES.map((c) => ({
      category: c.key,
      label: c.label,
      color: MF_CATEGORY_COLOR[c.key],
      value: byCat.get(c.key) ?? 0,
      pct: (byCat.get(c.key) ?? 0) / totalActive
    }))
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [activeMetrics]);

  // Unrealized-gain LTCG snapshot on current active holdings, using the same
  // constants as the main FIRE plan's tax model (taxModel.ts) — but computed
  // straight from this tab's own gain figure, since this report has no access
  // to the full plan's CalculationResults/withdrawal scenarios. This is a
  // "sell everything today" estimate, not a withdrawal plan — the main plan's
  // Withdrawal tab covers phased SWP tax sequencing in more depth.
  const unrealizedGain = activeMetrics.reduce((s, m) => s + Math.max(0, m.gain), 0);
  const ltcgExemptionUsed = Math.min(unrealizedGain / 100000, LTCG_EXEMPTION_LAKHS);
  const ltcgTaxableLakhs = Math.max(0, unrealizedGain / 100000 - LTCG_EXEMPTION_LAKHS);
  const estimatedLtcgTax = ltcgTaxableLakhs * 100000 * LTCG_RATE;

  // ---------- Fund vs benchmark comparison ----------
  // A grouped vertical bar chart reads poorly here: real fund names are long
  // ("quant Small Cap Fund - Direct Plan - Growth"), so axis labels either
  // collide or get silently hidden, and two side-by-side bars per fund make
  // the reader do the subtraction themselves. A ranked list of delta-vs-
  // benchmark bars (ahead = green, behind = red) shows the actual question —
  // "is this fund beating its own category benchmark, and by how much" —
  // directly, with full fund names as normal wrapped text instead of axis
  // ticks, sorted so the biggest over/under-performers are easy to spot.
  //
  // Built from activeGroups (one entry per scheme+plan), not raw activeMetrics
  // (one per folio) — the same scheme held under two folios has two different
  // XIRRs (different purchase dates/amounts per folio), so listing folios
  // individually shows what looks like duplicate fund names with conflicting
  // numbers. Using each group's already-pooled `combined` metrics gives one
  // bar per fund, matching the Active/Redeemed tables' grouping.
  const comparable = useMemo(
    () =>
      activeGroups
        .map((g) => ({ name: g.members[0].fund.name, metrics: g.combined }))
        .filter((c) => c.metrics.xirr !== null && !c.metrics.usesAbsoluteReturn && c.metrics.deltaVsBenchmark !== null)
        .sort((a, b) => (b.metrics.deltaVsBenchmark ?? 0) - (a.metrics.deltaVsBenchmark ?? 0)),
    [activeGroups]
  );
  const maxAbsDelta = Math.max(1, ...comparable.map((c) => Math.abs((c.metrics.deltaVsBenchmark ?? 0) * 100)));

  const investedLakhs = Number((totals.invested / 100000).toFixed(2));
  const currentValueLakhs = Number((totals.currentValue / 100000).toFixed(2));
  const inSync = Math.abs(mfCurrentSynced - currentValueLakhs) < 0.01 && Math.abs(mfPrincipalSynced - investedLakhs) < 0.01;

  const renderFundRow = (m: MFFundMetrics, showTier = true) => {
    const f = m.fund;
    const expanded = expandedId === f.id;
    const tm = tierMeta(m.tier);
    return (
      <Fragment key={f.id}>
        <tr className={expanded ? 'mark' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : f.id)}>
          <td className="fund-name" style={{ textAlign: 'left', maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={f.name}>{cleanFundDisplayName(f.name)}</span>
              {m.closed && <span className="tag" style={{ flex: '0 0 auto' }} title="Fully redeemed / switched out — no units currently held">Redeemed</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {MF_CATEGORY_LABEL[f.category]}
              {f.folio && <span> · Folio {f.folio}</span>}
            </div>
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
            {showTier ? (
              <span className={'tag ' + tm.cls} title={m.tierReason}>{tm.label}</span>
            ) : (
              <span style={{ color: 'var(--text-3)' }} title="Tier is a forward-looking accumulate/maintain/reduce call — doesn't apply to a fund you no longer hold">—</span>
            )}
          </td>
          <td></td>
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
  };

  const renderFundGroup = (g: FundGroup, showTier = true) => {
    if (g.members.length === 1) return renderFundRow(g.members[0], showTier);

    const groupExpanded = expandedGroupKey === g.key;
    const first = g.members[0].fund;
    const gainPct = g.invested > 0 ? g.gain / g.invested : null;
    const anyClosed = g.members.some((m) => m.closed);
    const gtm = tierMeta(g.combined.tier);

    return (
      <Fragment key={g.key}>
        <tr className={groupExpanded ? 'mark' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpandedGroupKey(groupExpanded ? null : g.key)}>
          <td className="fund-name" style={{ textAlign: 'left', maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
              {groupExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={first.name}>{cleanFundDisplayName(first.name)}</span>
              <span className="tag" style={{ flex: '0 0 auto' }} title="Held under more than one folio — expand to see each folio separately">
                {g.members.length} folios
              </span>
              {anyClosed && <span className="tag warn" style={{ flex: '0 0 auto' }} title="At least one of these folios has been fully redeemed/switched out">Includes redeemed</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 19 }}>{MF_CATEGORY_LABEL[first.category]}</div>
          </td>
          <td>
            {first.plan === 'regular' ? (
              <span className="tag warn" title="Regular plans usually carry a higher expense ratio than the same scheme's Direct plan">Regular</span>
            ) : (
              'Direct'
            )}
          </td>
          <td>{fmtRupees(g.invested)}</td>
          <td className="k">{fmtRupees(g.currentValue)}</td>
          <td className={g.gain >= 0 ? 'text-pos' : 'text-neg'}>
            {fmtRupees(g.gain)} {gainPct !== null && <span style={{ opacity: 0.75 }}>({fmtPct(gainPct)})</span>}
          </td>
          <td className={g.combined.xirr !== null && g.combined.xirr >= 0 ? 'text-pos' : g.combined.xirr !== null ? 'text-neg' : undefined}>
            {fmtPct(g.combined.xirr)}
            {g.combined.usesAbsoluteReturn && <span style={{ opacity: 0.6 }}> *</span>}
          </td>
          <td>{(g.combined.benchmark * 100).toFixed(1)}%</td>
          <td>
            {showTier ? (
              <span className={'tag ' + gtm.cls} title={g.combined.tierReason}>{gtm.label}</span>
            ) : (
              <span style={{ color: 'var(--text-3)' }} title="Tier is a forward-looking accumulate/maintain/reduce call — doesn't apply to a fund you no longer hold">—</span>
            )}
          </td>
          <td></td>
        </tr>
        {groupExpanded && (
          <tr>
            <td colSpan={COL_COUNT} style={{ background: 'var(--surface-2)', padding: 0 }}>
              <table className="grid" style={{ width: '100%' }}>
                <tbody>{g.members.map((m) => renderFundRow(m, showTier))}</tbody>
              </table>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderSortHeader = () => (
    <thead>
      <tr>
        {SORT_COLUMNS.map((col) => (
          <th
            key={col.key}
            style={{ textAlign: col.align ?? 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSort(col.key)}
            title={`Sort by ${col.label}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'left' ? 'flex-start' : 'center' }}>
              {col.label}
              {sortColumn === col.key ? (
                <ChevronDown size={12} style={{ transform: sortDirection === 'asc' ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              ) : (
                <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />
              )}
            </span>
          </th>
        ))}
        <th></th>
      </tr>
    </thead>
  );

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
              <span className="panel-t">Funds ({activeGroups.length} active{closedGroups.length > 0 ? `, ${closedGroups.length} redeemed` : ''})</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>Per-fund XIRR, category benchmark &amp; tier</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm" onClick={openCasImport}>
              <FileUp size={12} /> Import CAS statement
            </button>
            <button className="btn btn-sm" onClick={handleResetAndReimport} title="Delete all tracked funds/transactions and re-import from a fresh CAS statement">
              <RotateCcw size={12} /> Reset &amp; re-import
            </button>
          </div>
        </div>
        {backupStatus !== 'idle' && (
          <div
            className={'banner' + (backupStatus === 'failed' ? ' bad' : backupStatus === 'done' ? ' ok' : '')}
            style={{ margin: '0 20px 12px', fontSize: 12 }}
          >
            <CloudUpload size={13} />
            {backupStatus === 'syncing' && 'Syncing to your Upstash cloud store…'}
            {backupStatus === 'done' && 'Backed up to your Upstash cloud store.'}
            {backupStatus === 'failed' && 'Cloud backup failed — your data is still saved locally.'}
          </div>
        )}

        {funds.length === 0 ? (
          <div className="empty-state" style={{ border: 'none', borderRadius: 0 }}>
            <h3>No funds tracked yet</h3>
            <p>Import a CAS statement to pull in your holdings, transactions, and valuations.</p>
          </div>
        ) : activeMetrics.length === 0 ? (
          <div className="empty-state" style={{ border: 'none', borderRadius: 0 }}>
            <h3>No active holdings</h3>
            <p>Every tracked fund has been fully redeemed or switched out — see Redeemed funds below.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="grid" style={{ width: '100%' }}>
              {renderSortHeader()}
              <tbody>{sortedActiveGroups.map((g) => renderFundGroup(g))}</tbody>
            </table>
          </div>
        )}
        {metrics.some((m) => m.usesAbsoluteReturn) && (
          <div style={{ padding: '0 20px 16px', fontSize: 11.5, color: 'var(--text-3)' }}>* Absolute return, not annualized XIRR — see the fund's row for why.</div>
        )}

        {closedMetrics.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ margin: '12px 20px' }}
              onClick={() => setShowRedeemed((v) => !v)}
            >
              {showRedeemed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Redeemed funds ({closedGroups.length})
            </button>
            {showRedeemed && (
              <div className="table-scroll" style={{ marginBottom: 12 }}>
                <table className="grid" style={{ width: '100%' }}>
                  {renderSortHeader()}
                  <tbody>{sortedClosedGroups.map((g) => renderFundGroup(g, false))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Fund vs benchmark comparison ---------- */}
      {comparable.length > 0 && (
        <div className="card card-pad">
          <div className="panel-h">
            <span className="panel-t">XIRR vs category benchmark</span>
          </div>
          <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 14 }}>
            Ranked by how far each fund's XIRR sits from its own category benchmark. Funds without a settled XIRR (too new, or still absolute-return) are excluded.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comparable.map((c) => {
              const m = c.metrics;
              const deltaPct = (m.deltaVsBenchmark ?? 0) * 100;
              const ahead = deltaPct >= 0;
              const barPct = Math.min(100, (Math.abs(deltaPct) / maxAbsDelta) * 100);
              return (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: '0 0 auto', width: 200, maxWidth: '32%', fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
                    {cleanFundDisplayName(c.name)}
                  </div>
                  <div style={{ flex: '1 1 auto', position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex' }}>
                      <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                        {!ahead && (
                          <div
                            className="text-neg"
                            style={{ width: `${barPct / 2}%`, height: 12, background: 'currentColor', opacity: 0.75, borderRadius: '3px 0 0 3px' }}
                          />
                        )}
                      </div>
                      <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start' }}>
                        {ahead && (
                          <div
                            className="text-pos"
                            style={{ width: `${barPct / 2}%`, height: 12, background: 'currentColor', opacity: 0.75, borderRadius: '0 3px 3px 0' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: '0 0 auto', width: 108, fontSize: 12, textAlign: 'right' }}>
                    <span className={ahead ? 'text-pos' : 'text-neg'}>{ahead ? '+' : ''}{deltaPct.toFixed(1)}pp</span>
                    <span style={{ color: 'var(--text-3)' }}> ({fmtPct(m.xirr)} vs {(m.benchmark * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
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
          {MF_CATEGORIES.filter((c) => BENCHMARK_EDITABLE_CATEGORIES.has(c.key)).map((c) => (
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

      {/* ---------- Portfolio report ---------- */}
      {activeMetrics.length > 0 && (
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="panel-h">
                <span className="panel-t">Portfolio report</span>
              </div>
              <div className="panel-cap" style={{ marginLeft: 0 }}>Snapshot, allocation, tax position, and top actions — built entirely from your tracked data.</div>
            </div>
            <button className="btn btn-sm" onClick={() => setShowReport((v) => !v)}>
              {showReport ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {showReport ? 'Hide report' : 'Show report'}
            </button>
          </div>

          {showReport && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Snapshot */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Snapshot</div>
                <div className="stat-grid">
                  <div className="stat">
                    <div className="stat-top"><TrendingUp size={15} /> Current value</div>
                    <div className="stat-val num">{fmtL(currentValueLakhs)}</div>
                    <div className="stat-foot">{activeGroups.length} active fund{activeGroups.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-top"><TrendingUp size={15} /> Overall gain</div>
                    <div className={'stat-val num' + (totals.gain >= 0 ? ' text-pos' : ' text-neg')}>{fmtL(Number((totals.gain / 100000).toFixed(2)))}</div>
                    <div className="stat-foot">{totals.gainPct !== null ? fmtPct(totals.gainPct) + ' absolute' : '—'}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-top"><TrendingUp size={15} /> Blended XIRR</div>
                    <div className={'stat-val num' + (totals.blendedXirr !== null && totals.blendedXirr >= 0 ? ' text-pos' : totals.blendedXirr !== null ? ' text-neg' : '')}>{fmtPct(totals.blendedXirr)}</div>
                    <div className="stat-foot">Pooled across all cash flows</div>
                  </div>
                  <div className="stat">
                    <div className="stat-top"><TrendingUp size={15} /> Health score</div>
                    <div className="stat-val num">{health.score !== null ? health.score.toFixed(0) + '/100' : '—'}</div>
                    <div className="stat-foot">{health.grade ?? 'Add active holdings to score'}</div>
                  </div>
                </div>
              </div>

              {/* Asset allocation */}
              {allocationByCategory.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Asset allocation (active holdings)</div>
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
                    {allocationByCategory.map((a) => (
                      <div key={a.category} style={{ width: `${a.pct * 100}%`, background: a.color }} title={`${a.label}: ${(a.pct * 100).toFixed(1)}%`} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {allocationByCategory.map((a) => (
                      <div key={a.category} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color, flex: '0 0 auto' }} />
                        <span style={{ color: 'var(--text-2)' }}>{a.label}</span>
                        <span className="k">{(a.pct * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fund-by-fund scorecard */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Fund-by-fund scorecard</div>
                <div className="table-scroll">
                  <table className="grid" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Fund</th>
                        <th>Current</th>
                        <th>Gain</th>
                        <th>XIRR</th>
                        <th>vs benchmark</th>
                        <th>Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeGroups.map((g) => {
                        const gtm = tierMeta(g.combined.tier);
                        const deltaPct = g.combined.deltaVsBenchmark !== null ? g.combined.deltaVsBenchmark * 100 : null;
                        return (
                          <tr key={g.key}>
                            <td className="fund-name" style={{ textAlign: 'left', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.members[0].fund.name}>
                              {cleanFundDisplayName(g.members[0].fund.name)}
                            </td>
                            <td className="k">{fmtRupees(g.currentValue)}</td>
                            <td className={g.gain >= 0 ? 'text-pos' : 'text-neg'}>{fmtRupees(g.gain)}</td>
                            <td className={g.combined.xirr !== null && g.combined.xirr >= 0 ? 'text-pos' : g.combined.xirr !== null ? 'text-neg' : undefined}>{fmtPct(g.combined.xirr)}</td>
                            <td className={deltaPct !== null && deltaPct >= 0 ? 'text-pos' : deltaPct !== null ? 'text-neg' : undefined}>
                              {deltaPct !== null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}pp` : '—'}
                            </td>
                            <td><span className={'tag ' + gtm.cls}>{gtm.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="panel-cap" style={{ marginLeft: 0, marginTop: 8 }}>
                  Expense ratio and rolling-period returns aren't shown — a CAS statement doesn't carry either, and this app doesn't call out to a paid fund-data provider that would.
                </div>
              </div>

              {/* Tax snapshot */}
              {unrealizedGain > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Tax snapshot — if sold today</div>
                  <div className="grid-3">
                    <div className="calc">
                      <div className="calc-l">Unrealized gain</div>
                      <div className="calc-v">{fmtL(Number((unrealizedGain / 100000).toFixed(2)))}</div>
                    </div>
                    <div className="calc">
                      <div className="calc-l">LTCG exemption used</div>
                      <div className="calc-v">{fmtL(Number(ltcgExemptionUsed.toFixed(2)))} / {fmtL(LTCG_EXEMPTION_LAKHS)}</div>
                    </div>
                    <div className="calc hl">
                      <div className="calc-l">Est. LTCG tax</div>
                      <div className="calc-v">{fmtL(Number((estimatedLtcgTax / 100000).toFixed(2)))}</div>
                    </div>
                  </div>
                  <div className="panel-cap" style={{ marginLeft: 0, marginTop: 8 }}>
                    Equity LTCG at {(LTCG_RATE * 100).toFixed(1)}% above the ₹{LTCG_EXEMPTION_LAKHS}L/yr exemption (Sec 112A), applied to gains only — a "sell everything now" estimate, not a phased withdrawal plan. For sequencing withdrawals across years, see the main plan's Withdrawal tab.
                  </div>
                </div>
              )}

              {/* Top actions */}
              {health.insights.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Top actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {health.insights.map((insight, i) => (
                      <div key={i} className={'banner' + (insight.tone === 'warn' ? ' warn' : ' ok')} style={{ fontSize: 12.5 }}>
                        {insight.tone === 'warn' ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                        {insight.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plain-English summary */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Summary</div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                  Across {activeGroups.length} active fund{activeGroups.length === 1 ? '' : 's'} you're tracking {fmtL(currentValueLakhs)} of current value
                  {totals.blendedXirr !== null && <> compounding at a blended {fmtPct(totals.blendedXirr)} XIRR</>}.
                  {health.grade && <> Portfolio health scores {health.grade.toLowerCase()} ({health.score?.toFixed(0)}/100)</>}
                  {allocationByCategory.length > 0 && (
                    <> — the largest allocation is {allocationByCategory[0].label} at {(allocationByCategory[0].pct * 100).toFixed(0)}% of active value.</>
                  )}
                  {' '}
                  {activeGroups.filter((g) => g.combined.tier === 3).length > 0 ? (
                    <>{activeGroups.filter((g) => g.combined.tier === 3).length} fund{activeGroups.filter((g) => g.combined.tier === 3).length === 1 ? ' is' : 's are'} tiered "Reduce" — behind its category benchmark by more than your tier threshold.</>
                  ) : (
                    'No funds are currently tiered "Reduce" against their category benchmark.'
                  )}
                  {unrealizedGain > 0 && <> Selling everything today would use {fmtL(Number(ltcgExemptionUsed.toFixed(2)))} of your ₹{LTCG_EXEMPTION_LAKHS}L LTCG exemption{estimatedLtcgTax > 0 && <> and owe an estimated {fmtL(Number((estimatedLtcgTax / 100000).toFixed(2)))} in tax</>}.</>}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- CAS import modal ---------- */}
      {showCasImport && (
        <div className="modal-overlay" onClick={closeCasImport}>
          <div className="modal" style={{ maxWidth: casParsed ? 720 : 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><FileUp size={18} /> Import CAS statement</div>
              <button className="modal-close" onClick={closeCasImport}><X size={18} /></button>
            </div>

            {!casParsed ? (
              <>
                <div className="form-group">
                  <label className="form-label">CAS statement PDF(s)</label>
                  <input
                    ref={casFileInputRef}
                    className="form-input"
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      setCasFiles(Array.from(e.target.files ?? []));
                      setCasFileStatus({});
                      setCasError(null);
                    }}
                  />
                  <div className="panel-cap" style={{ marginLeft: 0, marginTop: 6 }}>
                    Pick a combined CAMS+KFintech statement, a single-AMC statement, or several — they'll be parsed in parallel and merged automatically.
                  </div>
                </div>

                {casFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {casFiles.map((file, i) => {
                      const status = casFileStatus[casFileKey(file, i)];
                      return (
                        <div key={casFileKey(file, i)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ flex: '0 0 16px', textAlign: 'center' }}>
                            {status?.state === 'parsing' && <RefreshCw size={13} className="spin" style={{ color: 'var(--text-3)' }} />}
                            {status?.state === 'done' && <span className="text-pos">✓</span>}
                            {status?.state === 'failed' && <span className="text-neg">✕</span>}
                            {!status && <span style={{ color: 'var(--text-3)' }}>•</span>}
                          </span>
                          <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)' }} title={file.name}>
                            {file.name}
                          </span>
                          <span style={{ flex: '0 0 auto', color: status?.state === 'failed' ? 'var(--neg)' : 'var(--text-3)' }}>
                            {status?.state === 'parsing' && 'Parsing…'}
                            {status?.state === 'done' && 'Parsed'}
                            {status?.state === 'failed' && (status.error || 'Failed')}
                            {!status && 'Queued'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">PDF password (if any)</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Leave blank if the PDF isn't password-protected"
                    value={casPassword}
                    onChange={(e) => setCasPassword(e.target.value)}
                  />
                </div>

                {casError && (
                  <div className="banner bad" style={{ fontSize: 12 }}>
                    <AlertTriangle size={14} /> {casError}
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-snapshot secondary" onClick={closeCasImport}>Cancel</button>
                  <button className="btn-snapshot" onClick={handleCasParse} disabled={casLoading}>
                    {casLoading ? 'Parsing…' : 'Parse statement'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="panel-cap" style={{ marginLeft: 0, marginBottom: 10 }}>
                  Found {casRows.length} holding{casRows.length === 1 ? '' : 's'}. Review category/plan and uncheck anything you don't want tracked.
                </div>
                <div className="table-scroll" style={{ maxHeight: 360 }}>
                  <table className="grid" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th></th>
                        <th style={{ textAlign: 'left' }}>Scheme</th>
                        <th>Category</th>
                        <th>Plan</th>
                        <th>Value</th>
                        <th>Txns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {casRows.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={(e) => updateCasRow(row.key, { include: e.target.checked })}
                            />
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            {row.schemeName}
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {row.amc}{' '}
                              {row.isUpdate && <span className="tag warn">Updates existing</span>}{' '}
                              {row.closed && <span className="tag" title="No units currently held — will be tracked in the Redeemed bucket">Redeemed</span>}
                            </div>
                          </td>
                          <td>
                            <select
                              className="in"
                              style={{ width: 130 }}
                              value={row.category}
                              onChange={(e) => updateCasRow(row.key, { category: e.target.value as MFCategory })}
                            >
                              {MF_CATEGORIES.map((c) => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="in"
                              style={{ width: 100 }}
                              value={row.plan}
                              onChange={(e) => updateCasRow(row.key, { plan: e.target.value as MFPlan })}
                            >
                              <option value="direct">Direct</option>
                              <option value="regular">Regular</option>
                            </select>
                          </td>
                          <td>{fmtRupees(row.currentValue)}</td>
                          <td>{row.txnCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="modal-actions">
                  <button className="btn-snapshot secondary" onClick={closeCasImport}>Cancel</button>
                  <button className="btn-snapshot" onClick={handleCasConfirm} disabled={casRows.every((r) => !r.include)}>
                    <Save size={16} /> Import {casRows.filter((r) => r.include).length} fund(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
