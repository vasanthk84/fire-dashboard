import type { ChangeEvent } from 'react';
import type { ApexOptions } from 'apexcharts';
import { Activity, Archive, BarChart2, CheckCircle, Download, Trash2, Upload, Wallet } from 'lucide-react';
import { ApexChartComponent } from '../ApexChartComponent';
import type { Snapshot } from '../../types';
import { fmtL } from '../../utils/formatters';

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
    onDelete
  } = props;

  const selected = selectedSnapshots
    .map((id) => snapshots.find((snapshot) => snapshot.modelId === id))
    .filter((snapshot): snapshot is Snapshot => Boolean(snapshot))
    .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());

  const progressionSeries = [
    {
      name: 'Actual Total Wealth',
      data: selected.map((snapshot) => snapshot.results.currentWealth)
    },
    {
      name: 'FIRE Target',
      data: selected.map((snapshot) => snapshot.results.fireNumber)
    }
  ];

  const progressionOptions: ApexOptions = {
    chart: { height: 350, toolbar: { show: true } },
    xaxis: {
      categories: selected.map((snapshot) => new Date(snapshot.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
      labels: { style: { colors: '#94a3b8', fontSize: '11px' }, rotate: -45 }
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8' }, formatter: (value) => fmtL(Number(value)) }
    },
    colors: ['#10b981', '#f59e0b'],
    stroke: { width: [4, 2], curve: 'smooth' },
    legend: { position: 'top', labels: { colors: '#94a3b8' } },
    tooltip: { theme: 'dark', y: { formatter: (value) => fmtL(Number(value)) } },
    grid: { borderColor: '#334155', strokeDashArray: 4 }
  };

  return (
    <div>
      <div className="snapshot-section">
        <div className="snapshot-header">
          <div className="snapshot-title"><Activity size={18} /> Current Model</div>
        </div>

        <div className="current-model-card">
          <div className="model-summary">
            <div className="summary-item">
              <span className="summary-label">Total Wealth</span>
              <span className="summary-value">{fmtL(currentWealthLakhs)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">FIRE Target</span>
              <span className="summary-value" style={{ color: 'var(--accent-orange)' }}>{fmtL(fireNumberLakhs)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Progress</span>
              <span className="summary-value" style={{ color: 'var(--accent-purple)' }}>{progressToFire.toFixed(1)}%</span>
            </div>
          </div>

          <div className="snapshot-actions">
            <button className="btn-snapshot" onClick={onSaveOpen}>Save Snapshot</button>
            <button className="btn-snapshot secondary" onClick={onExport}><Download size={16} /> Export All ({snapshots.length})</button>
            <label className="btn-snapshot secondary file-label">
              <Upload size={16} /> Import
              <input type="file" accept=".json" onChange={onImport} hidden />
            </label>
          </div>
        </div>
      </div>

      <div className="snapshot-section">
        <div className="snapshot-header">
          <div className="snapshot-title"><Archive size={18} /> Saved Snapshots ({snapshots.length})</div>
          {snapshots.length > 0 && (
            <button className="btn-snapshot danger" onClick={onClearAll}><Trash2 size={16} /> Clear All</button>
          )}
        </div>

        {snapshots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📸</div>
            <h3>No Snapshots Yet</h3>
            <p>Save your current financial state to track progress over time</p>
          </div>
        ) : (
          <div className="snapshot-list">
            {snapshots.map((snapshot, index) => {
              const prev = snapshots[index + 1];
              const wealthChange = prev ? ((snapshot.results.currentWealth - prev.results.currentWealth) / prev.results.currentWealth) * 100 : 0;
              const isSelected = selectedSnapshots.includes(snapshot.modelId);

              return (
                <div key={snapshot.modelId} className={`snapshot-item ${isSelected ? 'selected' : ''}`} onClick={() => onToggleSelection(snapshot.modelId)}>
                  <div className="snapshot-info">
                    <div className="snapshot-label">
                      {isSelected && <CheckCircle size={16} />}
                      {snapshot.label}
                    </div>
                    <div className="snapshot-date">{new Date(snapshot.snapshotDate).toLocaleString()}</div>
                    <div className="snapshot-metrics">
                      <div className="metric"><Wallet size={14} /> <span className="metric-value">{fmtL(snapshot.results.currentWealth)}</span></div>
                      {prev && <div className={`change-indicator ${wealthChange > 0 ? 'positive' : wealthChange < 0 ? 'negative' : 'neutral'}`}>{wealthChange > 0 ? '↑' : wealthChange < 0 ? '↓' : '='} {Math.abs(wealthChange).toFixed(1)}%</div>}
                      <div className="metric">FIRE: <span className="metric-value">{fmtL(snapshot.results.fireNumber)}</span></div>
                    </div>
                  </div>
                  <div className="snapshot-item-actions" onClick={(event) => event.stopPropagation()}>
                    <button className="btn-icon" onClick={() => onLoad(snapshot.modelId)} title="Load this snapshot"><Upload size={16} /></button>
                    <button className="btn-icon danger" onClick={() => onDelete(snapshot.modelId)} title="Delete snapshot"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length >= 2 && (
        <div className="snapshot-section">
          <div className="snapshot-header">
            <div className="snapshot-title"><BarChart2 size={18} /> Comparison Analysis</div>
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <div className="chart-title" style={{ color: 'var(--accent-green)' }}>Wealth Progression Over Time</div>
            </div>
            <div className="chart-wrapper">
              <ApexChartComponent type="line" series={progressionSeries} options={progressionOptions} />
            </div>
          </div>

          <div className="comparison-grid">
            {selected.map((snapshot, index) => {
              const previous = selected[index - 1];
              const monthsElapsed = previous ? Math.round((new Date(snapshot.snapshotDate).getTime() - new Date(previous.snapshotDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
              const wealthChange = previous ? snapshot.results.currentWealth - previous.results.currentWealth : 0;
              const wealthChangePct = previous ? (wealthChange / previous.results.currentWealth) * 100 : 0;

              return (
                <div key={snapshot.modelId} className="comparison-card">
                  <div className="comparison-header">{snapshot.label}</div>
                  <div className="comparison-wealth">{fmtL(snapshot.results.currentWealth)}</div>
                  {previous && (
                    <div className={wealthChangePct >= 0 ? 'text-green' : 'text-red'}>
                      {wealthChangePct >= 0 ? '↑' : '↓'} {fmtL(Math.abs(wealthChange))} ({Math.abs(wealthChangePct).toFixed(1)}%) over {monthsElapsed}m
                    </div>
                  )}
                  <div className="asset-breakdown">
                    <div><span>MF:</span><strong>{fmtL(snapshot.assets.mfCurrent)}</strong></div>
                    <div><span>Stocks:</span><strong>{fmtL(snapshot.assets.stocksIndia)}</strong></div>
                    <div><span>EPF:</span><strong>{fmtL(snapshot.assets.epfCurrent)}</strong></div>
                    <div><span>Bonds:</span><strong>{fmtL(snapshot.assets.bondsInitial)}</strong></div>
                  </div>
                  {snapshot.notes && <div className="snapshot-note">"{snapshot.notes}"</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
