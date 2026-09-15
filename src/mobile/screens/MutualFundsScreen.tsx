import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileUp,
  PlusCircle,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import type { CASParseResult, MFCategory, MFFundMetrics, MFPlan, MFTxnType } from '../../types';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { useMutualFunds } from '../../hooks/useMutualFunds';
import { ApexChartComponent } from '../../components/ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MF_CATEGORIES, MF_CATEGORY_COLOR, MF_CATEGORY_LABEL, MF_TXN_TYPE_LABEL } from '../../utils/mfCategories';
import { groupFundsByScheme, type FundGroup } from '../../utils/mfAnalysis';
import { projectScenarios, yearlyPoints } from '../../utils/mfProjections';
import { buildCASReviewRows, mergeCasResults, type CASImportSelection, type CASReviewRow, type CASSourceFile } from '../../utils/mfCasImport';
import { computeHealthScore } from '../../utils/mfHealthScore';
import { LTCG_EXEMPTION_LAKHS, LTCG_RATE } from '../../utils/taxModel';
import { parseCASStatement } from '../../services/api';
import { pushCloudState } from '../../services/cloudSync';
import { MHero, MChipNeutral, MChip, MTile, MEditTile } from '../components/primitives';
import { M_HERO_TINT, M_POS, M_NEG, M_WARN } from '../mobileColors';

function fmtPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return (rate * 100).toFixed(1) + '%';
}

function tierMeta(tier: 1 | 2 | 3 | null): { label: string; color: string } {
  if (tier === 1) return { label: 'Accumulate', color: M_POS };
  if (tier === 2) return { label: 'Maintain', color: M_WARN };
  if (tier === 3) return { label: 'Reduce', color: M_NEG };
  return { label: 'Pending', color: 'var(--text-3)' };
}

// The Category benchmarks card only shows an editable %/yr input for these —
// mirrors desktop's MutualFundsTab.tsx BENCHMARK_EDITABLE_CATEGORIES exactly.
const BENCHMARK_EDITABLE_CATEGORIES = new Set<MFCategory>(['largeCap', 'flexiCap', 'midCap', 'smallCap']);

