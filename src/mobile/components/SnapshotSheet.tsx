import { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import type { Snapshot } from '../../types';
import { fmtL } from '../../utils/formatters';
import { ApexChartComponent } from '../../components/ApexChartComponent';
import { CHARTS } from '../../utils/chartBuilders';

interface SnapshotSheetProps {
  open: boolean;
  onClose: () => void;
  snapshots: Snapshot[];
  selectedSnapshots: string[];
  toggleSnapshotSelection: (modelId: string) => void;
  saveSnapshot: () => void;
  exportSnapshots: () => void;
  fireNumberLakhs: number;
  themeKey: string;
}

function fmtMonYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function SnapshotSheet({
  open,
  onClose,
  snapshots,
  selectedSnapshots,
  toggleSnapshotSelection,
  saveSnapshot,
  exportSnapshots,
  fireNumberLakhs,
  themeKey
}: SnapshotSheetProps) {
  // Newest is index 0 (saveSnapshot unshifts); oldest is the baseline for the
  // "baseline" / "↑ N.N%" delta line.
  const baseline = snapshots[snapshots.length - 1];

  const selected = useMemo(
    () =>
      snapshots
        .filter((s) => selectedSnapshots.includes(s.modelId))
        .slice()
        .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()),
    [snapshots, selectedSnapshots]
  );

  if (!open) return null;

  return (
    <>
      <div className="m-scrim" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-header">
          <div>
            <div className="m-sheet-title">Snapshots</div>
            <div className="m-caption" style={{ marginTop: 2 }}>Compare saved versions of the plan</div>
          </div>
          <button type="button" className="m-sheet-close" onClick={onClose}>
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>

        <div className="m-sheet-actions">
          <button type="button" className="m-btn-primary" onClick={saveSnapshot}>+ Save current</button>
          <button type="button" className="m-btn-secondary" onClick={exportSnapshots}>
            <Download size={14} strokeWidth={1.8} />
            Export
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="m-empty">No snapshots yet — save one to start comparing.</div>
        ) : (
          <div className="m-snap-list">
            {snapshots.map((s) => {
              const isSelected = selectedSnapshots.includes(s.modelId);
              const isBaseline = s.modelId === baseline?.modelId;
              const deltaPct = isBaseline || !baseline || baseline.results.currentWealth === 0
                ? null
                : ((s.results.currentWealth - baseline.results.currentWealth) / baseline.results.currentWealth) * 100;

              return (
                <div
                  key={s.modelId}
                  className={'m-snap-row' + (isSelected ? ' selected' : '')}
                  onClick={() => toggleSnapshotSelection(s.modelId)}
                >
                  <div className="m-snap-line1">
                    <span className="m-body-label">{s.label}</span>
                    {s.notes && <span className="m-snap-note">· {s.notes}</span>}
                    <span className="m-row-value" style={{ marginLeft: 'auto' }}>{fmtL(s.results.currentWealth)}</span>
                  </div>
                  <div className="m-snap-line2">
                    {isBaseline || deltaPct === null ? (
                      <span className="m-caption">baseline</span>
                    ) : (
                      <span className="m-caption" style={{ color: deltaPct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                        {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
                      </span>
                    )}
                    <span className="m-caption">{fmtMonYear(s.snapshotDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected.length >= 2 && (
          <div className="m-progression-card">
            <ApexChartComponent
              height={160}
              dep={'msnap' + themeKey + selected.map((s) => s.modelId).join(',')}
              build={CHARTS.mobileSnapshotProgression(
                selected.map((s) => fmtMonYear(s.snapshotDate)),
                selected.map((s) => s.results.currentWealth),
                fireNumberLakhs
              )}
            />
          </div>
        )}
      </div>
    </>
  );
}
