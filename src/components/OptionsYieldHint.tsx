import { useEffect, useState } from 'react';
import { fetchTradingIncome, type TradingIncomeResponse } from '../services/tradingIncome';
import { ApexChartComponent } from './ApexChartComponent';
import { CHARTS } from '../utils/chartBuilders';
import { fmtRupees } from '../utils/formatters';

/**
 * Sits under the "Options income" card header (see INPUT_GROUPS in
 * InputDeck.tsx, rendered live in App.tsx's Assumptions drawer) and shows
 * what your CC/CSP wheeling strategy has ACTUALLY realized — read from
 * trade-analytics (D:\Zerodha_Reports) — next to the `optionsYieldPct` you
 * type in by hand, so you can eyeball whether 20% (or whatever you've set)
 * still matches reality and dial it in yourself.
 *
 * Scope: wheeling started April 2026, so every number here — monthly and
 * the annualized headline — only covers Apr 2026 onward (see
 * WHEELING_START_ORD in trade-analytics' lib/pnl-summary.js). There's
 * exactly ONE percentage computed directly from P&L: monthly yield (that
 * month's gross F&O pnl ÷ your portfolio value). The headline "annualized"
 * figure is DERIVED from those monthly values (averaged, then ×12) —
 * never computed separately — so there's one source of truth, not two
 * numbers that can quietly disagree.
 *
 * Purely informational: never writes back to `optionsYieldPct`, matching
 * this app's existing everything-is-a-manual-input philosophy (same as
 * CloudSyncChip, which surfaces status but never auto-syncs). Renders
 * nothing while loading, on any error, or until TA_API_TOKEN is configured
 * on both this app and zerodha-report — same "not broken, just not set up
 * yet" convention api/state.js already uses for cloud sync.
 */
export function OptionsYieldHint({
  portfolioValueLakhs,
  assumedYieldPct
}: {
  portfolioValueLakhs: number;
  assumedYieldPct: number;
}) {
  const [data, setData] = useState<TradingIncomeResponse | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTradingIncome()
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

  if (!data || !data.configured || data.error) return null;

  const months = data.monthlyFO || [];
  if (!months.length) return null;

  const portfolioRupees = portfolioValueLakhs * 100000;
  if (portfolioRupees <= 0) return null;

  // The one and only place a percentage is computed directly from P&L.
  const monthlyPct = months.map((m) => (m.pnl / portfolioRupees) * 100);
  // Everything else derives from that: average monthly %, annualized ×12.
  const avgMonthlyPct = monthlyPct.reduce((a, v) => a + v, 0) / monthlyPct.length;
  const annualizedPct = avgMonthlyPct * 12;
  const totalPnlSinceStart = months.reduce((a, m) => a + m.pnl, 0);

  const assumedPct = assumedYieldPct * 100;
  const diverges = Math.abs(annualizedPct - assumedPct) >= 5;
  const firstMonth = months[0].month;

  return (
    <div style={{ marginTop: -4, marginBottom: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}
        title={`Annualized from ${months.length} month${months.length === 1 ? '' : 's'} since ${firstMonth} (avg ${avgMonthlyPct.toFixed(2)}%/mo × 12) — cumulative gross F&O P&L so far: ${fmtRupees(totalPnlSinceStart)}, from trade-analytics as of ${data.asOf ? new Date(data.asOf).toLocaleString('en-IN') : 'last sync'}`}
      >
        <span style={{ color: diverges ? 'var(--warn, #b8860b)' : 'var(--text-3)' }}>
          Actual (annualized since {firstMonth}): {annualizedPct.toFixed(1)}%/yr (assumed {assumedPct.toFixed(1)}%)
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '1px 6px', fontSize: 10.5, flex: '0 0 auto' }}
          onClick={() => setTrendOpen((v) => !v)}
        >
          {trendOpen ? '▲ hide trend' : '▼ show trend'}
        </button>
      </div>

      {trendOpen && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 2 }}>
            Monthly yield since {firstMonth} · each bar = that month's gross F&O P&L ÷ your ₹{portfolioValueLakhs}L portfolio
          </div>
          <ApexChartComponent
            height={150}
            dep={(data.asOf || 'x') + 'mo' + months.length}
            build={CHARTS.optionsMonthlyYieldPct(months, portfolioValueLakhs, assumedYieldPct)}
          />
        </div>
      )}
    </div>
  );
}
