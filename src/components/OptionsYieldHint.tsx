import { useEffect, useState } from 'react';
import { fetchTradingIncome, type TradingIncomeResponse } from '../services/tradingIncome';
import { ApexChartComponent } from './ApexChartComponent';
import { CHARTS } from '../utils/chartBuilders';

/**
 * Sits under the "Options income" card header (see INPUT_GROUPS in
 * InputDeck.tsx, rendered live in App.tsx's Assumptions drawer) and shows
 * what your options-wheel strategy has ACTUALLY realized, read from
 * trade-analytics (D:\Zerodha_Reports), next to the `optionsYieldPct` you
 * type in by hand — so you can eyeball whether 20% (or whatever you've set)
 * still matches reality and dial it in yourself.
 *
 * Purely informational: never writes back to `optionsYieldPct`, matching
 * this app's existing everything-is-a-manual-input philosophy (same as
 * CloudSyncChip, which surfaces status but never auto-syncs). Renders
 * nothing while loading, on any error, or until TA_API_TOKEN is configured
 * on both this app and zerodha-report — same "not broken, just not set up
 * yet" convention api/state.js already uses for cloud sync.
 *
 * The one-line summary is always visible; the year-by-year and
 * month-by-month charts are tucked behind a "▼ show trend" toggle, same
 * collapsible pattern as JourneyTab's "Corpus trajectory" card, so the
 * compact Assumptions drawer doesn't default to two extra charts.
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

  if (!data || !data.configured || !data.currentFY || data.error) return null;

  const portfolioRupees = portfolioValueLakhs * 100000;
  if (portfolioRupees <= 0) return null;

  const actualPct = (data.currentFY.foNet / portfolioRupees) * 100;
  const assumedPct = assumedYieldPct * 100;
  const diverges = Math.abs(actualPct - assumedPct) >= 5;
  const hasTrend = (data.byFY && data.byFY.length > 1) || (data.monthlyFO && data.monthlyFO.length > 0);

  return (
    <div style={{ marginTop: -4, marginBottom: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}
        title={`Realized F&O net P&L this FY (₹${data.currentFY.foNet.toLocaleString('en-IN')} across ${data.currentFY.foTrades} positions) ÷ your options portfolio value, from trade-analytics as of ${data.asOf ? new Date(data.asOf).toLocaleString('en-IN') : 'last sync'}`}
      >
        <span style={{ color: diverges ? 'var(--warn, #b8860b)' : 'var(--text-3)' }}>
          Actual {data.currentFY.fy}: {actualPct.toFixed(1)}%/yr (assumed {assumedPct.toFixed(1)}%)
        </span>
        {hasTrend && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '1px 6px', fontSize: 10.5, flex: '0 0 auto' }}
            onClick={() => setTrendOpen((v) => !v)}
          >
            {trendOpen ? '▲ hide trend' : '▼ show trend'}
          </button>
        )}
      </div>

      {trendOpen && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.byFY && data.byFY.length > 1 && (
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 2 }}>
                Year-by-year actual yield · today's ₹{portfolioValueLakhs}L portfolio applied to every past year (not what your capital actually was back then)
              </div>
              <ApexChartComponent
                height={150}
                dep={(data.asOf || 'x') + 'fy'}
                build={CHARTS.optionsYieldByFY(data.byFY, portfolioValueLakhs, assumedYieldPct)}
              />
            </div>
          )}
          {data.monthlyFO && data.monthlyFO.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 2 }}>
                {data.currentFY.fy} by month · gross F&O P&L, by contract expiry month
              </div>
              <ApexChartComponent
                height={150}
                dep={(data.asOf || 'x') + 'mo'}
                build={CHARTS.optionsMonthlyFO(data.monthlyFO)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
