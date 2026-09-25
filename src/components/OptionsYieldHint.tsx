import { useEffect, useState } from 'react';
import { fetchTradingIncome, type TradingIncomeResponse } from '../services/tradingIncome';

/**
 * Sits under the "Options income" card header (see INPUT_GROUPS in
 * InputDeck.tsx) and shows what your options-wheel strategy has ACTUALLY
 * realized this FY, read from trade-analytics (D:\Zerodha_Reports), next to
 * the `optionsYieldPct` you type in by hand — so you can eyeball whether 20%
 * (or whatever you've set) still matches reality and dial it in yourself.
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

  return (
    <div
      style={{
        fontSize: 11.5,
        color: diverges ? 'var(--warn, #b8860b)' : 'var(--text-3)',
        marginTop: -4,
        marginBottom: 8
      }}
      title={`Realized F&O net P&L this FY (₹${data.currentFY.foNet.toLocaleString('en-IN')} across ${data.currentFY.foTrades} positions) ÷ your options portfolio value, from trade-analytics as of ${data.asOf ? new Date(data.asOf).toLocaleString('en-IN') : 'last sync'}`}
    >
      Actual {data.currentFY.fy}: {actualPct.toFixed(1)}%/yr (assumed {assumedPct.toFixed(1)}%)
    </div>
  );
}
