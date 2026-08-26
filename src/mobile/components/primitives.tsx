import type { ReactNode, CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';

/** 44x26 pill switch — README "Switch" spec, exact geometry. */
export function MSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      className={'m-switch' + (checked ? ' on' : '')}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="m-switch-knob" />
    </button>
  );
}

export function MSwitchRow({
  label,
  sub,
  checked,
  onChange
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="m-switch-row">
      <div className="m-switch-label">
        <span className="m-body-label">{label}</span>
        <span className="m-caption">{sub}</span>
      </div>
      <MSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

/** N-way segmented control — Journey sub-nav, Expenses etc. */
export function MSegmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="m-seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small tinted pill — header chips, milestone chips. */
// hex '#rrggbb' -> 'r,g,b' for building precise rgba() fills. Falls back to
// passing the color straight through (e.g. a var(--x) reference can't be
// alpha-blended this way; callers pass a literal hex for tinted chips).
function hexToRgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function MChip({
  label,
  color,
  mono = true,
  style
}: {
  label: string;
  color: string;
  mono?: boolean;
  style?: CSSProperties;
}) {
  // Spec recipe for tinted status chips (FIRE-by-year, "N.Nx of today",
  // "Date not confirmed"): background at .13 alpha, hairline border at .3 —
  // e.g. rgba(31,170,107,.13) / rgba(31,170,107,.3). Precise rgba() rather
  // than the old hex-suffix approximation (color+'33'/'55').
  const rgb = hexToRgbTriplet(color);
  const background = rgb ? `rgba(${rgb},.13)` : color;
  const border = rgb ? `rgba(${rgb},.3)` : color;
  return (
    <span
      className={mono ? 'm-chip' : 'm-chip-word'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '4px 9px',
        background,
        border: '1px solid ' + border,
        color,
        ...style
      }}
    >
      {label}
    </span>
  );
}

/** Neutral (non-tone-colored) chip — e.g. "FIRE target ₹X". */
export function MChipNeutral({ label }: { label: string }) {
  // Spec: rgba(255,255,255,.05) fill + var(--bd) hairline, mono 600/10.5 —
  // used for the "FIRE target X" style chip on hero cards. Literal white-alpha
  // fill (not a surface token) so it reads consistently over any hero tint.
  return (
    <span
      className="m-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '4px 9px',
        background: 'rgba(255,255,255,.05)',
        border: '1px solid var(--border)',
        color: 'var(--text-2)'
      }}
    >
      {label}
    </span>
  );
}

/** Hero card recipe: radius 18, gradient tint -> surface, hairline border. */
export function MHero({
  tint1,
  tint2,
  lineColor,
  children
}: {
  tint1: string;
  tint2?: string;
  lineColor?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="m-hero"
      style={
        {
          '--m-hero-tint1': tint1,
          '--m-hero-tint2': tint2 ?? 'rgba(0,0,0,0)',
          '--m-hero-line': lineColor ?? 'var(--m-accent-line)'
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/** Generic small stat tile (var(--surface-2), radius 12). */
export function MTile({
  top,
  value,
  foot,
  valueColor,
  onHero = false
}: {
  top: string;
  value: ReactNode;
  foot?: string;
  valueColor?: string;
  onHero?: boolean;
}) {
  return (
    <div className={onHero ? 'm-tile-onhero' : 'm-tile'}>
      <div className="m-tile-top">{top}</div>
      <div className="m-tile-value" style={{ marginTop: 4, color: valueColor ?? 'var(--text)' }}>
        {value}
      </div>
      {foot && <div className="m-tile-foot">{foot}</div>}
    </div>
  );
}

/** ± stepper. size 'sm' = 30px buttons (expenses/salary line items), 'lg' = 34px (hero salary card). */
export function MStepper({
  value,
  onChange,
  step,
  min = 0,
  format,
  size = 'sm'
}: {
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  format: (n: number) => string;
  size?: 'sm' | 'lg';
}) {
  const clamp = (n: number) => Math.max(min, n);
  const btnClass = size === 'lg' ? 'm-stepper-btn m-stepper-btn-lg' : 'm-stepper-btn';
  const valClass = size === 'lg' ? 'm-stepper-val m-stepper-val-lg' : 'm-stepper-val';
  const iconSize = size === 'lg' ? 16 : 14;
  return (
    <div className="m-stepper">
      <button type="button" className={btnClass} onClick={() => onChange(clamp(value - step))}>
        <Minus size={iconSize} strokeWidth={1.8} />
      </button>
      <span className={valClass}>{format(value)}</span>
      <button type="button" className={btnClass} onClick={() => onChange(clamp(value + step))}>
        <Plus size={iconSize} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/** Thin proportional-width bar — share bars, allocation bars, drift columns.
 *  Plain CSS, not ApexCharts: these are single-value proportional widths, not
 *  multi-point series (see plan discussion — ApexCharts is reserved for the
 *  real line/area/column charts with actual data points). */
export function MShareBar({
  segments,
  height = 6,
  radius = 999
}: {
  segments: Array<{ pct: number; color: string }>;
  height?: number;
  radius?: number;
}) {
  return (
    <div style={{ display: 'flex', height, borderRadius: radius, overflow: 'hidden', background: 'var(--surface-3)' }}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: s.pct + '%', background: s.color }} />
      ))}
    </div>
  );
}
