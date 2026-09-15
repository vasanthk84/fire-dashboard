import { useEffect, useState, type ChangeEvent } from 'react';
import { Archive, CloudCheck, CloudOff, Download, Loader2, Play, RefreshCw, Upload, Trash2 } from 'lucide-react';
import type { Snapshot } from '../../types';
import { fmtL } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';
import { fetchCloudState, pullCloudState, pushCloudState } from '../../services/cloudSync';

interface SnapshotsTabProps {
  snapshots: Snapshot[];
  selectedSnapshots: string[];
  currentWealthLakhs: number;
  fireNumberLakhs: number;
  progressToFire: number;
  onSaveOpen: () => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearAll: () => void;
  onToggleSelection: (id: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  themeKey: string;
}

type CloudStatus = 'checking' | 'unconfigured' | 'ready';

function CloudSyncCard() {
  const [status, setStatus] = useState<CloudStatus>('checking');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<'idle' | 'saving' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCloudState()
      .then(({ configured, state }) => {
        if (cancelled) return;
        setStatus(configured ? 'ready' : 'unconfigured');
        setUpdatedAt(configured ? (state?.updatedAt ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) setStatus('unconfigured');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setBusy('saving');
    setError(null);
    setSaved(false);
    try {
      const { updatedAt: newUpdatedAt } = await pushCloudState();
      setUpdatedAt(newUpdatedAt);
      setStatus('ready');
      setSaved(true);
    } catch (err) {
      setError((err as Error).message || 'Failed to save to cloud.');
    } finally {
      setBusy('idle');
    }
  };

  const handleLoad = async () => {
    if (
      !window.confirm(
        'This replaces your FIRE plan, mutual fund portfolio, and snapshots on this device with the cloud copy. Continue?'
      )
    ) {
      return;
    }
    setBusy('loading');
    setError(null);
    try {
      await pullCloudState();
      window.location.reload(); // every hook here reads localStorage only on mount
    } catch (err) {
      setError((err as Error).message || 'Failed to load from cloud.');
      setBusy('idle');
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="panel-h">
            <span className="panel-t">Cloud sync</span>
          </div>
          <div className="panel-cap" style={{ marginLeft: 0 }}>
            {status === 'checking' && 'Checking…'}
            {status === 'unconfigured' &&
              'Not set up — your plan, MF portfolio, and snapshots stay on this device/browser only. See .env.example for a free setup.'}
            {status === 'ready' &&
              (updatedAt ? `Last synced ${new Date(updatedAt).toLocaleString()}` : 'Set up — no backup saved yet.')}
          </div>
        </div>

        {status === 'ready' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={busy !== 'idle'}>
              {busy === 'saving' ? <Loader2 size={12} className="spin" /> : <CloudCheck size={12} />} Save to cloud
            </button>
            <button className="btn btn-sm" onClick={handleLoad} disabled={busy !== 'idle'}>
              {busy === 'loading' ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Load from cloud
            </button>
          </div>
        )}
        {status === 'unconfigured' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
            <CloudOff size={14} /> Not configured
          </div>
        )}
      </div>

      {saved && (
        <div
          className="banner warn"
          style={{ marginTop: 12, borderColor: 'var(--pos)', background: 'color-mix(in srgb, var(--pos) 10%, transparent)', color: 'var(--pos)' }}
        >
          <CloudCheck size={14} /> Saved to cloud.
        </div>
      )}
      {error && (
        <div className="banner warn" style={{ marginTop: 12, fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function SnapshotsTab(props: SnapshotsTabProps) {
  const {
    snapshots,
    selectedSnapshots,
    currentWealthLakhs,
    fireNumberLakhs,
    progressToFire,
    onSaveOpen,
    onExport,
    onImport,
    onClearAll,
    onToggleSelection,
    onLoad,
    onDelete,
    themeKey
  } = props;

  // Selected snapshots sorted chronologically
  const sel = selectedSnapshots
    .map((id) => snapshots.find((s) => s.modelId === id))
    .filter((s): s is Snapshot => Boolean(s))
    .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());

  return (
    <div className="stack">
      <div className="grid-3">
        <div className="calc">
          <div className="calc-l">Total wealth</div>
          <div className="calc-v">{fmtL(currentWealthLakhs)}</div>
        </div>
        <div className="calc">
          <div className="calc-l">FIRE target</div>
          <div className="calc-v">{fireNumberLakhs > 0 ? fmtL(fireNumberLakhs) : '—'}</div>
        </div>
        <div className="calc">
          <div className="calc-l">Progress</div>
          <div className="calc-v">{progressToFire.toFixed(0)}%</div>
        </div>
      </div>

      <CloudSyncCard />

      <div className="card card-pad">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Saved snapshots ({snapshots.length})</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>Select two or more to compare progress</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm btn-primary" onClick={onSaveOpen}>
              <Play size={12} /> Save
            </button>
            <button className="btn btn-sm" onClick={onExport} disabled={snapshots.length === 0}>
              <Download size={12} /> Export
            </button>
            <label className="btn btn-sm" style={{ margin: 0 }}>
              <Upload size={12} /> Import
              <input type="file" accept=".json" onChange={onImport} hidden />
            </label>
            {snapshots.length > 0 && (
              <button className="btn btn-sm btn-ghost text-neg" onClick={onClearAll}>
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="empty">
            <Archive size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <h3>No Snapshots Saved</h3>
            <p>Save your current assumptions to build a comparison history.</p>
          </div>
        ) : (
          <div className="snap-list">
            {snapshots
              .slice()
              .reverse()
              .map((s, i, arr) => {
                const prev = arr[i + 1];
                const chg = prev ? ((s.results.currentWealth - prev.results.currentWealth) / prev.results.currentWealth) * 100 : 0;
                const on = selectedSnapshots.includes(s.modelId);

                return (
                  <div
                    key={s.modelId}
                    className={'snap-item' + (on ? ' sel' : '')}
                    onClick={() => onToggleSelection(s.modelId)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="snap-label">
                        {s.label}
                        {s.notes && (
                          <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                            · {s.notes}
                          </span>
                        )}
                      </div>
                      <div className="snap-meta">
                        <span className="num">{fmtL(s.results.currentWealth)}</span>
                        {prev && (
                          <span className={chg >= 0 ? 'delta-up' : 'delta-dn'}>
                            {chg >= 0 ? '↑' : '↓'} {Math.abs(chg).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={(e) => e.stopPropagation()}>
                      <div className="num" style={{ color: 'var(--text-3)', fontSize: 12 }}>
                        {new Date(s.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ padding: 4 }}
                        onClick={() => onLoad(s.modelId)}
                        title="Load this snapshot"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-neg"
                        style={{ padding: 4 }}
                        onClick={() => onDelete(s.modelId)}
                        title="Delete snapshot"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {sel.length >= 2 && (
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div className="panel-h">
                <span className="panel-t">Wealth progression</span>
              </div>
              <div className="panel-cap" style={{ marginLeft: 0 }}>Selected snapshots vs FIRE target</div>
            </div>
          </div>
          <ApexChartComponent
            height={280}
            dep={'prog' + themeKey + selectedSnapshots.join()}
            build={CHARTS.progression(sel)}
          />
          <div className="grid-3" style={{ marginTop: 16 }}>
            {sel.map((s, i) => {
              const prev = sel[i - 1];
              const d = prev ? s.results.currentWealth - prev.results.currentWealth : 0;
              const dp = prev ? (d / prev.results.currentWealth) * 100 : 0;
              return (
                <div className="card card-pad" key={s.modelId} style={{ background: 'var(--surface-2)' }}>
                  <div className="eyebrow">{s.label}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px' }}>
                    {fmtL(s.results.currentWealth)}
                  </div>
                  {prev && (
                    <div className={dp >= 0 ? 'delta-up' : 'delta-dn'} style={{ fontSize: 12 }}>
                      {dp >= 0 ? '↑' : '↓'} {fmtL(Math.abs(d))} ({Math.abs(dp).toFixed(1)}%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
