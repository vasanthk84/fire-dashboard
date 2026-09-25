import { useEffect, useState } from 'react';
import { fetchOptionsCapital, type OptionsCapitalResponse } from '../services/optionsCapital';

/**
 * Sits alongside OptionsYieldHint under the "Options income" card header and
 * shows what's ACTUALLY deployed in open CC/CSP wheel cycles right now —
 * read from oi-analyzer (D:\oi-analyzer) — next to the `optionsPortfolioValue`
 * you type in by hand. Same "Use actual" manual-apply pattern as
 * OptionsYieldHint: never writes back on its own, only on an explicit click
 * via the optional `onApplyActual` callback.
 *
 * Purely informational by default; renders nothing while loading, on any
 * error, or until OI_ANALYZER_TOKEN is configured on both this app and
 * oi-analyzer (see api/options-capital.js) — same "not broken, just not set
 * up yet" convention every other cross-app hint in this app uses.
 */
export function OptionsCapitalHint({
  portfolioValueLakhs,
  onApplyActual
}: {
  portfolioValueLakhs: number;
  onApplyActual?: (lakhs: number) => void;
}) {
  const [data, setData] = useState<OptionsCapitalResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOptionsCapital()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !data.configured || data.error || data.openCapitalDeployedRupees == null) return null;

  const actualLakhs = data.openCapitalDeployedRupees / 100000;
  const diverges =
    portfolioValueLakhs > 0 && Math.abs(actualLakhs - portfolioValueLakhs) / portfolioValueLakhs >= 0.1;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, marginTop: -2, marginBottom: 6, flexWrap: 'wrap' }}
      title={`Sum of capital deployed across all currently-open wheel cycles in oi-analyzer, as of ${data.asOf ? new Date(data.asOf).toLocaleString('en-IN') : 'last sync'}`}
    >
      <span style={{ color: diverges ? 'var(--warn, #b8860b)' : 'var(--text-3)' }}>
        Actual deployed: ₹{actualLakhs.toFixed(2)}L (assumed ₹{portfolioValueLakhs.toFixed(2)}L)
      </span>
      {onApplyActual && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '1px 6px', fontSize: 10.5, flex: '0 0 auto' }}
          title="Set the portfolio value assumption below to this actual deployed capital"
          onClick={() => onApplyActual(Number(actualLakhs.toFixed(2)))}
        >
          Use actual (₹{actualLakhs.toFixed(2)}L)
        </button>
      )}
    </div>
  );
}