const TXN_TYPES: MFTxnType[] = ['purchase', 'redemption', 'switchIn', 'switchOut'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CasFileStatus {
  state: 'queued' | 'parsing' | 'done' | 'failed';
  error?: string;
}

interface MutualFundsScreenProps {
  planner: UseFirePlannerReturn;
}

export function MutualFundsScreen({ planner }: MutualFundsScreenProps) {
  const mf = useMutualFunds();
  const { funds, metrics, totals, benchmarks, tierThresholdPct } = mf;
  const { inputs, handleInput, runCalculation } = planner;

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedFolioId, setExpandedFolioId] = useState<string | null>(null);
  const [showRedeemed, setShowRedeemed] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // ---------- Grouping (shared with desktop via mfAnalysis.groupFundsByScheme) ----------
  const activeMetrics = useMemo(() => metrics.filter((m) => !m.closed), [metrics]);
  const closedMetrics = useMemo(() => metrics.filter((m) => m.closed), [metrics]);
  const activeGroups = useMemo(() => groupFundsByScheme(activeMetrics, benchmarks, tierThresholdPct), [activeMetrics, benchmarks, tierThresholdPct]);
  const closedGroups = useMemo(() => groupFundsByScheme(closedMetrics, benchmarks, tierThresholdPct), [closedMetrics, benchmarks, tierThresholdPct]);

  // ---------- Sync to plan — mirrors App.tsx's onSyncToPlan callback verbatim ----------
  const investedLakhs = Number((totals.invested / 100000).toFixed(2));
  const currentValueLakhs = Number((totals.currentValue / 100000).toFixed(2));
  const inSync = Math.abs(inputs.mfCurrent - currentValueLakhs) < 0.01 && Math.abs(inputs.mfPrincipal - investedLakhs) < 0.01;

  const onSyncToPlan = () => {
    handleInput('mfCurrent', currentValueLakhs);
    handleInput('mfPrincipal', investedLakhs);
    void runCalculation({ mfCurrent: currentValueLakhs, mfPrincipal: investedLakhs });
  };

  // ---------- Cloud backup status ----------
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

  const casFileKey = (file: File, index: number) => `${index}:${file.name}`;

  const handleCasParse = async () => {
    if (casFiles.length === 0) {
      setCasError('Choose at least one CAS statement PDF.');
      return;
    }
    setCasLoading(true);
    setCasError(null);
    setCasFileStatus(Object.fromEntries(casFiles.map((f, i) => [casFileKey(f, i), { state: 'parsing' as const }])));

    // Parallel Promise.allSettled parse — mirrors desktop's MutualFundsTab.tsx
    // handleCasParse verbatim: one bad password/corrupt PDF only fails its own
    // row, every other file still gets merged/reconciled.
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
    mf.importFromCAS(casParsed, selections);
    setShowCasImport(false);
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
    setExpandedKey(null);
    setExpandedFolioId(null);
    openCasImport();
  };

  // ---------- Transaction entry (one shared draft row for whichever folio is expanded) ----------
  const [txnDate, setTxnDate] = useState(today());
  const [txnType, setTxnType] = useState<MFTxnType>('purchase');
  const [txnAmount, setTxnAmount] = useState(0);

  const handleAddTxn = (fundId: string) => {
    if (txnAmount <= 0) return;
    mf.addTransaction(fundId, { date: txnDate, type: txnType, amount: txnAmount });
    setTxnAmount(0);
  };

  // ---------- Projection engine ----------
  const [projMonthly, setProjMonthly] = useState(10000);
  const [projYears, setProjYears] = useState(15);
  const defaultStartLakhs = Number((totals.currentValue / 100000).toFixed(2));
  const defaultReturnPct = totals.blendedXirr !== null ? Number((totals.blendedXirr * 100).toFixed(1)) : 12;
  const [projReturnPct, setProjReturnPct] = useState<number | null>(null);
  const effectiveReturnPct = (projReturnPct ?? defaultReturnPct) / 100;

  const scenarios = useMemo(
    () => projectScenarios(defaultStartLakhs, projMonthly / 100000, effectiveReturnPct, projYears),
    [defaultStartLakhs, projMonthly, effectiveReturnPct, projYears]
  );
  const yearlyFlat = useMemo(() => yearlyPoints(scenarios.flat), [scenarios]);
  const yearlyStep10 = useMemo(() => yearlyPoints(scenarios.step10), [scenarios]);
  const yearlyStep20 = useMemo(() => yearlyPoints(scenarios.step20), [scenarios]);
  const projLabels = useMemo(() => {
    const startYr = new Date().getFullYear();
    return yearlyFlat.map((p) => String(startYr + p.month / 12));
  }, [yearlyFlat]);
  const finalFlat = yearlyFlat[yearlyFlat.length - 1]?.balance ?? defaultStartLakhs;
  const finalStep10 = yearlyStep10[yearlyStep10.length - 1]?.balance ?? defaultStartLakhs;
  const finalStep20 = yearlyStep20[yearlyStep20.length - 1]?.balance ?? defaultStartLakhs;

  // ---------- XIRR vs benchmark ranked list — mirrors desktop's `comparable` ----------
  const comparable = useMemo(
    () =>
      activeGroups
        .map((g) => ({ name: g.members[0].fund.name, metrics: g.combined }))
        .filter((c) => c.metrics.xirr !== null && !c.metrics.usesAbsoluteReturn && c.metrics.deltaVsBenchmark !== null)
        .sort((a, b) => (b.metrics.deltaVsBenchmark ?? 0) - (a.metrics.deltaVsBenchmark ?? 0)),
    [activeGroups]
  );
  const maxAbsDelta = Math.max(1, ...comparable.map((c) => Math.abs((c.metrics.deltaVsBenchmark ?? 0) * 100)));

  // ---------- Report ----------
  const health = useMemo(() => computeHealthScore(metrics), [metrics]);
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

  const unrealizedGain = activeMetrics.reduce((s, m) => s + Math.max(0, m.gain), 0);
  const ltcgExemptionUsed = Math.min(unrealizedGain / 100000, LTCG_EXEMPTION_LAKHS);
  const ltcgTaxableLakhs = Math.max(0, unrealizedGain / 100000 - LTCG_EXEMPTION_LAKHS);
  const estimatedLtcgTax = ltcgTaxableLakhs * 100000 * LTCG_RATE;

  const gainLakhs = Number((totals.gain / 100000).toFixed(2));

  const renderFolioCard = (m: MFFundMetrics, showTier: boolean) => {
    const f = m.fund;
    const expanded = expandedFolioId === f.id;
    const tm = tierMeta(m.tier);
    return (
      <div key={f.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpandedFolioId(expanded ? null : f.id)}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="m-caption" style={{ fontSize: 11 }}>{f.folio ? `Folio ${f.folio}` : 'Folio'}</span>
          <span style={{ marginLeft: 'auto', font: '700 12px var(--font-mono)', color: m.gain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {fmtRupees(m.gain)}
          </span>
        </div>
        <div className="m-grid-2" style={{ marginTop: 8 }}>
          <MTile top="Invested" value={fmtRupees(m.invested)} />
          <MTile top="Current" value={fmtRupees(f.currentValue)} />
          <MTile top="XIRR" value={fmtPct(m.xirr) + (m.usesAbsoluteReturn ? ' *' : '')} valueColor={m.xirr !== null && m.xirr >= 0 ? 'var(--pos)' : m.xirr !== null ? 'var(--neg)' : undefined} />
          {showTier ? (
            <MTile top="Tier" value={tm.label} valueColor={tm.color} />
          ) : (
            <MTile top="Tier" value="—" foot="Not applicable — redeemed" />
          )}
        </div>
        {expanded && (
          <div style={{ marginTop: 10 }}>
            <div className="m-eyebrow">Log a transaction</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} style={{ flex: '1 1 130px', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '600 11.5px var(--font-sans)' }} />
              <select value={txnType} onChange={(e) => setTxnType(e.target.value as MFTxnType)} style={{ flex: '1 1 110px', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '600 11.5px var(--font-sans)' }}>
                {TXN_TYPES.map((t) => (
                  <option key={t} value={t}>{MF_TXN_TYPE_LABEL[t]}</option>
                ))}
              </select>
              <input type="number" value={txnAmount || ''} placeholder="Amount" onChange={(e) => setTxnAmount(Number(e.target.value))} style={{ flex: '1 1 90px', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '600 11.5px var(--font-mono)' }} />
              <button className="m-btn-secondary" style={{ padding: '8px 12px' }} onClick={() => handleAddTxn(f.id)}>
                <PlusCircle size={13} strokeWidth={1.8} />
              </button>
            </div>
            {f.transactions.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {f.transactions.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    <span style={{ color: 'var(--text-3)', minWidth: 66 }}>{t.date}</span>
                    <span style={{ color: 'var(--text-2)' }}>{MF_TXN_TYPE_LABEL[t.type]}</span>
                    <span style={{ marginLeft: 'auto', font: '600 11.5px var(--font-mono)' }}>{fmtRupees(t.amount)}</span>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer', padding: 2 }}
                      onClick={() => mf.deleteTransaction(f.id, t.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="m-caption" style={{ marginTop: 8, lineHeight: 1.4 }}>{m.tierReason}</div>
          </div>
        )}
      </div>
    );
  };

  const renderGroupCard = (g: FundGroup, showTier: boolean) => {
    const expanded = expandedKey === g.key;
    const first = g.members[0].fund;
    const gainPct = g.invested > 0 ? g.gain / g.invested : null;
    const tm = tierMeta(g.combined.tier);
    return (
      <div key={g.key} className="m-card" onClick={() => setExpandedKey(expanded ? null : g.key)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {expanded ? <ChevronDown size={14} style={{ marginTop: 2, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ marginTop: 2, flexShrink: 0 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: '650 12.5px var(--font-sans)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first.name}</div>
            <div className="m-caption" style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span>{MF_CATEGORY_LABEL[first.category]}</span>
              <span>· {first.plan === 'regular' ? 'Regular' : 'Direct'}</span>
              {g.members.length > 1 && <MChipNeutral label={`${g.members.length} folios`} />}
            </div>
          </div>
          {showTier && <MChip label={tm.label} color={tm.color} mono={false} />}
        </div>

        <div className="m-grid-2" style={{ marginTop: 10 }}>
          <MTile top="Invested" value={fmtRupees(g.invested)} />
          <MTile top="Current" value={fmtRupees(g.currentValue)} />
          <MTile top="Gain" value={fmtRupees(g.gain)} foot={gainPct !== null ? fmtPct(gainPct) : undefined} valueColor={g.gain >= 0 ? 'var(--pos)' : 'var(--neg)'} />
          <MTile
            top="XIRR vs benchmark"
            value={fmtPct(g.combined.xirr) + (g.combined.usesAbsoluteReturn ? ' *' : '')}
            foot={`benchmark ${(g.combined.benchmark * 100).toFixed(1)}%`}
            valueColor={g.combined.xirr !== null && g.combined.xirr >= 0 ? 'var(--pos)' : g.combined.xirr !== null ? 'var(--neg)' : undefined}
          />
        </div>

        {expanded && (
          <div onClick={(e) => e.stopPropagation()}>
            {g.members.map((m) => renderFolioCard(m, showTier))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="m-screen">
      <div className="m-screen-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 className="m-h1" style={{ flex: 1 }}>Mutual Funds</h1>
        <button className="m-btn-secondary" style={{ padding: '8px 10px' }} title="Import CAS statement" onClick={openCasImport}>
          <FileUp size={14} strokeWidth={1.8} />
        </button>
        <button className="m-btn-secondary" style={{ padding: '8px 10px' }} title="Reset & re-import" onClick={handleResetAndReimport}>
          <RotateCcw size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="m-stack">
        <MHero tint1={M_HERO_TINT.mf} lineColor="rgba(79,140,255,.28)">
          <div className="m-eyebrow">Current value</div>
          <div className="m-hero-metric" style={{ marginTop: 8 }}>{fmtL(currentValueLakhs)}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MChipNeutral label={`Invested ${fmtL(investedLakhs)}`} />
            <MChip label={`${gainLakhs >= 0 ? '+' : ''}${fmtL(gainLakhs)} gain`} color={gainLakhs >= 0 ? M_POS : M_NEG} />
          </div>
          <div className="m-grid-2" style={{ marginTop: 14 }}>
            <MTile top="Blended XIRR" value={fmtPct(totals.blendedXirr)} onHero />
            <MTile top="Funds" value={String(funds.length)} foot={`${activeGroups.length} active`} onHero />
          </div>
        </MHero>

        <div className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="m-eyebrow">FIRE plan sync</div>
            <div className="m-caption" style={{ marginTop: 4, lineHeight: 1.4 }}>
              Plan uses {fmtL(inputs.mfCurrent)} / {fmtL(inputs.mfPrincipal)}. Tracked: {fmtL(currentValueLakhs)} / {fmtL(investedLakhs)}.
            </div>
          </div>
          <button className="m-btn-secondary" disabled={inSync || funds.length === 0} onClick={onSyncToPlan}>
            {inSync ? 'In sync' : 'Sync'}
          </button>
        </div>

        {backupStatus !== 'idle' && (
          <div className="m-card" style={{ padding: '10px 14px', fontSize: 11.5, color: backupStatus === 'failed' ? 'var(--neg)' : backupStatus === 'done' ? 'var(--pos)' : 'var(--text-2)' }}>
            {backupStatus === 'syncing' && 'Syncing to your Upstash cloud store…'}
            {backupStatus === 'done' && 'Backed up to your Upstash cloud store.'}
            {backupStatus === 'failed' && 'Cloud backup failed — your data is still saved locally.'}
          </div>
        )}

        {funds.length === 0 ? (
          <div className="m-card">
            <div className="m-card-title">No funds tracked yet</div>
            <div className="m-caption" style={{ marginTop: 6, lineHeight: 1.4 }}>Import a CAS statement to pull in your holdings, transactions, and valuations.</div>
          </div>
        ) : (
          <>
            <div>
              <div className="m-eyebrow" style={{ marginBottom: 8 }}>Active funds ({activeGroups.length})</div>
              {activeGroups.length === 0 ? (
                <div className="m-card"><div className="m-caption">Every tracked fund has been fully redeemed — see Redeemed funds below.</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeGroups.map((g) => renderGroupCard(g, true))}
                </div>
              )}
              {metrics.some((m) => m.usesAbsoluteReturn) && (
                <div className="m-caption" style={{ marginTop: 8 }}>* Absolute return, not annualized XIRR — the holding is too new, or XIRR couldn't be solved.</div>
              )}
            </div>

            {closedGroups.length > 0 && (
              <div className="m-card">
                <button
                  type="button"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0, width: '100%' }}
                  onClick={() => setShowRedeemed((v) => !v)}
                >
                  {showRedeemed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="m-card-title">Redeemed funds ({closedGroups.length})</span>
                </button>
                {showRedeemed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {closedGroups.map((g) => renderGroupCard(g, false))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {comparable.length > 0 && (
          <div className="m-card">
            <div className="m-card-title">XIRR vs category benchmark</div>
            <div className="m-caption" style={{ marginTop: 6, marginBottom: 12, lineHeight: 1.4 }}>
              Ranked by how far each fund's XIRR sits from its own category benchmark.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comparable.map((c) => {
                const m = c.metrics;
                const deltaPct = (m.deltaVsBenchmark ?? 0) * 100;
                const ahead = deltaPct >= 0;
                const barPct = Math.min(100, (Math.abs(deltaPct) / maxAbsDelta) * 100);
                return (
                  <div key={c.name}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text)' }} title={c.name}>{c.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <div style={{ flex: 1, position: 'relative', height: 14 }}>
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                          <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                            {!ahead && <div style={{ width: `${barPct / 2}%`, height: 10, background: 'var(--neg)', opacity: 0.8, borderRadius: '3px 0 0 3px' }} />}
                          </div>
                          <div style={{ width: '50%', display: 'flex' }}>
                            {ahead && <div style={{ width: `${barPct / 2}%`, height: 10, background: 'var(--pos)', opacity: 0.8, borderRadius: '0 3px 3px 0' }} />}
                          </div>
                        </div>
                      </div>
                      <span style={{ font: '650 11px var(--font-mono)', color: ahead ? 'var(--pos)' : 'var(--neg)', flexShrink: 0 }}>
                        {ahead ? '+' : ''}{deltaPct.toFixed(1)}pp
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="m-card">
          <div className="m-card-title">Category benchmarks &amp; tiering</div>
          <div className="m-caption" style={{ marginTop: 6, marginBottom: 12, lineHeight: 1.4 }}>
            Each fund's XIRR is ranked against its own category benchmark.
          </div>
          <div className="m-grid-2">
            {MF_CATEGORIES.filter((c) => BENCHMARK_EDITABLE_CATEGORIES.has(c.key)).map((c) => (
              <MEditTile
                key={c.key}
                top={c.label}
                value={benchmarks[c.key]}
                step={0.5}
                format={(n) => `${n.toFixed(1)}%`}
                onChange={(n) => mf.updateBenchmark(c.key, n)}
              />
            ))}
            <MEditTile
              top="Tier threshold"
              value={tierThresholdPct}
              step={0.5}
              min={0.5}
              format={(n) => `±${n.toFixed(1)}pp`}
              onChange={mf.setTierThresholdPct}
            />
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-title">Projection · flat vs step-up SIP</div>
          <div className="m-caption" style={{ marginTop: 6, marginBottom: 12, lineHeight: 1.4 }}>
            From today's tracked corpus: same monthly SIP, +10%/yr step-up, +20%/yr step-up.
          </div>
          <div className="m-grid-2">
            <MEditTile top="Monthly SIP · ₹" value={projMonthly} step={500} format={(n) => fmtRupees(n)} onChange={setProjMonthly} />
            <MEditTile top="Return %/yr" value={Math.round(effectiveReturnPct * 1000) / 10} step={0.5} format={(n) => `${n.toFixed(1)}%`} onChange={(n) => setProjReturnPct(n)} />
            <MEditTile top="Horizon · yrs" value={projYears} step={1} min={1} format={(n) => String(n)} onChange={setProjYears} />
            <MTile top="Starting corpus" value={fmtL(defaultStartLakhs)} />
          </div>
          {projLabels.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <ApexChartComponent
                height={220}
                dep={'mfproj' + defaultStartLakhs + projMonthly + effectiveReturnPct + projYears}
                build={CHARTS.mfProjection(
                  projLabels,
                  yearlyFlat.map((p) => p.balance),
                  yearlyStep10.map((p) => p.balance),
                  yearlyStep20.map((p) => p.balance)
                )}
              />
            </div>
          )}
          <div className="m-grid-2-card" style={{ marginTop: 12 }}>
            <MTile top={`Flat · ${projYears}y`} value={fmtL(finalFlat)} />
            <MTile top="+10%/yr" value={fmtL(finalStep10)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <MTile top="+20%/yr step-up" value={fmtL(finalStep20)} />
          </div>
        </div>

        {activeMetrics.length > 0 && (
          <div className="m-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="m-card-title">Portfolio report</div>
                <div className="m-caption" style={{ marginTop: 4, lineHeight: 1.4 }}>Snapshot, allocation, tax position, top actions.</div>
              </div>
              <button className="m-btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setShowReport((v) => !v)}>
                {showReport ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {showReport ? 'Hide' : 'Show'}
              </button>
            </div>

            {showReport && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div className="m-eyebrow" style={{ marginBottom: 8 }}>Snapshot</div>
                  <div className="m-grid-2">
                    <MTile top="Current value" value={fmtL(currentValueLakhs)} foot={`${activeGroups.length} active fund${activeGroups.length === 1 ? '' : 's'}`} />
                    <MTile top="Overall gain" value={fmtL(gainLakhs)} valueColor={gainLakhs >= 0 ? 'var(--pos)' : 'var(--neg)'} foot={totals.gainPct !== null ? fmtPct(totals.gainPct) : undefined} />
                    <MTile top="Blended XIRR" value={fmtPct(totals.blendedXirr)} />
                    <MTile top="Health score" value={health.score !== null ? health.score.toFixed(0) + '/100' : '—'} foot={health.grade ?? undefined} />
                  </div>
                </div>

                {allocationByCategory.length > 0 && (
                  <div>
                    <div className="m-eyebrow" style={{ marginBottom: 8 }}>Asset allocation (active holdings)</div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                      {allocationByCategory.map((a) => (
                        <div key={a.category} style={{ width: `${a.pct * 100}%`, background: a.color }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                      {allocationByCategory.map((a) => (
                        <div key={a.category} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-2)' }}>{a.label}</span>
                          <span style={{ font: '650 11px var(--font-mono)' }}>{(a.pct * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="m-eyebrow" style={{ marginBottom: 8 }}>Fund-by-fund scorecard</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeGroups.map((g) => {
                      const gtm = tierMeta(g.combined.tier);
                      const deltaPct = g.combined.deltaVsBenchmark !== null ? g.combined.deltaVsBenchmark * 100 : null;
                      return (
                        <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }} title={g.members[0].fund.name}>{g.members[0].fund.name}</span>
                          <span style={{ font: '650 11px var(--font-mono)', color: g.gain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtRupees(g.gain)}</span>
                          <span style={{ font: '650 11px var(--font-mono)', color: deltaPct !== null && deltaPct >= 0 ? 'var(--pos)' : deltaPct !== null ? 'var(--neg)' : 'var(--text-3)' }}>
                            {deltaPct !== null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}pp` : '—'}
                          </span>
                          <MChip label={gtm.label} color={gtm.color} mono={false} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="m-caption" style={{ marginTop: 10, lineHeight: 1.4 }}>
                    Expense ratio and rolling-period returns aren't shown — a CAS statement doesn't carry either, and this app doesn't call out to a paid fund-data provider that would.
                  </div>
                </div>

                {unrealizedGain > 0 && (
                  <div>
                    <div className="m-eyebrow" style={{ marginBottom: 8 }}>Tax snapshot — if sold today</div>
                    <div className="m-grid-2">
                      <MTile top="Unrealized gain" value={fmtL(Number((unrealizedGain / 100000).toFixed(2)))} />
                      <MTile top="LTCG exemption used" value={`${fmtL(Number(ltcgExemptionUsed.toFixed(2)))} / ${fmtL(LTCG_EXEMPTION_LAKHS)}`} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <MTile top="Est. LTCG tax" value={fmtL(Number((estimatedLtcgTax / 100000).toFixed(2)))} />
                    </div>
                    <div className="m-caption" style={{ marginTop: 8, lineHeight: 1.4 }}>
                      Equity LTCG at {(LTCG_RATE * 100).toFixed(1)}% above the ₹{LTCG_EXEMPTION_LAKHS}L/yr exemption (Sec 112A), on gains only — a "sell everything now" estimate, not a phased withdrawal plan.
                    </div>
                  </div>
                )}

                {health.insights.length > 0 && (
                  <div>
                    <div className="m-eyebrow" style={{ marginBottom: 8 }}>Top actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {health.insights.map((insight, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'flex-start',
                            padding: '10px 12px',
                            borderRadius: 11,
                            fontSize: 11.5,
                            lineHeight: 1.4,
                            background: insight.tone === 'warn' ? 'rgba(217,138,35,.1)' : 'rgba(31,170,107,.1)',
                            border: '1px solid ' + (insight.tone === 'warn' ? 'rgba(217,138,35,.3)' : 'rgba(31,170,107,.3)'),
                            color: 'var(--text-2)'
                          }}
                        >
                          {insight.tone === 'warn' ? <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: M_WARN }} /> : <span style={{ color: M_POS, flexShrink: 0 }}>✓</span>}
                          {insight.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="m-eyebrow" style={{ marginBottom: 8 }}>Summary</div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
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
      </div>

      {showCasImport && (
        <>
          <div className="m-scrim" onClick={closeCasImport} />
          <div className="m-sheet" style={{ maxHeight: '86%' }}>
            <div className="m-sheet-header">
              <div className="m-sheet-title">Import CAS statement</div>
              <button type="button" className="m-sheet-close" onClick={closeCasImport}>
                <X size={15} strokeWidth={1.8} />
              </button>
            </div>

            {!casParsed ? (
              <>
                <div style={{ marginTop: 14 }}>
                  <label className="m-body-label" style={{ display: 'block', marginBottom: 8 }}>CAS statement PDF(s)</label>
                  <input
                    ref={casFileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      setCasFiles(Array.from(e.target.files ?? []));
                      setCasFileStatus({});
                      setCasError(null);
                    }}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                  <div className="m-caption" style={{ marginTop: 6, lineHeight: 1.4 }}>
                    Pick one or several CAS PDFs — they'll be parsed in parallel and merged automatically.
                  </div>
                </div>

                {casFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {casFiles.map((file, i) => {
                      const status = casFileStatus[casFileKey(file, i)];
                      return (
                        <div key={casFileKey(file, i)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                          <span style={{ flex: '0 0 14px', textAlign: 'center' }}>
                            {status?.state === 'parsing' && <span style={{ color: 'var(--text-3)' }}>•</span>}
                            {status?.state === 'done' && <span style={{ color: 'var(--pos)' }}>✓</span>}
                            {status?.state === 'failed' && <span style={{ color: 'var(--neg)' }}>✕</span>}
                            {!status && <span style={{ color: 'var(--text-3)' }}>•</span>}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{file.name}</span>
                          <span style={{ color: status?.state === 'failed' ? 'var(--neg)' : 'var(--text-3)' }}>
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

                <div style={{ marginTop: 14 }}>
                  <label className="m-body-label" style={{ display: 'block', marginBottom: 8 }}>PDF password (if any)</label>
                  <input
                    type="password"
                    placeholder="Leave blank if not password-protected"
                    value={casPassword}
                    onChange={(e) => setCasPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '500 12px var(--font-sans)' }}
                  />
                </div>

                {casError && (
                  <div className="m-caption" style={{ marginTop: 10, color: 'var(--neg)', lineHeight: 1.4 }}>{casError}</div>
                )}

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="m-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={closeCasImport}>Cancel</button>
                  <button className="m-btn-primary" onClick={handleCasParse} disabled={casLoading}>
                    {casLoading ? 'Parsing…' : 'Parse statement'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="m-caption" style={{ marginTop: 10, lineHeight: 1.4 }}>
                  Found {casRows.length} holding{casRows.length === 1 ? '' : 's'}. Review category/plan and uncheck anything you don't want tracked.
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                  {casRows.map((row) => (
                    <div key={row.key} className="m-card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateCasRow(row.key, { include: e.target.checked })}
                          style={{ marginTop: 3 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: '650 12px var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.schemeName}</div>
                          <div className="m-caption" style={{ marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span>{row.amc}</span>
                            {row.isUpdate && <MChipNeutral label="Updates existing" />}
                            {row.closed && <MChipNeutral label="Redeemed" />}
                          </div>
                        </div>
                        <span style={{ font: '650 11.5px var(--font-mono)', flexShrink: 0 }}>{fmtRupees(row.currentValue)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <select
                          value={row.category}
                          onChange={(e) => updateCasRow(row.key, { category: e.target.value as MFCategory })}
                          style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '600 11px var(--font-sans)' }}
                        >
                          {MF_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                        <select
                          value={row.plan}
                          onChange={(e) => updateCasRow(row.key, { plan: e.target.value as MFPlan })}
                          style={{ flex: '0 0 100px', padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)', font: '600 11px var(--font-sans)' }}
                        >
                          <option value="direct">Direct</option>
                          <option value="regular">Regular</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="m-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={closeCasImport}>Cancel</button>
                  <button className="m-btn-primary" onClick={() => void handleCasConfirm()} disabled={casRows.every((r) => !r.include)}>
                    Import {casRows.filter((r) => r.include).length} fund(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
