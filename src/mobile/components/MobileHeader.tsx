import { Archive, BookOpen, Moon, Sun } from 'lucide-react';
import { fmtL } from '../../utils/formatters';

type Theme = 'dark' | 'light' | 'paper';

interface MobileHeaderProps {
  theme: Theme;
  onCycleTheme: () => void;
  snapshotCount: number;
  onOpenSnapshots: () => void;
  wealthLakhs: number;
  targetLakhs: number;
  progressPct: number;
}

const THEME_ICON: Record<Theme, typeof Moon> = { dark: Moon, light: Sun, paper: BookOpen };
const THEME_LABEL: Record<Theme, string> = { dark: 'Dark theme', light: 'Light theme', paper: 'Paper theme' };

export function MobileHeader({
  theme,
  onCycleTheme,
  snapshotCount,
  onOpenSnapshots,
  wealthLakhs,
  targetLakhs,
  progressPct
}: MobileHeaderProps) {
  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="m-header">
      <div className="m-header-row1">
        <div className="m-logo">F</div>
        <div className="m-title-block">
          <span className="m-title">FIRE Planner</span>
          <span className="m-subtitle">Plan 2026 · returning-NRI</span>
        </div>
        <div className="m-header-actions">
          <button type="button" className="m-icon-btn" title={THEME_LABEL[theme]} onClick={onCycleTheme}>
            <ThemeIcon size={16} strokeWidth={1.6} />
          </button>
          <button type="button" className="m-icon-btn" title="Snapshots" onClick={onOpenSnapshots}>
            <Archive size={16} strokeWidth={1.6} />
            <span className="m-badge">{snapshotCount}</span>
          </button>
        </div>
      </div>

      <div className="m-kpi-strip">
        <div className="m-kpi-cell">
          <div className="m-kpi-eyebrow">Wealth</div>
          <div className="m-kpi-value">{fmtL(wealthLakhs)}</div>
        </div>
        <div className="m-kpi-cell">
          <div className="m-kpi-eyebrow">Target</div>
          <div className="m-kpi-value">{fmtL(targetLakhs)}</div>
        </div>
        <div className="m-kpi-cell">
          <div className="m-kpi-eyebrow">Progress</div>
          <div className="m-kpi-value" style={{ color: 'var(--pos)' }}>{progressPct.toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}
